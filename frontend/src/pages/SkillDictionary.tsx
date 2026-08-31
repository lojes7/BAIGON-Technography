// 百工谱 — 真实规范技能词典与批量向量化进度页
import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, RefreshCw, Search, SearchX, Database } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import EmbeddingProgress from "../components/EmbeddingProgress";
import { Btn, Card, PageHeader, Pagination, MetricCard } from "../components/ui";
import T from "../constants/tokens";
import { searchCanonicalSkills } from "../services/skill-resolution";
import { getEmbeddingProgress } from "../services/occupation";
import type { CanonicalSkillItem } from "../types/api";

const PAGE_SIZE = 20;

function SkillDictionaryPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<CanonicalSkillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  /* 向量化统计（真实接口：已向量化 / 总数） */
  const [embedded, setEmbedded] = useState<number | null>(null);
  const [skillTotal, setSkillTotal] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    searchCanonicalSkills({
      page: page - 1,
      pageSize: PAGE_SIZE,
      keyword: appliedKeyword || undefined,
    })
      .then((response) => {
        if (!active) return;
        setItems(response.data.items ?? []);
        setTotal(Number(response.data.total ?? 0));
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : "规范技能加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page, appliedKeyword, refreshKey]);

  /* 向量化进度统计：加载一次 + 每 15s 轻量轮询，保证 KPI 与向量化任务同步 */
  useEffect(() => {
    let active = true;
    const fetchProgress = () => {
      getEmbeddingProgress()
        .then((res) => {
          if (!active) return;
          setEmbedded(Number(res.data.skills?.embedded ?? 0));
          setSkillTotal(Number(res.data.skills?.total ?? 0));
        })
        .catch(() => {});
    };
    fetchProgress();
    const id = setInterval(fetchProgress, 15000);
    return () => { active = false; clearInterval(id); };
  }, [refreshKey]);

  const search = () => {
    setLoading(true);
    setPage(1);
    setAppliedKeyword(keyword.trim());
    setRefreshKey((value) => value + 1);
  };
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pendingCount = embedded != null && skillTotal != null ? Math.max(0, skillTotal - embedded) : null;
  const coverage = embedded != null && skillTotal ? Math.round((embedded / skillTotal) * 100) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dictionaries"), t("nav.skillDict")]}
        title={t("page.skillDict.title")}
        description={t("page.skillDict.desc")}
      />

      {/* KPI 统计卡区（数据来自向量化进度接口） */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 主指标：深蓝渐变卡 */}
        <div className="rounded-lg p-4 flex flex-col gap-2 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #2E5FA3 0%, #1E4C8F 55%, #16386B 100%)" }}>
          <Database size={44} className="absolute -right-2 -bottom-2 opacity-15" />
          <div className="text-[13px] opacity-80">已向量化技能</div>
          <div className="text-[24px] font-mono font-medium leading-tight">
            {embedded ?? "—"}
          </div>
          <div className="text-[12px] opacity-75">可直接用于语义检索与匹配</div>
        </div>
        <MetricCard
          title="规范技能总数"
          value={skillTotal ?? "—"}
          sub="词典全量条目"
        />
        <MetricCard
          title="待向量化"
          value={pendingCount ?? "—"}
          sub={pendingCount ? "建议尽快启动向量化" : "全部处理完成"}
          severity={pendingCount ? "warning" : "normal"}
        />
        <MetricCard
          title="向量化覆盖率"
          value={coverage != null ? `${coverage}%` : "—"}
          sub="已向量化 / 总数"
          trend={{ label: "目标 100%", up: coverage != null && coverage >= 99 ? true : undefined }}
        />
      </div>

      {/* 规范技能批量向量化进度与启动按钮。 */}
      <EmbeddingProgress kind="skill" />

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex h-9 min-w-72 flex-1 items-center gap-2 rounded-md bg-white px-3"
          style={{ border: `1px solid ${T.border}` }}
        >
          <Search size={14} style={{ color: T.info }} />
          <input
            className="flex-1 bg-transparent text-[13px] outline-none"
            placeholder="按规范技能名称筛选（可选）"
            style={{ color: T.ink }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") search(); }}
          />
        </div>
        <Btn size="sm" icon={Search} onClick={search}>筛选</Btn>
        <Btn
          size="sm"
          variant="secondary"
          icon={RefreshCw}
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setRefreshKey((value) => value + 1);
          }}
        >
          刷新列表
        </Btn>
      </div>

      <Card>
        {loading ? (
          /* 加载骨架屏 */
          <div className="px-4 py-3 flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-8 h-3.5 rounded animate-pulse" style={{ background: T.cloud }} />
                <div className="h-3.5 rounded animate-pulse" style={{ background: T.cloud, width: `${38 - (i % 3) * 6}%` }} />
                <div className="flex-1" />
                <div className="w-20 h-5 rounded-full animate-pulse" style={{ background: T.cloud }} />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          /* 空态 */
          <div className="px-4 py-14 flex flex-col items-center gap-3">
            <SearchX size={34} style={{ color: T.border }} />
            <div className="text-[13px]" style={{ color: T.info }}>
              {appliedKeyword ? `未找到与「${appliedKeyword}」相关的规范技能` : "暂无规范技能"}
            </div>
            {appliedKeyword && (
              <Btn size="sm" variant="secondary" onClick={() => {
                setKeyword("");
                setAppliedKeyword("");
                setLoading(true);
                setPage(1);
                setRefreshKey((value) => value + 1);
              }}>
                清除筛选条件
              </Btn>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[13px]">
              <thead>
                <tr style={{ background: T.cloud }}>
                  {["#", "规范技能", "技能 ID", "向量化状态"].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: T.info }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((skill, i) => (
                  <tr key={skill.id} className="transition-colors hover:bg-gray-50" style={{ borderTop: `1px solid ${T.cloud}` }}>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* 技能实体标识：绿色圆点（与能力图谱颜色编码一致） */}
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: "#10B981", border: "1px solid #059669" }} />
                        <span className="font-medium" style={{ color: T.ink }}>{skill.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{skill.id}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                        style={skill.is_embed
                          ? { background: "#D1FAE5", color: "#065F46" }
                          : { background: "#FEF3C7", color: "#92400E" }}
                      >
                        {skill.is_embed
                          ? <CheckCircle2 size={11} style={{ color: "#059669" }} />
                          : <CircleDashed size={11} style={{ color: "#D97706" }} />}
                        {skill.is_embed ? "已向量化" : "待向量化"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {total > 0 && (
        <Pagination page={page} totalPages={pageCount} onChange={setPage} total={total} />
      )}
    </div>
  );
}

export default SkillDictionaryPage;
