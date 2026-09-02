import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, Pencil, X } from "lucide-react";
import T from "../constants/tokens";
import { useAuth } from "../auth/AuthContext";
import { PAGE_PERMISSIONS, ROLES, type RoleKey } from "../auth/roles";
import { Btn, Card, StatusBadge } from "../components/ui";
import { pagedSearchAuditLogs } from "../services/audit";
import { getMe } from "../services/user";
import type { AuditLogItem, CurrentUser } from "../types/api";

// ── 各角色的 Mock 详细资料 ──
const PROFILE: Record<RoleKey, {
  email: string;
  institution: string;
  department: string;
  accountType: string;
  joinDate: string;
  stats: { label: string; value: string }[];
}> = {
  admin: {
    email: "zhang@cjut.edu.cn",
    institution: "常州工业职业技术学院",
    department: "人工智能研究中心",
    accountType: "研究人员",
    joinDate: "2024-09-01",
    stats: [
      { label: "已复核能力项", value: "248" },
      { label: "采纳改进建议", value: "32" },
      { label: "创建标准词条", value: "17" },
      { label: "操作记录总数", value: "1,284" },
      { label: "本月活跃天数", value: "18" },
    ],
  },
  reviewer: {
    email: "wangreviewer@cjut.edu.cn",
    institution: "常州工业职业技术学院",
    department: "数据质量部",
    accountType: "审核人员",
    joinDate: "2024-08-20",
    stats: [
      { label: "已复核任务", value: "1,032" },
      { label: "复核通过率", value: "96%" },
      { label: "词典条目维护", value: "86" },
      { label: "驳回修正数", value: "41" },
      { label: "本月活跃天数", value: "20" },
    ],
  },
  analyst: {
    email: "lianalyst@cjut.edu.cn",
    institution: "常州工业职业技术学院",
    department: "数据分析部",
    accountType: "分析人员",
    joinDate: "2024-11-01",
    stats: [
      { label: "图谱关系审核", value: "567" },
      { label: "演化事件管理", value: "156" },
      { label: "能力组合分析", value: "89" },
      { label: "导出报告数", value: "34" },
      { label: "本月活跃天数", value: "16" },
    ],
  },
  teacher: {
    email: "chenteacher@cjut.edu.cn",
    institution: "常州工业职业技术学院",
    department: "计算机科学与技术教研室",
    accountType: "教师",
    joinDate: "2024-09-01",
    stats: [
      { label: "所带学生", value: "32" },
      { label: "培养方案关注", value: "4" },
      { label: "课程证据查看", value: "128" },
      { label: "改进建议采纳", value: "15" },
      { label: "本月活跃天数", value: "14" },
    ],
  },
  student: {
    email: "zhangsan@cjut.edu.cn",
    institution: "常州工业职业技术学院",
    department: "计算机科学 2023级",
    accountType: "学生",
    joinDate: "2025-02-20",
    stats: [
      { label: "已掌握技能", value: "18" },
      { label: "能力诊断次数", value: "7" },
      { label: "学习路径进度", value: "60%" },
      { label: "课程学习完成", value: "12" },
      { label: "本月活跃天数", value: "24" },
    ],
  },
  student_affair: {
    email: "liuxuegong@cjut.edu.cn",
    institution: "常州工业职业技术学院",
    department: "学生工作办公室",
    accountType: "行政人员",
    joinDate: "2024-07-15",
    stats: [
      { label: "管理教师数", value: "12" },
      { label: "管理学生数", value: "320" },
      { label: "导入成绩单", value: "24" },
      { label: "导入学生批次", value: "8" },
      { label: "本月活跃天数", value: "21" },
    ],
  },
};

