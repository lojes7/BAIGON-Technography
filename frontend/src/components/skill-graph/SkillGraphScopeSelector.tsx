import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import T from "../../constants/tokens";
import { getMajors, getOccupations } from "../../services/occupation";
import type { EmbeddableCatalogItem, SkillGraphScopeType } from "../../types/api";
import type { GraphScopeSelection } from "../../utils/skill-graph";
import { Btn } from "../ui";

const fieldClass = "h-9 px-3 rounded-md text-[13px] outline-none bg-white";
const fieldStyle: React.CSSProperties = { border: `1px solid ${T.border}`, color: T.ink };

export default function SkillGraphScopeSelector({
  value,
  onChange,
}: {
  value: GraphScopeSelection | null;
  onChange: (value: GraphScopeSelection | null) => void;
}) {
  const [scopeType, setScopeType] = useState<SkillGraphScopeType>(value?.type ?? "OCCUPATION");
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<EmbeddableCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (type: SkillGraphScopeType, searchKeyword: string) => {
    setLoading(true);
    try {
      const query = { page: 0, pageSize: 100, keyword: searchKeyword.trim() || undefined };
      const response = type === "OCCUPATION"
        ? await getOccupations(query)
        : await getMajors(query);
      setItems(response.data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 延后到当前渲染提交后加载目录，避免类型切换时产生级联同步渲染。
    const timer = window.setTimeout(() => void load(scopeType, ""), 0);
    return () => window.clearTimeout(timer);
  }, [scopeType, load]);

  const changeType = (type: SkillGraphScopeType) => {
    setScopeType(type);
    setKeyword("");
    setItems([]);
    onChange(null);
  };

  const selectItem = (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) {
      onChange(null);
      return;
    }
    onChange({ type: scopeType, id: item.id, code: item.code, name: item.name });
  };

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <label className="flex flex-col gap-1 w-28">
        <span className="text-[11px]" style={{ color: T.info }}>对象类型</span>
        <select
          className={fieldClass}
          style={fieldStyle}
          value={scopeType}
          onChange={(event) => changeType(event.target.value as SkillGraphScopeType)}
        >
          <option value="OCCUPATION">职业</option>
          <option value="MAJOR">专业</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 w-60">
        <span className="text-[11px]" style={{ color: T.info }}>搜索名称或编码</span>
        <div className="flex gap-1.5">
          <input
            className={`${fieldClass} min-w-0 flex-1`}
            style={fieldStyle}
            value={keyword}
            placeholder={scopeType === "OCCUPATION" ? "例如：Java 开发" : "例如：软件工程"}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load(scopeType, keyword);
            }}
          />
          <Btn
            variant="secondary"
            size="sm"
            icon={Search}
            disabled={loading}
            onClick={() => void load(scopeType, keyword)}
          >
            搜索
          </Btn>
        </div>
      </label>

      <label className="flex flex-col gap-1 min-w-64 flex-1">
        <span className="text-[11px]" style={{ color: T.info }}>
          {scopeType === "OCCUPATION" ? "选择职业" : "选择专业"}
        </span>
        <select
          className={`${fieldClass} w-full`}
          style={fieldStyle}
          value={value?.type === scopeType ? value.id : ""}
          onChange={(event) => selectItem(event.target.value)}
        >
          <option value="">{loading ? "正在加载…" : "请选择"}</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}{item.code ? ` · ${item.code}` : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
