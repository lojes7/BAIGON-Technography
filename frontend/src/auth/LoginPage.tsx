import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import T from "../constants/tokens";
import { Eye, EyeOff, User, Lock, LogIn, ArrowRight, Network, TrendingUp, Target, Briefcase, Layers, GitBranch } from "lucide-react";

type Mode = "login" | "register";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [loginUid, setLoginUid] = useState("admin");
  const [loginPass, setLoginPass] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regPass2, setRegPass2] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const { t, i18n } = useTranslation();
  const switchMode = (m: Mode) => { setError(""); setSuccess(""); setMode(m); };

  // ── 错误信息处理：error.xxx 走翻译，否则直显 ──
  const errMsg = (msg: string) => msg.startsWith("error.") ? t(msg) : msg;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loginPass || loginPass.length < 6) { setError(t("auth.passwordMin")); return; }
    setLoading(true);
    try { await login(loginUid, loginPass); navigate("/"); }
    catch (err) { setError(err instanceof Error ? errMsg(err.message) : t("error.loginFailed")); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!regName.trim() || !regEmail.trim() || !regPass || !regPass2) { setError(t("error.fillAllFields")); return; }
    if (regPass.length < 6) { setError(t("error.passwordMin")); return; }
    if (regPass !== regPass2) { setError(t("error.passwordMismatch")); return; }
    setLoading(true);
    try { await register(regName, regEmail, regPass); setSuccess(t("auth.registerSuccess")); setTimeout(() => setMode("login"), 1200); }
    catch (err) { setError(err instanceof Error ? errMsg(err.message) : t("error.registerFailed")); }
    finally { setLoading(false); }
  };

  const inputStyle = { width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", color: T.ink, fontSize: 14, outline: "none", boxSizing: "border-box" as const };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #F0F4F8 0%, #E8EEF4 100%)", fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif' }}>
      <div className="flex rounded-2xl overflow-hidden"
        style={{ maxWidth: 900, width: "100%", boxShadow: "0 20px 60px rgba(25,50,77,0.15)", border: "1px solid rgba(25,50,77,0.08)" }}>

        {/* ─ 左侧：品牌面板 ── */}
        <div className="hidden md:flex flex-col items-center justify-center flex-shrink-0"
          style={{ width: 320, background: `linear-gradient(135deg, ${T.ink} 0%, ${T.teal} 100%)`, padding: "48px 32px", position: "relative" }}>
          
          {/* 装饰性圆圈 */}
          <div style={{ position: "absolute", top: 40, right: 40, width: 120, height: 120, borderRadius: "50%", background: "rgba(49,93,109,0.2)" }} />
          <div style={{ position: "absolute", bottom: 60, left: 30, width: 80, height: 80, borderRadius: "50%", background: "rgba(49,93,109,0.15)" }} />
          
          {/* 百工谱相关的知识图谱/数据可视化图标 */}
          <div style={{ marginBottom: 24, position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              {/* 中心节点 - 岗位 */}
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
                <Briefcase size={28} color="white" />
              </div>
              
              {/* 连接线 */}
              <div style={{ width: 2, height: 24, background: "rgba(255,255,255,0.3)" }} />
              
              {/* 第二层 - 技能和能力 */}
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Target size={20} color="white" />
                </div>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Layers size={20} color="white" />
                </div>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <GitBranch size={20} color="white" />
                </div>
              </div>
              
              {/* 连接线 */}
              <div style={{ width: 2, height: 20, background: "rgba(255,255,255,0.3)" }} />
              
              {/* 第三层 - 趋势分析 */}
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingUp size={16} color="white" />
                </div>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Network size={16} color="white" />
                </div>
              </div>
            </div>
          </div>
          
          <h3 style={{ fontSize: 24, fontWeight: 700, color: "white", marginBottom: 12, textAlign: "center", zIndex: 1 }}>
            百工谱
          </h3>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center", marginBottom: 32, zIndex: 1 }}>
            岗位能力智能分析平台
          </p>
          
          {/* 平台特色描述 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,0.1)", borderRadius: 8 }}>
              <Network size={18} color="rgba(255,255,255,0.9)" />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>岗位能力知识图谱</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,0.1)", borderRadius: 8 }}>
              <TrendingUp size={18} color="rgba(255,255,255,0.9)" />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>技能演化趋势分析</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,0.1)", borderRadius: 8 }}>
              <Target size={18} color="rgba(255,255,255,0.9)" />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>人岗匹配智能诊断</span>
            </div>
          </div>
        </div>

        {/* ── 右侧：表单 ── 垂直居中 */}
        <div className="flex-1 px-12 py-12 flex items-center justify-center" style={{ background: T.white }}>
          <div style={{ width: "100%", maxWidth: 420 }}>
            {/* 语言切换 */}
            <div className="flex justify-end mb-2">
              <button
                className="text-[12px] rounded font-medium transition-colors"
                style={{ background: `${T.teal}10`, color: T.teal, border: `1px solid ${T.teal}30`, cursor: "pointer", width: 36, height: 28 }}
                onClick={() => i18n.changeLanguage(i18n.language.startsWith("en") ? "zh" : "en-GB")}>
                {i18n.language.startsWith("en") ? "中" : "EN"}
              </button>
            </div>
            {/* 移动端 Logo */}
            <div className="md:hidden flex items-center gap-3 mb-6">
              <div style={{ width: 40, height: 40, borderRadius: 10, background: T.teal, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: T.white, fontSize: 18, fontWeight: 700 }}>百</span>
              </div>
              <span className="text-[18px] font-semibold" style={{ color: T.ink }}>百工谱</span>
            </div>

            <h2 className="text-[24px] font-semibold mb-2" style={{ color: T.ink }}>
              {mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}
            </h2>
            <p className="text-[14px] mb-8" style={{ color: "#6B7280" }}>
              {mode === "login" ? t("auth.loginSubtitle") : t("auth.registerSubtitle")}
            </p>

            {error && <div className="text-[13px] p-3 rounded-lg mb-6" style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>{error}</div>}
            {success && <div className="text-[13px] p-3 rounded-lg mb-6" style={{ background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>{success}</div>}

            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <div style={{ position: "relative" }}>
                    <User size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
                    <input 
                      value={loginUid} 
                      onChange={e => setLoginUid(e.target.value)} 
                      placeholder={t("auth.username")}
                      style={{ ...inputStyle, paddingLeft: 44 }} 
                    />
                  </div>
                </div>
                <div>
                  <div style={{ position: "relative" }}>
                    <Lock size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
                    <input 
                      type={showLoginPass ? "text" : "password"} 
                      value={loginPass} 
                      onChange={e => setLoginPass(e.target.value)} 
                      placeholder={t("auth.password")}
                      style={{ ...inputStyle, paddingLeft: 44 }} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowLoginPass(v => !v)} 
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>
                      {showLoginPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={rememberMe} 
                      onChange={e => setRememberMe(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: T.teal }}
                    />
                    <span style={{ fontSize: 13, color: "#6B7280" }}>{t("auth.rememberMe")}</span>
                  </label>
                  <button type="button" style={{ fontSize: 13, color: T.teal, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                    {t("auth.forgotPassword")}
                  </button>
                </div>

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full py-3 rounded-lg text-[15px] font-semibold transition-all hover:shadow-lg disabled:opacity-60"
                  style={{ background: T.teal, color: T.white }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <LogIn size={18} />
                    {loading ? t("auth.loggingIn") : t("auth.loginBtn")}
                  </span>
                </button>
                
                <p className="text-center text-[13px] mt-6" style={{ color: "#6B7280" }}>
                  {t("auth.noAccount")}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="font-semibold ml-1"
                    style={{ color: T.teal, background: "none", border: "none", cursor: "pointer" }}>
                    {t("auth.toRegister")} <ArrowRight size={14} style={{ display: "inline", verticalAlign: "middle" }} />
                  </button>
                </p>
              </form>
            )}

            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="text-[13px] font-medium block mb-1.5" style={{ color: T.ink }}>{t("auth.name")}</label>
                  <input 
                    value={regName} 
                    onChange={e => setRegName(e.target.value)} 
                    placeholder={t("auth.name")} 
                    style={inputStyle} 
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium block mb-1.5" style={{ color: T.ink }}>{t("auth.email")}</label>
                  <input 
                    value={regEmail} 
                    onChange={e => setRegEmail(e.target.value)} 
                    placeholder="user@example.edu" 
                    style={inputStyle} 
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium block mb-1.5" style={{ color: T.ink }}>{t("auth.password")}</label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type={showRegPass ? "text" : "password"} 
                      value={regPass} 
                      onChange={e => setRegPass(e.target.value)} 
                      placeholder={t("auth.passwordMin")} 
                      style={inputStyle} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowRegPass(v => !v)} 
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>
                      {showRegPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[13px] font-medium block mb-1.5" style={{ color: T.ink }}>{t("auth.confirmPassword")}</label>
                  <input 
                    type="password" 
                    value={regPass2} 
                    onChange={e => setRegPass2(e.target.value)} 
                    placeholder={t("auth.confirmPassword")} 
                    style={inputStyle} 
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full py-3 rounded-lg text-[15px] font-semibold transition-all hover:shadow-lg disabled:opacity-60"
                  style={{ background: T.teal, color: T.white, marginTop: 8 }}>
                  {loading ? t("auth.registering") : t("auth.registerBtn")}
                </button>
                <p className="text-center text-[13px] mt-6" style={{ color: "#6B7280" }}>
                  {t("auth.hasAccount")}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="font-semibold ml-1"
                    style={{ color: T.teal, background: "none", border: "none", cursor: "pointer" }}>
                    {t("auth.toLogin")}
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}