// ── 权限页面名映射 ──
const PAGE_LABELS: Record<string, string> = {
  "dashboard": "工作台",
  "import-batches": "导入批次",
  "raw-records": "原始记录",
  "extraction-tasks": "抽取任务",
  "review-queue": "复核队列",
  "processing-errors": "处理异常",
  "job-dict": "岗位词典",
  "skill-dict": "能力词典",
  "taxonomy": "分类体系",
  "graph-browser": "图谱浏览",
  "graph-snapshots": "图谱对比",
  "relation-evidence": "关系证据",
  "evolution-trends": "趋势总览",
  "evolution-events": "演化事件",
  "skill-combos": "能力组合",
  "programs": "专业与方案",
  "course-evidence": "课程证据",
  "gap-analysis": "供需缺口",
  "response-lag": "响应时滞",
  "recommendations": "改进建议",
  "export-tasks": "数据导出",
  "export-history": "导出记录",
  "account-settings": "账号设置",
  "params": "参数配置",
  "users": "用户权限",
  "audit-log": "审计日志",
  "my-resume": "我的简历",
  "skill-compare": "能力对比",
  "gap-report": "差距分析报告",
  "learning-path": "学习路径规划",
  "teacher-management": "教师管理",
  "student-management": "学生管理",
  "grade-import": "导入成绩单",
};

function UserProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [bio, setBio] = useState("");
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLogItem[]>([]);

  // 接入 GET /api/auth/me，获取账号资料与校园组织引用。
  useEffect(() => {
    getMe().then((res) => setMe(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    // 审计日志仅 ADMIN 可见，普通用户个人页不得发起日志请求。
    if (!user?.id || user.role !== "admin") return;
    pagedSearchAuditLogs("occupation", {
      page: 0,
      pageSize: 8,
      targetUserId: user.id,
    }).then((response) => setRecentLogs(response.data.items)).catch(() => setRecentLogs([]));
  }, [user?.id, user?.role]);

  const role = user?.role ?? "admin";
  const name = me?.name || user?.name || "未知用户";
  const roleLabel = ROLES.find(r => r.key === role)?.labelKey ?? "未知角色";
  const profile = PROFILE[role] ?? PROFILE.admin;

  // /me 不再嵌入组织名称；个人页只展示引用，组织名称由有权限的目录详情接口查询。
  const institution = me?.universityId && String(me.universityId) !== "0"
    ? `高校 #${me.universityId}`
    : profile.institution;
  const departmentRefs = [me?.schoolId, me?.departmentId]
    .filter((id) => id && String(id) !== "0")
    .map((id) => `#${id}`);
  const department = departmentRefs.length > 0 ? departmentRefs.join(" · ") : profile.department;

  // 从权限表生成模块访问列表
  const moduleAccess = (PAGE_PERMISSIONS[role] ?? [])
    .filter(p => PAGE_LABELS[p])
    .map(p => ({ name: PAGE_LABELS[p], level: role === "admin" ? "全权" : "可访问" }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 mb-1">
        <button className="text-[13px] flex items-center gap-1" style={{ color: T.teal }}
          onClick={() => navigate("/")}>
          <ChevronLeft size={14} />返回工作台
        </button>
      </div>

      {/* ── 顶部：个人信息 + 数据统计通栏 ── */}
      <Card>
        <div className="px-6 py-5 flex items-start gap-5">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-[24px] font-bold text-white flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${T.teal}, ${T.ink})` }}>
            {name[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-[20px] font-medium" style={{ color: T.ink }}>{name}</h2>
              <span className="text-[12px] px-2 py-0.5 rounded font-medium"
                style={{ color: T.ink, background: `${T.ink}15` }}>{roleLabel}</span>
              <StatusBadge status="confirmed" />
            </div>
            <div className="text-[13px] mb-1" style={{ color: T.info }}>
              {profile.email} · {institution} · {department}
            </div>
            <p className="text-[13px] leading-relaxed mt-1 text-[12px]" style={{ color: T.info }}>
              {bio || "这个人很懒，什么都没写。"}
            </p>
          </div>
          <Btn variant="secondary" size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>编辑资料</Btn>
        </div>
        {/* 统计 */}
        <div className="px-6 py-3 grid grid-cols-5 gap-3" style={{ borderTop: `1px solid ${T.cloud}` }}>
          {profile.stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="font-mono text-[18px] font-medium" style={{ color: T.ink }}>{s.value}</div>
              <div className="text-[11px] mt-0.5" style={{ color: T.info }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── 下半区：7:3 左右分栏 ── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: role === "admin" ? "7fr 3fr" : "1fr" }}>
        {/* 左：最近操作记录 */}
        {role === "admin" && <Card title="最近操作记录">
          <div className="divide-y divide-[#E4EAF2]" >
            {recentLogs.length > 0 ? recentLogs.map((entry) => {
              const col = entry.level === "ERROR" ? T.risk : entry.level === "WARNING" ? T.pending : T.stable;
              return (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ color: col, background: `${col}18` }}>{entry.level}</span>
                  <span className="flex-1 text-[13px] truncate" style={{ color: T.ink }}>{entry.detail || entry.requestUrl || "操作记录"}</span>
                  <span className="text-[11px] max-w-[180px] truncate font-mono" style={{ color: T.info }}>{entry.requestUrl || "-"}</span>
                  <span className="font-mono text-[11px] flex-shrink-0" style={{ color: T.info }}>
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour12: false }) : "-"}
                  </span>
                </div>
              );
            }) : (
              <div className="px-4 py-12 text-center text-[13px]" style={{ color: T.info }}>暂无操作记录</div>
            )}
          </div>
          <div className="px-4 py-2" style={{ borderTop: `1px solid ${T.cloud}` }}>
            <button className="text-[12px]" style={{ color: T.teal }} onClick={() => navigate("/audit-log")}>查看完整审计日志 →</button>
          </div>
        </Card>}

        {/* 右：权限 + 账户 堆叠 */}
        <div className="flex flex-col gap-4">
          {/* 权限 */}
          <Card title="权限与访问">
            <div className="px-3 py-2 flex flex-col gap-0.5">
              {moduleAccess.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-[12px] py-0.5">
                  <span style={{ color: T.ink }}>{m.name}</span>
                  <span className="text-[10px]" style={{ color: T.info }}>{m.level}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* 账户 */}
          <Card title="账户信息">
            <div className="px-3 py-2 space-y-1 text-[12px]">
              {[
                ["账户类型", profile.accountType],
                ["加入日期", profile.joinDate],
              ].map(([k, v], i) => (
                <div key={i} className="flex justify-between">
                  <span style={{ color: T.info }}>{k}</span>
                  <span style={{ color: T.ink }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="px-3 py-2" style={{ borderTop: `1px solid ${T.cloud}` }}>
              <button className="text-[12px] w-full text-center opacity-60 hover:opacity-100 transition-opacity" style={{ color: T.risk }}
                onClick={() => { logout(); navigate("/login"); }}>
                退出登录
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Edit bio modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(25,50,77,0.3)" }} onClick={() => setEditOpen(false)}>
          <div className="bg-white rounded-lg w-[460px]"
            style={{ border: `1px solid ${T.border}`, boxShadow: "0 12px 40px rgba(0,0,0,0.15)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <h3 className="text-[15px] font-medium" style={{ color: T.ink }}>编辑个人资料</h3>
              <button onClick={() => setEditOpen(false)} style={{ color: T.info }}><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                { label: "姓名", value: name },
                { label: "邮箱", value: profile.email },
                { label: "单位", value: profile.institution },
                { label: "部门", value: profile.department },
              ].map((f, i) => (
                <div key={i}>
                  <label className="text-[12px] font-medium block mb-1" style={{ color: T.ink }}>{f.label}</label>
                  <input className="w-full px-3 py-2 rounded-md text-[13px] outline-none"
                    style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
                    defaultValue={f.value} />
                </div>
              ))}
              <div>
                <label className="text-[12px] font-medium block mb-1" style={{ color: T.ink }}>个人简介</label>
                <textarea className="w-full px-3 py-2 rounded-md text-[13px] outline-none resize-none"
                  style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink, height: 72 }}
                  value={bio} onChange={e => setBio(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.cloud}` }}>
              <Btn variant="secondary" onClick={() => setEditOpen(false)}>取消</Btn>
              <Btn onClick={() => { setEditOpen(false); toast.success("资料已更新"); }}>保存</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserProfilePage;
