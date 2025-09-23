const fs = require('fs');
const path = require('path');

// HTML 템플릿 함수 복사 (간단한 테스트용)
function generateShareHtml(data) {
  const { title, items, createdAt, location, includeAudio } = data;
  
  // 최대 20개 아이템으로 제한 (2*10 그리드)
  const limitedItems = items.slice(0, 20);
  
  // 갤러리 아이템 생성
  const galleryItemsHtml = limitedItems.map((item, index) => `
    <div class="gallery-item" data-id="${item.id}">
      <img src="data:image/jpeg;base64,${item.imageBase64}" alt="${item.title}">
      <p>${item.title}</p>
    </div>
  `).join('');

  // 데이터 스토리지 생성
  const dataStorageHtml = limitedItems.map(item => `
    <div data-id="${item.id}">${item.description}</div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 내손가이드</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background-color: #f0f2f5; padding-bottom: 100px; }
    .header { padding: 20px; background-color: #343a40; color: #fff; text-align: center; position: sticky; top: 0; z-index: 10; }
    .header h1 { margin: 0; font-size: 28px; }
    .meta-info { margin-top: 10px; font-size: 14px; opacity: 0.8; }
    #gallery-view { padding: 15px; max-height: calc(100vh - 200px); overflow-y: auto; }
    .gallery-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; max-width: 500px; margin: 0 auto; }
    .gallery-item { cursor: pointer; text-align: center; transition: transform 0.2s; }
    .gallery-item:hover { transform: scale(1.02); }
    .gallery-item img { width: 100%; height: 150px; object-fit: cover; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,.1); background-color: #e9e9e9; }
    .gallery-item p { margin: 8px 0 0; font-weight: 700; color: #333; font-size: 14px; line-height: 1.3; }
    .fixed-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; height: 80px; background-color: #fff; border-top: 1px solid #ddd; display: flex; align-items: center; justify-content: space-around; box-shadow: 0 -2px 10px rgba(0,0,0,.1); z-index: 50; }
    .nav-button { display: flex; flex-direction: column; align-items: center; padding: 8px 16px; background: none; border: none; cursor: pointer; font-size: 14px; color: #666; transition: color 0.2s; }
    .nav-button:hover { color: #007bff; }
    .nav-icon { font-size: 24px; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="meta-info">
      ${location ? `📍 ${location} • ` : ''}📅 ${new Date(createdAt).toLocaleDateString('ko-KR')}
    </div>
  </div>
  <div id="gallery-view">
    <div class="gallery-grid">
      ${galleryItemsHtml}
    </div>
  </div>
  <div class="fixed-bottom-nav">
    <button class="nav-button" onclick="alert('앱으로 가기')">
      <div class="nav-icon">🏠</div>
      <div>앱으로 가기</div>
    </button>
    <button class="nav-button" onclick="alert('공유하기')">
      <div class="nav-icon">📤</div>
      <div>공유하기</div>
    </button>
    <button class="nav-button" onclick="alert('정보')">
      <div class="nav-icon">ℹ️</div>
      <div>정보</div>
    </button>
  </div>
</body>
</html>`;
}

// 테스트 데이터
const testData = {
  title: "테스트 HTML 공유 페이지",
  items: [
    {
      id: "1",
      title: "서울 남산타워",
      description: "아름다운 서울 전경을 볼 수 있는 남산타워입니다. 서울의 대표적인 관광지로 많은 사람들이 찾는 곳입니다.",
      imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    },
    {
      id: "2", 
      title: "홍대 먹거리",
      description: "홍대 거리의 다양한 먹거리를 체험할 수 있는 곳입니다. 젊은이들의 문화가 살아 숨쉬는 공간입니다.",
      imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    }
  ],
  createdAt: new Date().toISOString(),
  location: "서울시",
  includeAudio: true
};

// HTML 생성 및 저장
const htmlContent = generateShareHtml(testData);
const fileName = 'test-share-page.html';
const filePath = path.join(__dirname, 'public', fileName);

// public 폴더가 없으면 생성
if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

fs.writeFileSync(filePath, htmlContent, 'utf8');

console.log(`✅ 테스트 HTML 파일이 생성되었습니다: ${filePath}`);
console.log(`🌐 브라우저에서 확인: http://localhost:5000/${fileName}`);
console.log(`📊 포함된 아이템: ${testData.items.length}개`);
console.log(`📱 2*10 그리드 레이아웃 적용`);
console.log(`📍 하단 고정 네비게이션 포함`);