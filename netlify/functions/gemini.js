// Netlify Functions는 Node.js 환경에서 실행되므로, require를 사용하여 모듈을 가져옵니다.
const { GoogleGenAI } = require("@google/generative-ai");

// Netlify가 호출하는 기본 핸들러 함수입니다.
exports.handler = async function(event, context) {
  // Netlify에 설정된 환경 변수에서 API 키를 안전하게 불러옵니다.
  // 이 키는 클라이언트(사용자)에게 노출되지 않습니다.
  const apiKey = process.env.GEMINI_API_KEY;

  // API 키가 서버에 설정되지 않았다면, 오류를 반환합니다.
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API 키가 서버에 설정되지 않았습니다." }),
    };
  }

  // Gemini AI 클라이언트를 초기화합니다.
  const genAI = new GoogleGenAI(apiKey);

  try {
    // 클라이언트로부터 받은 요청 본문을 JSON으로 파싱합니다.
    const { prompt, base64Image, systemInstruction } = JSON.parse(event.body || '{}');

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

    // 스트리밍 응답을 위해 generateContentStream을 사용합니다.
    const result = await model.generateContentStream({
      contents: [{ role: "user", parts }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
    });

    // Netlify Functions는 스트림을 직접 반환하는 것을 지원하므로,
    // 응답을 그대로 스트리밍하여 클라이언트로 전달합니다.
    // (이 부분은 Netlify의 고급 기능으로, 여기서는 간단하게 전체 텍스트를 받아옵니다.)

    let fullText = "";
    for await (const chunk of result.stream) {
      fullText += chunk.text();
    }

    // 성공적으로 응답을 받으면, 200 OK 상태와 함께 전체 텍스트를 반환합니다.
    return {
      statusCode: 200,
      body: JSON.stringify({ text: fullText }),
      headers: { "Content-Type": "application/json" },
    };

  } catch (error) {
    console.error("API Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AI와 통신 중 오류가 발생했습니다: " + error.message }),
    };
  }
};