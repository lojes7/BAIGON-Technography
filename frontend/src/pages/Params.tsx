import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Filter, Activity, Clock, RefreshCw } from "lucide-react";
import T from "../constants/tokens";
import { PageHeader, Btn, Card } from "../components/ui";
import ConfirmDialog from "../components/overlay/ConfirmDialog";

function ParamsPage() {
  const { t } = useTranslation();
  const defaultValues: Record<string, string> = {
    "默认工作流": "岗位能力抽取 v1.3", "默认模型": "讯飞星火 Spark Max",
    "最大自动重试次数": "2", "单批最大记录数": "500",
    "低置信度阈值（触发复核）": "0.75", "高置信度阈值（自动接受）": "0.95",
    "能力归一高置信度": "0.85", "最小样本量（识别演化事件）": "10",
    "演化信号时间窗口": "半年度（H）", "覆盖率变化阈值（触发信号）": "3.0%",
    "可信度综合算法": "加权均值 v2", "当前分析区域": "常州市",
    "当前分析产业": "人工智能软件与智能制造", "当前活跃时间窗口": "2026H1",
    "数据保留周期": "3年",
  };
  const [values, setValues] = useState<Record<string, string>>(defaultValues);
  const [confirmReset, setConfirmReset] = useState(false);
  const [dirty, setDirty] = useState(false);
  const set = (label: string, v: string) => { setValues(p => ({ ...p, [label]: v })); setDirty(true); };
  const sections = [
    {
      title: "AI抽取配置", icon: Sparkles,
      params: [
        { label: "默认工作流", type: "select", value: "岗位能力抽取 v1.3" },
        { label: "默认模型", type: "select", value: "讯飞星火 Spark Max" },
        { label: "最大自动重试次数", type: "number", value: "2" },
        { label: "单批最大记录数", type: "number", value: "500" },
      ],
    },
    {
      title: "置信度阈值", icon: Filter,
      params: [
        { label: "低置信度阈值（触发复核）", type: "number", value: "0.75" },
        { label: "高置信度阈值（自动接受）", type: "number", value: "0.95" },
        { label: "能力归一高置信度", type: "number", value: "0.85" },
      ],
    },
    {
      title: "演化分析算法", icon: Activity,
      params: [
        { label: "最小样本量（识别演化事件）", type: "number", value: "10" },
        { label: "演化信号时间窗口", type: "select", value: "半年度（H）" },
        { label: "覆盖率变化阈值（触发信号）", type: "number", value: "3.0%" },
        { label: "可信度综合算法", type: "select", value: "加权均值 v2" },
      ],
    },
    {
      title: "数据周期与区域", icon: Clock,
      params: [
        { label: "当前分析区域", type: "select", value: "常州市" },
        { label: "当前分析产业", type: "select", value: "人工智能软件与智能制造" },
        { label: "当前活跃时间窗口", type: "select", value: "2026H1" },
        { label: "数据保留周期", type: "select", value: "3年" },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.admin"), t("nav.params")]}
        title={t("page.params.title")}
        description={t("page.params.desc")}
        actions={<Btn icon={RefreshCw} size="sm" variant="secondary" onClick={() => setConfirmReset(true)}>恢复默认</Btn>}
      />

      <div className="grid grid-cols-2 gap-4">
        {sections.map(sec => {
          const Icon = sec.icon;
          return (
            <Card key={sec.title}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${T.cloud}` }}>
                <Icon size={14} style={{ color: T.teal }} />
                <span className="text-[14px] font-medium" style={{ color: T.ink }}>{sec.title}</span>
              </div>
              <div className="px-4 py-3 space-y-3">
                {sec.params.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <label className="text-[13px] flex-1" style={{ color: T.ink }}>{p.label}</label>
                    <input
                      className="px-3 py-1.5 rounded-md text-[13px] font-mono font-medium outline-none min-w-40 text-right"
                      style={{ background: T.cloud, border: `1px solid ${T.border}`, color: T.ink }}
                      value={values[p.label] ?? p.value}
                      onChange={e => set(p.label, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        {dirty && <span className="text-[12px]" style={{ color: T.pending }}>● 有未保存的更改</span>}
        <div className="flex gap-2 ml-auto">
          <Btn variant="secondary" onClick={() => { setValues(defaultValues); setDirty(false); }}>取消</Btn>
          <Btn onClick={() => { setDirty(false); toast.success("参数配置已保存"); }}>保存配置</Btn>
        </div>
      </div>
      {confirmReset && (
        <ConfirmDialog
          title="恢复默认配置"
          body="所有参数将恢复为系统默认值，当前自定义配置将丢失。"
          confirmLabel="恢复默认"
          onConfirm={() => { setValues(defaultValues); setDirty(false); toast("已恢复默认配置"); }}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}

export default ParamsPage;
