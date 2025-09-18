    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: `<h1>서버 오류</h1><p>서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.</p><pre>${error.message}</pre>`
    };
  }
};
        <h1>${title}</h1>
        <p>${description}</p>
    </header>
    <main id="guidebook-content">
        <!-- 콘텐츠는 클라이언트에서 렌더링됨 -->
    </main>
    <script>
        window.guidebookData = ${JSON.stringify(guidebookData)};
    </script>
</body>
</html>`;
}

exports.handler = async function(event) {
  const store = getStore("guidebooks");
  try {
    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body);
      } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "잘못된 요청 형식입니다." }) };
      }
      const { contents, name } = body;
      if (!Array.isArray(contents) || contents.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "공유할 항목이 없습니다." }) };
      }
      if (contents.length > 30) {
        return { statusCode: 400, body: JSON.stringify({ error: "한 번에 최대 30개까지만 공유할 수 있습니다." }) };
      }
      const guidebookId = crypto.randomBytes(4).toString('base64url').slice(0, 6);
      await store.setJSON(guidebookId, { contents, name, createdAt: new Date().toISOString() });
      return {
        statusCode: 200,
        body: JSON.stringify({ guidebookId }),
      };
    }
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
      body: `<h1>서버 오류</h1><p>서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.</p><pre>${error.message}</pre>`
    };
  }
};
} catch (error) {
  console.error("Unhandled error in share function:", error);
  return {
    statusCode: 500,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: `<h1>서버 오류</h1><p>서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.</p><pre>${error.message}</pre>`
  };
}
} catch (error) {
  console.error("Unhandled error in share function:", error);
  return {
    statusCode: 500,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: `<h1>서버 오류</h1><p>서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.</p><pre>${error.message}</pre>`
  };
}

