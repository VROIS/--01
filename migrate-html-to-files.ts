/**
 * 🔧 HTML 데이터 마이그레이션 스크립트
 * 
 * 목적: DB에 저장된 htmlContent를 파일로 이동하여 DB 용량 절약
 * 
 * 작업:
 * 1. shared_html_pages 테이블에서 htmlContent가 있는 데이터 조회
 * 2. 각 데이터를 /public/shared/{id}.html 파일로 저장
 * 3. DB에서 htmlFilePath 업데이트
 * 4. htmlContent를 NULL로 변경 (용량 절약)
 * 
 * 예상 효과: 184MB → 1MB (99% 감소)
 */

import { db } from './server/db';
import { sharedHtmlPages } from './shared/schema';
import { isNotNull, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function migrateHtmlToFiles() {
  console.log('🚀 HTML 마이그레이션 시작...\n');

  try {
    // 1. public/shared 폴더 생성
    const sharedDir = path.join(process.cwd(), 'public', 'shared');
    if (!fs.existsSync(sharedDir)) {
      fs.mkdirSync(sharedDir, { recursive: true });
      console.log('✅ public/shared 폴더 생성 완료\n');
    }

    // 2. htmlContent가 있는 모든 데이터 조회
    const pages = await db
      .select()
      .from(sharedHtmlPages)
      .where(isNotNull(sharedHtmlPages.htmlContent));

    console.log(`📊 마이그레이션 대상: ${pages.length}개\n`);

    if (pages.length === 0) {
      console.log('✅ 마이그레이션할 데이터가 없습니다.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let totalSizeBefore = 0;

    // 3. 각 페이지를 파일로 저장
    for (const page of pages) {
      try {
        const htmlFilePath = `/shared/${page.id}.html`;
        const fullPath = path.join(sharedDir, `${page.id}.html`);

        // 파일로 저장
        fs.writeFileSync(fullPath, page.htmlContent, 'utf8');
        
        const fileSizeKB = Math.round(page.htmlContent.length / 1024);
        totalSizeBefore += page.htmlContent.length;

        // DB 업데이트: htmlFilePath 설정, htmlContent NULL
        await db
          .update(sharedHtmlPages)
          .set({ 
            htmlFilePath: htmlFilePath,
            htmlContent: null 
          })
          .where(sql`${sharedHtmlPages.id} = ${page.id}`);

        successCount++;
        console.log(`✅ [${successCount}/${pages.length}] ${page.id} - ${page.name} (${fileSizeKB}KB)`);

      } catch (error) {
        errorCount++;
        console.error(`❌ [ERROR] ${page.id}:`, error.message);
      }
    }

    // 4. 결과 요약
    const totalSizeMB = (totalSizeBefore / (1024 * 1024)).toFixed(2);
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 마이그레이션 완료!');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    console.log(`💾 이동한 데이터: ${totalSizeMB}MB`);
    console.log(`📁 저장 위치: ${sharedDir}`);
    console.log(`${'='.repeat(60)}\n`);

    // 5. DB 크기 확인
    const dbSize = await db.execute(sql`
      SELECT pg_size_pretty(pg_total_relation_size('shared_html_pages')) as size
    `);
    console.log(`🗄️  현재 shared_html_pages 테이블 크기: ${dbSize.rows[0]?.size || 'N/A'}\n`);

  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
    process.exit(1);
  }

  process.exit(0);
}

// 실행
migrateHtmlToFiles();
