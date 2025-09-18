
// netlify/functions/share.js

const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

// HTML 페이지를 생성하는 헬퍼 함수
function generateHtml(guidebookData, guidebookId) {
    const { contents, createdAt } = guidebookData;
    
    // OG 태그에 사용할 데이터 추출
    const title = "손안에 가이드북";
    const description = contents[0]?.description.substring(0, 100) || "친구가 공유한 가이드북을 확인해보세요!";
    // 중요: 이 이미지는 모든 공유에 동일하게 사용됩니다. 나중에 앱 로고 등으로 교체하는 것을 권장합니다.
    const imageUrl = "https://images.unsplash.com/photo-1516822432462-b55a21394911?q=80&w=2070&auto=format&fit=crop";
    const pageUrl = `https://main--my-handyguide01.netlify.app/.netlify/functions/share?id=${guidebookId}`;

    // 클라이언트 사이드에서 사용할 데이터를 window 객체에 주입
    const embeddedDataScript = "\n        <script>\n            window.guidebookData = " + JSON.stringify(guidebookData) + ";\n        </script>\n    ";

    // 클라이언트 사이드 렌더링을 처리하는 스크립트
    const clientScript = "\n        <script>\n            document.addEventListener('DOMContentLoaded', () => {\n                const contentContainer = document.getElementById('guidebook-content');
                const loader = document.getElementById('loader');
                const descriptionEl = document.getElementById('guidebook-description');

              // 클라이언트 사이드에서 사용할 데이터를 window 객체에 주입
              const embeddedDataScript = `

    // --- 가이드북 생성 (POST 요청) ---
    if (event.httpMethod === "POST") {
      let body;

              // 클라이언트 사이드 렌더링을 처리하는 스크립트
              const clientScript = `
      try {
        body = JSON.parse(event.body);
      } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "잘못된 요청 형식입니다." }) };
      }

      const { contents } = body;
      if (!Array.isArray(contents) || contents.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "공유할 항목이 없습니다." }) };
      }
      if (contents.length > 30) {
        return { statusCode: 400, body: JSON.stringify({ error: "한 번에 최대 30개까지만 공유할 수 있습니다." }) };
      }

      const guidebookId = crypto.randomBytes(4).toString('base64url').slice(0, 6);
      
      await store.setJSON(guidebookId, { contents, createdAt: new Date().toISOString() });
      
      return {
        statusCode: 200,
        body: JSON.stringify({ guidebookId }),
      };
    }
    
    // --- 가이드북 조회 및 HTML 생성 (GET 요청) ---
    if (event.httpMethod === "GET") {
      const guidebookId = event.queryStringParameters.id;

      if (!guidebookId) {
        return { statusCode: 400, headers: { "Content-Type": "text/html; charset=utf-8" }, body: "<h1>오류</h1><p>가이드북 ID가 필요합니다.</p>" };
      }

      const guidebookData = await store.get(guidebookId, { type: "json" });

      if (!guidebookData) {
        return { statusCode: 404, headers: { "Content-Type": "text/html; charset=utf-8" }, body: "<h1>404 - 찾을 수 없음</h1><p>해당 가이드북을 찾을 수 없습니다.</p>" };
      }
      
      const html = generateHtml(guidebookData, guidebookId);

              return `
      
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: html,
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };

  } catch (error) {
    console.error("Unhandled error in share function:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `<h1>서버 오류</h1><p>서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.</p><pre>${error.message}</pre>`,
    };
  }
};

