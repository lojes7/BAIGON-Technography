# 百工谱 — 智联招聘爬虫（真实爬虫，迁移自 demo：~/code/baigon/backend/app/data）
# 用 DrissionPage（Chromium 自动化）监听 search/positions 网络接口拿 JSON，
# 每次任务所有分类从第 1 页开始；跨分类去重（seen_numbers.txt）保证不重复——
# 去重集合即增量基线，集合里没有的就是新职位。
# CDP 后台 fetch 详情页兜底描述、技能标签抽取。
# 本模块只负责"爬"，产出 list[JobRecord]，由 CrawlerServicer 统一落库。

import json
import logging
import os
import re
import threading
import time
from dataclasses import dataclass
from datetime import datetime

from DrissionPage import ChromiumOptions, ChromiumPage
from DrissionPage.errors import PageDisconnectedError

from src.config.city_mapping import get_province
from src.config.job_list import JOB_LIST_URL
from src.utils.snowflake import snowflake

logger = logging.getLogger(__name__)


@dataclass
class JobRecord:
    """一条待入库的岗位记录（字段与 job_sources 列一一对应）"""

    publish_date: datetime | None  # 解析失败为 None（诚实标记未知，不伪造当前时间）
    source_platform: str
    source_url: str
    city: str | None
    tags: str | None
    major: str | None
    nature: str | None
    salary: str | None
    job_name: str
    company_name: str | None
    company_size: str | None
    province: str | None
    education: str | None
    experience: str | None
    job_description: str | None
    # 每条记录唯一 trace_id（爬虫生成时赋雪花 ID，job_sources 有 trace_id 唯一索引）
    trace_id: int | None = None


# 列表数据中可能的职位描述字段名（demo 迁移）
DESC_FIELDS: list[str] = [
    "jobDesc", "description", "jobDescription", "describe",
    "jobContent", "jobDetail", "positionDetail",
    "recruitInfo", "jobInfo", "recruitPostInfo",
]

# 多级翻页选择器（demo 迁移）
PAGER_SELECTORS: list[str] = [
    "css:.soupager a:last-of-type",
    "css:.pagination__next",
    "css:.pagination .next",
    "tag:a@@text()=下一页",
    "tag:a@@class=next",
]

_FETCH_TIMEOUT: int = 6  # CDP 详情页 fetch 超时

_PUBLISH_DATE_FORMATS: list[str] = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S",
]

def _parse_publish_date(date_str: str) -> datetime | None:
    """解析发布日期字符串，失败返回 None

    诚实标记：解析不了就存 NULL（表示未知），绝不伪造当前时间。
    """
    if not date_str:
        return None
    for fmt in _PUBLISH_DATE_FORMATS:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


