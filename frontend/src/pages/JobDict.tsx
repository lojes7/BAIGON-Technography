// 百工谱 — 职业大典页（职业大类 → 职业中类 → 职业小类 → 职业 四级懒加载树）
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import P from "../constants/palette";
import { PageHeader, Card } from "../components/ui";
import CatalogTree, { type CatalogNodeData } from "../components/CatalogTree";
import CatalogSearch, { type CatalogSearchLevel } from "../components/CatalogSearch";
import EmbeddingProgress from "../components/EmbeddingProgress";
import {
  getOccupationMajorCategories, getOccupationSubCategories,
  getOccupationCategories, getOccupations,
} from "../services/occupation";
import type { CatalogItem } from "../types/api";

function JobDictPage() {
  const { t } = useTranslation();
  const [roots, setRoots] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchActive, setSearchActive] = useState(false);

  useEffect(() => {
    getOccupationMajorCategories({ page: 0, pageSize: 100 })
      .then((res) => setRoots(res.data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 懒加载：depth 0 大类→中类；depth 1 中类→小类；depth 2 小类→职业
  const loadChildren = async (node: CatalogNodeData, depth: number): Promise<CatalogNodeData[]> => {
    if (depth === 0) {
      const res = await getOccupationSubCategories({ page: 0, pageSize: 100, occupationMajorCategoryId: node.id });
      return res.data.items ?? [];
    }
    if (depth === 1) {
      const res = await getOccupationCategories({ page: 0, pageSize: 100, occupationSubCategoryId: node.id });
      return res.data.items ?? [];
    }
    const res = await getOccupations({ page: 0, pageSize: 100, occupationCategoryId: node.id });
    return res.data.items ?? [];
  };

  // 级联搜索层级定义：职业大类（顶层）→ 中类 → 小类 → 职业
  const searchLevels: CatalogSearchLevel[] = [
    {
      label: "职业大类",
      parents: [],
      search: async (_parentId, kw) => (await getOccupationMajorCategories({ page: 0, pageSize: 100, keyword: kw })).data.items ?? [],
    },
    {
      label: "职业中类",
      parents: [
        { label: "职业大类", load: async () => (await getOccupationMajorCategories({ page: 0, pageSize: 100 })).data.items ?? [] },
      ],
      search: async (parentId, kw) => (await getOccupationSubCategories({ page: 0, pageSize: 100, occupationMajorCategoryId: parentId, keyword: kw })).data.items ?? [],
    },
    {
      label: "职业小类",
      parents: [
        { label: "职业大类", load: async () => (await getOccupationMajorCategories({ page: 0, pageSize: 100 })).data.items ?? [] },
        { label: "职业中类", load: async (pid) => (await getOccupationSubCategories({ page: 0, pageSize: 100, occupationMajorCategoryId: pid! })).data.items ?? [] },
      ],
      search: async (parentId, kw) => (await getOccupationCategories({ page: 0, pageSize: 100, occupationSubCategoryId: parentId, keyword: kw })).data.items ?? [],
    },
    {
      label: "职业",
      parents: [
        { label: "职业大类", load: async () => (await getOccupationMajorCategories({ page: 0, pageSize: 100 })).data.items ?? [] },
        { label: "职业中类", load: async (pid) => (await getOccupationSubCategories({ page: 0, pageSize: 100, occupationMajorCategoryId: pid! })).data.items ?? [] },
        { label: "职业小类", load: async (pid) => (await getOccupationCategories({ page: 0, pageSize: 100, occupationSubCategoryId: pid! })).data.items ?? [] },
      ],
      search: async (parentId, kw) => (await getOccupations({ page: 0, pageSize: 100, occupationCategoryId: parentId, keyword: kw })).data.items ?? [],
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dictionaries"), t("nav.jobDict")]}
        title={t("page.jobDict.title")}
        description={t("page.jobDict.desc")}
      />

      {/* 职业名称向量化进度 + 按钮 */}
      <EmbeddingProgress kind="occupation" />

      {/* 级联搜索：选层级 + 级联选父级 + 关键词；清空恢复树 */}
      <CatalogSearch
        levels={searchLevels}
        onActiveChange={setSearchActive}
      />

      {!searchActive && (
        <Card>
          {loading ? (
            <div className="px-4 py-8 text-center text-[13px]" style={{ color: P.muted }}>{t("common.loading")}</div>
          ) : (
            <CatalogTree roots={roots} loadChildren={loadChildren} maxDepth={4} leafEmbedBadge />
          )}
        </Card>
      )}
    </div>
  );
}

export default JobDictPage;
