import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/ui";
import IngestFormModal from "../components/overlay/IngestFormModal";

function ImportWizardPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[t("nav.dataCenter"), t("nav.importBatches")]}
        title={t("nav.importBatches")}
        description={t("page.dataImport.desc")}
      />

      {/* CSV 注入表单直接内联在页面中 */}
      <IngestFormModal />
    </div>
  );
}

export default ImportWizardPage;
