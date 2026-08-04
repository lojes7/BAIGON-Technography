# 百工谱 — 爬取桩实现
# TODO: 后续接入真实爬虫（httpx + beautifulsoup4 已安装），当前返回随机生成的假岗位数据

import random
from dataclasses import dataclass
from datetime import datetime, timezone

from src.utils.snowflake import snowflake

# 中文模板池：随机组合生成贴近真实场景的岗位记录
_PLATFORMS = ["拉勾", "Boss直聘", "猎聘", "智联招聘", "前程无忧"]
_CITIES = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "南京", "苏州", "西安"]
_PROVINCES = ["北京市", "上海市", "广东省", "浙江省", "四川省", "湖北省", "江苏省", "陕西省"]
_MAJORS = ["计算机科学与技术", "软件工程", "人工智能", "数据科学与大数据技术", "信息安全", "物联网工程"]
_NATURES = ["全职", "实习", "兼职"]
_EDUCATIONS = ["本科", "硕士", "博士", "大专"]
_COMPANIES = ["字节跳动", "腾讯", "阿里云", "华为", "小米", "美团", "网易", "百度"]
_COMPANY_SIZES = ["1000-9999人", "100-499人", "5000人以上", "20-99人"]
_JOB_NAMES = [
    "后端开发工程师", "前端开发工程师", "算法工程师", "数据分析师", "运维开发工程师",
    "测试开发工程师", "AI 产品经理", "机器学习工程师", "大数据开发工程师", "云原生开发工程师",
]
_EXPERIENCES = ["1-3年", "3-5年", "5-10年", "应届生", "不限"]
_SALARIES = ["15-25K", "20-35K", "25-40K", "10-15K", "30-50K"]
_TAGS_POOL = ["Java", "Go", "Python", "Kubernetes", "AI", "微服务", "分布式", "大数据", "云原生"]


@dataclass
class JobRecord:
    """一条待入库的岗位原始记录（字段与 job_sources 列一一对应）"""

    publish_date: datetime
    source_platform: str
    source_url: str
    city: str
    tags: str
    major: str
    nature: str
    salary: str
    job_name: str
    company_name: str
    company_size: str
    province: str
    education: str
    experience: str
    job_description: str


def _generate_one() -> JobRecord:
    """生成一条随机岗位记录"""
    job_name = random.choice(_JOB_NAMES)
    company = random.choice(_COMPANIES)
    # source_url 用雪花 ID 保证唯一
    source_url = f"https://stub.example.com/jobs/{snowflake.next_id()}"
    tags = "、".join(random.sample(_TAGS_POOL, k=random.randint(2, 4)))
    return JobRecord(
        publish_date=datetime.now(timezone.utc),
        source_platform=random.choice(_PLATFORMS),
        source_url=source_url,
        city=random.choice(_CITIES),
        tags=tags,
        major=random.choice(_MAJORS),
        nature=random.choice(_NATURES),
        salary=random.choice(_SALARIES),
        job_name=job_name,
        company_name=company,
        company_size=random.choice(_COMPANY_SIZES),
        province=random.choice(_PROVINCES),
        education=random.choice(_EDUCATIONS),
        experience=random.choice(_EXPERIENCES),
        job_description=(
            f"{company} 正在招聘 {job_name}，要求熟悉 {tags}，"
            f"工作地点 {random.choice(_CITIES)}，期待您的加入。"
        ),
    )


def fetch_jobs(max_documents: int = 1000) -> list[JobRecord]:
    """爬取桩：随机生成 max_documents 条岗位记录

    返回空列表视为本次爬取失败（由调用方将 clean_status 置 FAILED）。
    """
    count = min(max_documents, 1000)
    return [_generate_one() for _ in range(count)]
