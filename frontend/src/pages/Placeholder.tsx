import { useTranslation } from "react-i18next";
import { History } from "lucide-react";
import T from "../constants/tokens";
import { PageHeader, Card } from "../components/ui";

function PlaceholderPage({ title, breadcrumbs }: { title: string; breadcrumbs: string[] }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader breadcrumbs={breadcrumbs} title={title} />
      <Card>
        <div className="px-6 py-16 flex flex-col items-center gap-3">
          <History size={32} style={{ color: T.cloud }} />
          <div className="text-[14px]" style={{ color: T.info }}>{t("underDevelopment")}</div>
          <div className="text-[12px]" style={{ color: T.info }}>{t("underDevelopmentSub")}</div>
        </div>
      </Card>
    </div>
  );
}

export default PlaceholderPage;
