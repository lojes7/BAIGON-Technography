import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Filter, Zap, Crosshair, RefreshCw } from "lucide-react";
import T from "../constants/tokens";
import {
  ENTITY_COLOR,
  ENTITY_ICON_CODE,
} from "../constants/graph-theme";
import type { EntityType } from "../types/dynamic-graph";
import { ENTITY_TYPE_LABEL } from "../types/dynamic-graph";

export interface SearchResultItem {
  id: string;
  name: string;
  type: EntityType;
  matchedAlias?: string;
}

interface Props {
  placeholder?: string;
  onSearch: (keyword: string) => SearchResultItem[];
  onSelect: (id: string, ev?: React.MouseEvent) => void;
  activeFilter: Set<EntityType>;
  onFilterChange: (filter: Set<EntityType>) => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onResetView: () => void;
  allEntityTypes: EntityType[];
}

function GraphSearchBar(p: Props) {
  const {
    placeholder = "搜索节点：职业、岗位、技能、工具、证书、任务…",
    onSearch, onSelect,
    activeFilter, onFilterChange,
    focusMode, onToggleFocusMode, onResetView,
    allEntityTypes,
  } = p;
  const [kw, setKw] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => onSearch(kw), [kw, onSearch]);

  useEffect(() => {
    setActiveIdx(0);
  }, [kw]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (results[activeIdx]) {
        e.preventDefault();
        onSelect(results[activeIdx].id);
        setOpen(false);
        setKw(results[activeIdx].name);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const toggleFilter = (t: EntityType) => {
    const next = new Set(activeFilter);
    if (next.has(t)) next.delete(t); else next.add(t);
    onFilterChange(next);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2 w-full">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: T.info, opacity: 0.55 }}
          />
          <input
            ref={inputRef}
            value={kw}
            onChange={(e) => { setKw(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            className="w-full pl-9 pr-8 py-2 text-[13px] rounded-lg outline-none transition"
            style={{
              background: T.white,
              border: `1px solid ${kw ? T.teal : T.border}`,
              color: T.ink,
              boxShadow: kw ? `0 0 0 3px ${T.teal}22` : "none",
            }}
          />
          {kw && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-black/5"
              onClick={(e) => { e.preventDefault(); setKw(""); setOpen(false); inputRef.current?.focus(); }}
              type="button"
            >
              <X size={13} style={{ color: T.info, opacity: 0.5 }} />
            </button>
          )}
          {open && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 rounded-lg overflow-hidden z-40 max-h-[360px] overflow-y-auto shadow-xl"
              style={{ background: T.white, border: `1px solid ${T.border}` }}>
              {results.map((r, i) => {
                const c = ENTITY_COLOR[r.type];
                const active = i === activeIdx;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(r.id, e);
                      setOpen(false);
                      setKw(r.name);
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left border-0 transition ${active ? "bg-black/[0.04]" : ""}`}
                    style={{ borderBottom: i < results.length - 1 ? `1px solid ${T.border}` : "none" }}
                  >
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                      style={{ background: c.fill, color: c.stroke, border: `1px solid ${c.stroke}55` }}
                    >
                      {ENTITY_ICON_CODE[r.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate" style={{ color: T.ink }}>{r.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-medium" style={{ color: c.stroke }}>
                          {ENTITY_TYPE_LABEL[r.type]}
                        </span>
                        {r.matchedAlias && (
                          <span className="text-[10.5px] px-1.5 py-0.5 rounded"
                            style={{ background: T.cloud + "88", color: T.info }}>
                            匹配: {r.matchedAlias}
                          </span>
                        )}
                      </div>
                    </div>
                    <Crosshair size={14} style={{ color: T.teal, opacity: active ? 1 : 0 }} />
                  </button>
                );
              })}
            </div>
          )}
          {open && kw && results.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 rounded-lg px-3 py-3 text-[12px] text-center z-40 shadow-lg"
              style={{ background: T.white, border: `1px solid ${T.border}`, color: T.info }}>
              未找到匹配的节点，请尝试其他关键词
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleFocusMode}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition border"
          style={{
            background: focusMode ? `${T.teal}12` : T.white,
            borderColor: focusMode ? T.teal : T.border,
            color: focusMode ? T.teal : T.ink,
          }}
          title={focusMode ? "退出焦点模式（显示全部节点）" : "焦点模式：点击节点仅显示其一阶邻居"}
        >
          <Zap size={14} />
          <span className="whitespace-nowrap">{focusMode ? "焦点模式：开" : "焦点模式：关"}</span>
        </button>

        <button
          type="button"
          onClick={onResetView}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition border"
          style={{ background: T.white, borderColor: T.border, color: T.info }}
          title="重置视图（缩放/平移/筛选/焦点）"
        >
          <RefreshCw size={14} />
          <span className="whitespace-nowrap hidden sm:inline">重置</span>
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-md"
          style={{ background: T.cloud + "88", color: T.info }}>
          <Filter size={12} />
          <span>类型筛选：</span>
        </div>
        {allEntityTypes.map((t) => {
          const c = ENTITY_COLOR[t];
          const on = activeFilter.size === 0 || activeFilter.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleFilter(t)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11.5px] font-medium transition border"
              style={{
                background: on ? c.fill : `${T.bg}`,
                borderColor: on ? c.stroke : T.border,
                color: on ? c.text : T.info,
                opacity: on ? 1 : 0.45,
              }}
            >
              <span style={{ fontSize: 11 }}>{ENTITY_ICON_CODE[t]}</span>
              <span>{ENTITY_TYPE_LABEL[t]}</span>
              {activeFilter.has(t) && <span style={{ color: c.stroke, fontSize: 10 }}>✓</span>}
            </button>
          );
        })}
        {activeFilter.size > 0 && (
          <button
            type="button"
            onClick={() => onFilterChange(new Set())}
            className="text-[11.5px] px-2 py-1 rounded-md transition"
            style={{ color: T.teal, background: `${T.teal}10` }}
          >
            清除全部
          </button>
        )}
      </div>
    </div>
  );
}

export default GraphSearchBar;
