import { storage } from '../server/storage';

async function regenerateAllFeatured() {
  console.log('🔄 모든 Featured 페이지 HTML 재생성 시작...');
  
  try {
    const featuredPages = await storage.getFeaturedHtmlPages();
    console.log(`📋 Featured 페이지 ${featuredPages.length}개 발견`);
    
    for (const page of featuredPages) {
      console.log(`\n처리 중: ${page.id} - ${page.name}`);
      
      try {
        await storage.regenerateFeaturedHtml(page.id, {
          title: page.name,
          sender: page.sender || '여행자',
          location: page.location || '알 수 없음',
          date: page.date || new Date().toISOString().split('T')[0]
        });
        console.log(`✅ 완료: ${page.id}`);
      } catch (err) {
        console.error(`❌ 실패: ${page.id}`, err);
      }
    }
    
    console.log('\n🎉 모든 Featured HTML 재생성 완료!');
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

regenerateAllFeatured();
