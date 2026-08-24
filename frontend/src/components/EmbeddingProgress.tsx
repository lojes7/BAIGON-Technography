// 百工谱 — 向量化进度面板（专业 / 职业名称向量化）
// 需求 5：用户正在向量化时查看进度，显示「当前正在向量化」，不做同步更新（不轮询）。
// 页面加载时一次性拉取进度 + 任务状态；提供「向量化」按钮，点击后重新拉取一次快照。
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import T from "../constants/tokens";
import {
  getEmbeddingProgress, startMajorEmbedding, getMajorEmbeddingStatus,
  startOccupationEmbedding, getOccupationEmbeddingStatus,
} from "../services/occupation";
import type { EmbeddingProgress as ProgressType } from "../types/api";

interface EmbeddingProgressProps {
  kind: "major" | "occupation";
}

export default function EmbeddingProgress({ kind }: EmbeddingProgressProps) {
  const { t } = useTranslation();
  const isMajor = kind === "major";
  const [progress, setProgress] = useState<ProgressType | null>(null);
  const [status, setStatus] = useState("");
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(() => {
    getEmbeddingProgress()
      .then((res) => setProgress(isMajor ? res.data.majors : res.data.occupations))
      .catch(() => {});
    (isMajor ? getMajorEmbeddingStatus() : getOccupationEmbeddingStatus())
      .then((res) => setStatus(res.data.status))
      .catch(() => {});
  }, [isMajor]);

  // 首次加载拉取一次
  useEffect(() => { refresh(); }, [refresh]);

  const running = status === "running" || status === "stopping";

  // 任务运行中时定时轮询，自动刷新进度；任务结束（idle/success/failed/stopped）后自动停止
  useEffect(() => {
    if (!running) return;
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [running, refresh]);

  const start = async () => {
    setStarting(true);
    try {
      if (isMajor) await startMajorEmbedding();
      else await startOccupationEmbedding();
      toast.success(t("embedding.started"));
      refresh(); // 启动后立即刷新一次，进入运行态并开始轮询
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const label = isMajor ? t("embedding.majorName") : t("embedding.occupationName");
  const done = progress?.embedded ?? 0;
  const total = progress?.total ?? 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-lg px-4 py-3 flex items-center gap-4" style={{ background: "#F7F9FB", border: `1px solid ${T.border}` }}>
      {/* 状态提示 */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {running ? (
          <Loader2 size={16} className="animate-spin flex-shrink-0" style={{ color: T.pending }} />
        ) : (
          <Sparkles size={16} className="flex-shrink-0" style={{ color: T.teal }} />
        )}
        <span className="text-[13px] font-medium" style={{ color: running ? T.pending : T.ink }}>
          {running ? t("embedding.embedding") : t("embedding.progress", { label })}
        </span>
        <span className="text-[13px] font-mono" style={{ color: T.info }}>
          {done} / {total}
        </span>
      </div>

      {/* 进度条 */}
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: T.cloud }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: T.teal }} />
      </div>

      {/* 向量化按钮 */}
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ background: T.teal, color: "white" }}
        onClick={start}
        disabled={starting || running}
      >
        {starting || running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {starting || running ? t("embedding.embedding") : t("embedding.start")}
      </button>
    </div>
  );
}