class ZhaopinCrawler:
    """智联招聘爬虫 — 按岗位分类爬取职位数据

    每次任务所有分类都从第 1 页开始；跨分类去重（seen_numbers.txt，
    job_number 稳定 ID）保证已爬职位不重复——去重集合即增量基线，
    集合里没有的就是新职位。
    产出 list[JobRecord]，由 CrawlerServicer 统一落库。
    停止：传入 stop_event，设置后立即中断（不等当前页爬完）。
    """

    def __init__(self, data_dir: str) -> None:
        os.makedirs(data_dir, exist_ok=True)
        self._dedup_file = os.path.join(data_dir, "seen_numbers.txt")
        self._seen: set[str] = set()

    # ============================================================
    # 去重管理
    # ============================================================
    def _load_seen(self) -> None:
        if os.path.exists(self._dedup_file):
            with open(self._dedup_file, "r", encoding="utf-8") as f:
                self._seen = {line.strip() for line in f if line.strip()}

    def _mark_seen(self, number: str) -> None:
        self._seen.add(number)
        with open(self._dedup_file, "a", encoding="utf-8") as f:
            f.write(f"{number}\n")

    # ============================================================
    # 浏览器管理
    # ============================================================
    @staticmethod
    def _create_browser() -> ChromiumPage:
        co = ChromiumOptions()
        co.set_argument("--no-sandbox")
        co.set_argument("--disable-dev-shm-usage")
        co.set_argument("--headless=new")
        co.set_argument("--disable-blink-features=AutomationControlled")
        co.set_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
        return ChromiumPage(co)

    # ============================================================
    # CDP 后台抓取详情页
    # ============================================================
    @staticmethod
    def _fetch_work_desc(dp: ChromiumPage, job_detail_url: str, stop_event: threading.Event | None) -> tuple[str, str]:
        """通过 CDP 在后台 fetch 详情页 HTML，返回 (description, skill_tags)"""
        safe_url = job_detail_url.replace("\\", "\\\\").replace("'", "\\'")
        js = (
            "(async()=>{try{"
            "const c=new AbortController();"
            "setTimeout(()=>c.abort(),5000);"
            "const r=await fetch('" + safe_url + "',{signal:c.signal});"
            "const html=await r.text();"
            "const p=new DOMParser();"
            "const d=p.parseFromString(html,'text/html');"
            "let desc='';"
            "const ss=['.describtion__content','.job-detail__content',"
            "'.job-detail','.job-content','.detail-content','.position-detail',"
            "'.recruit-detail'];"
            "for(const s of ss){try{"
            "const e=d.querySelector(s);"
            "if(e){const t=(e.textContent||'').trim();if(t.length>50){desc=t;break;}}"
            "}catch(ex){}}"
            "if(!desc){"
            "const sa=['div[class*=\"describ\"]','div[class*=\"detail-content\"]'];"
            "for(const s of sa){try{"
            "const e=d.querySelector(s);"
            "if(e){const t=(e.textContent||'').trim();if(t.length>50){desc=t;break;}}"
            "}catch(ex){}}"
            "}"
            "if(!desc){"
            "const bt=(d.body&&d.body.textContent)||'';"
            "const kw=['岗位职责','任职要求','职位描述','工作内容'];"
            "for(const k of kw){"
            "const i=bt.indexOf(k);"
            "if(i>=0){desc=bt.substring(i);break;}"
            "}"
            "}"
            "const tags=[];"
            "try{"
            "const items=d.querySelectorAll('.describtion-card__skills-item');"
            "items.forEach(el=>{const t=el.textContent.trim();if(t)tags.push(t);});"
            "}catch(ex){}"
            "return JSON.stringify({d:desc,t:tags.join('|')});"
            "}catch(e){return JSON.stringify({d:'',t:''});}"
            "})()"
        )

        result: dict[str, str] = {"d": "", "t": ""}

        def _do() -> None:
            try:
                resp = dp._run_cdp("Runtime.evaluate", expression=js,
                                   awaitPromise=True, timeout=_FETCH_TIMEOUT)
                value = resp.get("result", {}).get("value", "")
                if value and isinstance(value, str):
                    parsed = json.loads(value)
                    result["d"] = parsed.get("d", "")
                    result["t"] = parsed.get("t", "")
            except Exception:
                pass

        t = threading.Thread(target=_do, daemon=True)
        t.start()
        # 立即停止：fetch 用短超时（6s），超时后检查 stop_event
        t.join(timeout=_FETCH_TIMEOUT + 2)
        if stop_event and stop_event.is_set():
            return "", ""

        desc = result["d"].strip() if result["d"] else ""
        if desc:
            desc = re.sub(r"<[^>]+>", "", desc)
            desc = re.sub(r"^\s*职位描述\s*", "", desc)
            desc = desc.strip()
        tags = result["t"] if result["t"] else ""
        return desc, tags

    # ============================================================
    # 翻页
    # ============================================================
    @staticmethod
    def _click_next_page(dp: ChromiumPage) -> bool:
        for sel in PAGER_SELECTORS:
            try:
                elem = dp.ele(sel, timeout=3)
                if elem:
                    elem.click()
                    return True
            except Exception:
                continue
        return False

    # ============================================================
    # 爬取单个分类
    # ============================================================
    def crawl_category(
        self, dp: ChromiumPage, job_name: str, job_url: str,
        pages_per_category: int, max_documents: int,
        stop_event: threading.Event | None = None,
    ) -> list[JobRecord]:
        """爬取一个岗位分类的所有职位，返回 JobRecord 列表"""
        records: list[JobRecord] = []
        entry_url = job_url.rstrip("/")
        entry_url = re.sub(r"/p\d+$", "", entry_url) + "/p2"

        dp.listen.start("search/positions")
        dp.get(entry_url)
        dp.scroll.to_bottom()
        time.sleep(3)
        try:
            dp.ele("css:.btn", timeout=3).click()
        except Exception:
            pass

        # 每次任务都从第 1 页开始
        for page in range(1, pages_per_category + 1):
            # 立即停止检查：翻页/请求前
            if stop_event and stop_event.is_set():
                logger.info("[%s] 收到停止信号，中断（已抓 %d 条）", job_name, len(records))
                break

            try:
                resp = dp.listen.wait(timeout=20)
            except Exception:
                logger.info("[%s] 监听超时，结束", job_name)
                break

            if not resp:
                logger.info("[%s] 第%d页请求被拦截(反爬可能)，结束", job_name, page)
                break

            json_data = resp.response.body
            job_list_data = json_data["data"]["list"]
            if not job_list_data:
                logger.info("[%s] 第%d页无数据，结束", job_name, page)
                break

            logger.info("[%s] 第%d页 (%d条)", job_name, page, len(job_list_data))

            for job in job_list_data:
                # 立即停止检查：每条数据前
                if stop_event and stop_event.is_set():
                    logger.info("[%s] 收到停止信号，中断（已抓 %d 条）", job_name, len(records))
                    break

                job_number = job.get("number", "")
                job_detail_url = f"https://www.zhaopin.com/jobdetail/{job_number}.html" if job_number else ""

                if job_number and self._is_duplicate(job_number):
                    continue

                work_desc = ""
                for field in DESC_FIELDS:
                    val = job.get(field, "")
                    if val and isinstance(val, str) and len(val.strip()) > 50:
                        work_desc = val.strip()
                        break
                if work_desc:
                    work_desc = re.sub(r"<[^>]+>", "", work_desc)
                    work_desc = re.sub(r"职位描述", "", work_desc).strip()

                skill_tags = ""
                if not work_desc and job_number:
                    work_desc, skill_tags = self._fetch_work_desc(dp, job_detail_url, stop_event)
                    # fetch 详情后立即停止检查
                    if stop_event and stop_event.is_set():
                        break
                if not work_desc:
                    logger.warning("[%s] 无描述: %s", job_name, job.get("name", "")[:25])

                record = JobRecord(
                    publish_date=_parse_publish_date(job.get("firstPublishTime", "")),
                    source_platform="智联招聘",
                    source_url=job_detail_url,
                    city=job.get("workCity", "") or None,
                    tags=skill_tags or None,
                    major=job.get("industryName", "") or None,
                    nature=job.get("propertyName", "") or None,
                    salary=job.get("salary60", "") or None,
                    job_name=job.get("name", ""),
                    company_name=job.get("companyName", "") or None,
                    company_size=job.get("companySize", "") or None,
                    province=get_province(job.get("workCity", "")),
                    education=job.get("education", "") or None,
                    experience=job.get("workingExp", "") or None,
                    job_description=work_desc or None,
                    # 每条记录唯一 trace_id（job_sources 有 trace_id 唯一索引）
                    trace_id=snowflake.next_id(),
                )
                records.append(record)

                if job_number:
                    self._mark_seen(job_number)

                # 单分类最大条数限制
                if len(records) >= max_documents:
                    logger.info("[%s] 达到单分类上限 %d 条，结束", job_name, max_documents)
                    break

            # 立即停止检查：翻页前
            if stop_event and stop_event.is_set():
                break
            if len(records) >= max_documents:
                break

            if page < pages_per_category:
                dp.scroll.to_bottom()
                time.sleep(4)
                if not self._click_next_page(dp):
                    break

        return records

    # ============================================================
    # 主流程：爬取指定分类列表
    # ============================================================
    def run(
        self,
        categories: list[str] | None = None,
        pages_per_category: int = 5,
        max_documents: int = 1000,
        stop_event: threading.Event | None = None,
    ) -> list[JobRecord]:
        """遍历指定分类爬取，返回全部 JobRecord

        Args:
            categories: 要爬的分类名列表，空/None 则爬全部 16 个
            pages_per_category: 每分类最大页数
            max_documents: 单分类最大条数
            stop_event: 停止信号，设置后立即中断
        """
        self._load_seen()
        logger.info("已加载 %d 条去重记录", len(self._seen))

        targets = list(categories) if categories else list(JOB_LIST_URL.keys())
        all_records: list[JobRecord] = []

        logger.info("启动浏览器...")
        dp = self._create_browser()

        try:
            for job_name in targets:
                # 立即停止检查
                if stop_event and stop_event.is_set():
                    logger.info("收到停止信号，退出")
                    break

                job_url = JOB_LIST_URL.get(job_name)
                if not job_url:
                    logger.warning("未知分类: %s，跳过", job_name)
                    continue

                logger.info("=== %s 开始爬取 ===", job_name)
                try:
                    records = self.crawl_category(
                        dp, job_name, job_url,
                        pages_per_category=pages_per_category,
                        max_documents=max_documents,
                        stop_event=stop_event,
                    )
                    all_records.extend(records)
                    logger.info("[%s] 完成，本分类 %d 条", job_name, len(records))
                except PageDisconnectedError:
                    logger.warning("[%s] 断连，重启浏览器继续", job_name)
                    dp = self._create_browser()
                except Exception as e:
                    logger.exception("[%s] 异常: %s", job_name, e)
                    dp = self._create_browser()

                # 单分类结束后立即停止检查
                if stop_event and stop_event.is_set():
                    break

        finally:
            try:
                dp.quit()
            except Exception:
                pass

        logger.info("爬取结束，共 %d 条", len(all_records))
        return all_records
