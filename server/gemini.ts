import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// 🎬 드림샷 스튜디오 전용 프롬프트 엔진
export interface DreamShotPrompt {
  imagePrompt: string;
  audioScript: string;
  mood: 'cinematic' | 'commercial' | 'documentary' | 'artistic';
  lighting: 'golden-hour' | 'natural' | 'studio' | 'dramatic';
  angle: 'close-up' | 'medium-shot' | 'wide-shot' | 'aerial';
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
  locationName?: string;
}

export interface GuideContent {
  title: string;
  description: string;
  tips: string[];
  culturalNotes?: string;
  bestTimeToVisit?: string;
  accessibility?: string;
}

export async function generateLocationBasedContent(
  imageBase64: string,
  locationInfo: LocationInfo,
  language: string = 'ko'
): Promise<GuideContent> {
  try {
    const languageMap: Record<string, string> = {
      ko: '한국어',
      en: 'English',
      ja: '日本語',
      zh: '中文'
    };

    const targetLanguage = languageMap[language] || languageMap.ko;

    const systemPrompt = `You are a professional travel guide content creator.
Analyze the provided image and location information to create detailed, accurate guide content.
Location: ${locationInfo.locationName || `${locationInfo.latitude}, ${locationInfo.longitude}`}
Respond in ${targetLanguage} with JSON format:
{
  "title": "string - catchy, descriptive title",
  "description": "string - detailed description of the place",
  "tips": ["string array - practical tips for visitors"],
  "culturalNotes": "string - cultural significance or background",
  "bestTimeToVisit": "string - optimal visiting times",
  "accessibility": "string - accessibility information"
}`;

    const contents = [
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/jpeg",
        },
      },
      `Create a comprehensive travel guide for this location.
Location coordinates: ${locationInfo.latitude}, ${locationInfo.longitude}
${locationInfo.locationName ? `Location name: ${locationInfo.locationName}` : ''}

Please provide accurate, helpful information that would be valuable for travelers visiting this place.`,
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            tips: {
              type: "array",
              items: { type: "string" }
            },
            culturalNotes: { type: "string" },
            bestTimeToVisit: { type: "string" },
            accessibility: { type: "string" }
          },
          required: ["title", "description", "tips"]
        }
      },
      contents: contents,
    });

    const rawJson = response.text;

    if (rawJson) {
      const data: GuideContent = JSON.parse(rawJson);
      return data;
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(`Failed to generate content: ${error}`);
  }
}

export async function getLocationName(latitude: number, longitude: number): Promise<string> {
  try {
    // Use Google Geocoding API to get location name
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}&language=ko`
    );

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      return result.formatted_address || `${latitude}, ${longitude}`;
    }

    return `${latitude}, ${longitude}`;
  } catch (error) {
    console.error("Geocoding error:", error);
    return `${latitude}, ${longitude}`;
  }
}

export async function generateShareLinkDescription(
  guides: any[],
  linkName: string,
  language: string = 'ko'
): Promise<string> {
  try {
    const languageMap: Record<string, string> = {
      ko: '한국어',
      en: 'English',
      ja: '日本語',
      zh: '中文'
    };

    const targetLanguage = languageMap[language] || languageMap.ko;

    const guideDescriptions = guides.map(guide =>
      `${guide.title}: ${guide.description} (위치: ${guide.locationName || `${guide.latitude}, ${guide.longitude}`})`
    ).join('\n');

    const prompt = `Create an engaging description for a shared travel guide collection in ${targetLanguage}.
Collection name: ${linkName}
Included locations:
${guideDescriptions}

Create a compelling description that would entice people to explore these locations.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "공유된 가이드 모음입니다.";
  } catch (error) {
    console.error("Share link description generation error:", error);
    return "공유된 가이드 모음입니다.";
  }
}

