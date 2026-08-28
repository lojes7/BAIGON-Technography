import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import T from "../../constants/tokens";

const DISABLED_COLOR = "#D1D5DB";

function pageItems(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const items: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("...");
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < total - 1) items.push("...");
  items.push(total);
  return items;
}

export default function Pagination({
  page,
  totalPages,
  onChange,
  disabled = false,
  total,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
  total?: number; 
}) {
  const [draft, setDraft] = useState(String(page));

  useEffect(() => { setDraft(String(page)); }, [page]);

  const jump = () => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(page));
      return;
    }
    const clamped = Math.min(Math.max(1, parsed), totalPages);
    setDraft(String(clamped));
    if (clamped !== page) onChange(clamped);
  };

  const items = pageItems(page, totalPages);

  return (
    <div className="flex items-center justify-between py-2 text-[14px]">
      <div className="text-[13px]" style={{ color: T.info }}>
        {total != null ? `共 ${total} 条记录` : ""}
      </div>

      <div className="flex items-center gap-1">
        {/* 上一页图标按钮 */}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed"
          style={{
            background: disabled || page <= 1 ? "transparent" : "#F1F3F9",
            color: disabled || page <= 1 ? DISABLED_COLOR : T.ink,
          }}
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="上一页"
        >
          <ChevronLeft size={16} />
        </button>

        {/* 页码按钮组 */}
        {items.map((item, idx) =>
          item === "..." ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-[13px]" style={{ color: T.info }}>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className="flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-[13px] transition-colors"
              style={{
                background: item === page ? T.teal : "transparent",
                color: item === page ? "#FFFFFF" : T.ink,
              }}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          )
        )}

        {/* 下一页图标按钮 */}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed"
          style={{
            background: disabled || page >= totalPages ? "transparent" : "#F1F3F9",
            color: disabled || page >= totalPages ? DISABLED_COLOR : T.ink,
          }}
          disabled={disabled || page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="下一页"
        >
          <ChevronRight size={16} />
        </button>

        {/* 跳页输入 */}
        {totalPages > 7 && (
          <div className="ml-3 flex items-center gap-1 text-[13px]" style={{ color: T.info }}>
            <span>跳至</span>
            <input
              className="h-8 w-12 rounded-md text-center text-[13px] outline-none"
              style={{ background: "#F1F3F9", color: T.ink, border: "none" }}
              value={draft}
              inputMode="numeric"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={jump}
              onKeyDown={(e) => { if (e.key === "Enter") jump(); }}
            />
            <span>页</span>
          </div>
        )}
      </div>
    </div>
  );
}
