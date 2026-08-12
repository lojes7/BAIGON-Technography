import { useTranslation } from "react-i18next";
import T from "../../constants/tokens";

function ConfidenceBadge({ value }: { value: number }) {
  const { t } = useTranslation();
  const key = value >= 0.85 ? "confidence.high" : value >= 0.70 ? "confidence.medium" : "confidence.low";
  const color = value >= 0.85 ? T.emerging : value >= 0.70 ? T.pending : T.risk;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[13px]" style={{ color: T.ink }}>{value.toFixed(2)}</span>
      <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ color, background: `${color}18` }}>
        {t(key)}
      </span>
    </span>
  );
}

export default ConfidenceBadge;
