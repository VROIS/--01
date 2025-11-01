const fs = require('fs');
const path = require('path');

const serviceWorkerCode = `
        // Service Worker 등록 (오프라인 지원)
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        console.log('✅ Service Worker 등록 성공:', registration.scope);
                    })
                    .catch(error => {
                        console.error('❌ Service Worker 등록 실패:', error);
                    });
            });
        }`;

function addServiceWorkerToHtml(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('serviceWorker')) {
      console.log(`⏭️  건너뜀: ${filePath} (이미 Service Worker 있음)`);
      return false;
    }
    
    // </script> 태그 바로 전에 Service Worker 등록 코드 추가
    const scriptCloseRegex = /(\s*)<\/script>/;
    if (!scriptCloseRegex.test(content)) {
      console.log(`❌ 실패: ${filePath} (<script> 태그 없음)`);
      return false;
    }
    
    content = content.replace(scriptCloseRegex, `${serviceWorkerCode}\n$1</script>`);
    
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
      const result = addServiceWorkerToHtml(filePath);
      if (result === true) updated++;
      else if (result === false && fs.readFileSync(filePath, 'utf8').includes('serviceWorker')) skipped++;
      else failed++;
    }
  });
  
  console.log(`\n📊 결과: ${updated}개 업데이트, ${skipped}개 건너뜀, ${failed}개 실패`);
}

const sharedDir = path.join(process.cwd(), 'public', 'shared');
console.log(`🔍 Service Worker 등록 코드 추가 중: ${sharedDir}\n`);
processDirectory(sharedDir);

console.log('\n🎉 모든 HTML 파일에 Service Worker 등록 완료!');
