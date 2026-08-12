import { useTranslation } from "react-i18next";
import T from "../constants/tokens";
import { PageHeader, Card, StatusBadge, ConfidenceBadge } from "../components/ui";

function RelationEvidencePage() {
  const { t } = useTranslation();
  const relations = [
    { from: "大模型应用工程师", to: "Agent编排", type: "需要", conf: 0.91, sources: 28, status: "confirmed" },
    { from: "大模型应用工程师", to: "RAG工程化", type: "需要", conf: 0.89, sources: 24, status: "confirmed" },
    { from: "大模型应用工程师", to: "向量数据库", type: "使用", conf: 0.82, sources: 19, status: "needs_review" },
    { from: "AI平台工程师", to: "MLOps", type: "需要", conf: 0.88, sources: 16, status: "confirmed" },
    { from: "机器视觉工程师", to: "图像识别", type: "核心技能", conf: 0.95, sources: 32, status: "confirmed" },
    { from: "机器视觉工程师", to: "PyTorch", type: "使用", conf: 0.91, sources: 28, status: "confirmed" },
    { from: "数据开发工程师", to: "Python工程化", type: "需要", conf: 0.97, sources: 54, status: "confirmed" },
    { from: "Agent编排", to: "LangChain", type: "使用工具", conf: 0.74, sources: 14, status: "needs_review" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.graph"), t("nav.relationEvidence")]}
        title={t("page.relationEvidence.title")}
        description={t("page.relationEvidence.desc")}
      />
      <Card>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: T.cloud }}>
              {["colFrom","colType","colTo","colSources","colConfidence","colStatus","colActions"].map(k => (
                <th key={k} className="px-4 py-2.5 text-left font-medium text-[12px]" style={{ color: T.info }}>{t(`page.relationEvidence.${k}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {relations.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors" style={{ borderTop: `1px solid ${T.cloud}` }}>
                <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{r.from}</td>
                <td className="px-4 py-3 text-[12px]" style={{ color: T.info }}>{r.type}</td>
                <td className="px-4 py-3 font-medium" style={{ color: T.ink }}>{r.to}</td>
                <td className="px-4 py-3 font-mono">{r.sources}</td>
                <td className="px-4 py-3"><ConfidenceBadge value={r.conf} /></td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3"><button className="text-[12px] font-medium" style={{ color: T.teal }}>{t("page.relationEvidence.viewEvidence")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export default RelationEvidencePage;
