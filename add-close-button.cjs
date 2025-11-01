const fs = require('fs');
const path = require('path');

const closeButtonHtml = `
    <!-- 닫기 버튼 (모든 공유 페이지에 표시) -->
    <button id="closeWindowBtn" onclick="window.close()" title="페이지 닫기" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000; width: 3rem; height: 3rem; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); border-radius: 50%; color: #4285F4; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); border: none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    </button>
`;

function addCloseButtonToHtml(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('id="closeWindowBtn"')) {
      console.log(`⏭️  건너뜀: ${filePath} (이미 X 버튼 있음)`);
      return false;
    }
    
    const bodyRegex = /(<body[^>]*>)/;
    if (!bodyRegex.test(content)) {
      console.log(`❌ 실패: ${filePath} (<body> 태그 없음)`);
      return false;
    }
    
    content = content.replace(bodyRegex, `$1\n${closeButtonHtml}`);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 업데이트: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ 에러: ${filePath}`, error.message);
    return false;
  }
}

function processDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`❌ 디렉토리가 존재하지 않습니다: ${dirPath}`);
    return;
  }
  
  const files = fs.readdirSync(dirPath);
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  
  files.forEach(file => {
    if (file.endsWith('.html')) {
      const filePath = path.join(dirPath, file);
      const result = addCloseButtonToHtml(filePath);
      if (result === true) updated++;
      else if (result === false && fs.readFileSync(filePath, 'utf8').includes('closeWindowBtn')) skipped++;
      else failed++;
    }
  });
  
  console.log(`\n📊 결과: ${updated}개 업데이트, ${skipped}개 건너뜀, ${failed}개 실패`);
}

const sharedDir = path.join(process.cwd(), 'public', 'shared');
console.log(`🔍 처리 중: ${sharedDir}\n`);
processDirectory(sharedDir);

const publicDir = path.join(process.cwd(), 'public');
const publicFiles = fs.readdirSync(publicDir).filter(f => f.startsWith('share-') && f.endsWith('.html'));
if (publicFiles.length > 0) {
  console.log(`\n🔍 처리 중: ${publicDir} (share-*.html)\n`);
  let updated = 0;
  let skipped = 0;
  publicFiles.forEach(file => {
    const filePath = path.join(publicDir, file);
    const result = addCloseButtonToHtml(filePath);
    if (result === true) updated++;
    else if (result === false) skipped++;
  });
  console.log(`\n📊 결과: ${updated}개 업데이트, ${skipped}개 건너뜀`);
}

console.log('\n🎉 모든 HTML 파일 처리 완료!');
