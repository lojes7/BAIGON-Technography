import { ChevronRight } from "lucide-react";
import T from "../../constants/tokens";

function PageHeader({
  breadcrumbs, title, description, updated, actions,
}: {
  breadcrumbs: string[]; title: string; description?: string;
  updated?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex-shrink-0">
      <div className="flex items-center gap-1 text-[12px] mb-1.5" style={{ color: T.info }}>
        {breadcrumbs.map((b, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={11} />}
            <span className={i === breadcrumbs.length - 1 ? "font-medium" : ""}>{b}</span>
          </span>
        ))}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[15px] font-medium leading-tight" style={{ color: T.ink }}>{title}</h1>
          {description && <p className="text-[13px] mt-0.5" style={{ color: T.info }}>{description}</p>}
          {updated && (
            <p className="text-[12px] mt-1 font-mono" style={{ color: T.info }}>
              常州市 · 人工智能软件与智能制造 · 数据截至 {updated}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
