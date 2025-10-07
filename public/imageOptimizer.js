// utils/imageOptimizer.js

/**
 * 데이터 URL로부터 이미지를 리사이즈하여 가로/세로 비율을 유지합니다.
 * @param {string} dataUrl 이미지의 데이터 URL입니다.
 * @param {number} maxWidth 결과 이미지의 최대 너비입니다.
 * @param {number} maxHeight 결과 이미지의 최대 높이입니다.
 * @returns {Promise<string>} 리사이즈된 이미지의 데이터 URL을 포함하는 Promise를 반환합니다.
 */
export function optimizeImage(dataUrl, maxWidth = 1024, maxHeight = 1024) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;

            if (width <= maxWidth && height <= maxHeight) {
                // 리사이즈 필요 없음
                resolve(dataUrl);
                return;
            }

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round(height * (maxWidth / width));
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round(width * (maxHeight / height));
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                return reject(new Error('Canvas context를 가져올 수 없습니다.'));
            }

            ctx.drawImage(img, 0, 0, width, height);
            
            // 🔍 압축률 테스트용 - localStorage에서 설정 읽기
            const testQuality = parseFloat(localStorage.getItem('imageQuality')) || 0.75; // 0.9→0.75 속도 향상
            console.log(`📊 [압축테스트] 사용 품질: ${testQuality}, 크기: ${width}x${height}`);
            
            // 리사이즈된 이미지를 JPEG 데이터 URL로 가져옵니다.
            const result = canvas.toDataURL('image/jpeg', testQuality);
            const fileSizeKB = Math.round((result.length * 3/4) / 1024);
            console.log(`📊 [압축결과] 최종 크기: ${fileSizeKB}KB`);
            
            resolve(result);
        };
        img.onerror = (error) => {
            console.error("이미지 로딩 오류:", error);
            reject(new Error("최적화를 위해 이미지를 로드하는 데 실패했습니다."));
        };
        img.src = dataUrl;
    });
}