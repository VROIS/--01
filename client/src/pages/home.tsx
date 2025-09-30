import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { type Guide, type ShareLink } from "@shared/schema";
import CameraCapture from "@/components/camera-capture";
import GuideGrid from "@/components/guide-grid";
import SharePanel from "@/components/share-panel";
import Navigation from "@/components/navigation";
import { Download } from "lucide-react";

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

  const { data: featuredLinks = [] } = useQuery<ShareLink[]>({
    queryKey: ["/api/featured-share-links"],
    enabled: true,
    retry: false,
  });

  const handleDownloadFeatured = async (link: ShareLink) => {
    try {
      if (!link.htmlFilePath) {
        toast({
          title: "오류",
          description: "다운로드할 파일이 없습니다.",
          variant: "destructive",
        });
        return;
      }

      // Download the HTML file from the server
      const response = await fetch(link.htmlFilePath);
      const htmlContent = await response.text();
      
      // Create a blob from the HTML content
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `${link.name}-손안에가이드.html`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "다운로드 완료",
        description: `${link.name} 파일이 다운로드되었습니다.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "다운로드 실패",
        description: "파일 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

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
          <p className="text-muted-foreground">{t('common.loading')}</p>
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
            <h1 className="text-xl font-semibold">{t('main.storage')}</h1>
            {isBatchMode && (
              <span className="px-2 py-1 bg-primary text-primary-foreground rounded-full text-xs" data-testid="text-selected-count">
                {t('share.selected', { count: selectedGuides.length })}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="location-badge px-3 py-1 rounded-full text-white text-xs font-medium">
              <i className="fas fa-map-marker-alt mr-1"></i>
              <span>서울, 강남구</span>
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

        {/* Featured Gallery Section */}
        {featuredLinks.length > 0 && (
          <section className="px-4 py-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">✨ 추천 갤러리</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {featuredLinks.map((link) => (
                <div
                  key={link.id}
                  className="bg-card rounded-lg overflow-hidden shadow-sm border border-border hover:shadow-md transition-shadow"
                  data-testid={`featured-gallery-${link.id}`}
                >
                  <div className="aspect-square bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                    <i className="fas fa-star text-white text-2xl"></i>
                  </div>
                  <div className="p-2">
                    <h3 className="text-xs font-medium truncate" data-testid={`text-featured-name-${link.id}`}>
                      {link.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadFeatured(link);
                      }}
                      className="mt-2 w-full bg-primary/10 text-primary text-xs py-1 rounded flex items-center justify-center gap-1 hover:bg-primary/20 transition-colors"
                      data-testid={`button-download-${link.id}`}
                    >
                      <Download className="w-3 h-3" />
                      다운로드
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Guide Items Grid */}
        <section className="px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('main.myGuides')}</h2>
            <span className="text-sm text-muted-foreground">
              {t('main.total', { count: guides.length })}
            </span>
          </div>

          {guidesLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl overflow-hidden shadow-sm border border-border animate-pulse">
                  <div className="w-full aspect-square bg-muted"></div>
                  <div className="p-2 space-y-1">
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                    <div className="h-2 bg-muted rounded w-full"></div>
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

      {/* Bottom Action Bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 bg-card border-t border-border shadow-lg">
        <div className="grid grid-cols-4 divide-x divide-border">
          <button
            onClick={toggleBatchMode}
            className={`flex flex-col items-center justify-center py-3 transition-colors ${
              isBatchMode ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
            }`}
            data-testid="button-select"
          >
            <i className="fas fa-check-square text-xl mb-1"></i>
            <span className="text-xs">선택</span>
          </button>
          
          <button
            onClick={() => {
              if (selectedGuides.length > 0) {
                setShowSharePanel(true);
              } else {
                toast({
                  title: "알림",
                  description: "공유할 가이드를 선택해주세요.",
                  variant: "destructive",
                });
              }
            }}
            className="flex flex-col items-center justify-center py-3 hover:bg-muted transition-colors"
            data-testid="button-share"
          >
            <i className="fas fa-share-alt text-xl mb-1"></i>
            <span className="text-xs">공유</span>
          </button>
          
          <button
            onClick={() => {
              if (selectedGuides.length === 0) {
                toast({
                  title: "알림",
                  description: "삭제할 가이드를 선택해주세요.",
                  variant: "destructive",
                });
              } else {
                // TODO: Implement delete functionality
                toast({
                  title: "삭제 예정",
                  description: `${selectedGuides.length}개 항목이 삭제될 예정입니다.`,
                });
              }
            }}
            className="flex flex-col items-center justify-center py-3 hover:bg-muted transition-colors"
            data-testid="button-delete"
          >
            <i className="fas fa-trash text-xl mb-1"></i>
            <span className="text-xs">삭제</span>
          </button>
          
          <button
            onClick={() => window.location.href = '/settings'}
            className="flex flex-col items-center justify-center py-3 hover:bg-muted transition-colors"
            data-testid="button-settings"
          >
            <i className="fas fa-cog text-xl mb-1"></i>
            <span className="text-xs">설정</span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <Navigation currentPage="home" />
    </div>
  );
}
