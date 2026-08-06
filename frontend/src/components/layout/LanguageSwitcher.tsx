import { useTranslation } from "react-i18next";
import T from "../../constants/tokens";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language.startsWith("en") ? "en-GB" : "zh";

  return (
    <button
      className="text-[12px] rounded font-medium transition-colors"
      style={{ background: `${T.teal}12`, color: T.teal, border: "none", cursor: "pointer", width: 36, height: 28 }}
      onClick={() => i18n.changeLanguage(current === "zh" ? "en-GB" : "zh")}>
      {current === "zh" ? "EN" : "中"}
    </button>
  );
}
