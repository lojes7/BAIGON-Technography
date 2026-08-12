import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Pencil, X } from "lucide-react";
import T from "../constants/tokens";
import { extractionRecords } from "../data";
import { PageHeader, Btn, Card, StatusBadge, ConfidenceBadge } from "../components/ui";
import ConfirmDialog from "../components/overlay/ConfirmDialog";

function AIExtractionPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<typeof extractionRecords[0] | null>(null);
  const [confirm, setConfirm] = useState<null | "pause" | "stop">(null);
  const [taskRunning, setTaskRunning] = useState(true);

  const filters = [
    { key: "all", label: "全部", count: 486 },
    { key: "succeeded", label: "成功", count: 361 },
    { key: "needs_review", label: "低置信度", count: 107 },
    { key: "failed", label: "失败", count: 18 },
  ];

  const filtered = filter === "all" ? extractionRecords : extractionRecords.filter(r => r.status === filter);

  const stages = [
    { name: "文本清洗", done: true },
    { name: "岗位实体抽取", done: true },
    { name: "能力归一", current: true },
    { name: "结构校验", done: false },
    { name: "写入复核队列", done: false },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.aiProcessing"), t("nav.extractionTasks"), "#EXT-202607-012"]}
        title={t("page.aiExtraction.title") + " #EXT-202607-012"}
        description={t("page.aiExtraction.desc")}
        actions={
          <>
            <Btn variant="secondary" onClick={() => setConfirm("pause")} disabled={!taskRunning}>
              {taskRunning ? "暂停" : "已暂停"}
            </Btn>
            <Btn variant="danger" onClick={() => setConfirm("stop")}>终止任务</Btn>
          </>
        }
      />

      {/* Progress */}
      <Card>
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-medium" style={{ color: T.ink }}>处理进度</span>
            <span className="font-mono text-[13px]" style={{ color: T.teal }}>78%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: T.cloud }}>
            <div className="h-full rounded-full" style={{ width: "78%", background: T.teal }} />
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            {[
              { label: "总记录", value: "486", color: T.ink },
              { label: "成功", value: "361", color: T.emerging },
              { label: "待处理", value: "107", color: T.pending },
              { label: "失败", value: "18", color: T.risk },
              { label: "平均置信度", value: "0.87", color: T.stable },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="font-mono text-[18px] font-medium" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[11px]" style={{ color: T.info }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-5 gap-4">
        {/* Stages */}
        <Card title="处理阶段" className="col-span-2">
          <div className="px-4 py-3 flex flex-col gap-2">
            {stages.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: s.done ? T.emerging : s.current ? T.teal : T.cloud,
                  }}>
                  {s.done && <CheckCircle size={13} color="white" />}
                  {s.current && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                </div>
                <span className="text-[13px]" style={{
                  color: s.done ? T.ink : s.current ? T.teal : T.info,
                  fontWeight: s.current ? 500 : 400,
                }}>
                  {s.name}
                </span>
                {s.current && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded"
                    style={{ background: "#EBF2FA", color: T.stable }}>进行中</span>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Config */}
        <Card title="当前配置" className="col-span-3">
          <div className="px-4 py-3 grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              ["工作流版本", "岗位能力抽取 v1.3"],
              ["模型", "讯飞星火 Spark Max"],
              ["提示词版本", "prompt-job-skill-1.8"],
              ["自动重试", "2 次"],
              ["低置信度阈值", "0.75"],
              ["批次规模", "486 条"],
            ].map(([k, v], i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[12px] flex-shrink-0" style={{ color: T.info }}>{k}</span>
                <span className="text-[12px] font-mono font-medium" style={{ color: T.ink }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Record list */}
      <Card title="记录列表" action={
        <div className="flex items-center gap-1">
          {filters.map(f => (
            <button key={f.key}
              className="text-[12px] px-3 py-1 rounded transition-colors"
              style={{
                background: filter === f.key ? T.ink : "transparent",
                color: filter === f.key ? "#F5EFEA" : T.info,
              }}
              onClick={() => setFilter(f.key)}>
              {f.label} <span className="font-mono">{f.count}</span>
            </button>
          ))}
        </div>
      }>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: T.cloud }}>
              {["岗位名称", "能力数", "平均置信度", "状态", "操作"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium text-[12px]"
                  style={{ color: T.info }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="transition-colors hover:bg-gray-50"
                style={{ borderTop: `1px solid ${T.cloud}` }}>
                <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{r.job}</td>
                <td className="px-4 py-3 font-mono" style={{ color: r.skills ? T.ink : T.info }}>
                  {r.skills || "—"}
                </td>
                <td className="px-4 py-3">
                  {r.conf ? <ConfidenceBadge value={r.conf} /> : <span style={{ color: T.info }}>—</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3">
                  <button className="text-[12px] font-medium mr-3" style={{ color: T.teal }}
                    onClick={() => { setSelectedRecord(r); setDrawerOpen(true); }}>
                    {r.status === "failed" ? "重试" : "查看"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Extraction detail drawer */}
      {drawerOpen && selectedRecord && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setDrawerOpen(false)}>
          <div className="flex-1" />
          <div className="w-96 h-full bg-white shadow-xl overflow-y-auto flex flex-col"
            style={{ borderLeft: `1px solid ${T.border}` }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <div>
                <div className="text-[15px] font-medium" style={{ color: T.ink }}>{selectedRecord.job}</div>
                <div className="text-[12px] mt-0.5" style={{ color: T.info }}>原始岗位：高级AI研发工程师</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ color: T.info }}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: T.cloud }}>
              <div className="px-5 py-4">
                <div className="text-[12px] font-medium uppercase tracking-wider mb-3" style={{ color: T.info }}>
                  标准岗位候选
                </div>
                {[
                  { name: selectedRecord.job, conf: 0.94, selected: true },
                  { name: "AI平台工程师", conf: 0.71, selected: false },
                ].map((c, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                      style={{ borderColor: c.selected ? T.teal : T.border,
                        background: c.selected ? T.teal : "transparent" }} />
                    <span className="flex-1 text-[13px]" style={{ color: T.ink }}>{c.name}</span>
                    <ConfidenceBadge value={c.conf} />
                  </div>
                ))}
              </div>
              <div className="px-5 py-4">
                <div className="text-[12px] font-medium uppercase tracking-wider mb-3" style={{ color: T.info }}>
                  抽取能力
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: "检索增强生成", conf: 0.93 },
                    { name: "向量数据库", conf: 0.88 },
                    { name: "Agent编排", conf: 0.81 },
                    { name: "Python工程化", conf: 0.96 },
                    { name: "模型评测", conf: 0.74 },
                    { name: "容器化部署", conf: 0.79 },
                  ].map((sk, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px]"
                      style={{ background: T.cloud, color: T.ink, border: `1px solid ${T.border}` }}>
                      {sk.name}
                      <span className="font-mono" style={{ color: T.teal }}>{sk.conf.toFixed(2)}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4">
                <div className="text-[12px] font-medium uppercase tracking-wider mb-3" style={{ color: T.info }}>
                  原始证据片段
                </div>
                <div className="text-[13px] rounded p-3 leading-relaxed" style={{ background: T.cloud, color: T.ink }}>
                  "负责基于LangChain/LlamaIndex构建RAG知识库应用，熟悉向量数据库（Milvus/ChromaDB），
                  有Agent工作流设计和评测经验优先，需掌握Python并熟悉主流大模型API调用方式。"
                </div>
              </div>
              <div className="px-5 py-4">
                <div className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: T.info }}>
                  原始模型响应
                </div>
                <button className="text-[12px]" style={{ color: T.teal }}>展开查看 JSON ▸</button>
              </div>
            </div>
            <div className="px-5 py-4 flex gap-2 flex-shrink-0" style={{ borderTop: `1px solid ${T.cloud}` }}>
              <Btn variant="ghost" size="sm" onClick={() => { setDrawerOpen(false); toast("已拒绝此条结果"); }}>拒绝</Btn>
              <Btn variant="secondary" size="sm" onClick={() => { setDrawerOpen(false); toast.success("已送入复核队列"); }}>送入复核</Btn>
              <Btn variant="secondary" size="sm" icon={Pencil}>编辑</Btn>
              <Btn size="sm" onClick={() => { setDrawerOpen(false); toast.success("已接受并写入图谱"); }}>接受</Btn>
            </div>
          </div>
        </div>
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm === "pause" ? "暂停抽取任务" : "终止抽取任务"}
          body={confirm === "pause"
            ? "暂停后可随时继续，已完成的记录不受影响。"
            : "终止后任务无法继续，未处理记录需重新提交。此操作不可撤销。"}
          confirmLabel={confirm === "pause" ? "确认暂停" : "确认终止"}
          danger={confirm === "stop"}
          onConfirm={() => {
            if (confirm === "pause") { setTaskRunning(false); toast("任务已暂停"); }
            else toast.error("任务已终止");
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

export default AIExtractionPage;
