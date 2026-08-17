import { useTranslation } from "react-i18next";
import { useState } from "react";
import { FileSpreadsheet, Sparkles } from "lucide-react";
import T from "../constants/tokens";
import { PageHeader, Btn, Card } from "../components/ui";
import IngestFormModal from "../components/overlay/IngestFormModal";

// 数据导入页：仅保留「模拟采集」功能
// 原先的 5 步导入向导（来源信息 → 上传文件 → 字段映射 → 质量检查 → 确认导入）已移除
function ImportWizardPage() {
  const { t } = useTranslation();
  const [ingestOpen, setIngestOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dataCenter"), t("nav.importBatches")]}
        title={t("nav.importBatches")}
        description={t("page.dataImport.desc")}
      />

      <Card>
        <div className="px-6 py-12 flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: `${T.teal}12` }}>
            <Sparkles size={24} style={{ color: T.teal }} />
          </div>
          <div className="text-center">
            <div className="text-[15px] font-medium mb-1" style={{ color: T.ink }}>
              {t("page.dataImport.ingestTitle")}
            </div>
            <div className="text-[13px]" style={{ color: T.info }}>
              {t("page.dataImport.ingestDesc")}
            </div>
          </div>
          <Btn icon={FileSpreadsheet} onClick={() => setIngestOpen(true)}>
            {t("page.dataImport.ingestBtn")}
          </Btn>
        </div>
      </Card>

      {/* 模拟采集弹窗 */}
      {ingestOpen && <IngestFormModal onClose={() => setIngestOpen(false)} />}
    </div>
  );
}

export default ImportWizardPage;
