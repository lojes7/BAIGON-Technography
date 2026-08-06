import { useTranslation } from "react-i18next";
import T from "../../constants/tokens";
import STATUS from "../../constants/status";

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  // 后端返回大写 SNAKE_CASE，统一转为小写 snake_case 匹配 STATUS 表
  const normalized = status.toLowerCase();
  const s = STATUS[normalized] ?? { key: status, color: T.info, bg: "#EDE6E0" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}25` }}
    >
      {t(s.key)}
    </span>
  );
}

export default StatusBadge;
