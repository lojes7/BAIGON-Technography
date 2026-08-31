import { useMemo, useRef, useState } from "react";
import { Search, X, ArrowRight, Route, Sparkles } from "lucide-react";
import T from "../../constants/tokens";
import {
  ENTITY_COLOR,
  ENTITY_ICON_CODE,
} from "../../constants/graph-theme";
import type { EntityType } from "../../types/dynamic-graph";
import { ENTITY_TYPE_LABEL } from "../../types/dynamic-graph";
import { Btn, Divider } from "../ui";

export interface SearchItem {
  id: string;
  name: string;
  type: EntityType;
  matchedAlias?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSearch: (kw: string) => SearchItem[];
  onQuery: (sourceId: string, targetId: string) => {
    found: boolean;
    hops: number;
    path: SearchItem[];
    edgeLabels: string[];
    totalImportance: number;
  } | null;
  getNodeById: (id: string) => SearchItem | undefined;
}

type Field = "source" | "target" | null;

function PathQueryModal({ open, onClose, onSearch, onQuery, getNodeById }: Props) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [sourceKw, setSourceKw] = useState("");
  const [targetKw, setTargetKw] = useState("");
  const [focused, setFocused] = useState<Field>(null);
  const [result, setResult] = useState<ReturnType<typeof onQuery> | null>(null);
  const srcRes = useMemo(() => (focused === "source" ? onSearch(sourceKw) : []), [sourceKw, focused, onSearch]);
  const tgtRes = useMemo(() => (focused === "target" ? onSearch(targetKw) : []), [focused, targetKw, onSearch]);
  const lastTouched = useRef<Field>(null);

  if (!open) return null;

  const srcNode = sourceId ? getNodeById(sourceId) : undefined;
  const tgtNode = targetId ? getNodeById(targetId) : undefined;

  const runQuery = () => {
    if (!sourceId || !targetId) return;
    const r = onQuery(sourceId, targetId);
    setResult(r);
  };

  const swap = () => {
    const sid = sourceId, skw = sourceKw;
    setSourceId(targetId); setSourceKw(targetKw);
    setTargetId(sid); setTargetKw(skw);
    setResult(null);
  };

  const applyResult = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(25,50,77,0.48)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: T.white }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, ${T.teal}18, ${T.cloud}88)`, borderBottom: `1px solid ${T.border}` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: T.white, border: `1.5px solid ${T.teal}` }}>
            <Route size={20} style={{ color: T.teal }} />
          </div>
          <div className="flex-1">
            <div className="text-[16px] font-semibold" style={{ color: T.ink }}>多跳路径查询</div>
            <div className="text-[12px] mt-0.5" style={{ color: T.info }}>
              选择起点与终点节点，查找最短关联路径
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 transition">
            <X size={18} style={{ color: T.info }} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {(["source", "target"] as const).map((f) => {
            const isSrc = f === "source";
            void isSrc;
            const id = isSrc ? sourceId : targetId;
            const kw = isSrc ? sourceKw : targetKw;
            const setId = isSrc ? setSourceId : setTargetId;
            const setKw = isSrc ? setSourceKw : setTargetKw;
            const list = isSrc ? srcRes : tgtRes;
            const sel = isSrc ? srcNode : tgtNode;
            return (
              <div key={f} className="space-y-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <label className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: T.teal }}>
                    {isSrc ? "① 起点节点" : "② 终点节点"}
                  </label>
                  {!isSrc && sourceId && targetId && (
                    <button type="button" onClick={swap}
                      className="text-[11px] px-2 py-0.5 rounded-md transition"
                      style={{ color: T.info, background: T.bg }}>
                      交换起终点
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: T.info, opacity: 0.5 }} />
                  <input
                    value={sel ? sel.name : kw}
                    onChange={(e) => { setKw(e.target.value); setId(""); lastTouched.current = f; }}
                    onFocus={() => { setFocused(f); lastTouched.current = f; }}
                    onBlur={() => setTimeout(() => setFocused(null), 160)}
                    placeholder={isSrc ? "输入起点名称…如 大模型应用工程师" : "输入终点名称…如 Python"}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg text-[13px] outline-none transition"
                    style={{
                      background: T.white,
                      border: `1.5px solid ${focused === f ? T.teal : T.border}`,
                      color: T.ink,
                    }}
                  />
                  {sel && (
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-black/5"
                      onClick={(e) => { e.preventDefault(); setId(""); setKw(""); }}
                    >
                      <X size={13} style={{ color: T.info, opacity: 0.5 }} />
                    </button>
                  )}
                  {focused === f && list.length > 0 && !sel && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 rounded-lg overflow-hidden z-20 max-h-[240px] overflow-y-auto shadow-xl"
                      style={{ background: T.white, border: `1px solid ${T.border}` }}>
                      {list.map((r, i) => {
                        const c = ENTITY_COLOR[r.type];
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setId(r.id);
                              setKw(r.name);
                              setFocused(null);
                              if (isSrc) lastTouched.current = "target";
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left transition hover:bg-black/[0.04]"
                            style={{ borderBottom: i < list.length - 1 ? `1px solid ${T.border}` : "none" }}
                          >
                            <span className="w-6 h-6 rounded-md flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                              style={{ background: c.fill, color: c.stroke, border: `1px solid ${c.stroke}55` }}>
                              {ENTITY_ICON_CODE[r.type]}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-medium truncate" style={{ color: T.ink }}>{r.name}</div>
                              <div className="text-[11px]" style={{ color: c.stroke }}>
                                {ENTITY_TYPE_LABEL[r.type]}
                                {r.matchedAlias ? <span style={{ color: T.info }}> · {r.matchedAlias}</span> : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="pt-1">
            <Btn
              size="md"
              block
              icon={Sparkles}
              disabled={!sourceId || !targetId}
              onClick={runQuery}
            >
              查询最短路径
            </Btn>
          </div>

          {result && (
            <div className="mt-3 rounded-xl overflow-hidden border"
              style={{ borderColor: T.border }}>
              <div className="px-4 py-2.5 flex items-center justify-between"
                style={{ background: result.found ? `${T.emerging}14` : `${T.risk}12`, borderBottom: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-2">
                  {result.found
                    ? <Sparkles size={15} style={{ color: T.emerging }} />
                    : <X size={15} style={{ color: T.risk }} />}
                  <span className="text-[13px] font-semibold"
                    style={{ color: result.found ? T.emerging : T.risk }}>
                    {result.found ? `找到路径 · ${result.hops} 跳` : "未找到可达路径"}
                  </span>
                </div>
                {result.found && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded"
                    style={{ background: T.white, color: T.teal, border: `1px solid ${T.border}` }}>
                    置信度 {result.totalImportance.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="px-4 py-3">
                {result.found ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {result.path.map((n, i) => {
                      const c = ENTITY_COLOR[n.type];
                      const isLast = i === result.path.length - 1;
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md"
                            style={{ background: c.fill, border: `1px solid ${c.stroke}66`, color: c.text }}>
                            <span className="text-[11.5px] font-bold">{ENTITY_ICON_CODE[n.type]}</span>
                            <span className="text-[12px] font-semibold">{n.name}</span>
                          </div>
                          {!isLast && (
                            <ArrowRight size={14} style={{ color: T.info, opacity: 0.5 }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[12.5px] leading-relaxed" style={{ color: T.info }}>
                    从起点到终点不存在有向可达路径，请尝试更换节点对，
                    或调整节点筛选范围后重新查询。
                  </div>
                )}
              </div>
              {result.found && (
                <>
                  <Divider className="my-0" />
                  <div className="px-4 py-3 flex justify-end gap-2">
                    <Btn variant="secondary" size="sm" onClick={() => setResult(null)}>重新查询</Btn>
                    <Btn size="sm" onClick={applyResult}>在图谱中高亮</Btn>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PathQueryModal;
