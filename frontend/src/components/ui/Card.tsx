import T from "../../constants/tokens";

function Card({
  children, className = "", title, action, noPad = false,
}: {
  children?: React.ReactNode; className?: string; title?: string;
  action?: React.ReactNode; noPad?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl ${className}`} style={{ border: `1px solid ${T.border}`, boxShadow: "0 1px 3px rgba(25,50,77,0.06)" }}>
      {title && (
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${T.cloud}` }}>
          <span className="text-[14px] font-medium" style={{ color: T.ink }}>{title}</span>
          {action}
        </div>
      )}
      <div className={noPad ? "" : ""}>{children}</div>
    </div>
  );
}

export default Card;
