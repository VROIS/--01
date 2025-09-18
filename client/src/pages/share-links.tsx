import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { type ShareLink } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navigation from "@/components/navigation";
import { useEffect } from "react";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function ShareLinks() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  const { data: shareLinks = [], isLoading: linksLoading, error } = useQuery<ShareLink[]>({
    queryKey: ["/api/share-links"],
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

  const copyShareLink = (linkId: string) => {
    const shareUrl = `${window.location.origin}/share/${linkId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: "Success",
        description: "Share link copied to clipboard!",
      });
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to copy link to clipboard.",
        variant: "destructive",
      });
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
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-semibold korean-text">{t('nav.shareLinks')}</h1>
          <span className="text-sm text-muted-foreground korean-text">
            {t('main.total', { count: shareLinks.length })}
          </span>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {linksLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                    <div className="flex space-x-4">
                      <div className="h-3 bg-muted rounded w-20"></div>
                      <div className="h-3 bg-muted rounded w-20"></div>
                      <div className="h-3 bg-muted rounded w-24"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : shareLinks.length > 0 ? (
          <div className="space-y-4">
            {shareLinks.map((link: any) => (
              <Card key={link.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium korean-text" data-testid={`text-link-name-${link.id}`}>
                        {link.name}
                      </h3>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                        <span data-testid={`text-link-guides-${link.id}`}>
                          {link.guideIds.length}개 가이드
                        </span>
                        <span data-testid={`text-link-views-${link.id}`}>
                          조회 {link.viewCount}회
                        </span>
                        <span data-testid={`text-link-date-${link.id}`}>
                          {new Date(link.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      {link.includeLocation && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                            <i className="fas fa-map-marker-alt mr-1"></i>
                            위치 정보 포함
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyShareLink(link.id)}
                        data-testid={`button-copy-link-${link.id}`}
                      >
                        <i className="fas fa-copy mr-2"></i>
                        {t('common.copy')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`button-view-link-${link.id}`}
                      >
                        <i className="fas fa-external-link-alt"></i>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
              <i className="fas fa-link text-2xl text-muted-foreground"></i>
            </div>
            <div>
              <h3 className="font-semibold korean-text">No share links yet</h3>
              <p className="text-sm text-muted-foreground korean-text">
                Create share links from your guides to share with others
              </p>
            </div>
          </div>
        )}
      </div>

      <Navigation currentPage="share-links" />
    </div>
  );
}
