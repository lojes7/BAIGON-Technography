import T from "../../constants/tokens";
import Btn from "../ui/Btn";

function ConfirmDialog({
  title, body, confirmLabel = "确认", danger = false, onConfirm, onClose,
}: {
  title: string; body: string; confirmLabel?: string;
  danger?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(25,50,77,0.3)" }} onClick={onClose}>
      <div className="bg-white rounded-lg w-96 p-6"
        style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-[16px] font-medium mb-2" style={{ color: T.ink }}>{title}</h3>
        <p className="text-[13px] mb-5 leading-relaxed" style={{ color: T.info }}>{body}</p>
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>取消</Btn>
          <Btn variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
