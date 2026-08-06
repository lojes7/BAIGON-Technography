import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { Plus, Search } from "lucide-react";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { getMajorList, getOccupationFamilyList, getOccupationList, getAbilityList } from "../services/dict";
import type { MajorItem, OccupationFamilyItem, OccupationItem, AbilityItem } from "../types/api";
import { PageHeader, Btn, Card } from "../components/ui";
import CreateTaxNodeModal from "../components/overlay/CreateTaxNodeModal";
import TaxTreeNode from "../components/overlay/TaxTreeNode";
import type { TaxNode } from "../types";

function TaxonomyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "reviewer";
  const [search, setSearch] = useState("");
  const [createNodeOpen, setCreateNodeOpen] = useState(false);
  const [tree, setTree] = useState<TaxNode[]>([]);
  const [majorList, setMajorList] = useState<MajorItem[]>([]);
  const [familyList, setFamilyList] = useState<OccupationFamilyItem[]>([]);
  const [jobList, setJobList] = useState<OccupationItem[]>([]);
  const [abilityList, setAbilityList] = useState<AbilityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = () => {
    setLoading(true);
    Promise.allSettled([
      getMajorList(1, 100),
      getOccupationFamilyList(1, 100),
      getOccupationList(1, 100),
      getAbilityList(1, 100),
    ]).then(([mS, fS, jS, aS]) => {
      // 每个请求独立：成功的更新state，失败的保持旧数据
      const majors = mS.status === "fulfilled" ? mS.value.data.items : majorList;
      const families = fS.status === "fulfilled" ? fS.value.data.items : familyList;
      const jobs = jS.status === "fulfilled" ? jS.value.data.items : jobList;
      const abilities = aS.status === "fulfilled" ? aS.value.data.items : abilityList;

      if (mS.status === "fulfilled") setMajorList(majors);
      if (fS.status === "fulfilled") setFamilyList(families);
      if (jS.status === "fulfilled") setJobList(jobs);
      if (aS.status === "fulfilled") setAbilityList(abilities);

      // 构建四级树：产业 → 岗位族 → 岗位 → 能力
      setTree(majors.map(m => ({
        id: String(m.id), label: m.name, type: "产业",
        children: families.map(f => ({
          id: String(f.id), label: f.name, type: "岗位族",
          children: jobs
            .filter(j => j.occupation_family?.id === f.id)
            .map(j => ({
              id: String(j.id), label: j.name, type: "岗位",
              skills: j.abilities_count,
              children: [],
            })),
        })),
      })));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  // 统计（直接使用 API 返回的列表长度，而非递归计算 tree）
  const majorCount = majorList.length;
  const familyCount = familyList.length;
  const jobCount = jobList.length;
  const abilityCount = abilityList.length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dictionaries"), t("nav.taxonomy")]}
        title={t("page.taxonomy.title")}
        description={t("page.taxonomy.desc")}
        actions={canEdit ? <Btn icon={Plus} size="sm" onClick={() => setCreateNodeOpen(true)}>{t("page.taxonomy.createNode")}</Btn> : undefined}
      />
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: t("page.taxonomy.industry"), value: String(majorCount), color: T.ink },
          { label: t("page.taxonomy.jobFamily"), value: String(familyCount), color: T.teal },
          { label: t("page.taxonomy.standardJob"), value: String(jobCount), color: T.stable },
          { label: t("page.taxonomy.skillType"), value: String(abilityCount), color: T.emerging },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg p-4 flex items-center gap-3" style={{ border: `1px solid ${T.border}` }}>
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-[13px]" style={{ color: T.info }}>{s.label}</span>
            <span className="font-mono text-[18px] font-medium ml-auto" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white max-w-64" style={{ border: `1px solid ${T.border}` }}>
          <Search size={13} style={{ color: T.info }} />
          <input className="bg-transparent text-[13px] flex-1 outline-none" placeholder={t("page.taxonomy.searchNode")} style={{ color: T.ink }} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Btn variant="ghost" size="sm">{t("page.taxonomy.expandAll")}</Btn>
        <Btn variant="ghost" size="sm">{t("page.taxonomy.collapseAll")}</Btn>
      </div>
      <Card>
        <div className="py-2">
          {loading ? (
            <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>{t("common.loading")}</div>
          ) : tree.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>{t("common.noData")}</div>
          ) : (
            tree.map(node => <TaxTreeNode key={node.id} node={node} />)
          )}
        </div>
      </Card>
      {createNodeOpen && <CreateTaxNodeModal onClose={() => setCreateNodeOpen(false)} onCreated={fetchAll} majorParents={majorList.map(m => ({ id: String(m.id), name: m.name }))} familyParents={familyList.map(f => ({ id: String(f.id), name: f.name }))} occupationParents={jobList.map(j => ({ id: String(j.id), name: j.name }))} />}
    </div>
  );
}
export default TaxonomyPage;
