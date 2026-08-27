import { ExternalLink, X } from "lucide-react";
import T from "../../constants/tokens";
import type { SkillGraphEvidenceJob } from "../../types/api";

export default function SkillGraphEvidenceDrawer({
  skillName,
  jobCount,
  items,
  onClose,
}: {
  skillName: string;
  jobCount: number;
  items: SkillGraphEvidenceJob[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1" />
      <aside
        className="w-[440px] h-full bg-white shadow-xl flex flex-col"
        style={{ borderLeft: `1px solid ${T.border}` }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="px-5 py-4 flex items-start justify-between" style={{ borderBottom: `1px solid ${T.cloud}` }}>
          <div>
            <div className="text-[15px] font-medium" style={{ color: T.ink }}>{skillName}</div>
            <div className="text-[12px] mt-1" style={{ color: T.info }}>
              共覆盖 {jobCount} 个岗位，以下展示最多 {items.length} 条代表岗位证据
            </div>
          </div>
          <button onClick={onClose} aria-label="关闭岗位证据" style={{ color: T.info }}>
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-5 py-12 text-center text-[13px]" style={{ color: T.info }}>
              暂无可展示的岗位证据
            </div>
          ) : items.map((job) => (
            <article key={job.jobId} className="px-5 py-4" style={{ borderBottom: `1px solid ${T.cloud}` }}>
              <div className="font-medium text-[13px]" style={{ color: T.ink }}>{job.jobName || `岗位 #${job.jobId}`}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                <div><span style={{ color: T.info }}>企业 </span><span style={{ color: T.ink }}>{job.companyName || "—"}</span></div>
                <div><span style={{ color: T.info }}>平台 </span><span style={{ color: T.ink }}>{job.sourcePlatform || "—"}</span></div>
                <div className="col-span-2"><span style={{ color: T.info }}>发布时间 </span><span className="font-mono" style={{ color: T.ink }}>{job.publishDate ? job.publishDate.slice(0, 10) : "未知"}</span></div>
              </div>
              {job.sourceUrl && (
                <a
                  className="mt-3 inline-flex items-center gap-1 text-[12px]"
                  style={{ color: T.teal }}
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看岗位原文 <ExternalLink size={12} />
                </a>
              )}
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
