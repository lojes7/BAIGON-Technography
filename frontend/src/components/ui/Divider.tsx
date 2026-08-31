import T from "../../constants/tokens";

function Divider({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={className} style={{ height: 1, background: T.cloud, ...style }} />;
}

export default Divider;
