import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import T from "../constants/tokens";
import { getAiAnalyses } from "../services/reviewer";
import { getJobList } from "../services/jobs";
import { getMajorList } from "../services/dict";
import type { AiAnalysisItem } from "../types/api";
import { PageHeader, Card, StatusBadge, Pagination } from "../components/ui";

const TASK_STATUS_LABEL: Record<string, string> = {
  SUCCESS: "清洗成功",
  FAILED: "清洗失败",
  PENDING: "处理中",
};

export default function AiAnalysesPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<AiAnalysisItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // ID → 岗位名称映射
  const [jobMap, setJobMap] = useState<Map<string, string>>(new Map());

  // 加载岗位名称映射表（遍历所有专业）
  useEffect(() => {
    getMajorList(1, 100).then(res => {
      const majors = res.data.items;
      if (majors.length === 0) return;
      Promise.all(majors.map(m => getJobList(m.id, undefined, 1, 100).catch(() => null)))
        .then(results => {
          const m = new Map<string, string>();
          results.forEach(r => {
            if (r?.data?.items) r.data.items.forEach(j => m.set(String(j.job_id), j.occupation_name));
          });
          setJobMap(m);
        });
    }).catch(() => {});
  }, []);

  const fetchData = () => {
    setLoading(true);
    getAiAnalyses(page)
      .then((res) => { setItems(res.data.items); setTotal(res.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.aiProcessing"), "AI 分析记录"]}
        title="AI 分析记录"
        description="查看数据清洗流水线中 AI 解析的分析记录，追溯每条岗位数据的处理状态"
      />

      <Card>
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>暂无 AI 分析记录</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: T.cloud }}>
                {["数据来源","对应岗位","任务状态","审核状态","创建时间"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{item.data_source_id}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>
                    {jobMap.get(String(item.job_id)) || item.job_id}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] px-2 py-0.5 rounded font-medium"
                      style={{
                        color: item.task_status === "SUCCESS" ? T.emerging : item.task_status === "FAILED" ? T.risk : T.pending,
                        background: item.task_status === "SUCCESS" ? `${T.emerging}15` : item.task_status === "FAILED" ? `${T.risk}15` : `${T.pending}15`,
                      }}>
                      {TASK_STATUS_LABEL[item.task_status] || item.task_status}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={item.review_status} /></td>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{item.created_at?.slice(0, 10) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {total > 20 && (
        <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} />
      )}
    </div>
  );
}
