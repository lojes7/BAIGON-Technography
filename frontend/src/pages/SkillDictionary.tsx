// 百工谱 — 真实规范技能词典与批量向量化进度页
import { useEffect, useRef, useState } from "react";
import { Eye, Loader2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import EmbeddingProgress from "../components/EmbeddingProgress";
import ConfirmDialog from "../components/overlay/ConfirmDialog";
import CanonicalSkillMultiSelect from "../components/skill/CanonicalSkillMultiSelect";
import { Btn, Card, PageHeader, Pagination } from "../components/ui";
import T from "../constants/tokens";
import {
  addCanonicalSkillRelation,
  deleteCanonicalSkillRelation,
  getCanonicalSkillDetail,
  listCanonicalSkillRelations,
  loadCanonicalSkillPage,
  lookupCanonicalSkills,
} from "../services/skill-resolution";
import type {
  CanonicalSkillItem,
  SkillRelationDirection,
} from "../types/api";

const PAGE_SIZE = 50;

interface SkillDetailView {
  skill: CanonicalSkillItem;
  parentSkillIds: string[];
  childSkillIds: string[];
}

function SkillDictionaryPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<CanonicalSkillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openingId, setOpeningId] = useState("");
  const detailRequestRef = useRef(0);
  const [detail, setDetail] = useState<SkillDetailView | null>(null);
  const [relationNames, setRelationNames] = useState<Record<string, string>>({});
  const [relationDirection, setRelationDirection] = useState<SkillRelationDirection>("parents");
  const [pendingRelatedSkills, setPendingRelatedSkills] = useState<CanonicalSkillItem[]>([]);
  const [savingRelation, setSavingRelation] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    direction: SkillRelationDirection;
    relatedId: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    loadCanonicalSkillPage({
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

  const fetchDetail = async (
    skillId: string | number,
    requestId = detailRequestRef.current,
  ) => {
    const [detailResponse, parentsResponse, childrenResponse] = await Promise.all([
      getCanonicalSkillDetail(skillId),
      listCanonicalSkillRelations(skillId, "parents"),
      listCanonicalSkillRelations(skillId, "children"),
    ]);
    const nextDetail: SkillDetailView = {
      skill: detailResponse.data,
      parentSkillIds: parentsResponse.data.skillIds,
      childSkillIds: childrenResponse.data.skillIds,
    };
    const relationIds = Array.from(new Set([
      ...nextDetail.parentSkillIds,
      ...nextDetail.childSkillIds,
    ]));
    let names: Record<string, string> = {};
    if (relationIds.length > 0) {
      try {
        const lookup = await lookupCanonicalSkills(relationIds);
        names = Object.fromEntries((lookup.data.items ?? []).map((skill) => [String(skill.id), skill.name]));
      } catch (error) {
        if (detailRequestRef.current === requestId) {
          toast.error(error instanceof Error ? error.message : "关系技能名称加载失败");
        }
      }
    }
    if (detailRequestRef.current === requestId) {
      setDetail(nextDetail);
      setRelationNames(names);
    }
  };

  const openDetail = async (skillId: string | number) => {
    const requestId = ++detailRequestRef.current;
    setOpeningId(String(skillId));
    setRelationDirection("parents");
    setPendingRelatedSkills([]);
    try {
      await fetchDetail(skillId, requestId);
    } catch (error) {
      if (detailRequestRef.current === requestId) {
        toast.error(error instanceof Error ? error.message : "规范技能详情加载失败");
      }
    } finally {
      if (detailRequestRef.current === requestId) setOpeningId("");
    }
  };

  const closeDetail = () => {
    detailRequestRef.current += 1;
    setOpeningId("");
    setDetail(null);
    setRelationNames({});
    setPendingRelatedSkills([]);
    setDeleteTarget(null);
    setSavingRelation(false);
  };

  const addRelations = async () => {
    if (!detail || pendingRelatedSkills.length === 0) return;
    const requestId = detailRequestRef.current;
    const skillId = detail.skill.id;
    const relatedSkill = pendingRelatedSkills[0];
    setSavingRelation(true);
    try {
      await addCanonicalSkillRelation(skillId, relationDirection, relatedSkill.id);
      if (detailRequestRef.current !== requestId) return;
      setPendingRelatedSkills([]);
      await fetchDetail(skillId, requestId);
      if (detailRequestRef.current === requestId) toast.success("技能关系已添加");
    } catch (error) {
      if (detailRequestRef.current === requestId) {
        await fetchDetail(skillId, requestId).catch(() => {});
        toast.error(error instanceof Error ? error.message : "技能关系添加失败");
      }
    } finally {
      if (detailRequestRef.current === requestId) setSavingRelation(false);
    }
  };

  const deleteRelation = async () => {
    if (!detail || !deleteTarget) return;
    const requestId = detailRequestRef.current;
    const skillId = detail.skill.id;
    const target = deleteTarget;
    setSavingRelation(true);
    try {
      await deleteCanonicalSkillRelation(
        skillId,
        target.direction,
        target.relatedId,
      );
      if (detailRequestRef.current !== requestId) return;
      await fetchDetail(skillId, requestId);
      if (detailRequestRef.current === requestId) toast.success("技能关系已删除");
    } catch (error) {
      if (detailRequestRef.current === requestId) {
        toast.error(error instanceof Error ? error.message : "技能关系删除失败");
      }
    } finally {
      if (detailRequestRef.current === requestId) setSavingRelation(false);
    }
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
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr style={{ background: T.cloud }}>
                  {["规范技能", "技能 ID", "向量化状态", "操作"].map((heading) => (
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
                          background: skill.isEmbed ? `${T.emerging}14` : `${T.pending}14`,
                          color: skill.isEmbed ? T.emerging : T.pending,
                        }}
                      >
                        {skill.isEmbed ? "已向量化" : "待向量化"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[12px] font-medium disabled:opacity-50"
                        style={{ color: T.teal }}
                        disabled={openingId === String(skill.id)}
                        onClick={() => void openDetail(skill.id)}
                      >
                        {openingId === String(skill.id)
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Eye size={12} />}
                        查看详情
                      </button>
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

      {detail && (
        <div
          className="fixed inset-0 z-50 flex"
          style={{ background: "rgba(25,50,77,0.3)" }}
          onClick={closeDetail}
        >
          <div
            className="ml-auto flex h-full w-[720px] flex-col overflow-y-auto bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 py-4"
              style={{ borderBottom: `1px solid ${T.cloud}` }}
            >
              <div>
                <h2 className="text-[15px] font-medium" style={{ color: T.ink }}>{detail.skill.name}</h2>
                <div className="mt-1 flex items-center gap-3 text-[11px]" style={{ color: T.info }}>
                  <span className="font-mono">技能 ID：{detail.skill.id}</span>
                  <span>{detail.skill.isEmbed ? "已向量化" : "待向量化"}</span>
                  <span>{isAdmin ? "可管理技能关系" : "关系只读"}</span>
                </div>
              </div>
              <button type="button" onClick={closeDetail} style={{ color: T.info }}><X size={18} /></button>
            </div>

            <div className="flex-1 space-y-5 px-5 py-4">
              <div className="grid grid-cols-2 gap-4">
                <RelationList
                  title="父技能"
                  emptyText="暂无父技能"
                  direction="parents"
                  ids={detail.parentSkillIds}
                  names={relationNames}
                  canDelete={isAdmin}
                  deleting={savingRelation}
                  onDelete={(relatedId, name) => setDeleteTarget({
                    direction: "parents",
                    relatedId,
                    name,
                  })}
                />
                <RelationList
                  title="子技能"
                  emptyText="暂无子技能"
                  direction="children"
                  ids={detail.childSkillIds}
                  names={relationNames}
                  canDelete={isAdmin}
                  deleting={savingRelation}
                  onDelete={(relatedId, name) => setDeleteTarget({
                    direction: "children",
                    relatedId,
                    name,
                  })}
                />
              </div>

              {isAdmin && (
                <Card title="添加技能关系">
                  <div className="space-y-4 px-4 py-4">
                    <div>
                      <div className="mb-1 text-[11px]" style={{ color: T.info }}>关系方向</div>
                      <select
                        className="h-9 w-full rounded-md bg-white px-3 text-[13px] outline-none"
                        style={{ border: `1px solid ${T.border}`, color: T.ink }}
                        value={relationDirection}
                        disabled={savingRelation}
                        onChange={(event) => {
                          setRelationDirection(event.target.value as SkillRelationDirection);
                          setPendingRelatedSkills([]);
                        }}
                      >
                        <option value="parents">将所选技能设为当前技能的父技能</option>
                        <option value="children">将所选技能设为当前技能的子技能</option>
                      </select>
                    </div>

                    <CanonicalSkillMultiSelect
                      value={pendingRelatedSkills}
                      onChange={setPendingRelatedSkills}
                      maxSelected={1}
                      excludeSkillIds={[
                        detail.skill.id,
                        ...detail.parentSkillIds,
                        ...detail.childSkillIds,
                      ]}
                      disabled={savingRelation}
                      placeholder="搜索要建立关系的规范技能"
                    />

                    <div className="flex justify-end">
                      <Btn
                        size="sm"
                        icon={Plus}
                        disabled={savingRelation || pendingRelatedSkills.length === 0}
                        onClick={() => void addRelations()}
                      >
                        {savingRelation ? "保存中…" : "添加关系"}
                      </Btn>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="删除技能关系"
          body={`确认删除当前技能与“${deleteTarget.name}”的${deleteTarget.direction === "parents" ? "父技能" : "子技能"}关系吗？`}
          confirmLabel="删除关系"
          danger
          onConfirm={() => { void deleteRelation(); }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function RelationList({
  title,
  emptyText,
  direction,
  ids,
  names,
  canDelete,
  deleting,
  onDelete,
}: {
  title: string;
  emptyText: string;
  direction: SkillRelationDirection;
  ids: string[];
  names: Record<string, string>;
  canDelete: boolean;
  deleting: boolean;
  onDelete: (relatedId: string, name: string) => void;
}) {
  return (
    <Card title={`${title}（${ids.length}）`}>
      <div className="max-h-72 overflow-y-auto">
        {ids.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px]" style={{ color: T.info }}>{emptyText}</div>
        ) : ids.map((id) => {
          const name = names[id] || `技能 #${id}`;
          return (
            <div
              key={`${direction}-${id}`}
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ borderTop: `1px solid ${T.cloud}` }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium" style={{ color: T.ink }}>{name}</div>
                <div className="font-mono text-[10px]" style={{ color: T.info }}>ID {id}</div>
              </div>
              {canDelete && (
                <button
                  type="button"
                  title={`删除${title}关系`}
                  disabled={deleting}
                  onClick={() => onDelete(id, name)}
                >
                  <Trash2 size={13} style={{ color: T.risk }} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default SkillDictionaryPage;
