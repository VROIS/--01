// Netlify Functions는 CommonJS 모듈 시스템을 사용하므로 require를 사용합니다.
const { GoogleGenAI } = require("@google/generative-ai");

// Netlify Function의 표준 핸들러
// 이 함수는 Netlify에 의해 트리거되며, 모든 /api/* 요청을 처리합니다.
exports.handler = async (event) => {
  // Netlify는 모든 함수를 /.netlify/functions/ 경로 아래에서 실행합니다.
  // 실제 요청 경로를 얻기 위해 접두사를 제거합니다.
  const path = event.path.replace("/.netlify/functions/api", "");

  // Gemini API를 위한 라우팅 로직
  // 요청 경로가 '/gemini'이고 HTTP 메소드가 POST일 때만 처리합니다.
  if (path === "/gemini" && event.httpMethod === "POST") {
    return handleGeminiRequest(event);
  }

  // 일치하는 API 경로가 없을 경우 404 Not Found 응답을 반환합니다.
  return {
    statusCode: 404,
    body: JSON.stringify({ error: `The endpoint ${path} does not exist.` }),
    headers: { "Content-Type": "application/json" },
  };
};

// Gemini API 요청을 비동기적으로 처리하는 함수
async function handleGeminiRequest(event) {
  // API 키는 Netlify 대시보드에 설정된 환경 변수에서 안전하게 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GEMINI_API_KEY is not set in the server environment." }),
      headers: { "Content-Type": "application/json" },
    };
  }

  const ai = new GoogleGenAI(apiKey);

  try {
    // 클라이언트로부터 받은 요청 본문(body)을 JSON으로 파싱합니다.
    const { base64Image, prompt, systemInstruction } = JSON.parse(event.body || '{}');

    // 필수 데이터(이미지 또는 프롬프트)가 있는지 확인합니다.
    if (!prompt && !base64Image) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Request body must include 'prompt' or 'base64Image'." }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // Gemini API가 요구하는 형식으로 요청 데이터를 구성합니다.
    const parts = [];
    if (base64Image) {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Image } });
    }
    if (prompt) {
      parts.push({ text: prompt });
    }

    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Gemini API에 콘텐츠 생성을 요청합니다.
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      systemInstruction: { parts: [{ text: systemInstruction || 'You are a helpful travel guide.' }] },
    });

    const response = result.response;
    const text = response.text();

    // 성공적으로 응답을 받으면, 200 OK 상태와 함께 결과를 클라이언트에 반환합니다.
    return {
      statusCode: 200,
      body: JSON.stringify({ text }),
      headers: { "Content-Type": "application/json" },
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    // API 통신 중 에러가 발생하면, 500 서버 에러와 함께 상세 오류 메시지를 반환합니다.
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `An error occurred while communicating with the Gemini API: ${error.message}` }),
      headers: { "Content-Type": "application/json" },
    };
  }
}