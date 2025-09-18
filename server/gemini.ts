import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
