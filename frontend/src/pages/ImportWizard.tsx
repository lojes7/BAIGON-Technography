import { useTranslation } from "react-i18next";
import {
  ArrowUpRight, CheckCircle2, Database, FileSpreadsheet,
  GitBranch, HardDriveDownload, Layers, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useNav } from "../context/NavContext";
import { coverageData } from "../data";
import { INGEST_CSV_COLUMNS } from "../features/ingest/csv";
import IngestFormModal from "../components/overlay/IngestFormModal";

/* 深蓝主色系（确认后与工作台一起沉淀到 tokens.ts） */
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
  amber: "#D98E1F",
  amberBg: "#FBF1DC",
  red: "#E25C4A",
  violet: "#7468CE",
  violetBg: "#ECEAFA",
  teal: "#2E9E9A",
  border: "#E4EAF2",
} as const;

/* 批次记录（mock，后续接 /ingest 批次查询接口） */
const recentBatches = [
  { batch: "JOB-202607-006", source: "CSV 手动注入", rows: 486, time: "2026-07-01 14:32", trace: "tr_9f3a2c", status: "待复核", tone: "amber" },
  { batch: "JOB-202606-015", source: "CSV 手动注入", rows: 352, time: "2026-06-28 09:15", trace: "tr_7b1e8d", status: "部分失败", tone: "red" },
  { batch: "JOB-202606-014", source: "智联爬虫", rows: 1204, time: "2026-06-25 22:08", trace: "tr_5c9f04", status: "清洗中", tone: "sky" },
  { batch: "JOB-202606-013", source: "CSV 手动注入", rows: 278, time: "2026-06-21 16:47", trace: "tr_3a6d91", status: "已入库", tone: "green" },
  { batch: "JOB-202606-012", source: "智联爬虫", rows: 986, time: "2026-06-18 21:30", trace: "tr_2e4b70", status: "已入库", tone: "green" },
] as const;

const TONE: Record<string, { bg: string; color: string }> = {
  amber: { bg: P.amberBg, color: P.amber },
  red: { bg: "#FBEAE7", color: P.red },
  sky: { bg: P.skySoft, color: P.primary },
  green: { bg: P.greenBg, color: P.green },
};

function KpiCard({ children, onClick, featured = false }: {
  children: React.ReactNode; onClick?: () => void; featured?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 flex flex-col relative overflow-hidden transition-all hover:-translate-y-0.5 ${featured ? "text-white cursor-pointer" : "bg-white cursor-pointer hover:shadow-md"}`}
      style={featured
        ? { background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDeep} 100%)`, minHeight: 132 }
        : { border: `1px solid ${P.border}`, minHeight: 132 }}
      onClick={onClick}
    >
      {featured && (
        <>
          <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="absolute -right-2 top-14 w-20 h-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
        </>
      )}
      {children}
    </div>
  );
}

