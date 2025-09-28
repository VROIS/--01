const { GoogleGenAI } = require("@google/generative-ai");

// Netlify Function의 표준 핸들러. 모든 /api/* 요청을 처리합니다.
exports.handler = async (event) => {
  // 요청 경로를 분석하여 어떤 API를 호출할지 결정합니다.
  // 예: /api/gemini -> /gemini
  const path = event.path.replace("/.netlify/functions/api", "").replace("/api", "");

  // Gemini API 라우팅
  if (path === "/gemini" && event.httpMethod === "POST") {
    return handleGeminiRequest(event);
  }

  // 여기에 다른 API 엔드포인트를 추가할 수 있습니다.
  // if (path === "/some-other-route" && event.httpMethod === "GET") { ... }

  // 일치하는 API가 없을 경우 404 에러를 반환합니다.
  return {
    statusCode: 404,
    body: JSON.stringify({ error: `Route ${path} not found` }),
  };
};

// Gemini API 요청을 처리하는 비동기 함수
async function handleGeminiRequest(event) {
  // API 키는 Netlify 환경 변수에서 안전하게 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GEMINI_API_KEY is not set in environment variables." }),
    };
  }

  const ai = new GoogleGenAI(apiKey);

  try {
    // 요청 본문(body)에서 필요한 데이터를 파싱합니다.
    const { base64Image, prompt, systemInstruction } = JSON.parse(event.body || '{}');

    if (!prompt && !base64Image) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Request must include either 'prompt' or 'base64Image'." }),
      };
    }

    const parts = [];
    if (base64Image) {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Image } });
    }
    if (prompt) {
      parts.push({ text: prompt });
    }

    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Gemini API에 요청을 보냅니다.
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      systemInstruction: { parts: [{ text: systemInstruction || 'Be a helpful assistant.' }] },
    });

    const response = result.response;
    const text = response.text();

    // 성공적으로 텍스트를 받으면 200 OK와 함께 결과를 반환합니다.
    return {
      statusCode: 200,
      body: JSON.stringify({ text }),
      headers: { "Content-Type": "application/json" },
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    // API 통신 중 에러가 발생하면 500 에러를 반환합니다.
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Error communicating with Gemini API: ${error.message}` }),
    };
  }
}