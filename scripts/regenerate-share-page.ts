/**
 * 공유페이지 HTML 재생성 스크립트
 * 
 * 목적: 기존 공유페이지의 HTML을 최신 템플릿으로 재생성
 * 작성일: 2025-11-08
 * 
 * 작동 방식:
 * 1. DB에서 공유페이지 정보 조회 (userId, guideIds)
 * 2. 실제 사용자 정보 조회 (firstName, lastName)
 * 3. 가이드 정보 조회 (locationName, aiContent, 이미지)
 * 4. 새 HTML 생성 (수정된 템플릿 사용)
 * 5. DB 업데이트 (htmlContent 덮어쓰기)
 */

import { db } from "../server/db";
import { users, guides, sharedHtmlPages } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { generateShareHtml } from "../server/html-template";
import fs from "fs";
import path from "path";

async function regenerateSharePage(pageId: string) {
  console.log(`\n🔄 공유페이지 재생성 시작: ${pageId}`);
  
  // 1. 공유페이지 정보 조회
  const [page] = await db
    .select()
    .from(sharedHtmlPages)
    .where(eq(sharedHtmlPages.id, pageId));
  
  if (!page) {
    console.error(`❌ 페이지를 찾을 수 없습니다: ${pageId}`);
    return false;
  }
  
  console.log(`📄 페이지 이름: ${page.name}`);
  console.log(`👤 사용자 ID: ${page.userId}`);
  console.log(`📦 가이드 개수: ${page.guideIds?.length || 0}`);
  
  // 2. 사용자 정보 조회
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, page.userId));
  
  const senderName = user?.firstName 
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`.trim()
    : user?.email?.split('@')[0] || '여행자';
  
  console.log(`✅ 작성자: ${senderName}`);
  
  // 3. 가이드 정보 조회
  if (!page.guideIds || page.guideIds.length === 0) {
    console.error('❌ 가이드 ID가 없습니다');
    return false;
  }
  
  const guideList = await db
    .select()
    .from(guides)
    .where(inArray(guides.id, page.guideIds));
  
  console.log(`📍 가이드 조회 완료: ${guideList.length}개`);
  
  // 첫 번째 가이드에서 위치 정보 가져오기
  const locationName = guideList[0]?.locationName || undefined;
  console.log(`📍 위치: ${locationName || '(없음)'}`);
  
  // 4. Base64 이미지 로드
  const guidesWithBase64 = await Promise.all(
    guideList.map(async (guide) => {
      const imagePath = path.join(process.cwd(), guide.imageUrl || '');
      let imageBase64 = '';
      
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        imageBase64 = imageBuffer.toString('base64');
      } else {
        console.warn(`⚠️ 이미지 파일 없음: ${guide.imageUrl}`);
      }
      
      return {
        id: guide.id,
        title: guide.id,
        description: guide.aiGeneratedContent || '',
        imageBase64,
        location: guide.locationName || undefined,
        locationName: guide.locationName || undefined
      };
    })
  );
  
  // 5. 새 HTML 생성
  console.log(`🔨 HTML 생성 중...`);
  const newHtmlContent = generateShareHtml({
    title: page.name,
    items: guidesWithBase64,
    createdAt: page.createdAt?.toISOString() || new Date().toISOString(),
    location: locationName,
    sender: senderName,
    includeAudio: false
  });
  
  console.log(`✅ HTML 생성 완료 (${(newHtmlContent.length / 1024 / 1024).toFixed(2)} MB)`);
  
  // 6. DB 업데이트
  console.log(`💾 DB 업데이트 중...`);
  await db
    .update(sharedHtmlPages)
    .set({
      htmlContent: newHtmlContent,
      updatedAt: new Date()
    })
    .where(eq(sharedHtmlPages.id, pageId));
  
  console.log(`✅ 재생성 완료!`);
  console.log(`🔗 확인: http://localhost:5000/s/${pageId}`);
  
  return true;
}

// 메인 실행
const pageId = process.argv[2];

if (!pageId) {
  console.error('❌ 사용법: tsx scripts/regenerate-share-page.ts <페이지ID>');
  console.error('예시: tsx scripts/regenerate-share-page.ts qi6WlKKC');
  process.exit(1);
}

regenerateSharePage(pageId)
  .then((success) => {
    if (success) {
      console.log('\n✅ 재생성 성공!');
      process.exit(0);
    } else {
      console.log('\n❌ 재생성 실패');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  });
