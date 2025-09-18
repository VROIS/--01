import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

interface SharePanelProps {
  selectedGuideIds: string[];
  onClose: () => void;
}

export default function SharePanel({ selectedGuideIds, onClose }: SharePanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [linkName, setLinkName] = useState("");
  const [includeLocation, setIncludeLocation] = useState(true);
  const [includeAudio, setIncludeAudio] = useState(false);

  const createShareLinkMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      guideIds: string[];
      includeLocation: boolean;
      includeAudio: boolean;
    }) => {
      return await apiRequest("POST", "/api/share-links", data);
    },
    onSuccess: (shareLink) => {
      queryClient.invalidateQueries({ queryKey: ["/api/share-links"] });
      
      // Copy link to clipboard
      const shareUrl = `${window.location.origin}/share/${shareLink.id}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        toast({
          title: "Success",
          description: "Share link created and copied to clipboard!",
        });
      }).catch(() => {
        toast({
          title: "Success",
          description: "Share link created successfully!",
        });
      });
      
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create share link. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateLink = () => {
    if (!linkName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the share link.",
        variant: "destructive",
      });
      return;
    }

    createShareLinkMutation.mutate({
      name: linkName.trim(),
      guideIds: selectedGuideIds,
      includeLocation,
      includeAudio,
    });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 floating-share-panel">
      <div className="bg-card border-t border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold korean-text">{t('share.title')}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            data-testid="button-close-share"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="linkName" className="korean-text">{t('share.linkName')}</Label>
            <Input
              id="linkName"
              type="text"
              placeholder={t('share.linkNamePlaceholder')}
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              className="korean-text mt-2"
              data-testid="input-link-name"
            />
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="includeLocation"
              checked={includeLocation}
              onCheckedChange={(checked) => setIncludeLocation(checked as boolean)}
              data-testid="checkbox-include-location"
            />
            <Label htmlFor="includeLocation" className="text-sm korean-text">
              {t('share.includeLocation')}
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="includeAudio"
              checked={includeAudio}
              onCheckedChange={(checked) => setIncludeAudio(checked as boolean)}
              data-testid="checkbox-include-audio"
            />
            <Label htmlFor="includeAudio" className="text-sm korean-text">
              {t('share.includeAudio')}
            </Label>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={handleCreateLink}
              disabled={createShareLinkMutation.isPending}
              className="flex-1 korean-text"
              data-testid="button-create-share"
            >
              {createShareLinkMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                t('share.create')
              )}
            </Button>
            <Button
              variant="outline"
              className="korean-text"
              data-testid="button-preview-share"
            >
              {t('share.preview')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