// 🎬 드림샷 스튜디오: 영화급 이미지 생성 프롬프트
export async function generateCinematicPrompt(
  originalGuide: any,
  userPreferences: {
    mood?: 'adventure' | 'romantic' | 'peaceful' | 'dramatic';
    style?: 'movie' | 'commercial' | 'travel-blog' | 'instagram';
    timeOfDay?: 'sunrise' | 'noon' | 'sunset' | 'night';
  } = {}
): Promise<DreamShotPrompt> {
  const prompt = `
당신은 세계적인 여행 사진작가이자 영화감독입니다.

원본 여행 정보:
- 장소: ${originalGuide.locationName || originalGuide.title}
- 설명: ${originalGuide.description}
- 위도/경도: ${originalGuide.latitude}, ${originalGuide.longitude}

다음 조건으로 영화급 이미지를 위한 상세한 프롬프트를 생성해주세요:
- 분위기: ${userPreferences.mood || 'adventure'}
- 스타일: ${userPreferences.style || 'movie'}
- 시간대: ${userPreferences.timeOfDay || 'golden-hour'}

출력 형식 (JSON):
{
  "imagePrompt": "상세한 이미지 생성 프롬프트 (영문, 200자 이상)",
  "audioScript": "감정적이고 매력적인 한국어 내레이션 스크립트 (50-100자)",
  "mood": "cinematic/commercial/documentary/artistic 중 하나",
  "lighting": "golden-hour/natural/studio/dramatic 중 하나",
  "angle": "close-up/medium-shot/wide-shot/aerial 중 하나"
}

핵심 요구사항:
1. 사용자가 주인공이 되어 그 장소에 있는 것처럼 자연스럽게
2. 영화나 광고 같은 프로페셔널한 구도와 조명
3. 해당 여행지의 특색과 문화가 드러나게
4. 감정적으로 몰입할 수 있는 스토리텔링
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            imagePrompt: { type: "string" },
            audioScript: { type: "string" },
            mood: { type: "string", enum: ["cinematic", "commercial", "documentary", "artistic"] },
            lighting: { type: "string", enum: ["golden-hour", "natural", "studio", "dramatic"] },
            angle: { type: "string", enum: ["close-up", "medium-shot", "wide-shot", "aerial"] }
          },
          required: ["imagePrompt", "audioScript", "mood", "lighting", "angle"]
        }
      },
      contents: prompt
    });

    try {
      const result = JSON.parse(response.text || '{}');
      // 필수 필드 검증
      if (!result.imagePrompt || !result.audioScript || !result.mood) {
        throw new Error('Invalid JSON response structure');
      }
      return result as DreamShotPrompt;
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      throw parseError; // 기본 프롬프트로 fallback
    }
  } catch (error) {
    console.error('프롬프트 생성 실패:', error);
    // 기본 프롬프트 반환
    return {
      imagePrompt: `Cinematic travel photography of a person at ${originalGuide.locationName || originalGuide.title}, golden hour lighting, professional composition, travel magazine style, high quality, realistic`,
      audioScript: `${originalGuide.locationName || originalGuide.title}에서의 특별한 순간, 여행의 감동을 느껴보세요.`,
      mood: 'cinematic',
      lighting: 'golden-hour',
      angle: 'medium-shot'
    };
  }
}

// 🎤 음성 스크립트 최적화 (감정 표현 강화)
export async function optimizeAudioScript(
  originalScript: string,
  targetEmotion: 'excited' | 'peaceful' | 'inspiring' | 'nostalgic' = 'inspiring'
): Promise<string> {
  const prompt = `
당신은 전문 성우이자 여행 콘텐츠 전문가입니다.

원본 스크립트: "${originalScript}"
목표 감정: ${targetEmotion}

다음 조건으로 음성 녹음에 최적화된 스크립트로 개선해주세요:
1. 자연스러운 한국어 발음과 리듬감
2. ${targetEmotion} 감정이 잘 드러나는 톤
3. 15-30초 분량 (80-120자)
4. 여행의 감동과 스토리가 담긴 내용
5. 사용자가 직접 말하기 쉬운 문장 구조

개선된 스크립트만 출력해주세요:
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    return response.text?.trim() || originalScript;
  } catch (error) {
    console.error('스크립트 최적화 실패:', error);
    return originalScript;
  }
}
