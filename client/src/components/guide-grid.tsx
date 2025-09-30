import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
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
  const [, setLocation] = useLocation();

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
          <h3 className="font-semibold">No guides yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first guide by taking a photo!
          </p>
        </div>
      </div>
    );
  }

  const handleCardClick = (guide: Guide, event: React.MouseEvent) => {
    // Prevent default if clicking on checkbox
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
      return;
    }
    
    if (isBatchMode) {
      onGuideSelect(guide.id);
    } else {
      setLocation(`/guides/${guide.id}`);
    }
  };

  return (
    <div className={`grid grid-cols-3 gap-3 ${isBatchMode ? 'batch-select-mode' : ''}`}>
      {guides.map((guide) => (
        <div
          key={guide.id}
          className={`guide-item bg-card rounded-lg overflow-hidden shadow-sm border border-border hover:shadow-md transition-all cursor-pointer relative ${
            selectedGuides.includes(guide.id) ? 'selected' : ''
          }`}
          onClick={(e) => handleCardClick(guide, e)}
          data-testid={`card-guide-${guide.id}`}
        >
          {isBatchMode && (
            <div className="batch-checkbox absolute top-1 right-1 z-10">
              <input
                type="checkbox"
                checked={selectedGuides.includes(guide.id)}
                onChange={() => onGuideSelect(guide.id)}
                className="w-4 h-4 rounded border-2 border-white shadow-lg"
                data-testid={`checkbox-guide-${guide.id}`}
              />
            </div>
          )}
          
          {guide.imageUrl ? (
            <img
              src={guide.imageUrl}
              alt={guide.title}
              className="w-full aspect-square object-cover"
              data-testid={`img-guide-${guide.id}`}
            />
          ) : (
            <div className="w-full aspect-square bg-muted flex items-center justify-center">
              <i className="fas fa-image text-xl text-muted-foreground"></i>
            </div>
          )}
          
          <div className="p-2">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-medium text-xs truncate flex-1" data-testid={`text-title-${guide.id}`}>
                {guide.title}
              </h3>
              {guide.locationName && (
                <div className="location-badge px-1 py-0.5 rounded text-xs text-white ml-1">
                  <i className="fas fa-map-marker-alt text-xs"></i>
                </div>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground line-clamp-1" data-testid={`text-description-${guide.id}`}>
              {guide.description}
            </p>
            
            <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
              <span data-testid={`text-date-${guide.id}`} className="text-xs">
                {formatDate(guide.createdAt!)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
