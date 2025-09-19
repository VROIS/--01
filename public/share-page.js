// share-page.js - Modified for Express.js backend

document.addEventListener('DOMContentLoaded', async () => {
    const contentContainer = document.getElementById('guidebook-content');
    const loader = document.getElementById('loader');
    const descriptionEl = document.getElementById('guidebook-description');

    const showError = (message) => {
        if (loader) loader.classList.add('hidden');
        contentContainer.innerHTML = `<p class="text-red-500 text-center">${message}</p>`;
    };

    try {
        const params = new URLSearchParams(window.location.search);
        const guidebookId = params.get('id');

        if (!guidebookId) {
            showError('가이드북 ID를 찾을 수 없습니다. 링크가 올바른지 확인해주세요.');
            return;
        }

        // Express 서버에 GET 요청을 보냅니다.
        const response = await fetch(`/api/share?id=${guidebookId}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData?.error || `오류: ${response.status} - ${response.statusText}`;
            throw new Error(errorMessage);
        }

        const guidebook = await response.json();
        // 이제 contentIds 대신 contents 배열을 받습니다.
        const { contents, createdAt } = guidebook;

        if (!contents || !Array.isArray(contents) || contents.length === 0) {
            showError('이 가이드북에는 공유된 항목이 없습니다.');
            return;
        }

        if (loader) loader.classList.add('hidden');
        
        if (descriptionEl) {
            const createdDate = new Date(createdAt).toLocaleDateString('ko-KR');
            descriptionEl.textContent = `이 가이드북은 ${contents.length}개의 콘텐츠를 포함하고 있으며, ${createdDate}에 만들어졌습니다.`;
        }

        // 각 콘텐츠(이미지와 설명)를 페이지에 렌더링합니다.
        contents.forEach(content => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'guidebook-item';

            let imageElement = '';
            if (content.imageDataUrl) {
                imageElement = `<img src="${content.imageDataUrl}" alt="가이드북 이미지" class="w-full h-auto rounded-lg mb-4 shadow">`;
            }

            itemDiv.innerHTML = `
                ${imageElement}
                <p class="text-gray-700 whitespace-pre-wrap leading-relaxed">${content.description || '내용 없음'}</p>
            `;
            contentContainer.appendChild(itemDiv);
        });

    } catch (error) {
        console.error('가이드북 로딩 오류:', error);
        showError(`가이드북을 불러오는 중 오류가 발생했습니다: ${error.message}`);
    }
});