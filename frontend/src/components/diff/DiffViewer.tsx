// 百工谱 — 左右双栏 diff 对比组件（自研，类 VS Code diff）
// 左栏=原始数据，右栏=清洗后数据；同步滚动 + 增/删/改三态高亮 + 斜体 + 单栏复制。
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check } from "lucide-react";
import T from "../../constants/tokens";

export type DiffStatus = "unchanged" | "modified" | "deleted" | "added";

export interface DiffRow {
  label: string; // 字段显示名（已翻译）
  left: string; // 原始值（空字符串表示无）
  right: string; // 清洗后值（空字符串表示无）
  status: DiffStatus;
}

// 三态底色 / 前景色（与 RawRecords 现有审核按钮配色保持一致）
const MODIFIED = { leftBg: "#FDF6E3", leftFg: "#8B6914", rightBg: "#E6F5F1", rightFg: "#1A6B4E" };
const DELETED = { leftBg: "#FAECEC", leftFg: "#8B1A1A", rightBg: "#F7F9FB" };
const ADDED = { rightBg: "#E6F5F1", rightFg: "#1A6B4E", leftBg: "#F7F9FB" };

interface DiffViewerProps {
  rows: DiffRow[];
  leftTitle?: string;
  rightTitle?: string;
}

export default function DiffViewer({ rows, leftTitle, rightTitle }: DiffViewerProps) {
  const { t } = useTranslation();
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [leftCopied, setLeftCopied] = useState(false);
  const [rightCopied, setRightCopied] = useState(false);

  // 同步滚动：滚动一侧时同步另一侧（用 ref 防止循环触发）
  const handleScroll = (source: "left" | "right") => {
    if (syncing.current) return;
    syncing.current = true;
    const src = source === "left" ? leftRef.current : rightRef.current;
    const dst = source === "left" ? rightRef.current : leftRef.current;
    if (src && dst) {
      dst.scrollTop = src.scrollTop;
      dst.scrollLeft = src.scrollLeft;
    }
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  // 复制单栏文本
  const copySide = async (side: "left" | "right") => {
    const text = rows
      .filter((r) => (side === "left" ? r.left : r.right))
      .map((r) => `${r.label}: ${side === "left" ? r.left : r.right}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      if (side === "left") {
        setLeftCopied(true);
        setTimeout(() => setLeftCopied(false), 1500);
      } else {
        setRightCopied(true);
        setTimeout(() => setRightCopied(false), 1500);
      }
    } catch {
      /* 剪贴板不可用时静默失败 */
    }
  };

  const rowBg = (status: DiffStatus, side: "left" | "right"): string => {
    if (status === "unchanged") return "transparent";
    if (status === "modified") return side === "left" ? MODIFIED.leftBg : MODIFIED.rightBg;
    if (status === "deleted") return side === "left" ? DELETED.leftBg : DELETED.rightBg;
    return side === "right" ? ADDED.rightBg : ADDED.leftBg; // added
  };

  const valueStyle = (status: DiffStatus, side: "left" | "right"): React.CSSProperties => {
    const italic: React.CSSProperties = { fontStyle: status === "modified" ? "italic" : "normal" };
    if (status === "modified") {
      return side === "left"
        ? { ...italic, textDecoration: "line-through", color: MODIFIED.leftFg }
        : { ...italic, color: MODIFIED.rightFg, fontWeight: 500 };
    }
    if (status === "deleted" && side === "left") {
      return { textDecoration: "line-through", color: DELETED.leftFg };
    }
    if (status === "added" && side === "right") {
      return { color: ADDED.rightFg, fontWeight: 500 };
    }
    return {};
  };

  const valueText = (side: "left" | "right", r: DiffRow): string => {
    const v = side === "left" ? r.left : r.right;
    if (v) return v;
    if (r.status === "unchanged" || r.status === "modified") return "-";
    return ""; // 增/删的空占位
  };

  const renderSide = (side: "left" | "right") => (
    <div className="flex flex-col min-w-0 flex-1" style={side === "left" ? { borderRight: `1px solid ${T.border}` } : {}}>
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ background: T.cloud, borderBottom: `1px solid ${T.border}` }}
      >
        <span className="text-[12px] font-medium" style={{ color: T.ink }}>
          {side === "left" ? leftTitle ?? t("diff.original") : rightTitle ?? t("diff.cleaned")}
        </span>
        <button
          onClick={() => copySide(side)}
          className="flex items-center gap-1 text-[12px] transition-opacity hover:opacity-70"
          style={{ color: T.info }}
        >
          {side === "left" ? (leftCopied ? <Check size={13} style={{ color: T.emerging }} /> : <Copy size={13} />)
            : (rightCopied ? <Check size={13} style={{ color: T.emerging }} /> : <Copy size={13} />)}
          {side === "left" ? (leftCopied ? t("msg.copied") : t("common.copy")) : (rightCopied ? t("msg.copied") : t("common.copy"))}
        </button>
      </div>
      <div
        ref={side === "left" ? leftRef : rightRef}
        onScroll={() => handleScroll(side)}
        className="flex-1 overflow-auto min-h-0"
      >
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex items-start px-3 py-2 gap-2 text-[13px]"
            style={{ borderBottom: `1px solid ${T.cloud}`, background: rowBg(r.status, side) }}
          >
            <span className="font-mono text-[11px] leading-5 flex-shrink-0 text-right" style={{ color: T.info, minWidth: 20 }}>
              {i + 1}
            </span>
            <span className="flex-shrink-0 leading-5" style={{ color: T.info, minWidth: 64 }}>
              {r.label}
            </span>
            <span className="flex-1 leading-5 break-words whitespace-pre-wrap" style={{ color: T.ink, ...valueStyle(r.status, side) }}>
              {valueText(side, r)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 min-h-0 rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
      {renderSide("left")}
      {renderSide("right")}
    </div>
  );
}
