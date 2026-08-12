import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Btn, Card } from "../components/ui";

export default function AccountSettings() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.personalCenter"), t("nav.accountSettings")]}
        title={t("page.accountSettings.title")}
      />

      <Card title={t("page.accountSettings.basicInfo")}>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-[20px] font-bold text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${T.teal}, ${T.ink})` }}>
              {user?.name?.[0] ?? "张"}
            </div>
            <Btn variant="secondary" size="sm">更换头像</Btn>
          </div>
          {[
            ["姓名", "张三"],
            ["邮箱", "zhangsan@example.com"],
            ["手机", "138****1234", true],
          ].map(([label, value, canEdit], i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="w-20 text-[13px] flex-shrink-0" style={{ color: T.info }}>{label}</span>
              <span className="text-[13px] font-medium" style={{ color: T.ink }}>{value}</span>
              {canEdit && <Btn variant="ghost" size="sm">修改</Btn>}
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("page.accountSettings.changePassword")}>
        <div className="px-5 py-4 space-y-3">
          {["当前密码", "新密码", "确认新密码"].map((label, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="w-24 text-[13px] flex-shrink-0" style={{ color: T.info }}>{label}</span>
              <input type="password" className="flex-1 px-3 py-2 rounded-md text-[13px] outline-none"
                style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }} />
            </div>
          ))}
          <div className="pt-2">
            <Btn onClick={() => toast.success("密码已修改")}>保存修改</Btn>
          </div>
        </div>
      </Card>

      <Card title={t("page.accountSettings.bindAccounts")}>
        <div className="px-5 py-4 space-y-3">
          {[
            ["微信", "未绑定"],
            ["QQ", "未绑定"],
          ].map(([platform, status], i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="w-20 text-[13px]" style={{ color: T.info }}>{platform}</span>
              <span className="text-[13px] flex-1" style={{ color: T.info }}>{status}</span>
              <Btn variant="secondary" size="sm">绑定</Btn>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-center">
        <button className="text-[13px] font-medium" style={{ color: T.risk }}
          onClick={() => { logout(); navigate("/login"); }}>
          退出登录
        </button>
      </div>
    </div>
  );
}
