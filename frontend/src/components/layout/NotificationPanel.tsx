import { useState } from "react";
import { X, CheckCircle, AlertTriangle, Info } from "lucide-react";
import T from "../../constants/tokens";
import notifData from "../../data/notification";
import { useNav } from "../../context/NavContext";

const notifIcon: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
  success: { icon: <CheckCircle size={14} />, bg: `${T.emerging}15`, color: T.emerging },
  warning: { icon: <AlertTriangle size={14} />, bg: `${T.pending}15`, color: T.pending },
  info: { icon: <Info size={14} />, bg: `${T.stable}15`, color: T.stable },
};

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const nav = useNav();
  const [items, setItems] = useState(notifData);
  const unread = items.filter(n => !n.read).length;

  const markAll = () => setItems(prev => prev.map(n => ({ ...n, read: true })));
  const markOne = (id: number) => setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bg-white rounded-lg flex flex-col overflow-hidden"
        style={{
          top: 62, right: 12, width: 380, maxHeight: "72vh",
          border: `1px solid ${T.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
        }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${T.cloud}` }}>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium" style={{ color: T.ink }}>通知中心</span>
            {unread > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full text-white"
                style={{ background: T.risk }}>{unread}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button className="text-[12px]" style={{ color: T.teal }} onClick={markAll}>
                全部标记已读
              </button>
            )}
            <button onClick={onClose} style={{ color: T.info }}><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: T.cloud }}>
          {items.map(n => {
            const ni = notifIcon[n.type];
            return (
              <div key={n.id}
                className="flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-gray-50"
                style={{ background: n.read ? "transparent" : `${T.teal}05` }}
                onClick={() => {
                  markOne(n.id);
                  if (n.target) { onClose(); nav(n.target); }
                }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: ni.bg, color: ni.color }}>
                  {ni.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-medium leading-snug" style={{ color: T.ink }}>
                      {n.title}
                    </span>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: T.teal }} />
                    )}
                  </div>
                  <p className="text-[12px] mt-0.5 leading-relaxed line-clamp-2" style={{ color: T.info }}>
                    {n.body}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-mono" style={{ color: T.info }}>{n.time}</span>
                    {n.target && (
                      <span className="text-[11px]" style={{ color: T.teal }}>点击查看 →</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 flex-shrink-0" style={{ borderTop: `1px solid ${T.cloud}` }}>
          <button className="w-full text-[12px] py-2 rounded-md"
            style={{ color: T.info, background: T.cloud }}
            onClick={onClose}>
            查看全部通知历史
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotificationPanel;
