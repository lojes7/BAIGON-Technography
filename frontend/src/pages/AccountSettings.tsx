import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, Link2, LogOut, Shield, User as UserIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/ui";

/* 深蓝主色系（与其他改造页一致） */
const P = {
  primary: "#1E4C8F",
  primaryDeep: "#12305E",
  sky: "#A9C8EC",
  skySoft: "#DCE8F6",
  ink: "#16283E",
  muted: "#5E6E82",
  faint: "#8B99AB",
  green: "#159A6C",
  greenBg: "#E4F4ED",
  red: "#E25C4A",
  redBg: "#FBEAE7",
  border: "#E4EAF2",
  bgSoft: "#FAFBFD",
} as const;

const ROLE_LABEL: Record<string, string> = {
  student: "学生", teacher: "教师", admin: "管理员", reviewer: "审核员", analyst: "分析员", student_affairs: "学工",
};

export default function AccountSettings() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });

  const savePassword = () => {
    if (!pwd.current || !pwd.next || !pwd.confirm) { toast.error("请填写完整密码字段"); return; }
    if (pwd.next !== pwd.confirm) { toast.error("两次输入的新密码不一致"); return; }
    if (pwd.next.length < 6) { toast.error("新密码长度至少 6 位"); return; }
    toast.success("密码已修改", { description: "下次登录请使用新密码" });
    setPwd({ current: "", next: "", confirm: "" });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.personalCenter"), t("nav.accountSettings")]}
        title={t("page.accountSettings.title")}
        description="维护个人资料、登录密码与第三方账号绑定"
      />

      <div className="grid grid-cols-3 gap-5">
        {/* 左：个人资料卡 */}
        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${P.border}` }}>
            {/* 头部渐变横幅 */}
            <div className="h-20 relative" style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)` }}>
              <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>
            <div className="px-5 pb-5 flex flex-col items-center -mt-9 relative">
              <div className="w-[68px] h-[68px] rounded-full flex items-center justify-center text-[24px] font-bold text-white flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${P.primary}, ${P.sky})`, border: "3px solid #fff" }}>
                {user?.name?.[0] ?? "学"}
              </div>
              <div className="text-[16px] font-semibold mt-2" style={{ color: P.ink }}>{user?.name ?? "同学"}</div>
              <span className="mt-1.5 inline-flex text-[11px] px-2.5 py-0.5 rounded-full font-medium" style={{ background: P.skySoft, color: P.primary }}>
                {ROLE_LABEL[user?.role ?? ""] ?? "学生"}
              </span>
              <div className="mt-3 text-[12px] font-mono" style={{ color: P.faint }}>账号：{user?.uid ?? "-"}</div>
            </div>
          </div>

          {/* 基本信息 */}
          <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${P.border}` }}>
              <UserIcon size={14} style={{ color: P.primary }} />
              <span className="text-[15px] font-semibold" style={{ color: P.ink }}>{t("page.accountSettings.basicInfo")}</span>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                ["姓名", user?.name ?? "张三", false],
                ["邮箱", "zhangsan@example.com", true],
                ["手机", "138****1234", true],
              ].map(([label, value, canEdit]) => (
                <div key={String(label)} className="flex items-center gap-4">
                  <span className="w-12 text-[13px] flex-shrink-0" style={{ color: P.faint }}>{label}</span>
                  <span className="text-[13px] font-medium flex-1 min-w-0 truncate" style={{ color: P.ink }}>{value}</span>
                  {canEdit ? (
                    <button className="text-[12px] flex-shrink-0 whitespace-nowrap cursor-pointer" style={{ color: P.primary }}
                      onClick={() => toast.info("请联系管理员或通过绑定渠道更新该信息")}>
                      修改
                    </button>
                  ) : <span className="w-[26px]" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右列：密码 + 绑定 + 退出 */}
        <div className="col-span-2 flex flex-col gap-5">
          {/* 修改密码 */}
          <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${P.border}` }}>
              <KeyRound size={14} style={{ color: P.primary }} />
              <span className="text-[15px] font-semibold" style={{ color: P.ink }}>{t("page.accountSettings.changePassword")}</span>
            </div>
            <div className="px-5 py-4 space-y-3">
              {([
                ["当前密码", "current"] as const,
                ["新密码", "next"] as const,
                ["确认新密码", "confirm"] as const,
              ]).map(([label, key]) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="w-20 text-[13px] flex-shrink-0" style={{ color: P.faint }}>{label}</span>
                  <input type="password" className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none transition-colors focus:border-[#2563EB]"
                    style={{ background: P.bgSoft, border: `1px solid ${P.border}`, color: P.ink }}
                    value={pwd[key]} onChange={e => setPwd(v => ({ ...v, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <button
                  className="inline-flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg font-medium transition-all hover:opacity-85 whitespace-nowrap"
                  style={{ background: P.primary, color: "#fff" }}
                  onClick={savePassword}
                >
                  <Shield size={13} />保存修改
                </button>
                <span className="text-[12px]" style={{ color: P.faint }}>密码长度至少 6 位，建议包含字母与数字</span>
              </div>
            </div>
          </div>

          {/* 绑定账号 */}
          <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${P.border}` }}>
              <Link2 size={14} style={{ color: P.primary }} />
              <span className="text-[15px] font-semibold" style={{ color: P.ink }}>{t("page.accountSettings.bindAccounts")}</span>
            </div>
            <div className="px-5 py-2">
              {[
                ["微信", "未绑定"],
                ["QQ", "未绑定"],
              ].map(([platform, status], i) => (
                <div key={i} className="flex items-center gap-4 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${P.border}` }}>
                  <span className="w-12 text-[13px] flex-shrink-0" style={{ color: P.faint }}>{platform}</span>
                  <span className="flex-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#EEF2F6", color: P.faint }}>{status}</span>
                  </span>
                  <button
                    className="text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-85 whitespace-nowrap flex-shrink-0"
                    style={{ background: "#fff", color: P.primary, border: `1px solid ${P.border}` }}
                    onClick={() => toast.info(`跳转 ${platform} 授权页面（演示环境未接入）`)}
                  >
                    绑定
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 危险区：退出登录 */}
          <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.redBg}` }}>
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-[14px] font-semibold" style={{ color: P.ink }}>退出登录</div>
                <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>退出后需重新输入账号密码登录</div>
              </div>
              <button
                className="inline-flex items-center gap-1.5 text-[12.5px] px-3.5 py-2 rounded-lg font-medium transition-all hover:opacity-85 whitespace-nowrap flex-shrink-0"
                style={{ background: "#fff", color: P.red, border: `1px solid ${P.red}` }}
                onClick={() => { logout(); navigate("/login"); }}
              >
                <LogOut size={13} />退出登录
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
