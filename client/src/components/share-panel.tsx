import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Guide } from "@shared/schema";

interface SharePanelProps {
  selectedGuideIds: string[];
  guides: Guide[]; // home.tsx로부터 전체 가이드 데이터를 받습니다.
  onClose: () => void;
}

export default function SharePanel({ selectedGuideIds, guides, onClose }: SharePanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [linkName, setLinkName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 서버/Blob 의존성을 제거한 새로운 핸들러
  const handleCreateAndCopyLink = () => {
    if (!linkName.trim()) {
      toast({
        title: "이름 필요",
        description: "공유 가이드북의 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // 1. 선택된 가이드들의 전체 데이터만 필터링합니다.
      const selectedGuidesData = guides.filter(guide => selectedGuideIds.includes(guide.id));

      // 2. 공유 URL에 담을 데이터 객체를 생성합니다.
      const shareObject = {
        name: linkName.trim(),
        createdAt: new Date().toISOString(),
        contents: selectedGuidesData.map(guide => ({
          id: guide.id,
          title: guide.title,
          description: guide.description,
          aiGeneratedContent: guide.aiGeneratedContent,
          imageUrl: guide.imageUrl,
        })),
      };

      // 3. 데이터를 JSON 문자열로 변환 후 URL 인코딩합니다.
      const jsonString = JSON.stringify(shareObject);
      const encodedData = encodeURIComponent(jsonString);

      // 4. 최종 공유 URL을 생성합니다.
      const shareUrl = `${window.location.origin}/share.html?data=${encodedData}`;

      // 5. 생성된 URL을 클립보드에 복사합니다.
      navigator.clipboard.writeText(shareUrl).then(() => {
        toast({
          title: "성공!",
          description: "공유 링크가 클립보드에 복사되었습니다.",
        });
        onClose(); // 성공 후 패널을 닫습니다.
      }).catch(err => {
        console.error("Clipboard copy failed:", err);
        toast({
          title: "복사 실패",
          description: "링크를 클립보드에 복사하지 못했습니다.",
          variant: "destructive",
        });
      });

    } catch (error) {
      console.error("Share link creation error:", error);
      toast({
        title: "생성 오류",
        description: "공유 링크를 생성하는 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 floating-share-panel">
      <div className="bg-card border-t border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('share.title')}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="linkName">{t('share.linkName')}</Label>
            <Input
              id="linkName"
              type="text"
              placeholder={t('share.linkNamePlaceholder')}
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              className="mt-2"
            />
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={handleCreateAndCopyLink}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  생성 중...
                </>
              ) : (
                "링크 생성 및 복사"
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            버튼을 누르면 공유 링크가 클립보드에 복사됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}