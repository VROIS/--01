import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ko, enUS, ja, zhCN } from "date-fns/locale";
import { type Guide } from "@shared/schema";

interface GuideGridProps {
  guides: Guide[];
  isBatchMode: boolean;
  selectedGuides: string[];
  onGuideSelect: (guideId: string) => void;
}

export default function GuideGrid({ guides, isBatchMode, selectedGuides, onGuideSelect }: GuideGridProps) {
  const { t, i18n } = useTranslation();

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ja': return ja;
      case 'zh': return zhCN;
      case 'en': return enUS;
      default: return ko;
    }
  };

  const formatDate = (date: string | Date) => {
    return format(new Date(date), 'yyyy.MM.dd', { locale: getDateLocale() });
  };

  if (guides.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
          <i className="fas fa-camera text-2xl text-muted-foreground"></i>
        </div>
        <div>
          <h3 className="font-semibold korean-text">No guides yet</h3>
          <p className="text-sm text-muted-foreground korean-text">
            Create your first guide by taking a photo!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-4 ${isBatchMode ? 'batch-select-mode' : ''}`}>
      {guides.map((guide) => (
        <div
          key={guide.id}
          className={`guide-item bg-card rounded-xl overflow-hidden shadow-sm border border-border hover:shadow-md transition-all cursor-pointer relative ${
            selectedGuides.includes(guide.id) ? 'selected' : ''
          }`}
          onClick={() => onGuideSelect(guide.id)}
          data-testid={`card-guide-${guide.id}`}
        >
          {isBatchMode && (
            <div className="batch-checkbox absolute top-2 right-2 z-10">
              <input
                type="checkbox"
                checked={selectedGuides.includes(guide.id)}
                onChange={() => onGuideSelect(guide.id)}
                className="w-5 h-5 rounded border-2 border-white shadow-lg"
                data-testid={`checkbox-guide-${guide.id}`}
              />
            </div>
          )}
          
          {guide.imageUrl ? (
            <img
              src={guide.imageUrl}
              alt={guide.title}
              className="w-full h-32 object-cover"
              data-testid={`img-guide-${guide.id}`}
            />
          ) : (
            <div className="w-full h-32 bg-muted flex items-center justify-center">
              <i className="fas fa-image text-2xl text-muted-foreground"></i>
            </div>
          )}
          
          <div className="p-3">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium text-sm korean-text" data-testid={`text-title-${guide.id}`}>
                {guide.title}
              </h3>
              {guide.locationName && (
                <div className="location-badge px-2 py-1 rounded text-xs text-white">
                  <i className="fas fa-map-marker-alt text-xs"></i>
                </div>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground korean-text line-clamp-2" data-testid={`text-description-${guide.id}`}>
              {guide.description}
            </p>
            
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span className="korean-text" data-testid={`text-date-${guide.id}`}>
                {formatDate(guide.createdAt!)}
              </span>
              <span className="korean-text" data-testid={`text-views-${guide.id}`}>
                {t('main.views', { count: guide.viewCount || 0 })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
