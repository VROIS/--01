const fs = require('fs');
const path = require('path');

// Featured 페이지 ID 목록 (실제 DB에서 가져와야 함)
const featuredPages = [
  'mICyY4Wh', // 세느3
  // 다른 Featured 페이지 ID들...
];

const closeButtonHtml = `
    <!-- ✕ 닫기 버튼 (모든 공유 페이지에 표시) -->
    <button id="closeWindowBtn" onclick="window.close()" title="페이지 닫기" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000; width: 3rem; height: 3rem; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); border-radius: 50%; color: #4285F4; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); border: none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    </button>
`;

const sharedDir = path.join(process.cwd(), 'public', 'shared');
let updated = 0;

console.log('🔧 Featured 페이지 X 버튼 추가 시작...\n');

featuredPages.forEach(pageId => {
  const filePath = path.join(sharedDir, `${pageId}.html`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  파일 없음: ${pageId}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('id="closeWindowBtn"')) {
    console.log(`⏭️  이미 있음: ${pageId}`);
    return;
  }
  
  content = content.replace(/(<body[^>]*>)/, `$1\n${closeButtonHtml}`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ 추가 완료: ${pageId}`);
  updated++;
});

console.log(`\n📊 ${updated}개 Featured 페이지 업데이트 완료!`);
