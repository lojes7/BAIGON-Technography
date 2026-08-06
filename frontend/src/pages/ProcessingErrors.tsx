import { useTranslation } from "react-i18next";
import { Eye, RefreshCw } from "lucide-react";
import T from "../constants/tokens";
import { PageHeader, Btn, Card } from "../components/ui";

function ProcessingErrorsPage() {
  const { t } = useTranslation();
  const errors = [
    { id: "ERR-0128", task: "EXT-202607-012", record: "数据开发工程师", type: "解析失败", msg: "JSON响应格式不符合schema，缺少required字段 skills[]", retries: 2, time: "2026-07-06 11:34" },
    { id: "ERR-0127", task: "EXT-202607-012", record: "自然语言处理工程师", type: "解析失败", msg: "模型响应超时（30s），未收到有效内容", retries: 2, time: "2026-07-06 11:21" },
    { id: "ERR-0124", task: "EXT-202607-011", record: "嵌入式AI工程师", type: "归一失败", msg: "候选标准岗位相似度均低于0.5，无法自动归一", retries: 0, time: "2026-07-05 14:08" },
    { id: "ERR-0119", task: "EXT-202607-010", record: "AI芯片工程师", type: "字段缺失", msg: "原始记录缺少description字段，文本长度不足以进行能力抽取", retries: 0, time: "2026-07-04 09:15" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader breadcrumbs={[t("nav.aiProcessing"), t("nav.processingErrors")]} title={t("page.processingErrors.title")} description={t("page.processingErrors.desc")} />
      <div className="flex flex-col gap-3">
        {errors.map((e, i) => (
          <Card key={i}>
            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[12px]" style={{ color: T.info }}>{e.id}</span>
                  <span className="font-medium text-[14px]" style={{ color: T.ink }}>{e.record}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: T.risk, background: `${T.risk}18` }}>{e.type}</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] flex-shrink-0" style={{ color: T.info }}>
                  <span>{t("page.processingErrors.task")}<span className="font-mono font-medium" style={{ color: T.teal }}>{e.task}</span></span><span>{e.time}</span>
                </div>
              </div>
              <div className="mt-3 px-3 py-2 rounded text-[12px] font-mono leading-relaxed" style={{ background: T.cloud, color: T.ink }}>{e.msg}</div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[12px]" style={{ color: T.info }}>{t("page.processingErrors.retried", { n: e.retries })}</span>
                <div className="flex gap-2">
                  <Btn variant="ghost" size="sm" icon={Eye}>{t("page.processingErrors.viewSource")}</Btn>
                  <Btn variant="secondary" size="sm" icon={RefreshCw}>{t("common.retry")}</Btn>
                  <Btn variant="ghost" size="sm">{t("page.processingErrors.ignore")}</Btn>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default ProcessingErrorsPage;
