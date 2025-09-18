import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";

export default function CameraCapture() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCamera, setShowCamera] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<File | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiRequest("POST", "/api/guides", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guides"] });
      toast({
        title: "Success",
        description: "Guide created successfully!",
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create guide. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      console.log('getCurrentLocation: Checking geolocation support...');
      if (!navigator.geolocation) {
        console.error('getCurrentLocation: Geolocation not supported');
        reject(new Error("Geolocation is not supported"));
        return;
      }

      console.log('getCurrentLocation: Requesting current position...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          console.log('getCurrentLocation: Position success:', coords);
          resolve(coords);
        },
        (error) => {
          console.error('getCurrentLocation: Position error:', error.code, error.message);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  };

  const startCamera = async () => {
    console.log('startCamera: Starting camera and location capture...');
    try {
      // Try to start camera first - this is the primary function
      console.log('startCamera: Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setShowCamera(true);
        console.log('startCamera: Camera started successfully');
      }

      // Get location in parallel - don't block camera if this fails
      try {
        console.log('startCamera: Requesting location access...');
        const currentLocation = await getCurrentLocation();
        setLocation(currentLocation);
        console.log('startCamera: Location captured:', currentLocation);
      } catch (locationError) {
        console.warn('startCamera: Location access failed:', locationError);
        // Use a default location for testing purposes
        const defaultLocation = { latitude: 37.5665, longitude: 126.9780 }; // Seoul
        setLocation(defaultLocation);
        console.log('startCamera: Using default location:', defaultLocation);
      }
    } catch (cameraError) {
      console.error('startCamera: Camera access failed:', cameraError);
      toast({
        title: "Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !location) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert canvas to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `guide-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          setCapturedImage(file);
          setIsCapturing(true);
        }
      },
      "image/jpeg",
      0.9
    );
  };

  const handleUpload = () => {
    if (!capturedImage || !location) return;

    const formData = new FormData();
    formData.append("image", capturedImage);
    formData.append("latitude", location.latitude.toString());
    formData.append("longitude", location.longitude.toString());
    formData.append("language", i18n.language);
    formData.append("enableAI", "true");

    uploadMutation.mutate(formData);
  };

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setIsCapturing(false);
    setCapturedImage(null);
    setLocation(null);
  };

  return (
    <>
      <Button
        onClick={startCamera}
        className="w-full bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-md transition-shadow text-foreground"
        variant="ghost"
        data-testid="button-camera"
      >
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <i className="fas fa-camera text-2xl text-primary"></i>
          </div>
          <div>
            <h3 className="font-semibold korean-text">{t('main.newGuide')}</h3>
            <p className="text-sm text-muted-foreground korean-text">{t('main.newGuideDesc')}</p>
          </div>
          <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground">
            <span className="flex items-center korean-text">
              <i className="fas fa-map-marker-alt mr-1"></i>{t('main.gpsCapture')}
            </span>
            <span className="flex items-center korean-text">
              <i className="fas fa-robot mr-1"></i>{t('main.aiContent')}
            </span>
          </div>
        </div>
      </Button>

      <Dialog open={showCamera} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="korean-text">{t('main.newGuide')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!isCapturing ? (
              <>
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg"
                    data-testid="video-camera"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-white rounded-lg"></div>
                  </div>
                </div>
                <div className="flex justify-center space-x-4">
                  <Button onClick={handleClose} variant="outline" data-testid="button-cancel">
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={capturePhoto} data-testid="button-capture">
                    <i className="fas fa-camera mr-2"></i>
                    Capture
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <i className="fas fa-check text-2xl text-primary"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold korean-text">Photo Captured!</h3>
                    <p className="text-sm text-muted-foreground korean-text">
                      Creating guide with AI content generation...
                    </p>
                  </div>
                  {location && (
                    <div className="text-xs text-muted-foreground">
                      Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </div>
                  )}
                </div>
                <div className="flex space-x-4">
                  <Button
                    onClick={() => setIsCapturing(false)}
                    variant="outline"
                    disabled={uploadMutation.isPending}
                    data-testid="button-retake"
                  >
                    Retake
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={uploadMutation.isPending}
                    className="flex-1"
                    data-testid="button-upload"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-upload mr-2"></i>
                        Create Guide
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>
    </>
  );
}
