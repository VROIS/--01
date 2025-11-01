const fs = require('fs');
const path = require('path');

const closeButtonHtml = `
    <!-- ✕ 닫기 버튼 (모든 공유 페이지에 표시) -->
    <button id="closeWindowBtn" onclick="window.close()" title="페이지 닫기" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000; width: 3rem; height: 3rem; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); border-radius: 50%; color: #4285F4; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); border: none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    </button>
`;

function forceAddCloseButton(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 이미 closeWindowBtn이 있으면 건너뛰기
    if (content.includes('id="closeWindowBtn"')) {
      console.log(`⏭️  이미 있음: ${path.basename(filePath)}`);
      return false;
    }
    
    // <body> 태그 찾기
    const bodyRegex = /(<body[^>]*>)/;
    if (bodyRegex.test(content)) {
      content = content.replace(bodyRegex, `$1\n${closeButtonHtml}`);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ 추가 완료: ${path.basename(filePath)}`);
      return true;
    }
    
    console.log(`❌ <body> 태그 없음: ${path.basename(filePath)}`);
    return false;
  } catch (error) {
    console.error(`❌ 에러: ${path.basename(filePath)}`, error.message);
    return false;
  }
}

const sharedDir = path.join(process.cwd(), 'public', 'shared');
console.log(`🔍 강제 업데이트 시작: ${sharedDir}\n`);

if (!fs.existsSync(sharedDir)) {
  console.log(`❌ 디렉토리 없음: ${sharedDir}`);
  process.exit(1);
}

const files = fs.readdirSync(sharedDir).filter(f => f.endsWith('.html'));
let updated = 0;
let skipped = 0;
let failed = 0;

files.forEach(file => {
  const filePath = path.join(sharedDir, file);
  const result = forceAddCloseButton(filePath);
  if (result === true) updated++;
  else if (result === false && fs.readFileSync(filePath, 'utf8').includes('closeWindowBtn')) skipped++;
  else failed++;
});

console.log(`\n📊 최종 결과:`);
console.log(`   ✅ 추가 완료: ${updated}개`);
console.log(`   ⏭️  이미 있음: ${skipped}개`);
console.log(`   ❌ 실패: ${failed}개`);
console.log(`\n🎉 작업 완료!`);
