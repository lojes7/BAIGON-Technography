// 百工谱 — 学科门类页（学科门类 → 专业类 → 专业 三级懒加载树）
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import P from "../constants/palette";
import { PageHeader, Card } from "../components/ui";
import CatalogTree, { type CatalogNodeData } from "../components/CatalogTree";
import CatalogSearch, { type CatalogSearchLevel } from "../components/CatalogSearch";
import EmbeddingProgress from "../components/EmbeddingProgress";
import { getDisciplineCategories, getMajorCategories, getMajors } from "../services/occupation";
import type { CatalogItem } from "../types/api";

function DisciplineCategoriesPage() {
  const { t } = useTranslation();
  const [roots, setRoots] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchActive, setSearchActive] = useState(false);

  useEffect(() => {
    getDisciplineCategories({ page: 0, pageSize: 100 })
      .then((res) => setRoots(res.data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 懒加载：depth 0 = 学科门类 → 专业类；depth 1 = 专业类 → 专业
  const loadChildren = async (node: CatalogNodeData, depth: number): Promise<CatalogNodeData[]> => {
    if (depth === 0) {
      const res = await getMajorCategories({ page: 0, pageSize: 100, disciplineCategoryId: node.id });
      return res.data.items ?? [];
    }
    const res = await getMajors({ page: 0, pageSize: 100, majorCategoryId: node.id });
    return res.data.items ?? [];
  };

    const searchLevels: CatalogSearchLevel[] = [
    {
      label: "学科门类",
      parents: [],
      search: async (_parentId, kw) => (await getDisciplineCategories({ page: 0, pageSize: 100, keyword: kw })).data.items ?? [],
    },
    {
      label: "专业类",
      parents: [{ label: "学科门类", load: async () => (await getDisciplineCategories({ page: 0, pageSize: 100 })).data.items ?? [] }],
      search: async (parentId, kw) => (await getMajorCategories({ page: 0, pageSize: 100, disciplineCategoryId: parentId, keyword: kw })).data.items ?? [],
    },
    {
      label: "专业",
      parents: [
        { label: "学科门类", load: async () => (await getDisciplineCategories({ page: 0, pageSize: 100 })).data.items ?? [] },
        { label: "专业类", load: async (pid) => (await getMajorCategories({ page: 0, pageSize: 100, disciplineCategoryId: pid! })).data.items ?? [] },
      ],
      search: async (parentId, kw) => (await getMajors({ page: 0, pageSize: 100, majorCategoryId: parentId, keyword: kw })).data.items ?? [],
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dictionaries"), t("nav.discipline")]}
        title={t("page.discipline.title")}
        description={t("page.discipline.desc")}
      />

      {/* 专业名称向量化进度 + 按钮 */}
      <EmbeddingProgress kind="major" />

      {/* 级联搜索：选层级 + 选父级 + 关键词；清空恢复树 */}
      <CatalogSearch
        levels={searchLevels}
        onActiveChange={setSearchActive}
      />

      {!searchActive && (
        <Card>
          {loading ? (
            <div className="px-4 py-8 text-center text-[13px]" style={{ color: P.muted }}>{t("common.loading")}</div>
          ) : (
            <CatalogTree roots={roots} loadChildren={loadChildren} maxDepth={3} leafEmbedBadge />
          )}
        </Card>
      )}
    </div>
  );
}

export default DisciplineCategoriesPage;