function DataImportPage() {
  const { t } = useTranslation();
  const nav = useNav();

  return (
    <div className="flex flex-col gap-5">
      {/* ===== 页头 ===== */}
      <div>
        <h1 className="text-[26px] font-bold leading-tight" style={{ color: P.ink }}>{t("nav.importBatches")}</h1>
        <p className="text-[13px] mt-1" style={{ color: P.muted }}>
          CSV 注入 → Kafka 采集 → 清洗落库 → 人工复核，样本进入系统的唯一入口
        </p>
      </div>

      {/* ===== KPI 统计行 ===== */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard featured onClick={() => nav("raw-records")}>
          <div className="flex items-start justify-between">
            <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>累计注入样本</span>
            <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.16)" }}>
              <ArrowUpRight size={14} color="#fff" />
            </span>
          </div>
          <div className="text-[32px] font-mono font-semibold leading-tight mt-1">12,846</div>
          <div className="mt-auto flex items-center gap-2">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.16)", color: "#fff" }}>+1,032 本月</span>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>覆盖 12 个行业大类</span>
          </div>
        </KpiCard>

        {[
          { title: "本月注入批次", value: "14", icon: Layers, chip: "较上月 +3", bg: P.skySoft, color: P.primary },
          { title: "待复核样本", value: "37", icon: AlertTriangle, chip: "9 项高优先级", bg: P.amberBg, color: P.amber, warn: true },
          { title: "清洗通过率", value: "92.4%", icon: CheckCircle2, chip: "近 30 天均值", bg: P.greenBg, color: P.green },
        ].map((k) => (
          <KpiCard key={k.title} onClick={() => nav("raw-records")}>
            <div className="flex items-start justify-between">
              <span className="text-[13px]" style={{ color: P.muted }}>{k.title}</span>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={14} style={{ color: k.color }} />
              </span>
            </div>
            <div className="text-[30px] font-mono font-semibold leading-tight mt-1" style={{ color: P.ink }}>{k.value}</div>
            <div className="mt-auto flex items-center gap-1.5">
              {k.warn && <AlertTriangle size={11} style={{ color: k.color }} />}
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: k.bg, color: k.color }}>{k.chip}</span>
            </div>
          </KpiCard>
        ))}
      </div>

      {/* ===== 注入向导（左） + 字段规范 / 采集管道（右） ===== */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 flex">
          <IngestFormModal />
        </div>

        <div className="col-span-4 flex flex-col gap-4">
          {/* 字段规范 */}
          <div className="bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
              <div className="text-[15px] font-semibold" style={{ color: P.ink }}>CSV 字段规范</div>
              <FileSpreadsheet size={15} style={{ color: P.faint }} />
            </div>
            <div className="px-5 py-2">
              {INGEST_CSV_COLUMNS.map((col) => (
                <div key={col.header} className="flex items-center gap-2 py-2 text-[12px]" style={{ borderBottom: `1px dashed ${P.border}` }}>
                  <span className="flex-shrink-0 whitespace-nowrap font-medium" style={{ color: P.ink }}>{col.header}</span>
                  <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-4"
                    style={{ color: col.nullable ? P.faint : P.red, background: col.nullable ? P.skySoft : "#FBEAE7" }}>
                    {col.nullable ? "可空" : "必填"}
                  </span>
                  <span className="min-w-0 flex-1 truncate" style={{ color: P.faint }} title={col.rule}>{col.rule}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 采集管道深色卡 */}
          <div className="rounded-2xl p-5 text-white relative overflow-hidden"
            style={{ background: `linear-gradient(150deg, #16345E 0%, ${P.primaryDeep} 55%, #0C1F3C 100%)`, minHeight: 190 }}>
            <div className="absolute -right-10 -bottom-14 w-44 h-44 rounded-full" style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
            <div className="absolute -right-4 -bottom-8 w-28 h-28 rounded-full" style={{ border: "1px solid rgba(255,255,255,0.06)" }} />
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[14px] font-semibold">
                <GitBranch size={15} /> 采集管道
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.14)" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#5EEAB5" }} />
                爬虫运行中
              </span>
            </div>
            {/* 链路节点 */}
            <div className="flex items-center gap-1.5 mt-4">
              {[
                { icon: Database, label: "Kafka" },
                { icon: Layers, label: "清洗" },
                { icon: HardDriveDownload, label: "落库" },
              ].map((n, i) => (
                <div key={n.label} className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
                    style={{ background: "rgba(255,255,255,0.12)" }}>
                    <n.icon size={12} /> {n.label}
                  </span>
                  {i < 2 && <span className="w-3 h-px" style={{ background: "rgba(255,255,255,0.3)" }} />}
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 text-[12px]" style={{ color: "rgba(255,255,255,0.65)" }}>
              <div className="flex justify-between"><span>今日新增样本</span><span className="font-mono" style={{ color: "#fff" }}>+86</span></div>
              <div className="flex justify-between"><span>最近一次采集</span><span className="font-mono" style={{ color: "#fff" }}>14:20</span></div>
              <div className="flex justify-between"><span>最近 trace</span><span className="font-mono" style={{ color: "#9DBCE4" }}>tr_9f3a2c</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 注入趋势 + 最近批次 ===== */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
          <div className="px-5 pt-4 pb-1">
            <div className="text-[15px] font-semibold" style={{ color: P.ink }}>近 12 个月注入量</div>
            <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>单位：条清洗后样本</div>
          </div>
          <div className="px-3 pb-3 pt-2">
            <ResponsiveContainer width="100%" height={168}>
              <BarChart data={coverageData} barSize={10}>
                <CartesianGrid strokeDasharray="4 6" stroke={P.skySoft} vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 10, fill: P.faint }} tickLine={false} axisLine={false}
                  tickFormatter={(v: string) => v.slice(5)} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: P.faint }} tickLine={false} axisLine={false} width={26} />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: `1px solid ${P.border}`, borderRadius: 12, boxShadow: "0 8px 20px rgba(22,40,62,0.08)" }}
                  cursor={{ fill: P.skySoft }}
                />
                <Bar dataKey="n" name="注入样本" radius={[5, 5, 5, 5]}>
                  {coverageData.map((d, i) => (
                    <Cell key={i} fill={i === coverageData.length - 1 ? P.primary : P.sky} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-8 bg-white rounded-2xl" style={{ border: `1px solid ${P.border}` }}>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-[15px] font-semibold" style={{ color: P.ink }}>最近注入批次</div>
              <div className="text-[12px] mt-0.5" style={{ color: P.faint }}>点击行查看批次内样本的清洗与复核状态</div>
            </div>
            <span className="text-[12px] cursor-pointer font-medium" style={{ color: P.primary }}
              onClick={() => nav("raw-records")}>进入数据源 →</span>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: P.sky }}>
                {["批次号", "来源", "样本数", "提交时间", "trace_id", "状态"].map((h) => (
                  <th key={h} className="px-5 py-2 text-left font-medium text-[12px] first:pl-5" style={{ color: P.primaryDeep }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentBatches.map((b) => (
                <tr key={b.batch} className="cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ borderTop: `1px solid ${P.border}` }}
                  onClick={() => nav("raw-records")}>
                  <td className="px-5 py-3 font-medium font-mono text-[12px]" style={{ color: P.primary }}>{b.batch}</td>
                  <td className="px-5 py-3" style={{ color: P.muted }}>{b.source}</td>
                  <td className="px-5 py-3 font-mono" style={{ color: P.ink }}>{b.rows.toLocaleString()}</td>
                  <td className="px-5 py-3 font-mono text-[12px]" style={{ color: P.muted }}>{b.time}</td>
                  <td className="px-5 py-3 font-mono text-[12px]" style={{ color: P.faint }}>{b.trace}</td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: TONE[b.tone].bg, color: TONE[b.tone].color }}>{b.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DataImportPage;
