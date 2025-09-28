// React/ESM 없이 순수 Node.js의 require 구문을 사용합니다.
const { GoogleGenAI } = require("@google/generative-ai");

/**
 * Netlify Functions의 표준 핸들러 함수.
 * 이 함수는 '/.netlify/functions/api' 경로로 들어오는 모든 요청을 처리합니다.
 */
exports.handler = async function(event, context) {
  // API 키를 Netlify 환경 변수에서 안전하게 불러옵니다.
  // 이 키는 Netlify 대시보드에서 설정해야 합니다.
  const apiKey = process.env.GEMINI_API_KEY;

  // API 키가 설정되지 않았을 경우, 즉시 오류를 반환하여 문제를 명확히 합니다.
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "서버에 Gemini API 키가 설정되지 않았습니다." }),
    };
  }

  // Gemini 클라이언트를 초기화합니다.
  const genAI = new GoogleGenAI(apiKey);

  try {
    // 클라이언트로부터 받은 요청 본문(body)을 JSON 객체로 파싱합니다.
    const body = JSON.parse(event.body || '{}');
    const { prompt, base64Image, systemInstruction } = body;

    // 프롬프트나 이미지가 없는 경우, 잘못된 요청으로 처리합니다.
    if (!prompt && !base64Image) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "요청에 'prompt' 또는 'base64Image'가 포함되어야 합니다." })
      };
    }

    // Gemini API가 요구하는 형식으로 요청 데이터를 구성합니다.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const parts = [];
    if (base64Image) {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Image } });
    }
    if (prompt) {
      parts.push({ text: prompt });
    }

    // API에 콘텐츠 생성을 요청합니다.
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      systemInstruction: { parts: [{ text: systemInstruction || '당신은 유용한 여행 가이드입니다.' }] },
    });

    const response = result.response;
    const text = response.text();

    // 성공적으로 응답을 받으면, 200 OK 상태와 함께 결과를 클라이언트에 반환합니다.
    return {
      statusCode: 200,
      body: JSON.stringify({ text: text }),
      headers: { "Content-Type": "application/json" },
    };

  } catch (error) {
    // API 통신 중 또는 다른 에러 발생 시, 500 서버 에러와 함께 상세 오류를 반환합니다.
    console.error("API Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AI와 통신하는 중 오류가 발생했습니다: " + error.message }),
    };
  }
};