import { useEffect, useState } from "react";
import T from "../../constants/tokens";

const btnCls = "px-3 py-1.5 rounded-md disabled:opacity-30";
const btnStyle: React.CSSProperties = { border: `1px solid ${T.border}`, color: T.ink, background: "white" };

export default function Pagination({
  page,
  totalPages,
  onChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
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

  return (
    <div className="flex items-center justify-center gap-2 text-[13px]">
      <button
        className={btnCls}
        style={btnStyle}
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
      >
        上一页
      </button>

      <div className="flex items-center gap-1" style={{ color: T.info }}>
        第
        <input
          className="w-11 rounded-md px-1 py-1 text-center outline-none"
          style={{ border: `1px solid ${T.border}`, color: T.ink, background: "white" }}
          value={draft}
          inputMode="numeric"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={jump}
          onKeyDown={(e) => { if (e.key === "Enter") jump(); }}
        />
        / {totalPages} 页
      </div>

      <button
        className={btnCls}
        style={btnStyle}
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        下一页
      </button>
    </div>
  );
}
