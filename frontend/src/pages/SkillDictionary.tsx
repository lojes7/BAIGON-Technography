// 百工谱 — 真实规范技能词典与批量向量化进度页
import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import EmbeddingProgress from "../components/EmbeddingProgress";
import { Btn, Card, PageHeader, Pagination } from "../components/ui";
import T from "../constants/tokens";
import { searchCanonicalSkills } from "../services/skill-resolution";
import type { CanonicalSkillItem } from "../types/api";

const PAGE_SIZE = 50;

function SkillDictionaryPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<CanonicalSkillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const search = () => {
    setLoading(true);
    setPage(1);
    setAppliedKeyword(keyword.trim());
    setRefreshKey((value) => value + 1);
  };
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dictionaries"), t("nav.skillDict")]}
        title={t("page.skillDict.title")}
        description={t("page.skillDict.desc")}
        actions={<span className="font-mono text-[13px]" style={{ color: T.info }}>共 {total} 项</span>}
      />

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
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-[13px]" style={{ color: T.info }}>
            <Loader2 size={14} className="animate-spin" />加载中…
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>暂无规范技能</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[13px]">
              <thead>
                <tr style={{ background: T.cloud }}>
                  {['规范技能', '技能 ID', '向量化状态'].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-left text-[12px] font-medium" style={{ color: T.info }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((skill) => (
                  <tr key={skill.id} className="transition-colors hover:bg-gray-50" style={{ borderTop: `1px solid ${T.cloud}` }}>
                    <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{skill.name}</td>
                    <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.info }}>{skill.id}</td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded px-2 py-0.5 text-[11px]"
                        style={{
                          background: skill.is_embed ? `${T.emerging}14` : `${T.pending}14`,
                          color: skill.is_embed ? T.emerging : T.pending,
                        }}
                      >
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

      {total > PAGE_SIZE && (
        <Pagination page={page} totalPages={pageCount} onChange={setPage} total={total} />
      )}
    </div>
  );
}

export default SkillDictionaryPage;
