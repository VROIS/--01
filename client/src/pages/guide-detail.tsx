import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Calendar, Eye, Play, Pause } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { type Guide } from "@shared/schema";
import { format } from "date-fns";
import { ko, enUS, ja, zhCN } from "date-fns/locale";

export default function GuideDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Cleanup speech synthesis on component unmount or guide change
  useEffect(() => {
    return () => {
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
        speechSynthesisRef.current = null;
        setIsPlaying(false);
        setIsSpeaking(false);
      }
    };
  }, [id]);

  // Handle visibility change to pause/resume speech
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isSpeaking) {
        window.speechSynthesis.pause();
        // onpause event will handle state update
      } else if (!document.hidden && isPlaying && !isSpeaking && speechSynthesisRef.current) {
        window.speechSynthesis.resume();
        // onresume event will handle state update
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, isSpeaking]);

  // Load voices when component mounts
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Sometimes voices load asynchronously
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log('Available TTS voices:', voices.length);
      };

      // Load immediately if available
      loadVoices();

      // Also load when voices change
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

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

  const handlePlayAudio = async () => {
    if (!guide?.aiGeneratedContent) {
      console.warn('TTS: No AI generated content available');
      return;
    }

    // Check if browser supports speech synthesis
    if (!('speechSynthesis' in window)) {
      console.error('TTS: Speech synthesis not supported in this browser');
      return;
    }

    // Handle pause/resume if already playing
    if (isPlaying && speechSynthesisRef.current) {
      if (isSpeaking) {
        // Currently speaking - pause it
        window.speechSynthesis.pause();
        setIsSpeaking(false);
        console.log('TTS: Paused');
      } else {
        // Currently paused - resume it
        window.speechSynthesis.resume();
        setIsSpeaking(true);
        console.log('TTS: Resumed');
      }
      return;
    }

    try {
      // Ensure we have fresh voices loaded
      const loadVoices = () => {
        return new Promise<SpeechSynthesisVoice[]>((resolve) => {
          let voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            resolve(voices);
          } else {
            window.speechSynthesis.onvoiceschanged = () => {
              voices = window.speechSynthesis.getVoices();
              resolve(voices);
            };
          }
        });
      };

      console.log('TTS: Loading voices...');
      const voices = await loadVoices();
      console.log(`TTS: Found ${voices.length} voices`);

      // Get appropriate language
      const getVoiceLang = () => {
        switch (i18n.language) {
          case 'ko': return 'ko-KR';
          case 'en': return 'en-US';
          case 'ja': return 'ja-JP';
          case 'zh': return 'zh-CN';
          default: return 'ko-KR';
        }
      };

      // Limit text length to avoid synthesis issues
      const maxLength = 1000;
      let textToSpeak = guide.aiGeneratedContent;
      if (textToSpeak.length > maxLength) {
        textToSpeak = textToSpeak.substring(0, maxLength) + '...';
        console.log(`TTS: Text truncated to ${maxLength} characters`);
      }

      // Create new speech utterance
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      speechSynthesisRef.current = utterance;

      // Set voice with language preference
      const targetLang = getVoiceLang();
      console.log(`TTS: Target language: ${targetLang}`);

      // Find the best voice for the language
      let selectedVoice = null;

      // First, try to find exact lang match
      selectedVoice = voices.find(voice => voice.lang === targetLang);

      // If not found, try to find language family match (ko, en, ja, zh)
      if (!selectedVoice) {
        const langPrefix = targetLang.split('-')[0];
        selectedVoice = voices.find(voice => voice.lang.startsWith(langPrefix));
      }

      // If still not found, use default voice
      if (!selectedVoice && voices.length > 0) {
        selectedVoice = voices[0];
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log(`TTS: Selected voice: ${selectedVoice.name} (${selectedVoice.lang})`);
      } else {
        utterance.lang = targetLang;
        console.log(`TTS: Using language setting: ${targetLang}`);
      }

      // Configure utterance
      utterance.rate = 0.9; // Slightly slower for better comprehension
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Set up event listeners
      utterance.onstart = () => {
        setIsPlaying(true);
        setIsSpeaking(true);
        console.log('TTS: Started successfully');
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsSpeaking(false);
        speechSynthesisRef.current = null;
        console.log('TTS: Ended');
      };

      utterance.onerror = (event) => {
        console.error('TTS: Error occurred:', event.error, event);
        setIsPlaying(false);
        setIsSpeaking(false);
        speechSynthesisRef.current = null;

        // Show user-friendly error message
        if (event.error === 'synthesis-failed') {
          console.error('TTS: Speech synthesis failed - this may be due to browser limitations or voice availability');
        }
      };

      utterance.onpause = () => {
        setIsSpeaking(false);
        console.log('TTS: Paused via event');
      };

      utterance.onresume = () => {
        setIsSpeaking(true);
        console.log('TTS: Resumed via event');
      };

      // Cancel any existing speech before starting new one
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
        console.log('TTS: Cancelled existing speech');
        // Small delay to ensure cancellation is complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Start speech synthesis
      console.log('TTS: Starting speech synthesis...');
      window.speechSynthesis.speak(utterance);

    } catch (error) {
      console.error('TTS: Unexpected error:', error);
      setIsPlaying(false);
      setIsSpeaking(false);
      speechSynthesisRef.current = null;
    }
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
            <h3 className="font-semibold">Guide not found</h3>
            <p className="text-sm text-muted-foreground">
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
                  className={`${isPlaying ? 'bg-primary/10 text-primary border-primary/20' : ''}`}
                >
                  {isPlaying ? (
                    isSpeaking ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <span className="ml-1 text-xs">
                    {isPlaying ? (isSpeaking ? '재생중' : '일시정지') : '음성'}
                  </span>
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
              <h1 className="text-2xl font-bold mb-2" data-testid="text-title-detail">
                {guide.title}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {guide.locationName && (
                  <div className="flex items-center" data-testid="text-location">
                    <MapPin className="w-4 h-4 mr-1" />
                    {guide.locationName}
                  </div>
                )}
                <div className="flex items-center" data-testid="text-date-detail">
                  <Calendar className="w-4 h-4 mr-1" />
                  {formatDate(guide.createdAt!)}
                </div>
                <div className="flex items-center" data-testid="text-views-detail">
                  <Eye className="w-4 h-4 mr-1" />
                  {t('main.views', { count: guide.viewCount || 0 })}
                </div>
              </div>
            </div>

            {/* Description */}
            {guide.description && (
              <div className="prose max-w-none">
                <p className="text-foreground leading-relaxed" data-testid="text-description-detail">
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
                  <h3 className="font-semibold">AI Generated Content</h3>
                </div>
                <div className="bg-card p-4 rounded-lg border">
                  <p className="text-foreground leading-relaxed" data-testid="text-ai-content">
                    {guide.aiGeneratedContent}
                  </p>
                </div>
              </div>
            )}

            {/* Map Location */}
            {guide.latitude && guide.longitude && !isNaN(Number(guide.latitude)) && !isNaN(Number(guide.longitude)) && (
              <div className="space-y-3">
                <h3 className="font-semibold">Location</h3>
                <div className="bg-card p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-2">
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