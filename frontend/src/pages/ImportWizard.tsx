import { useTranslation } from "react-i18next";
import { useState } from "react";
import { ChevronDown, AlertTriangle, Info, RefreshCw, Download, CheckCircle } from "lucide-react";
import T from "../constants/tokens";
import { PageHeader, Btn, Card, StatusBadge } from "../components/ui";
import UploadFileStep from "../components/overlay/UploadFileStep";

function ImportWizardPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const steps = ["来源信息", "上传文件", "字段映射", "质量检查", "确认导入"];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dataCenter"), t("nav.importBatches"), t("page.importWizard.title")]}
        title={t("page.importWizard.title")}
      />

      {/* Stepper */}
      <Card>
        <div className="px-6 py-4">
          <div className="flex items-center">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => i < step && setStep(i)}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-mono font-medium flex-shrink-0"
                    style={{
                      background: i < step ? T.emerging : i === step ? T.ink : T.cloud,
                      color: i <= step ? "white" : T.info,
                    }}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span className="text-[13px]" style={{
                    color: i === step ? T.ink : i < step ? T.emerging : T.info,
                    fontWeight: i === step ? 500 : 400,
                  }}>{s}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 mx-3 h-px" style={{ background: i < step ? T.emerging : T.cloud }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Step 1 content */}
      {step === 0 && (
        <Card title="来源信息">
          <div className="px-6 py-5">
            <div className="max-w-xl space-y-4">
              {[
                { label: "数据类型", type: "select", value: "招聘岗位", required: true },
                { label: "来源名称", type: "text", placeholder: "例如：智联招聘 2026Q2", required: true },
                { label: "来源网址", type: "text", placeholder: "https://…" },
                { label: "区域", type: "select", value: "江苏省 / 常州市", required: true },
                { label: "产业范围", type: "select", value: "人工智能软件", required: true },
                { label: "来源说明", type: "textarea", placeholder: "简要说明数据来源、采集方式和覆盖范围" },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-4">
                  <label className="w-28 text-right text-[13px] pt-2 flex-shrink-0" style={{ color: T.ink }}>
                    {f.label}
                    {f.required && <span style={{ color: T.risk }}>*</span>}
                  </label>
                  {f.type === "select" ? (
                    <div className="flex items-center justify-between flex-1 px-3 py-2 rounded-md text-[13px]"
                      style={{ background: T.cloud, color: T.ink, border: `1px solid ${T.border}` }}>
                      <span>{"value" in f ? f.value : ""}</span>
                      <ChevronDown size={13} style={{ color: T.info }} />
                    </div>
                  ) : f.type === "textarea" ? (
                    <textarea
                      className="flex-1 px-3 py-2 rounded-md text-[13px] resize-none outline-none"
                      style={{ background: T.cloud, color: T.ink, border: `1px solid ${T.border}`, height: 72 }}
                      placeholder={"placeholder" in f ? f.placeholder : ""}
                    />
                  ) : (
                    <input
                      className="flex-1 px-3 py-2 rounded-md text-[13px] outline-none"
                      style={{ background: T.cloud, color: T.ink, border: `1px solid ${T.border}` }}
                      placeholder={"placeholder" in f ? f.placeholder : ""}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: `1px solid ${T.cloud}` }}>
            <Btn variant="secondary">取消</Btn>
            <Btn onClick={() => setStep(1)}>保存并下一步</Btn>
          </div>
        </Card>
      )}

      {step === 1 && <UploadFileStep onBack={() => setStep(0)} onNext={() => setStep(2)} />}

      {step === 2 && (
        <Card title="字段映射">
          <div className="px-4 pb-2 pt-1 text-[12px]" style={{ color: T.info, borderBottom: `1px solid ${T.cloud}` }}>
            将源文件字段映射至系统标准字段。请确认每个字段的目标和样例值。
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: T.cloud }}>
                {["源字段", "目标字段", "样例值", "空值比例", "转换规则", "状态"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { src: "job_name", target: "原始岗位名称", sample: "大模型应用工程师", nullPct: "0%", rule: "直接映射", status: "confirmed" },
                { src: "description", target: "岗位描述", sample: "负责基于LangChain…", nullPct: "3%", rule: "直接映射", status: "confirmed" },
                { src: "publish_date", target: "发布日期", sample: "2026/05/12", nullPct: "1%", rule: "格式转换 → YYYY-MM-DD", status: "needs_review" },
                { src: "company", target: "企业名称（脱敏）", sample: "XX科技有限公司", nullPct: "0%", rule: "MD5哈希脱敏", status: "confirmed" },
                { src: "salary_range", target: "薪资范围", sample: "15K-25K", nullPct: "22%", rule: "跳过（可选字段）", status: "draft" },
                { src: "city", target: "城市", sample: "常州", nullPct: "0%", rule: "直接映射", status: "confirmed" },
                { src: "education", target: "学历要求", sample: "本科及以上", nullPct: "8%", rule: "直接映射", status: "confirmed" },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: T.teal }}>{row.src}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 px-2 py-1 rounded text-[12px]"
                      style={{ background: T.cloud, color: T.ink }}>
                      {row.target} <ChevronDown size={11} style={{ color: T.info }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info, maxWidth: 160 }}>
                    <span className="truncate block">{row.sample}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: parseInt(row.nullPct) > 10 ? T.pending : T.info }}>
                    {row.nullPct}
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{row.rule}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 flex justify-between" style={{ borderTop: `1px solid ${T.cloud}` }}>
            <Btn variant="secondary" onClick={() => setStep(1)}>上一步</Btn>
            <Btn onClick={() => setStep(3)}>保存并下一步</Btn>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card title="数据质量检查">
          <div className="px-5 py-4">
            <div className="grid grid-cols-5 gap-4 mb-5">
              {[
                { label: "总记录数", value: "486", color: T.ink },
                { label: "通过", value: "441", color: T.emerging },
                { label: "有问题", value: "45", color: T.pending },
                { label: "需手动处理", value: "8", color: T.risk },
                { label: "可自动修复", value: "37", color: T.stable },
              ].map((s, i) => (
                <div key={i} className="text-center p-3 rounded" style={{ background: T.cloud }}>
                  <div className="font-mono text-[20px] font-medium" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[11px] mt-1" style={{ color: T.info }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {[
                { type: "重复记录", count: 8, severity: "warning", action: "忽略并记录", canFix: false, detail: "8条记录与已导入数据存在岗位名称+企业+日期完全重复" },
                { type: "日期格式异常", count: 6, severity: "warning", action: "自动修复", canFix: true, detail: "6条 publish_date 使用 2026/MM/DD 格式，可自动转换" },
                { type: "描述文本过短", count: 19, severity: "info", action: "忽略并记录", canFix: false, detail: "19条描述少于50字，可能影响能力抽取质量" },
                { type: "地区无法识别", count: 4, severity: "warning", action: "需手动映射", canFix: false, detail: '4条城市字段包含"苏锡常""江苏省"等模糊地区，需人工指定' },
                { type: "薪资字段空值", count: 108, severity: "info", action: "跳过", canFix: false, detail: "108条薪资字段为空（该字段非必填，不影响导入）" },
              ].map((issue, i) => (
                <div key={i} className="flex items-start gap-4 p-3 rounded"
                  style={{ background: issue.severity === "warning" ? `${T.pending}08` : T.cloud,
                    border: `1px solid ${issue.severity === "warning" ? `${T.pending}30` : T.border}` }}>
                  {issue.severity === "warning"
                    ? <AlertTriangle size={14} style={{ color: T.pending, marginTop: 2, flexShrink: 0 }} />
                    : <Info size={14} style={{ color: T.info, marginTop: 2, flexShrink: 0 }} />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-medium" style={{ color: T.ink }}>{issue.type}</span>
                      <span className="font-mono text-[12px]" style={{ color: issue.severity === "warning" ? T.pending : T.info }}>
                        {issue.count} 条
                      </span>
                    </div>
                    <div className="text-[12px]" style={{ color: T.info }}>{issue.detail}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {issue.canFix && <Btn size="sm" variant="secondary" icon={RefreshCw}>自动修复</Btn>}
                    <Btn size="sm" variant="ghost">{issue.action}</Btn>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: `1px solid ${T.cloud}` }}>
            <Btn variant="secondary" onClick={() => setStep(2)}>上一步</Btn>
            <div className="flex items-center gap-3">
              <Btn variant="ghost" size="sm" icon={Download}>导出问题清单</Btn>
              <Btn onClick={() => setStep(4)}>已确认，下一步</Btn>
            </div>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card title="确认导入">
          <div className="px-5 py-5 space-y-4">
            <div className="rounded-lg p-4" style={{ background: `${T.emerging}0A`, border: `1px solid ${T.emerging}30` }}>
              <div className="flex items-center gap-2 text-[13px] font-medium mb-3" style={{ color: T.emerging }}>
                <CheckCircle size={15} />即将创建导入批次
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
                {[
                  ["来源名称", "智联招聘 2026Q2"],
                  ["数据类型", "招聘岗位"],
                  ["区域", "常州市"],
                  ["产业范围", "人工智能软件"],
                  ["时间范围", "2026-01-01 至 2026-06-30"],
                  ["源文件", "zhilian_2026q2.xlsx"],
                  ["文件哈希", "a3f2e1…b48c"],
                  ["导入记录数", "486 条（8条重复将被标记）"],
                ].map(([k, v], i) => (
                  <div key={i} className="flex gap-2">
                    <span style={{ color: T.info }}>{k}</span>
                    <span className="font-medium" style={{ color: T.ink }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-[12px] leading-relaxed p-3 rounded" style={{ background: T.cloud, color: T.info }}>
              导入完成后将自动创建批次记录并可在数据中心 → 导入批次中查看。如需立即运行AI抽取，可在导入完成后从工作台启动。
            </div>
          </div>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: `1px solid ${T.cloud}` }}>
            <Btn variant="secondary" onClick={() => setStep(3)}>上一步</Btn>
            <Btn icon={CheckCircle}>确认导入</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

export default ImportWizardPage;
