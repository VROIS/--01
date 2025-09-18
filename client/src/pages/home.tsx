import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { type Guide } from "@shared/schema";
import CameraCapture from "@/components/camera-capture";
import GuideGrid from "@/components/guide-grid";
import SharePanel from "@/components/share-panel";
import Navigation from "@/components/navigation";

export default function Home() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedGuides, setSelectedGuides] = useState<string[]>([]);
  const [showSharePanel, setShowSharePanel] = useState(false);

  const { data: guides = [], isLoading: guidesLoading, error } = useQuery<Guide[]>({
    queryKey: ["/api/guides"],
    enabled: isAuthenticated,
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [error, toast]);

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    setSelectedGuides([]);
    setShowSharePanel(false);
  };

  const handleGuideSelection = (guideId: string) => {
    if (!isBatchMode) return;

    setSelectedGuides(prev => {
      const isSelected = prev.includes(guideId);
      let newSelection;

      if (isSelected) {
        newSelection = prev.filter(id => id !== guideId);
      } else if (prev.length < 30) {
        newSelection = [...prev, guideId];
      } else {
        toast({
          title: "Selection Limit",
          description: "You can select up to 30 guides maximum.",
          variant: "destructive",
        });
        return prev;
      }

      setShowSharePanel(newSelection.length > 0);
      return newSelection;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground korean-text">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleBatchMode}
              className={`p-2 rounded-lg hover:bg-muted transition-colors ${
                isBatchMode ? 'bg-primary text-primary-foreground' : ''
              }`}
              data-testid="button-batch-select"
            >
              <i className="fas fa-check-square text-lg"></i>
            </button>
            <h1 className="text-xl font-semibold korean-text">{t('main.storage')}</h1>
            {isBatchMode && (
              <span className="px-2 py-1 bg-primary text-primary-foreground rounded-full text-xs" data-testid="text-selected-count">
                {t('share.selected', { count: selectedGuides.length })}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="location-badge px-3 py-1 rounded-full text-white text-xs font-medium">
              <i className="fas fa-map-marker-alt mr-1"></i>
              <span className="korean-text">서울, 강남구</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-32">
        {/* Camera Section */}
        <section className="px-4 py-6 bg-gradient-to-r from-primary/10 to-secondary/10">
          <CameraCapture />
        </section>

        {/* Guide Items Grid */}
        <section className="px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold korean-text">{t('main.myGuides')}</h2>
            <span className="text-sm text-muted-foreground korean-text">
              {t('main.total', { count: guides.length })}
            </span>
          </div>

          {guidesLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl overflow-hidden shadow-sm border border-border animate-pulse">
                  <div className="w-full h-32 bg-muted"></div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-full"></div>
                    <div className="flex justify-between">
                      <div className="h-3 bg-muted rounded w-1/3"></div>
                      <div className="h-3 bg-muted rounded w-1/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <GuideGrid
              guides={guides}
              isBatchMode={isBatchMode}
              selectedGuides={selectedGuides}
              onGuideSelect={handleGuideSelection}
            />
          )}
        </section>
      </main>

      {/* Share Panel */}
      {showSharePanel && (
        <SharePanel
          selectedGuideIds={selectedGuides}
          onClose={() => {
            setShowSharePanel(false);
            setSelectedGuides([]);
            setIsBatchMode(false);
          }}
        />
      )}

      {/* Bottom Navigation */}
      <Navigation currentPage="home" />
    </div>
  );
}
