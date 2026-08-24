import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import T from "../../constants/tokens";
import logo from "../../assets/vector_color.svg";
import { ADMIN_NAV, STUDENT_NAV, TEACHER_NAV, STUDENT_AFFAIRS_NAV, ANALYST_NAV, REVIEWER_NAV } from "../../constants/nav";
import { useAuth } from "../../auth/AuthContext";
import type { NavSection } from "../../types";

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["data-center", "ai-processing", "curriculum", "evolution", "graph", "profile", "explore", "diagnosis"])
  );
  const navRef = useRef<HTMLElement>(null);
  const sectionRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const NAV = user?.role === "student" ? STUDENT_NAV
    : user?.role === "teacher" ? TEACHER_NAV
    : user?.role === "student_affair" ? STUDENT_AFFAIRS_NAV
    : user?.role === "analyst" ? ANALYST_NAV
    : user?.role === "reviewer" ? REVIEWER_NAV
    : ADMIN_NAV;
  const activePage = location.pathname.slice(1) || "dashboard";

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      const wasOpen = next.has(id);
      if (wasOpen) next.delete(id); else next.add(id);
      // 展开时滚动该段落到可见位置
      if (!wasOpen) {
        setTimeout(() => {
          const el = sectionRefs.current.get(id);
          if (el && navRef.current) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 50);
      }
      return next;
    });
  };

  const isActiveSection = (sec: NavSection) => {
    if (sec.single) return activePage === sec.id;
    return sec.children?.some(c => c.id === activePage) ?? false;
  };

  const handleNav = (id: string) => {
    navigate(id === "dashboard" ? "/" : `/${id}`);
  };

  return (
    <aside
      className="h-full flex flex-col flex-shrink-0 overflow-hidden transition-[width] duration-200"
      style={{ width: collapsed ? 64 : 224, background: T.ink }}
    >
      <div className="flex items-center gap-3 px-[18px] flex-shrink-0"
        style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <img src={logo} alt="百工谱" className="w-7 h-7 flex-shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-[14px] font-semibold leading-tight" style={{ color: "#F5EFEA" }}>百工谱</div>
            <div className="text-[10px] font-mono tracking-widest" style={{ color: "rgba(245,239,234,0.38)" }}>
              BAIGON Technography
            </div>
          </div>
        )}
      </div>

      <nav ref={navRef} className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "none" }}>
        {NAV.map(sec => {
          const Icon = sec.icon;
          const active = isActiveSection(sec);

          if (sec.single) {
            return (
              <button key={sec.id} ref={(el) => { if (el) sectionRefs.current.set(sec.id, el); }}
                className="w-full flex items-center gap-2.5 px-[18px] py-[8px] text-left transition-colors"
                style={{
                  fontSize: 13, color: active ? "#F5EFEA" : "rgba(245,239,234,0.6)",
                  background: active ? "rgba(255,255,255,0.1)" : "transparent",
                }}
                onClick={() => handleNav(sec.id)}
              >
                <Icon size={15} />
                {!collapsed && <span>{t(sec.labelKey)}</span>}
              </button>
            );
          }

          const open = expanded.has(sec.id);
          return (
            <div key={sec.id}>
              <button
                ref={(el) => { if (el) sectionRefs.current.set(sec.id, el); }}
                className="w-full flex items-center gap-2.5 px-[18px] py-[8px] text-left transition-colors"
                style={{
                  fontSize: 13,
                  color: active ? "#F5EFEA" : "rgba(245,239,234,0.6)",
                  background: "transparent",
                }}
                onClick={() => toggle(sec.id)}
              >
                <Icon size={15} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{t(sec.labelKey)}</span>
                    {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </>
                )}
              </button>
              {!collapsed && open && sec.children?.map(child => (
                <button key={child.id}
                  className="w-full flex items-center text-left transition-colors"
                  style={{
                    fontSize: 13, paddingLeft: 48, paddingRight: 16,
                    paddingTop: 6, paddingBottom: 6,
                    color: activePage === child.id ? "#F5EFEA" : "rgba(245,239,234,0.5)",
                    background: activePage === child.id ? "rgba(25,50,77,0.55)" : "transparent",
                  }}
                  onClick={() => handleNav(child.id)}
                >
                  {t(child.labelKey)}
                </button>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
