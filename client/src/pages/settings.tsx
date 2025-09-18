import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { type User, type ShareLink } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/navigation";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [preferences, setPreferences] = useState({
    preferredLanguage: 'ko',
    locationEnabled: true,
    aiContentEnabled: true,
  });

  const { data: shareLinks = [] } = useQuery<ShareLink[]>({
    queryKey: ["/api/share-links"],
    enabled: isAuthenticated,
    retry: false,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: typeof preferences) => {
      return await apiRequest("PATCH", "/api/user/preferences", newPreferences);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Success",
        description: "Preferences updated successfully!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
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
      toast({
        title: "Error",
        description: "Failed to update preferences.",
        variant: "destructive",
      });
    },
  });

  const deleteShareLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return await apiRequest("DELETE", `/api/share-links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/share-links"] });
      toast({
        title: "Success",
        description: "Share link deleted successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete share link.",
        variant: "destructive",
      });
    },
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
    if (user) {
      const userData = user as User;
      setPreferences({
        preferredLanguage: userData.preferredLanguage || 'ko',
        locationEnabled: userData.locationEnabled ?? true,
        aiContentEnabled: userData.aiContentEnabled ?? true,
      });
    }
  }, [user]);

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language);
    const newPreferences = { ...preferences, preferredLanguage: language };
    setPreferences(newPreferences);
    updatePreferencesMutation.mutate(newPreferences);
  };

  const handleToggle = (key: keyof typeof preferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    updatePreferencesMutation.mutate(newPreferences);
  };

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
      {/* Settings Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center px-4 py-3">
          <Link href="/">
            <button className="p-2 rounded-lg hover:bg-muted transition-colors mr-3" data-testid="button-back">
              <i className="fas fa-arrow-left text-lg"></i>
            </button>
          </Link>
          <h1 className="text-xl font-semibold korean-text">{t('settings.title')}</h1>
        </div>
      </header>

      {/* Settings Content */}
      <div className="p-4 space-y-6">
        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="korean-text">{t('settings.account')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium korean-text">{t('settings.language')}</h3>
                <p className="text-sm text-muted-foreground korean-text">{t('settings.languageDesc')}</p>
              </div>
              <Select value={preferences.preferredLanguage} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-32" data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ko">한국어</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium korean-text">{t('settings.location')}</h3>
                <p className="text-sm text-muted-foreground korean-text">{t('settings.locationDesc')}</p>
              </div>
              <Switch
                checked={preferences.locationEnabled}
                onCheckedChange={(checked) => handleToggle('locationEnabled', checked)}
                data-testid="switch-location"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium korean-text">{t('settings.aiContent')}</h3>
                <p className="text-sm text-muted-foreground korean-text">{t('settings.aiContentDesc')}</p>
              </div>
              <Switch
                checked={preferences.aiContentEnabled}
                onCheckedChange={(checked) => handleToggle('aiContentEnabled', checked)}
                data-testid="switch-ai-content"
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="korean-text">{t('settings.privacy')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-between"
              data-testid="button-privacy-policy"
            >
              <span className="korean-text">{t('settings.privacyPolicy')}</span>
              <i className="fas fa-chevron-right text-muted-foreground"></i>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-between"
              data-testid="button-data-management"
            >
              <span className="korean-text">{t('settings.dataManagement')}</span>
              <i className="fas fa-chevron-right text-muted-foreground"></i>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-between"
              data-testid="button-export-data"
            >
              <span className="korean-text">{t('settings.exportData')}</span>
              <i className="fas fa-download text-muted-foreground"></i>
            </Button>
          </CardContent>
        </Card>

        {/* Share Link Management */}
        <Card>
          <CardHeader>
            <CardTitle className="korean-text">{t('settings.shareLinkManagement')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {shareLinks.map((link: any) => (
              <div key={link.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <h3 className="font-medium text-sm korean-text" data-testid={`text-share-name-${link.id}`}>
                    {link.name}
                  </h3>
                  <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                    <span data-testid={`text-guide-count-${link.id}`}>
                      {link.guideIds.length}개 가이드
                    </span>
                    <span data-testid={`text-share-views-${link.id}`}>
                      조회 {link.viewCount}회
                    </span>
                    <span data-testid={`text-share-date-${link.id}`}>
                      {new Date(link.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyShareLink(link.id)}
                    data-testid={`button-copy-${link.id}`}
                  >
                    <i className="fas fa-copy text-sm"></i>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid={`button-edit-${link.id}`}
                  >
                    <i className="fas fa-edit text-sm"></i>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteShareLinkMutation.mutate(link.id)}
                    disabled={deleteShareLinkMutation.isPending}
                    data-testid={`button-delete-${link.id}`}
                  >
                    <i className="fas fa-trash text-sm text-destructive"></i>
                  </Button>
                </div>
              </div>
            ))}

            {shareLinks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground korean-text">
                No share links created yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* App Information */}
        <Card>
          <CardHeader>
            <CardTitle className="korean-text">{t('settings.appInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="korean-text">{t('settings.version')}</span>
              <span className="text-muted-foreground">v2.1.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="korean-text">{t('settings.lastUpdate')}</span>
              <span className="text-muted-foreground">2024.01.15</span>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-between"
              data-testid="button-check-update"
            >
              <span className="korean-text">{t('settings.checkUpdate')}</span>
              <i className="fas fa-sync text-muted-foreground"></i>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Navigation currentPage="settings" />
    </div>
  );
}
