// 规范技能多选器：复用全量技能分页与名称筛选接口，选择结果跨分页保留。
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import T from "../../constants/tokens";
import { loadCanonicalSkillPage } from "../../services/skill-resolution";
import type { CanonicalSkillItem } from "../../types/api";
import { Btn, Pagination } from "../ui";

const PAGE_SIZE = 20;

export default function CanonicalSkillMultiSelect({
  value,
  onChange,
  excludeSkillIds = [],
  maxSelected,
  disabled = false,
  placeholder = "按规范技能名称筛选（可选）",
}: {
  value: CanonicalSkillItem[];
  onChange: (skills: CanonicalSkillItem[]) => void;
  excludeSkillIds?: Array<string | number>;
  maxSelected?: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [items, setItems] = useState<CanonicalSkillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const selectedIds = useMemo(() => new Set(value.map((skill) => String(skill.id))), [value]);
  const excludedIds = useMemo(
    () => new Set(excludeSkillIds.map(String)),
    [excludeSkillIds],
  );

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
    setRefreshKey((current) => current + 1);
  };

  const toggle = (skill: CanonicalSkillItem) => {
    if (disabled || excludedIds.has(String(skill.id))) return;
    if (selectedIds.has(String(skill.id))) {
      onChange(value.filter((selected) => String(selected.id) !== String(skill.id)));
      return;
    }
    if (maxSelected !== undefined && value.length >= maxSelected) {
      toast.error(`最多选择 ${maxSelected} 个规范技能`);
      return;
    }
    onChange([...value, skill]);
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((skill) => (
            <span
              key={skill.id}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px]"
              style={{ background: `${T.teal}10`, color: T.ink, border: `1px solid ${T.teal}30` }}
            >
              {skill.name}
              <span className="font-mono text-[10px]" style={{ color: T.info }}>#{skill.id}</span>
              {!disabled && (
                <button type="button" onClick={() => toggle(skill)} title="移除已选技能">
                  <X size={12} style={{ color: T.info }} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <div
          className="flex h-9 flex-1 items-center gap-2 rounded-md bg-white px-3"
          style={{ border: `1px solid ${T.border}` }}
        >
          <Search size={13} style={{ color: T.info }} />
          <input
            className="flex-1 bg-transparent text-[13px] outline-none disabled:cursor-not-allowed"
            style={{ color: T.ink }}
            value={keyword}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") search(); }}
          />
        </div>
        <Btn size="sm" icon={Search} disabled={disabled || loading} onClick={search}>筛选</Btn>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md" style={{ border: `1px solid ${T.border}` }}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-8 text-[12px]" style={{ color: T.info }}>
            <Loader2 size={13} className="animate-spin" />正在加载规范技能…
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-8 text-center text-[12px]" style={{ color: T.info }}>暂无符合条件的规范技能</div>
        ) : items.map((skill) => {
          const selected = selectedIds.has(String(skill.id));
          const excluded = excludedIds.has(String(skill.id));
          const reachedLimit = maxSelected !== undefined && value.length >= maxSelected && !selected;
          return (
            <button
              type="button"
              key={skill.id}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                background: selected ? `${T.teal}10` : "transparent",
                borderBottom: `1px solid ${T.cloud}`,
              }}
              disabled={disabled || excluded || reachedLimit}
              onClick={() => toggle(skill)}
            >
              <span className="flex-1 text-[13px]" style={{ color: T.ink }}>{skill.name}</span>
              <span className="font-mono text-[10px]" style={{ color: T.info }}>ID {skill.id}</span>
              {excluded ? (
                <span className="text-[10px]" style={{ color: T.info }}>已关联</span>
              ) : reachedLimit ? (
                <span className="text-[10px]" style={{ color: T.info }}>已达上限</span>
              ) : selected ? (
                <Check size={13} style={{ color: T.teal }} />
              ) : null}
            </button>
          );
        })}
      </div>

      {total > PAGE_SIZE && (
        <Pagination
          page={page}
          totalPages={pageCount}
          disabled={loading || disabled}
          onChange={(nextPage) => {
            setLoading(true);
            setPage(nextPage);
          }}
        />
      )}
    </div>
  );
}
