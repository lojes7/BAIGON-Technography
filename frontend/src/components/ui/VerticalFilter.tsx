import T from "../../constants/tokens";

export interface VerticalFilterOption {
  value: string;
  label: string;
}

export interface VerticalFilterSection {
  title: string;
  value: string;
  options: VerticalFilterOption[];
  onChange: (value: string) => void;
}

function VerticalFilter({ sections }: { sections: VerticalFilterSection[] }) {
  return (
    <div className="bg-white rounded-xl" style={{ border: `1px solid ${T.border}` }}>
      <div className="px-3 py-3 space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="mb-1.5 text-[11px] font-medium" style={{ color: T.info }}>
              {section.title}
            </div>
            <div className="flex flex-col gap-0.5">
              {section.options.map((option) => {
                const active = option.value === section.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors"
                    style={{
                      background: active ? T.teal : "transparent",
                      color: active ? "white" : T.ink,
                    }}
                    onClick={() => section.onChange(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default VerticalFilter;
