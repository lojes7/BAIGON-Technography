import T from "../../constants/tokens";
import type { TimelineGranularity, TimelineMode } from "../../utils/skill-graph";

const fieldClass = "h-9 px-3 rounded-md text-[13px] outline-none bg-white";
const fieldStyle: React.CSSProperties = { border: `1px solid ${T.border}`, color: T.ink };

export default function SkillGraphTimelineFilter({
  mode,
  granularity,
  value,
  onModeChange,
  onGranularityChange,
  onValueChange,
}: {
  mode: TimelineMode;
  granularity: TimelineGranularity;
  value: string;
  onModeChange: (mode: TimelineMode) => void;
  onGranularityChange: (granularity: TimelineGranularity) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="flex items-end gap-3 flex-wrap">
      <label className="flex flex-col gap-1 w-28">
        <span className="text-[11px]" style={{ color: T.info }}>时间粒度</span>
        <select
          className={`${fieldClass} w-full`}
          style={fieldStyle}
          value={granularity}
          onChange={(event) => onGranularityChange(event.target.value as TimelineGranularity)}
        >
          <option value="month">按月</option>
          <option value="year">按年</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 w-32">
        <span className="text-[11px]" style={{ color: T.info }}>范围</span>
        <select
          className={`${fieldClass} w-full`}
          style={fieldStyle}
          value={mode}
          onChange={(event) => onModeChange(event.target.value as TimelineMode)}
        >
          <option value="all">全部时间</option>
          <option value="before">该时间之前</option>
          <option value="in">仅该时间</option>
          <option value="from">从该时间起</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 w-40">
        <span className="text-[11px]" style={{ color: T.info }}>
          {granularity === "month" ? "月份" : "年份"}
        </span>
        {granularity === "month" ? (
          <input
            type="month"
            className={`${fieldClass} w-full`}
            style={fieldStyle}
            disabled={mode === "all"}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
          />
        ) : (
          <input
            type="number"
            min="1900"
            max="2100"
            className={`${fieldClass} w-full`}
            style={fieldStyle}
            disabled={mode === "all"}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
          />
        )}
      </label>

      <div className="pb-2 text-[11px]" style={{ color: T.info }}>
        “之前”不含所选月/年；“从…起”包含所选月/年的第一天。
      </div>
    </div>
  );
}
