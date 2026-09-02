import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import Cascader, { type CascaderItem, type CascaderLevel } from "../Cascader";
import T from "../../constants/tokens";
import {
  getDisciplineCategories,
  getMajorCategories,
  getMajors,
  getOccupationCategories,
  getOccupationMajorCategories,
  getOccupations,
  getOccupationSubCategories,
} from "../../services/occupation";

type DirectoryKind = "major" | "occupation";

interface DirectoryPickerProps {
  kind: DirectoryKind;
  selectedId: string | number | null;
  selectedName: string;
  disabled?: boolean;
  onSelect: (id: string, name: string) => void;
}

const inputCls = "h-9 w-full rounded-md bg-white px-3 text-[13px] outline-none";

function toItems(items: Array<{ id: string; name: string; code?: string; isEmbed?: boolean }>): CascaderItem[] {
  return items.map((item) => ({
    id: String(item.id),
    name: item.name,
    code: item.code,
    isEmbed: item.isEmbed,
  }));
}

// 先确定父目录，再按关键词查询叶子节点，避免只加载前 100 条时漏掉合法专业或职业。
export default function DirectoryPicker({
  kind,
  selectedId,
  selectedName,
  disabled = false,
  onSelect,
}: DirectoryPickerProps) {
  const [parentPath, setParentPath] = useState<CascaderItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<CascaderItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const majorParents: CascaderLevel[] = [
    {
      label: "学科门类",
      load: async () => toItems((await getDisciplineCategories({ pageSize: 100 })).data.items),
    },
    {
      label: "专业类",
      load: async (parentId) => toItems((await getMajorCategories({
        disciplineCategoryId: parentId,
        pageSize: 100,
      })).data.items),
    },
  ];
  const occupationParents: CascaderLevel[] = [
    {
      label: "职业大类",
      load: async () => toItems((await getOccupationMajorCategories({ pageSize: 100 })).data.items),
    },
    {
      label: "职业中类",
      load: async (parentId) => toItems((await getOccupationSubCategories({
        occupationMajorCategoryId: parentId,
        pageSize: 100,
      })).data.items),
    },
    {
      label: "职业小类",
      load: async (parentId) => toItems((await getOccupationCategories({
        occupationSubCategoryId: parentId,
        pageSize: 100,
      })).data.items),
    },
  ];
  const parentLevels = kind === "major" ? majorParents : occupationParents;
  const leafLabel = kind === "major" ? "专业" : "职业";

  const changeParent = (path: CascaderItem[]) => {
    setParentPath(path);
    setResults([]);
    setSearched(false);
    setError("");
  };

  const search = async () => {
    const parentId = parentPath[parentLevels.length - 1]?.id;
    if (!parentId) {
      setError(`请先选完整的${parentLevels.map((item) => item.label).join(" / ")}`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = kind === "major"
        ? await getMajors({ majorCategoryId: parentId, keyword: keyword.trim(), pageSize: 100 })
        : await getOccupations({ occupationCategoryId: parentId, keyword: keyword.trim(), pageSize: 100 });
      setResults(toItems(response.data.items));
      setSearched(true);
    } catch (requestError) {
      setResults([]);
      setSearched(true);
      setError(requestError instanceof Error ? requestError.message : "目录查询失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md px-3 py-2 text-[12px]" style={{ background: T.cloud, color: T.ink }}>
        当前选择：{selectedId ? `${selectedName || leafLabel}（${selectedId}）` : `尚未选择${leafLabel}`}
      </div>
      {!disabled && (
        <>
          <Cascader
            levels={parentLevels}
            value={parentPath}
            onChange={changeParent}
            placeholder={parentLevels.map((item) => item.label).join(" / ")}
          />
          <div className="flex gap-2">
            <input
              className={inputCls}
              style={{ border: `1px solid ${T.border}`, color: T.ink }}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void search(); }}
              placeholder={`输入${leafLabel}名称或编码；留空查看前 100 条`}
            />
            <button
              type="button"
              className="flex h-9 shrink-0 items-center gap-1 rounded-md px-3 text-[12px] text-white disabled:opacity-50"
              style={{ background: T.teal }}
              disabled={loading}
              onClick={() => void search()}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              查询
            </button>
          </div>
          {error && <div className="text-[12px]" style={{ color: T.risk }}>{error}</div>}
          {searched && (
            <div className="max-h-40 overflow-y-auto rounded-md" style={{ border: `1px solid ${T.border}` }}>
              {results.length === 0 ? (
                <div className="px-3 py-5 text-center text-[12px]" style={{ color: T.info }}>未找到匹配项</div>
              ) : results.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                  style={{ borderBottom: `1px solid ${T.cloud}` }}
                  onClick={() => onSelect(item.id, item.name)}
                >
                  <span className="flex-1 truncate text-[13px]" style={{ color: T.ink }}>{item.name}</span>
                  {item.code && <span className="font-mono text-[11px]" style={{ color: T.info }}>{item.code}</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
