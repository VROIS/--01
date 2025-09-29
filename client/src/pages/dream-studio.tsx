import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Camera,
  Video,
  Wand2,
  Upload,
  Coins,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  videoUrl?: string;
  prompt?: string;
  duration?: string;
  quality?: string;
  settings?: any;
}

export default function DreamStudio() {
  const { toast } = useToast();
  const [selectedGuideId, setSelectedGuideId] = useState<string>('');
  const [userPhoto, setUserPhoto] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [customScript, setCustomScript] = useState('');
  const [mood, setMood] = useState('cinematic');
  const [lighting, setLighting] = useState('golden-hour');
  const [angle, setAngle] = useState('medium-shot');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const { data: credits } = useQuery({
    queryKey: ['/api/credits'],
  });

  const { data: guides } = useQuery({
    queryKey: ['/api/guides'],
  });

  const generateImageMutation = useMutation({
    mutationFn: async (formData: FormData): Promise<GenerationResult> => {
      setIsGenerating(true);
      setGenerationProgress(0);

      // 진행률 시뮬레이션
      const interval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      try {
        const response = await fetch('/api/dream-studio/generate-image', {
          method: 'POST',
          body: formData
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      } finally {
        clearInterval(interval);
        setGenerationProgress(100);
        setIsGenerating(false);
      }
    },
    onSuccess: (data: GenerationResult) => {
      setResult(data);
      toast({
        title: "이미지 생성 완료!",
        description: "영화급 이미지가 성공적으로 생성되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
    },
    onError: (error: any) => {
      toast({
        title: "생성 실패",
        description: error.message || "이미지 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setIsGenerating(false);
    }
  });

  const generateVideoMutation = useMutation({
    mutationFn: async (formData: FormData): Promise<GenerationResult> => {
      setIsGenerating(true);
      setGenerationProgress(0);

      // 진행률 시뮬레이션 (영상은 더 오래 걸림)
      const interval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return prev;
          }
          return prev + Math.random() * 5;
        });
      }, 800);

      try {
        const response = await fetch('/api/dream-studio/generate-video', {
          method: 'POST',
          body: formData
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      } finally {
        clearInterval(interval);
        setGenerationProgress(100);
        setIsGenerating(false);
      }
    },
    onSuccess: (data: GenerationResult) => {
      setResult(data);
      toast({
        title: "영상 생성 완료!",
        description: "립싱크 영상이 성공적으로 생성되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
    },
    onError: (error: any) => {
      toast({
        title: "생성 실패",
        description: error.message || "영상 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setIsGenerating(false);
    }
  });

  const handleImageGeneration = () => {
    if (!selectedGuideId || !userPhoto) {
      toast({
        title: "필수 정보 누락",
        description: "가이드와 사용자 사진을 모두 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (((credits as any)?.credits || 0) < 5) {
      toast({
        title: "크레딧 부족",
        description: "이미지 생성에는 5크레딧이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('guideId', selectedGuideId);
    formData.append('userPhoto', userPhoto);
    formData.append('mood', mood);
    formData.append('lighting', lighting);
    formData.append('angle', angle);

    generateImageMutation.mutate(formData);
  };

  const handleVideoGeneration = () => {
    if (!result?.imageUrl || (!audioFile && !customScript)) {
      toast({
        title: "필수 정보 누락",
        description: "기본 이미지와 음성 파일(또는 스크립트)가 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    if (((credits as any)?.credits || 0) < 10) {
      toast({
        title: "크레딧 부족",
        description: "영상 생성에는 10크레딧이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('baseImageUrl', result.imageUrl);
    if (audioFile) {
      formData.append('audioFile', audioFile);
    }
    if (customScript) {
      formData.append('script', customScript);
    }

    generateVideoMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-4">
      <div className="container mx-auto max-w-6xl pt-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 px-6 py-3 rounded-full shadow-sm border mb-4">
            <Coins className="h-5 w-5 text-yellow-500" />
            <span className="text-lg font-semibold">
              보유 크레딧: {(credits as any)?.credits || 0}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center justify-center gap-3">
            <Sparkles className="h-8 w-8 text-purple-600" />
            드림샷 스튜디오
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            AI로 영화급 이미지와 립싱크 영상을 생성하세요. 여행 가이드가 살아 움직이는 콘텐츠로 변신합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 생성 패널 */}
          <div className="space-y-6">
            <Tabs defaultValue="image" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="image" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  이미지 생성 (5크레딧)
                </TabsTrigger>
                <TabsTrigger value="video" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  영상 생성 (10크레딧)
                </TabsTrigger>
              </TabsList>

              <TabsContent value="image" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="h-5 w-5" />
                      드림샷 이미지 생성
                    </CardTitle>
                    <CardDescription>
                      기존 가이드와 사용자 사진을 합성하여 영화 같은 이미지를 만듭니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="guide-select">기본 가이드 선택</Label>
                      <Select value={selectedGuideId} onValueChange={setSelectedGuideId}>
                        <SelectTrigger data-testid="select-guide">
                          <SelectValue placeholder="가이드를 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {(guides as any)?.map?.((guide: any) => (
                            <SelectItem key={guide.id} value={guide.id}>
                              {guide.locationName || guide.description?.slice(0, 30)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="user-photo">사용자 사진 업로드</Label>
                      <Input
                        id="user-photo"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setUserPhoto(e.target.files?.[0] || null)}
                        data-testid="input-user-photo"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>분위기</Label>
                        <Select value={mood} onValueChange={setMood}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cinematic">영화적</SelectItem>
                            <SelectItem value="dramatic">드라마틱</SelectItem>
                            <SelectItem value="romantic">로맨틱</SelectItem>
                            <SelectItem value="adventure">모험</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>조명</Label>
                        <Select value={lighting} onValueChange={setLighting}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="golden-hour">황금시간</SelectItem>
                            <SelectItem value="natural">자연광</SelectItem>
                            <SelectItem value="dramatic">드라마틱</SelectItem>
                            <SelectItem value="soft">부드러운</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>앵글</Label>
                        <Select value={angle} onValueChange={setAngle}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="close-up">클로즈업</SelectItem>
                            <SelectItem value="medium-shot">미디엄샷</SelectItem>
                            <SelectItem value="wide-shot">와이드샷</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      onClick={handleImageGeneration}
                      disabled={isGenerating || !selectedGuideId || !userPhoto}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      data-testid="button-generate-image"
                    >
                      {isGenerating ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          생성 중... ({Math.round(generationProgress)}%)
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Wand2 className="h-4 w-4" />
                          드림샷 이미지 생성 (5크레딧)
                        </div>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="video" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      립싱크 영상 생성
                    </CardTitle>
                    <CardDescription>
                      생성된 이미지에 음성을 추가하여 말하는 영상을 만듭니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!result?.imageUrl && (
                      <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                        <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>먼저 드림샷 이미지를 생성해주세요</p>
                      </div>
                    )}

                    {result?.imageUrl && (
                      <>
                        <div>
                          <Label htmlFor="audio-file">음성 파일 업로드</Label>
                          <Input
                            id="audio-file"
                            type="file"
                            accept="audio/*"
                            onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                            data-testid="input-audio-file"
                          />
                        </div>

                        <div className="text-center text-gray-500">
                          <p>또는</p>
                        </div>

                        <div>
                          <Label htmlFor="custom-script">직접 스크립트 입력</Label>
                          <Textarea
                            id="custom-script"
                            placeholder="말하고 싶은 내용을 입력하세요..."
                            value={customScript}
                            onChange={(e) => setCustomScript(e.target.value)}
                            data-testid="textarea-script"
                          />
                        </div>

                        <Button
                          onClick={handleVideoGeneration}
                          disabled={isGenerating || (!audioFile && !customScript)}
                          className="w-full bg-pink-600 hover:bg-pink-700"
                          data-testid="button-generate-video"
                        >
                          {isGenerating ? (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              생성 중... ({Math.round(generationProgress)}%)
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Play className="h-4 w-4" />
                              립싱크 영상 생성 (10크레딧)
                            </div>
                          )}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {isGenerating && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>생성 진행률</span>
                      <span>{Math.round(generationProgress)}%</span>
                    </div>
                    <Progress value={generationProgress} className="h-2" />
                    <p className="text-xs text-gray-600 text-center">
                      AI가 열심히 작업 중입니다... 잠시만 기다려주세요
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 결과 패널 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  생성 결과
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!result ? (
                  <div className="text-center py-12 text-gray-500">
                    <Sparkles className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>AI 생성을 시작해보세요!</p>
                    <p className="text-sm mt-2">영화급 콘텐츠가 여기에 표시됩니다</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {result.imageUrl && (
                      <div className="space-y-2">
                        <Label>생성된 이미지</Label>
                        <div className="border rounded-lg overflow-hidden">
                          <img
                            src={result.imageUrl}
                            alt="Generated image"
                            className="w-full h-64 object-cover"
                            data-testid="img-generated"
                          />
                        </div>
                        {result.prompt && (
                          <div className="text-xs text-gray-600 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <strong>사용된 프롬프트:</strong> {result.prompt}
                          </div>
                        )}
                      </div>
                    )}

                    {result.videoUrl && (
                      <div className="space-y-2">
                        <Label>생성된 영상</Label>
                        <div className="border rounded-lg overflow-hidden">
                          <video
                            controls
                            className="w-full"
                            data-testid="video-generated"
                          >
                            <source src={result.videoUrl} type="video/mp4" />
                          </video>
                        </div>
                        <div className="flex gap-2 text-xs text-gray-600">
                          {result.duration && <Badge variant="outline">{result.duration}</Badge>}
                          {result.quality && <Badge variant="outline">{result.quality}</Badge>}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {result.imageUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          data-testid="button-download-image"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          이미지 다운로드
                        </Button>
                      )}
                      {result.videoUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          data-testid="button-download-video"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          영상 다운로드
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}