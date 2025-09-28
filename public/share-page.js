document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const contentContainer = document.getElementById('guidebook-content');
    const titleElement = document.getElementById('guidebook-title');
    const dateElement = document.getElementById('guidebook-created-date');

    const detailPage = document.getElementById('shareDetailPage');
    const detailImage = document.getElementById('shareResultImage');
    const detailDescription = document.getElementById('shareDescriptionText');
    const detailBackButton = document.getElementById('shareBackBtn');
    const detailFooter = document.getElementById('shareDetailFooter');

    const params = new URLSearchParams(window.location.search);
    const data = params.get('data');

    if (!data) {
        showError('공유된 데이터가 없습니다. 유효한 링크인지 확인해주세요.');
        return;
    }

    try {
        const decodedData = decodeURIComponent(data);
        const guidebook = JSON.parse(decodedData);

        // 1. 메인 페이지 콘텐츠 렌더링
        titleElement.textContent = guidebook.name || '공유된 가이드북';
        document.title = `${guidebook.name} - 내손가이드`;
        
        if (guidebook.createdAt) {
            dateElement.textContent = `작성일: ${new Date(guidebook.createdAt).toLocaleDateString('ko-KR')}`;
        }
        
        if (guidebook.contents && guidebook.contents.length > 0) {
            contentContainer.innerHTML = ''; // 기존 내용 비우기
            guidebook.contents.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'guidebook-item cursor-pointer p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow';
                itemElement.innerHTML = `
                    <img src="${item.imageUrl || 'https://via.placeholder.com/150'}" alt="${item.title}" class="w-full h-40 object-cover rounded-md mb-3">
                    <h3 class="font-bold text-gray-800 line-clamp-2">${item.title}</h3>
                `;

                // 상세보기 클릭 이벤트
                itemElement.addEventListener('click', () => showDetailView(item));
                contentContainer.appendChild(itemElement);
            });
        } else {
            showError('공유된 가이드가 없습니다.');
        }

        loader.style.display = 'none';

    } catch (error) {
        console.error('Data processing error:', error);
        showError('잘못된 공유 링크입니다. 링크를 다시 확인해주세요.');
    }

    function showDetailView(item) {
        if (!detailPage || !detailImage || !detailDescription || !detailBackButton || !detailFooter) return;

        detailImage.src = item.imageUrl || 'https://via.placeholder.com/400';

        let description = "해당 가이드에 대한 설명이 없습니다.";
        if (item.aiGeneratedContent) {
            try {
                const aiContent = JSON.parse(item.aiGeneratedContent);
                description = aiContent.description || item.description || description;
            } catch {
                description = (typeof item.aiGeneratedContent === 'string' ? item.aiGeneratedContent : item.aiGeneratedContent.description) || item.description || description;
            }
        } else if (item.description) {
            description = item.description;
        }

        detailDescription.textContent = description;

        detailPage.classList.add('visible');
        detailFooter.classList.remove('hidden');
    }
    
    if (detailBackButton) {
        detailBackButton.addEventListener('click', () => {
            if (!detailPage || !detailFooter) return;
            detailPage.classList.remove('visible');
            detailFooter.classList.add('hidden');
        });
    }

    function showError(message) {
        if (loader) loader.style.display = 'none';
        if (contentContainer) {
            contentContainer.innerHTML = `<p class="text-red-500 text-center col-span-3">${message}</p>`;
        }
    }
});