import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

/* 深蓝主色系（全局推广时与页面一起收敛到 tokens.ts） */
const PRIMARY = "#1E4C8F";
const INK = "#16283E";
const MUTED = "#8B99AB";
const BORDER = "#E4EAF2";
const HOVER_BG = "#F3F6FB";
const DISABLED_BG = "#F6F8FB";
const DISABLED = "#C4CFDD";

export default function Pagination({
  page,
  totalPages,
  onChange,
  disabled = false,
  total,
  pageSize = 20,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
  total?: number;
  pageSize?: number;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const [draft, setDraft] = useState(String(page));

  useEffect(() => { setDraft(String(page)); }, [page]);

  const jump = () => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(page));
      return;
    }
    const clamped = Math.min(Math.max(1, parsed), safeTotalPages);
    setDraft(String(clamped));
    if (clamped !== page) onChange(clamped);
  };

  const navBtn = (label: string, target: number, off: boolean, icon?: React.ReactNode, iconRight = false) => {
    const isOff = disabled || off;
    return (
      <button
        type="button"
        disabled={isOff}
        onClick={() => onChange(target)}
        className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12px] whitespace-nowrap transition-colors disabled:cursor-not-allowed"
        style={{
          background: isOff ? DISABLED_BG : "#FFFFFF",
          color: isOff ? DISABLED : INK,
          border: `1px solid ${isOff ? "#EDF0F5" : BORDER}`,
        }}
        onMouseEnter={e => { if (!isOff) e.currentTarget.style.background = HOVER_BG; }}
        onMouseLeave={e => { if (!isOff) e.currentTarget.style.background = "#FFFFFF"; }}
      >
        {icon && !iconRight && icon}
        {label}
        {icon && iconRight && icon}
      </button>
    );
  };

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 py-2 text-[13px]">
      {/* 左侧：总记录数 + 每页条数 */}
      <div className="whitespace-nowrap" style={{ color: MUTED }}>
        {total != null ? (
          <>
            共 <span className="font-mono font-medium" style={{ color: INK }}>{total.toLocaleString()}</span> 条记录
            <span className="mx-2.5" style={{ color: BORDER }}>|</span>
            每页 <span className="font-mono font-medium" style={{ color: INK }}>{pageSize}</span> 条
          </>
        ) : ""}
      </div>

      {/* 右侧：翻页控件 */}
      <div className="flex items-center gap-1.5">
        {navBtn("首页", 1, page <= 1)}
        {navBtn("上一页", page - 1, page <= 1, <ChevronsLeft size={13} />)}
        <span className="px-1.5 whitespace-nowrap" style={{ color: MUTED }}>
          页码 <span className="font-mono font-medium" style={{ color: PRIMARY }}>{Math.min(Math.max(1, page), safeTotalPages)}</span>
          <span style={{ color: DISABLED }}>/{safeTotalPages}</span>
        </span>
        {navBtn("下一页", page + 1, page >= safeTotalPages, <ChevronsRight size={13} />, true)}
        {navBtn("尾页", safeTotalPages, page >= safeTotalPages)}
        <span className="ml-1.5 flex items-center gap-1.5 whitespace-nowrap" style={{ color: MUTED }}>
          <input
            className="h-8 w-12 rounded-full text-center text-[12px] outline-none focus:ring-2"
            style={{ background: "#FFFFFF", color: INK, border: `1px solid ${BORDER}` }}
            value={draft}
            inputMode="numeric"
            disabled={disabled}
            onChange={e => setDraft(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={jump}
            onKeyDown={e => { if (e.key === "Enter") jump(); }}
          />
          跳转到
        </span>
      </div>
    </div>
  );
}
