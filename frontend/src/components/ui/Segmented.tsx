import T from "../../constants/tokens";

export interface SegmentedOption {
  value: string;
  label: string;
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg bg-white p-1"
      style={{ border: `1px solid ${T.border}` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className="rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              background: active ? T.teal : "transparent",
              color: active ? "white" : T.info,
            }}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;
