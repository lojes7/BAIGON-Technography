import T from "../../constants/tokens";

export interface UnderlineTabOption {
  value: string;
  label: string;
}

export interface UnderlineTabSection {
  value: string;
  options: UnderlineTabOption[];
  onChange: (value: string) => void;
}

function UnderlineTabs({ sections }: { sections: UnderlineTabSection[] }) {
  return (
    <div
      className="flex items-center gap-6 border-b"
      style={{ borderColor: T.border }}
    >
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="flex items-center gap-6">
          {sectionIndex > 0 && (
            <span className="h-4 w-px" style={{ background: T.border }} />
          )}
          {section.options.map((option) => {
            const active = option.value === section.value;
            return (
              <button
                key={option.value}
                type="button"
                className="relative whitespace-nowrap px-1 pb-2 text-[13px]"
                style={{ color: active ? T.teal : T.info }}
                onClick={() => section.onChange(option.value)}
              >
                {option.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: T.teal }}
                  />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default UnderlineTabs;
