import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { type User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import Navigation from "@/components/navigation";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function Profile() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

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

  const handleLogout = () => {
    window.location.href = "/api/logout";
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
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-semibold">{t('nav.profile')}</h1>
          <Link href="/settings">
            <Button variant="ghost" size="sm" data-testid="button-settings">
              <i className="fas fa-cog"></i>
            </Button>
          </Link>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user?.profileImageUrl || ''} alt="Profile" />
                <AvatarFallback>
                  <i className="fas fa-user text-xl"></i>
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold" data-testid="text-user-name">
                  {user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email || 'User'
                  }
                </h2>
                <p className="text-sm text-muted-foreground" data-testid="text-user-email">
                  {user?.email}
                </p>
                <div className="flex items-center mt-2 text-xs text-muted-foreground">
                  <span>가입일: {new Date(user?.createdAt || '').toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/">
              <Button variant="ghost" className="w-full justify-start" data-testid="button-my-guides">
                <i className="fas fa-folder mr-3"></i>
                <span >내 가이드</span>
              </Button>
            </Link>
            <Link href="/share-links">
              <Button variant="ghost" className="w-full justify-start" data-testid="button-share-links">
                <i className="fas fa-link mr-3"></i>
                <span >공유링크 관리</span>
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" className="w-full justify-start" data-testid="button-settings-full">
                <i className="fas fa-cog mr-3"></i>
                <span >설정</span>
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle >Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary" data-testid="text-guides-count">0</div>
                <div className="text-sm text-muted-foreground">가이드</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-secondary" data-testid="text-shares-count">0</div>
                <div className="text-sm text-muted-foreground">공유링크</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <i className="fas fa-sign-out-alt mr-2"></i>
              <span >로그아웃</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Navigation currentPage="profile" />
    </div>
  );
}
