import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Calendar, Eye, Play, Pause } from "lucide-react";
import { useState } from "react";
import { type Guide } from "@shared/schema";
import { format } from "date-fns";
import { ko, enUS, ja, zhCN } from "date-fns/locale";

export default function GuideDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);

  const { data: guide, isLoading } = useQuery<Guide>({
    queryKey: ["/api/guides", id],
    queryFn: async () => {
      const response = await fetch(`/api/guides/${id}`);
      if (!response.ok) throw new Error('Failed to fetch guide');
      return response.json();
    },
    enabled: !!id,
  });

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ja': return ja;
      case 'zh': return zhCN;
      case 'en': return enUS;
      default: return ko;
    }
  };

  const formatDate = (date: string | Date) => {
    return format(new Date(date), 'yyyy.MM.dd HH:mm', { locale: getDateLocale() });
  };

  const handleBack = () => {
    setLocation("/");
  };

  const handlePlayAudio = () => {
    if (!guide?.aiGeneratedContent) return;
    // TODO: Implement audio playback
    setIsPlaying(!isPlaying);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded-xl"></div>
            <div className="h-6 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <i className="fas fa-exclamation text-2xl text-muted-foreground"></i>
          </div>
          <div>
            <h3 className="font-semibold korean-text">Guide not found</h3>
            <p className="text-sm text-muted-foreground korean-text">
              This guide may have been deleted or does not exist.
            </p>
          </div>
          <Button onClick={handleBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="relative">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="flex items-center justify-between p-4">
            <Button
              onClick={handleBack}
              variant="ghost"
              size="sm"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('common.back')}
            </Button>
            <div className="flex items-center space-x-2">
              {guide.aiGeneratedContent && (
                <Button
                  onClick={handlePlayAudio}
                  variant="outline"
                  size="sm"
                  data-testid="button-play-audio"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Image */}
          {guide.imageUrl ? (
            <div className="aspect-[4/3] rounded-xl overflow-hidden">
              <img
                src={guide.imageUrl}
                alt={guide.title}
                className="w-full h-full object-cover"
                data-testid="img-guide-detail"
              />
            </div>
          ) : (
            <div className="aspect-[4/3] rounded-xl bg-muted flex items-center justify-center">
              <i className="fas fa-image text-4xl text-muted-foreground"></i>
            </div>
          )}

          {/* Title and Meta */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold korean-text mb-2" data-testid="text-title-detail">
                {guide.title}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {guide.locationName && (
                  <div className="flex items-center korean-text" data-testid="text-location">
                    <MapPin className="w-4 h-4 mr-1" />
                    {guide.locationName}
                  </div>
                )}
                <div className="flex items-center korean-text" data-testid="text-date-detail">
                  <Calendar className="w-4 h-4 mr-1" />
                  {formatDate(guide.createdAt!)}
                </div>
                <div className="flex items-center korean-text" data-testid="text-views-detail">
                  <Eye className="w-4 h-4 mr-1" />
                  {t('main.views', { count: guide.viewCount || 0 })}
                </div>
              </div>
            </div>

            {/* Description */}
            {guide.description && (
              <div className="prose max-w-none">
                <p className="text-foreground korean-text leading-relaxed" data-testid="text-description-detail">
                  {guide.description}
                </p>
              </div>
            )}

            {/* AI Generated Content */}
            {guide.aiGeneratedContent && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                    <i className="fas fa-robot text-xs text-primary"></i>
                  </div>
                  <h3 className="font-semibold korean-text">AI Generated Content</h3>
                </div>
                <div className="bg-card p-4 rounded-lg border">
                  <p className="text-foreground korean-text leading-relaxed" data-testid="text-ai-content">
                    {guide.aiGeneratedContent}
                  </p>
                </div>
              </div>
            )}

            {/* Map Location */}
            {guide.latitude && guide.longitude && !isNaN(Number(guide.latitude)) && !isNaN(Number(guide.longitude)) && (
              <div className="space-y-3">
                <h3 className="font-semibold korean-text">Location</h3>
                <div className="bg-card p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground korean-text mb-2">
                    {Number(guide.latitude).toFixed(6)}, {Number(guide.longitude).toFixed(6)}
                  </p>
                  <Button
                    onClick={() => {
                      const lat = Number(guide.latitude);
                      const lng = Number(guide.longitude);
                      const url = `https://maps.google.com/maps?q=${lat},${lng}`;
                      window.open(url, '_blank');
                    }}
                    variant="outline"
                    size="sm"
                    data-testid="button-open-map"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Open in Maps
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}