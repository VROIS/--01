import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

const languages = [
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {languages.map((lang) => (
        <Button
          key={lang.code}
          onClick={() => changeLanguage(lang.code)}
          variant={i18n.language === lang.code ? "default" : "outline"}
          className="p-3 text-sm font-medium transition-colors"
          data-testid={`button-lang-${lang.code}`}
        >
          {lang.flag} {lang.name}
        </Button>
      ))}
    </div>
  );
}
