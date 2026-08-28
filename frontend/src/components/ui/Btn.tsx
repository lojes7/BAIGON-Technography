import T from "../../constants/tokens";

function Btn({
  children, variant = "primary", onClick, size = "md",
  icon: Icon, disabled = false, title,
}: {
  children?: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger";
  onClick?: () => void; size?: "sm" | "md";
  icon?: React.ComponentType<{ size?: number }>; disabled?: boolean; title?: string;
}) {
  const sz = size === "sm" ? "text-[12px] px-2.5 py-1.5 gap-1" : "text-[14px] px-4 py-2 gap-1.5";
  const iconSz = size === "sm" ? 12 : 14;
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: T.teal, color: "#FFFFFF", border: "none", boxShadow: "0 4px 6px -1px rgba(37,99,235,0.3)" },
    secondary: { background: T.white, color: T.ink, border: `1px solid ${T.border}` },
    ghost: { background: "transparent", color: T.info, border: "1px solid transparent" },
    danger: { background: T.risk, color: "#FFFFFF", border: "none" },
  };
  return (
    <button
      className={`inline-flex items-center font-medium rounded-md cursor-pointer transition-opacity hover:opacity-85 active:opacity-75 ${sz}`}
      style={{ ...styles[variant], opacity: disabled ? 0.45 : 1 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {Icon && <Icon size={iconSz} />}
      {children}
    </button>
  );
}

export default Btn;
