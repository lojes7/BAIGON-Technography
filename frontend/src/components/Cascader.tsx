import { useState } from "react";
import { ChevronDown, ChevronRight, X, Loader2 } from "lucide-react";
import T from "../constants/tokens";

export interface CascaderItem {
  id: string;
  name: string;
  code?: string;
  isEmbed?: boolean;
}

export interface CascaderLevel {
  label: string; 
  load: (parentId?: string) => Promise<CascaderItem[]>; 
}

export default function Cascader({
  levels,
  value,
  onChange,
  placeholder = "请选择",
}: {
  levels: CascaderLevel[];
  value: CascaderItem[];
  onChange: (path: CascaderItem[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<CascaderItem[][]>([]);
  const [loadingCol, setLoadingCol] = useState<number | null>(null);

  const openPanel = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    await rebuild(value);
  };

  const rebuild = async (path: CascaderItem[]) => {
    const cols: CascaderItem[][] = [];
    for (let i = 0; i < levels.length; i++) {
      if (i === 0) {
        setLoadingCol(0);
        try { cols.push(await levels[0].load()); } catch { cols.push([]); }
        setLoadingCol(null);
      } else {
        const parent = path[i - 1];
        if (!parent) break; 
        setLoadingCol(i);
        try { cols.push(await levels[i].load(parent.id)); } catch { cols.push([]); }
        setLoadingCol(null);
      }
    }
    setColumns(cols);
  };

  const onSelect = async (colIdx: number, item: CascaderItem) => {
    const newPath = [...value.slice(0, colIdx), item];
    onChange(newPath);

    const newColumns = columns.slice(0, colIdx + 1);
    setColumns(newColumns);

    if (colIdx + 1 < levels.length) {
      setLoadingCol(colIdx + 1);
      try {
        const next = await levels[colIdx + 1].load(item.id);
        setColumns([...newColumns, next]);
      } catch {
        setColumns([...newColumns, []]);
      } finally {
        setLoadingCol(null);
      }
    }
  };

  const clear = () => {
    onChange([]);
    setColumns([]);
    setOpen(false);
  };

  const display = value.length ? value.map((p) => p.name).join(" / ") : placeholder;

  return (
    <div className="relative">
      {/* 输入框：显示已选路径 */}
      <div
        className="flex items-center gap-2 h-9 px-3 rounded-md bg-white cursor-pointer w-full"
        style={{ border: `1px solid ${T.border}` }}
        onClick={openPanel}
      >
        <span className="flex-1 text-[13px] truncate" style={{ color: value.length ? T.ink : T.info }}>
          {display}
        </span>
        {value.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); clear(); }}
            style={{ color: T.info, background: "none", border: "none", cursor: "pointer", display: "flex" }}
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown size={14} style={{ color: T.info }} />
      </div>

      {/* 弹出面板：横向多列 */}
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 mt-1 z-30 flex bg-white rounded-lg shadow-xl"
            style={{ border: `1px solid ${T.border}` }}
          >
            {columns.map((col, colIdx) => {
              const isLeafCol = colIdx === levels.length - 1;
              const activeId = value[colIdx]?.id;
              return (
                <div
                  key={colIdx}
                  className="flex-shrink-0 w-52 max-h-80 overflow-y-auto"
                  style={{ borderRight: colIdx < columns.length - 1 ? `1px solid ${T.cloud}` : "none" }}
                >
                  <div className="px-3 py-2 text-[11px] font-medium sticky top-0 bg-white"
                    style={{ color: T.info, borderBottom: `1px solid ${T.cloud}` }}>
                    {levels[colIdx].label}
                  </div>
                  {loadingCol === colIdx ? (
                    <div className="flex items-center justify-center py-6" style={{ color: T.info }}>
                      <Loader2 size={16} className="animate-spin" />
                    </div>
                  ) : col.length === 0 ? (
                    <div className="px-3 py-4 text-[12px] text-center" style={{ color: T.info }}>暂无数据</div>
                  ) : (
                    col.map((item) => {
                      const active = item.id === activeId;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors hover:bg-gray-50"
                          style={{ background: active ? `${T.teal}10` : "transparent" }}
                          onClick={() => onSelect(colIdx, item)}
                        >
                          <span className="text-[13px] flex-1 truncate" style={{ color: T.ink }}>{item.name}</span>
                          {item.code && (
                            <span className="text-[11px] font-mono flex-shrink-0" style={{ color: T.info }}>{item.code}</span>
                          )}
                          {isLeafCol && item.isEmbed !== undefined && (
                            item.isEmbed ? (
                              <span className="text-[10px] px-1 py-0.5 rounded flex-shrink-0"
                                style={{ background: `${T.emerging}12`, color: T.emerging }}>已向量化</span>
                            ) : (
                              <span className="text-[10px] px-1 py-0.5 rounded flex-shrink-0"
                                style={{ background: `${T.pending}12`, color: T.pending }}>未向量化</span>
                            )
                          )}
                          {!isLeafCol && <ChevronRight size={13} style={{ color: T.info }} />}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
