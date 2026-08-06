import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import T from "../../constants/tokens";

function MetricCard({
  title, value, sub, severity = "normal", trend,
}: {
  title: string; value: string | number; sub?: string;
  severity?: "normal" | "warning" | "critical";
  trend?: { label: string; up?: boolean };
}) {
  const borderColor = severity === "critical" ? T.risk : severity === "warning" ? T.pending : T.border;
  const subColor = severity === "critical" ? T.risk : severity === "warning" ? T.pending : T.info;
  return (
    <div className="bg-white rounded-lg p-4 flex flex-col gap-2 cursor-pointer transition-all hover:shadow-sm"
      style={{ border: `1px solid ${borderColor}` }}>
      <div className="text-[13px]" style={{ color: T.info }}>{title}</div>
      <div className="text-[22px] font-mono font-medium leading-tight" style={{ color: T.ink }}>{value}</div>
      {sub && (
        <div className="text-[12px] flex items-center gap-1" style={{ color: subColor }}>
          {severity !== "normal" && <AlertTriangle size={11} />}
          {sub}
        </div>
      )}
      {trend && (
        <div className="text-[12px] flex items-center gap-1 mt-auto pt-1" style={{
          color: trend.up === true ? T.emerging : trend.up === false ? T.declining : T.info,
        }}>
          {trend.up === true && <TrendingUp size={11} />}
          {trend.up === false && <TrendingDown size={11} />}
          {trend.label}
        </div>
      )}
    </div>
  );
}

export default MetricCard;
