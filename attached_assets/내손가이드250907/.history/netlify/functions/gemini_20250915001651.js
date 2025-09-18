// v2.3 최종 수정: 최신 @google/genai SDK(v0.14+) 방식으로 업그레이드하고, 스트리밍 응답을 적용합니다.
const { GoogleGenAI } = require("@google/genai");


// Netlify Functions 환경에서는 스트리밍 대신 전체 응답을 한 번에 반환



exports.handler = async (event) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY 환경 변수가 설정되지 않았습니다!");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "서버에 API 키가 설정되지 않았습니다. 관리자에게 문의해주세요." }),
    };
  }

  try {
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (parseError) {
      console.error("JSON 파싱 오류:", parseError.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `잘못된 요청 형식입니다: ${parseError.message}` }),
      };
    }
    
    const { base64Image, prompt, systemInstruction } = requestData;

    const isPromptEmpty = !prompt || prompt.trim() === '';
    const isImageEmpty = !base64Image;

    if (isPromptEmpty && isImageEmpty) {
      console.error("필수 데이터 누락: prompt 또는 base64Image가 없습니다.");
      return { statusCode: 400, body: JSON.stringify({ error: "요청 본문에 필수 데이터(prompt 또는 base64Image)가 누락되었습니다." }) };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    let parts = [];

    if (base64Image) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image,
        },
      });
    }

    if (prompt && prompt.trim() !== '') {
      parts.push({ text: prompt });
    }

    const model = 'gemini-2.5-flash';
    const contents = { parts };

    // [업그레이드] config 객체에 systemInstruction과 thinkingConfig를 모두 포함
    const config = {
      systemInstruction,
      thinkingConfig: { thinkingBudget: 0 } // ✨ 속도 최적화 옵션 적용
    };

    console.log("Gemini API(스트리밍)로 전송할 요청 본문:", JSON.stringify({ model, contents, config }));


    // 스트리밍 대신 전체 응답을 한 번에 받아서 반환
    const result = await ai.models.generateContent({ model, contents, config });
    let text = '';
    if (result && result.candidates && result.candidates.length > 0) {
      text = result.candidates[0].content.parts.map(p => p.text).join('');
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: text,
    };

  } catch (error) {
    console.error("Netlify 함수 오류:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `AI 통신 중 오류: ${error.message}` }),
    };
  }
};
