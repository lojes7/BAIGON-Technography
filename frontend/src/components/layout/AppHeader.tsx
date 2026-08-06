import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Menu, Activity, Bell, MapPin, User, LogOut, ChevronDown } from "lucide-react";
import T from "../../constants/tokens";
import { useAuth } from "../../auth/AuthContext";
import LanguageSwitcher from "./LanguageSwitcher";

export default function AppHeader({ onToggle, onNotif, notifOpen }: { onToggle: () => void; onNotif: () => void; notifOpen: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex items-center gap-4 px-4 flex-shrink-0 bg-white"
      style={{ height: 56, borderBottom: `1px solid ${T.border}` }}>
      <button onClick={onToggle}
        className="p-1.5 rounded transition-colors hover:bg-gray-100"
        style={{ color: T.info }}>
        <Menu size={17} />
      </button>

      <div className="flex items-center gap-2 text-[13px]" style={{ color: T.ink }}>
        <MapPin size={13} style={{ color: T.info }} />
        <span className="font-medium">常州市</span>
        <span style={{ color: "#CBD3D9" }}>·</span>
        <span style={{ color: T.info }}>人工智能软件与智能制造</span>
      </div>

      <div className="flex-1 max-w-60">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md"
          style={{ background: T.cloud, color: T.info }}>
          <Search size={13} />
          <input className="bg-transparent text-[13px] flex-1 outline-none placeholder:text-inherit"
            style={{ color: T.ink }} placeholder="搜索岗位、能力、课程…" />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="relative flex items-center text-[12px] font-mono px-2.5 py-1.5 rounded"
          style={{ background: "#EBF2FA", color: T.stable }}>
          <Activity size={12} className="mr-1" />
          AI抽取 #102 · 78%
          <span className="ml-2 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.stable }} />
        </div>
        <LanguageSwitcher />
        <button className="relative p-2 rounded transition-colors hover:bg-gray-50"
          style={{ color: notifOpen ? T.teal : T.info, background: notifOpen ? `${T.teal}12` : "transparent" }}
          onClick={onNotif}>
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: T.risk }} />
        </button>
        <div className="relative">
          <button className="flex items-center gap-2 px-2.5 py-1.5 rounded transition-colors hover:bg-gray-50 text-[13px]"
            style={{ color: T.ink }}
            onClick={() => setMenuOpen(!menuOpen)}>
            <div className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ background: T.teal }}>{user?.name?.[0] ?? "?"}</div>
            <span>{user?.name ?? "User"}</span>
            <ChevronDown size={12} style={{ color: T.info }} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-full right-0 mt-1 bg-white rounded-md shadow-lg z-30 py-1 min-w-[160px]"
                style={{ border: `1px solid ${T.border}` }}>
                <button className="w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 flex items-center gap-2"
                  style={{ color: T.ink }}
                  onClick={() => { navigate("/profile"); setMenuOpen(false); }}>
                  <User size={14} />查看个人资料
                </button>
                <button className="w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 flex items-center gap-2"
                  style={{ color: T.risk }}
                  onClick={() => { logout(); navigate("/login"); setMenuOpen(false); }}>
                  <LogOut size={14} />退出登录
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
