import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import T from "../constants/tokens";
import { getDataSourceList, approveReview, rejectReview } from "../services/engineer";
import type { DataSourceItem } from "../types/api";
import { PageHeader, Card, MetricCard } from "../components/ui";
import { toast } from "sonner";

function DataSourcesPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [sources, setSources] = useState<DataSourceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  const fetchSources = () => {
    setLoading(true);
    getDataSourceList({
      page: page - 1, // 新版 page 从 0 开始
      pageSize: 20,
      reviewStatus: filterStatus || undefined,
    })
      .then((res) => { setSources(res.data.items ?? []); setTotal(res.data.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSources(); }, [page, filterStatus]);

  const handleApprove = async (id: string) => {
    try {
      await approveReview(id);
      toast.success("已通过复核");
      fetchSources();
    } catch (err) { toast.error((err as Error).message); }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectReview(id);
      toast.success("已拒绝");
      fetchSources();
    } catch (err) { toast.error((err as Error).message); }
  };

  const reviewStatusLabel = (status: string) => {
    switch (status) {
      case "PASSED": return "已通过";
      case "REJECTED": return "已拒绝";
      default: return "待审核";
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dataCenter"), t("nav.dataSources")]}
        title={t("page.dataSources.title")}
        description={t("page.dataSources.desc")}
      />

      <div className="grid grid-cols-3 gap-4">
        <MetricCard title="岗位总数" value={loading ? "—" : String(total)} />
        <MetricCard title="来源平台数" value={loading ? "—" : String(new Set(sources.map(s => s.source_platform)).size)} />
        <MetricCard title="待审核" value={loading ? "—" : String(sources.filter(s => s.review_status === "PENDING").length)} />
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-2">
        {["", "PENDING", "PASSED", "REJECTED"].map(s => (
          <button key={s}
            className="px-3 py-1.5 rounded-md text-[13px] transition-colors"
            style={{
              border: `1px solid ${filterStatus === s ? T.teal : T.border}`,
              color: filterStatus === s ? "white" : T.ink,
              background: filterStatus === s ? T.teal : "white",
            }}
            onClick={() => { setFilterStatus(s); setPage(1); }}
          >{s === "" ? "全部" : reviewStatusLabel(s)}</button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
        ) : sources.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>暂无数据源记录</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: T.cloud }}>
                {["ID", "岗位名称", "公司名称", "来源平台", "发布时间", "获取时间", "审核状态", "操作"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{s.id}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{s.job_name || "—"}</td>
                  <td className="px-4 py-3" style={{ color: T.ink }}>{s.company_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded" style={{ background: T.cloud, color: T.info }}>{s.source_platform}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{s.publish_date?.slice(0, 10) || "—"}</td>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{s.created_at?.slice(0, 10) || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[12px]"
                      style={{
                        background: s.review_status === "PASSED" ? "#dcfce7" : s.review_status === "REJECTED" ? "#fee2e2" : "#fef9c3",
                        color: s.review_status === "PASSED" ? "#166534" : s.review_status === "REJECTED" ? "#991b1b" : "#854d0e",
                      }}>
                      {reviewStatusLabel(s.review_status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="text-[12px] font-medium flex items-center gap-1" style={{ color: T.teal }}
                        onClick={() => nav(`/data-sources?detail=${s.id}`)}>
                        <Eye size={12} />详情
                      </button>
                      {s.review_status === "PENDING" && (
                        <>
                          <button className="text-[12px] font-medium" style={{ color: "#166534" }}
                            onClick={() => handleApprove(s.id)}>通过</button>
                          <button className="text-[12px] font-medium" style={{ color: "#991b1b" }}
                            onClick={() => handleReject(s.id)}>拒绝</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {total > 20 && (
        <div className="flex items-center justify-center gap-2 text-[13px]">
          <button className="px-3 py-1.5 rounded-md disabled:opacity-30" style={{ border: `1px solid ${T.border}`, color: T.ink }}
            disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span style={{ color: T.info }}>{page} / {Math.ceil(total / 20)}</span>
          <button className="px-3 py-1.5 rounded-md disabled:opacity-30" style={{ border: `1px solid ${T.border}`, color: T.ink }}
            disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      )}
    </div>
  );
}

export default DataSourcesPage;
