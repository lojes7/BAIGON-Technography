import T from "../../constants/tokens";

function Btn({
  children, variant = "primary", onClick, size = "md",
  icon: Icon, disabled = false,
}: {
  children?: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger";
  onClick?: () => void; size?: "sm" | "md";
  icon?: React.ComponentType<{ size?: number }>; disabled?: boolean;
}) {
  const sz = size === "sm" ? "text-[12px] px-2.5 py-1.5 gap-1" : "text-[13px] px-3 py-[7px] gap-1.5";
  const iconSz = size === "sm" ? 12 : 14;
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: T.ink, color: "#F5EFEA", border: "none" },
    secondary: { background: T.white, color: T.ink, border: `1px solid ${T.border}` },
    ghost: { background: "transparent", color: T.info, border: "1px solid transparent" },
    danger: { background: T.risk, color: "#fff", border: "none" },
  };
  return (
    <button
      className={`inline-flex items-center font-medium rounded cursor-pointer transition-opacity hover:opacity-85 active:opacity-75 ${sz}`}
      style={{ ...styles[variant], opacity: disabled ? 0.45 : 1 }}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon size={iconSz} />}
      {children}
    </button>
  );
}

export default Btn;
