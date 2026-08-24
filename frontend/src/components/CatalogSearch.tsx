import { useState } from "react";
import { Search, X } from "lucide-react";
import T from "../constants/tokens";
import { Card, Btn } from "./ui";
import Cascader, { type CascaderItem, type CascaderLevel } from "./Cascader";

export interface CatalogSearchItem {
  id: string;
  code: string;
  name: string;
  is_embed?: boolean;
}

export interface CatalogSearchLevel {
  label: string;
  parents: CascaderLevel[]; // 从顶层到直接父级的级联链（空表示该层为顶层）
  search: (parentId: string, keyword: string) => Promise<CatalogSearchItem[]>;
}

const inputCls = "w-full h-9 px-3 rounded-md text-[13px] outline-none bg-white";
const inputStyle: React.CSSProperties = { border: `1px solid ${T.border}`, color: T.ink };

export default function CatalogSearch({
  levels,
  onActiveChange,
}: {
  levels: CatalogSearchLevel[];
  onActiveChange: (active: boolean) => void;
}) {
  // 选中的目标层级索引（默认顶层）
  const [levelIdx, setLevelIdx] = useState(0);
  const [parentPath, setParentPath] = useState<CascaderItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<CatalogSearchItem[] | null>(null);
  const [searching, setSearching] = useState(false);

  const level = levels[levelIdx];

  const changeLevel = (idx: number) => {
    setLevelIdx(idx);
    setParentPath([]);
    setResults(null);
  };

  const run = async () => {
    const kw = keyword.trim();
    if (!kw) return;
    // 直接父级 = 级联链最后一项；顶层无父级则为空串
    const parentId = level.parents.length > 0
      ? parentPath[level.parents.length - 1]?.id ?? ""
      : "";
    if (level.parents.length > 0 && !parentId) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await level.search(parentId, kw));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const clear = () => {
    setKeyword("");
    setResults(null);
    onActiveChange(false);
  };

  const searchActive = results !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2 flex-wrap">
        {/* 目标层级 */}
        <div className="w-56">
          <div className="text-[11px] mb-1" style={{ color: T.info }}>搜索层级</div>
          <select
            className={inputCls}
            style={inputStyle}
            value={levelIdx}
            onChange={(e) => changeLevel(Number(e.target.value))}
          >
            {levels.map((l, i) => (
              <option key={l.label} value={i}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* 父级级联（cascader 风格） */}
        {level.parents.length > 0 && (
          <div className="w-56">
            <div className="text-[11px] mb-1" style={{ color: T.info }}>所属层级</div>
            <Cascader
              levels={level.parents}
              value={parentPath}
              onChange={setParentPath}
              placeholder={level.parents.map(p => p.label).join(" / ")}
            />
          </div>
        )}

        {/* 关键词 */}
        <div className="w-56">
          <div className="text-[11px] mb-1" style={{ color: T.info }}>关键词</div>
          <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-white"
            style={{ border: `1px solid ${T.border}` }}>
            <Search size={13} style={{ color: T.info }} />
            <input
              className="bg-transparent text-[13px] flex-1 outline-none"
              style={{ color: T.ink }}
              placeholder={`搜索${level.label}（名称或编码）`}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") run(); }}
            />
            {keyword && (
              <button onClick={() => setKeyword("")} style={{ color: T.info, background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="pb-0.5">
          <Btn size="sm" icon={Search} onClick={run} disabled={searching}>
            {searching ? "搜索中…" : "搜索"}
          </Btn>
          {searchActive && (
            <Btn variant="ghost" size="sm" onClick={clear}>清空</Btn>
          )}
        </div>
      </div>

      {/* 命中结果 */}
      {searchActive && (
        <Card>
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px]" style={{ color: T.info }}>
              {level.parents.length > 0 && !(parentPath[level.parents.length - 1]?.id)
                ? `请先选择${level.parents.map(p => p.label).join(" → ")}`
                : "未找到匹配项"}
            </div>
          ) : (
            <div className="px-4 py-3 max-h-[480px] overflow-y-auto">
              <div className="text-[12px] font-medium mb-2" style={{ color: T.info }}>
                {level.label}（{results.length}）
              </div>
              <div className="space-y-1">
                {results.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-gray-50">
                    <span className="text-[13px] flex-1 truncate" style={{ color: T.ink }}>{item.name}</span>
                    {item.code && (
                      <span className="text-[11px] font-mono flex-shrink-0" style={{ color: T.info }}>{item.code}</span>
                    )}
                    {item.is_embed !== undefined && (
                      item.is_embed ? (
                        <span className="text-[11px] px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: `${T.emerging}12`, color: T.emerging }}>已向量化</span>
                      ) : (
                        <span className="text-[11px] px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: `${T.pending}12`, color: T.pending }}>未向量化</span>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
