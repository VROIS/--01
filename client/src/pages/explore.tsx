import { useTranslation } from "react-i18next";
import Navigation from "@/components/navigation";

export default function Explore() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center px-4 py-3">
          <h1 className="text-xl font-semibold korean-text">{t('nav.explore')}</h1>
        </div>
      </header>

      <div className="p-4">
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <i className="fas fa-compass text-2xl text-muted-foreground"></i>
          </div>
          <div>
            <h3 className="font-semibold korean-text">Explore Feature</h3>
            <p className="text-sm text-muted-foreground korean-text">
              Discover guides shared by other users
            </p>
          </div>
        </div>
      </div>

      <Navigation currentPage="explore" />
    </div>
  );
}
