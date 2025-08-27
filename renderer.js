// renderer.js
const { ipcRenderer } = require("electron");

// 인스턴스 생성
const pdfHandler = new PDFHandler();

// DOM 요소들
const pdfContainer = document.getElementById("pdf-container");
const pageInfo = document.getElementById("page-info");
const zoomInfo = document.getElementById("zoom-info");
const thumbnailSidebar = document.getElementById("thumbnail-sidebar");
const thumbnailContainer = document.getElementById("thumbnail-container");
const detailsModal = document.getElementById("details-modal");

let thumbnailsVisible = false;
let lastFitMode = null; // 'width', 'page', null

// PDF.js가 로드될 때까지 기다리기
document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.pdfjsLib !== "undefined") {
    console.log("PDF.js 로드 완료");
  } else {
    console.error("PDF.js 로드 실패");
  }
});

// 이벤트 리스너들
document.getElementById("open-pdf").addEventListener("click", async () => {
  try {
    console.log("PDF 열기 버튼 클릭됨");
    const filePath = await ipcRenderer.invoke("open-pdf-dialog");
    console.log("선택된 파일:", filePath);

    if (filePath) {
      await pdfHandler.loadPDF(filePath);
      updatePageInfo();
      updateZoomInfo();
      updatePdfInfo();
      await pdfHandler.renderPage(1, pdfContainer);
      
      // 페이지 점프 input의 max 값 설정
      document.getElementById("page-jump").max = pdfHandler.getTotalPages();
      
      // 썸네일 생성 시작 (백그라운드)
      generateThumbnails();
    }
  } catch (error) {
    console.error("파일 선택 오류:", error);
    alert("파일을 선택할 수 없습니다: " + error.message);
  }
});

document.getElementById("prev-page").addEventListener("click", async () => {
  const prevPage = pdfHandler.prevPage();
  if (prevPage !== pdfHandler.getCurrentPage()) {
    await pdfHandler.renderPage(prevPage, pdfContainer);
    updatePageInfo();
    updateActiveThumbnail();
  }
});

document.getElementById("next-page").addEventListener("click", async () => {
  const nextPage = pdfHandler.nextPage();
  if (nextPage !== pdfHandler.getCurrentPage()) {
    await pdfHandler.renderPage(nextPage, pdfContainer);
    updatePageInfo();
    updateActiveThumbnail();
  }
});

function updatePageInfo() {
  pageInfo.textContent = `페이지: ${pdfHandler.getCurrentPage()} / ${pdfHandler.getTotalPages()}`;
}

function updateZoomInfo() {
  zoomInfo.textContent = `${pdfHandler.getZoomPercent()}%`;
}

function updatePdfInfo() {
  const info = pdfHandler.getPdfInfo();
  document.getElementById("file-name").textContent = info.fileName;
  document.getElementById("file-size").textContent = info.fileSize;
  document.getElementById("total-pages").textContent = info.totalPages;
  document.getElementById("creation-date").textContent = new Date().toLocaleDateString();
  document.getElementById("pdf-info").style.display = "block";
}

// 페이지 점프 기능
document.getElementById("goto-page").addEventListener("click", async () => {
  const targetPage = parseInt(document.getElementById("page-jump").value);
  if (targetPage && pdfHandler.pdfDoc) {
    const newPage = pdfHandler.gotoPage(targetPage);
    await pdfHandler.renderPage(newPage, pdfContainer);
    updatePageInfo();
    updateActiveThumbnail();
    document.getElementById("page-jump").value = '';
  }
});

// Enter 키로도 페이지 점프 가능
document.getElementById("page-jump").addEventListener("keypress", async (event) => {
  if (event.key === "Enter") {
    document.getElementById("goto-page").click();
  }
});

// 확대 기능
document.getElementById("zoom-in").addEventListener("click", async () => {
  if (pdfHandler.pdfDoc) {
    pdfHandler.zoomIn();
    await pdfHandler.renderPage(pdfHandler.getCurrentPage(), pdfContainer);
    updateZoomInfo();
    lastFitMode = null;
  }
});

// 축소 기능
document.getElementById("zoom-out").addEventListener("click", async () => {
  if (pdfHandler.pdfDoc) {
    pdfHandler.zoomOut();
    await pdfHandler.renderPage(pdfHandler.getCurrentPage(), pdfContainer);
    updateZoomInfo();
    lastFitMode = null;
  }
});

// 원본 크기로 리셋
document.getElementById("zoom-reset").addEventListener("click", async () => {
  if (pdfHandler.pdfDoc) {
    pdfHandler.resetZoom();
    await pdfHandler.renderPage(pdfHandler.getCurrentPage(), pdfContainer);
    updateZoomInfo();
    lastFitMode = null;
  }
});

// 폭맞춤
document.getElementById("zoom-fit-width").addEventListener("click", async () => {
  if (pdfHandler.pdfDoc) {
    const containerWidth = pdfContainer.clientWidth;
    await pdfHandler.fitToWidth(containerWidth);
    await pdfHandler.renderPage(pdfHandler.getCurrentPage(), pdfContainer);
    updateZoomInfo();
    lastFitMode = 'width';
  }
});

// 페이지맞춤
document.getElementById("zoom-fit-page").addEventListener("click", async () => {
  if (pdfHandler.pdfDoc) {
    const containerWidth = pdfContainer.clientWidth;
    const containerHeight = pdfContainer.clientHeight;
    await pdfHandler.fitToPage(containerWidth, containerHeight);
    await pdfHandler.renderPage(pdfHandler.getCurrentPage(), pdfContainer);
    updateZoomInfo();
    lastFitMode = 'page';
  }
});

// 썸네일 토글
document.getElementById("toggle-thumbnails").addEventListener("click", () => {
  thumbnailsVisible = !thumbnailsVisible;
  thumbnailSidebar.style.display = thumbnailsVisible ? "block" : "none";
  
  const button = document.getElementById("toggle-thumbnails");
  button.textContent = thumbnailsVisible ? "썸네일 숨기기" : "썸네일 보기";
});

// 상세 정보 모달 표시
document.getElementById("show-details").addEventListener("click", () => {
  if (pdfHandler.pdfDoc) {
    showDetailsModal();
  } else {
    alert("PDF 파일을 먼저 열어주세요.");
  }
});

// 모달 닫기 이벤트들
document.querySelector(".close-modal").addEventListener("click", () => {
  detailsModal.style.display = "none";
});

// 모달 배경 클릭으로 닫기
detailsModal.addEventListener("click", (event) => {
  if (event.target === detailsModal) {
    detailsModal.style.display = "none";
  }
});

// ESC 키로 모달 닫기
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && detailsModal.style.display === "block") {
    detailsModal.style.display = "none";
  }
});

// 마우스 휠로 확대/축소 (Ctrl + 휠)
pdfContainer.addEventListener("wheel", async (event) => {
  if (event.ctrlKey && pdfHandler.pdfDoc) {
    event.preventDefault();
    
    if (event.deltaY < 0) {
      pdfHandler.zoomIn();
    } else {
      pdfHandler.zoomOut();
    }
    
    await pdfHandler.renderPage(pdfHandler.getCurrentPage(), pdfContainer);
    updateZoomInfo();
  }
});

// 썸네일 생성 및 표시 - 지연 로딩으로 성능 개선
async function generateThumbnails() {
  console.log("썸네일 생성 시작...");
  
  // 먼저 빈 썸네일 구조만 생성
  createThumbnailPlaceholders();
  
  // 첫 3페이지는 즉시 로드
  const priorityPages = Math.min(3, pdfHandler.getTotalPages());
  for (let i = 1; i <= priorityPages; i++) {
    try {
      const canvas = await pdfHandler.generateThumbnail(i);
      if (canvas) {
        updateThumbnailUI(i, canvas);
      }
    } catch (error) {
      console.error(`페이지 ${i} 썸네일 생성 실패:`, error);
    }
  }
  
  // 나머지 페이지는 백그라운드에서 천천히 로드
  if (pdfHandler.getTotalPages() > 3) {
    setTimeout(() => {
      loadRemainingThumbnails(priorityPages + 1);
    }, 100);
  }
}

// 나머지 썸네일 백그라운드 로딩
async function loadRemainingThumbnails(startPage) {
  for (let i = startPage; i <= pdfHandler.getTotalPages(); i++) {
    try {
      const canvas = await pdfHandler.generateThumbnail(i);
      if (canvas) {
        updateThumbnailUI(i, canvas);
      }
      // 각 썸네일 사이에 작은 지연을 둬서 UI가 멈추지 않게 함
      if (i % 2 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } catch (error) {
      console.error(`페이지 ${i} 썸네일 생성 실패:`, error);
    }
  }
  console.log("모든 썸네일 생성 완료");
}

// 썸네일 플레이스홀더 생성
function createThumbnailPlaceholders() {
  thumbnailContainer.innerHTML = '';
  
  for (let i = 1; i <= pdfHandler.getTotalPages(); i++) {
    const thumbnailDiv = document.createElement('div');
    thumbnailDiv.className = 'thumbnail-item';
    thumbnailDiv.dataset.pageNum = i;
    thumbnailDiv.id = `thumbnail-${i}`;
    
    // 로딩 플레이스홀더
    const placeholder = document.createElement('div');
    placeholder.className = 'thumbnail-placeholder';
    placeholder.style.cssText = `
      width: 150px; 
      height: 200px; 
      background: #f0f0f0; 
      border: 1px solid #ddd; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      color: #666;
      border-radius: 2px;
    `;
    placeholder.textContent = '로딩중...';
    thumbnailDiv.appendChild(placeholder);
    
    const pageNumber = document.createElement('div');
    pageNumber.className = 'page-number';
    pageNumber.textContent = `페이지 ${i}`;
    thumbnailDiv.appendChild(pageNumber);
    
    // 클릭 이벤트
    thumbnailDiv.addEventListener('click', async () => {
      const targetPage = parseInt(thumbnailDiv.dataset.pageNum);
      pdfHandler.gotoPage(targetPage);
      await pdfHandler.renderPage(targetPage, pdfContainer);
      updatePageInfo();
      updateActiveThumbnail();
    });
    
    thumbnailContainer.appendChild(thumbnailDiv);
  }
  
  updateActiveThumbnail();
}

// 개별 썸네일 UI 업데이트
function updateThumbnailUI(pageNum, canvas) {
  const thumbnailDiv = document.getElementById(`thumbnail-${pageNum}`);
  if (thumbnailDiv) {
    const placeholder = thumbnailDiv.querySelector('.thumbnail-placeholder');
    if (placeholder) {
      // 새로운 캔버스를 만들어서 내용을 복사
      const newCanvas = document.createElement('canvas');
      newCanvas.width = canvas.width;
      newCanvas.height = canvas.height;
      const ctx = newCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, 0);
      
      // 플레이스홀더를 캔버스로 교체
      thumbnailDiv.replaceChild(newCanvas, placeholder);
    }
  }
}

// 현재 페이지 썸네일 강조
function updateActiveThumbnail() {
  const thumbnails = document.querySelectorAll('.thumbnail-item');
  thumbnails.forEach((thumb, index) => {
    if (index + 1 === pdfHandler.getCurrentPage()) {
      thumb.classList.add('active');
    } else {
      thumb.classList.remove('active');
    }
  });
}

// 창 크기 변경 시 자동 리사이즈
window.addEventListener('resize', async () => {
  if (pdfHandler.pdfDoc && lastFitMode) {
    setTimeout(async () => {
      if (lastFitMode === 'width') {
        const containerWidth = pdfContainer.clientWidth;
        await pdfHandler.fitToWidth(containerWidth);
        await pdfHandler.renderPage(pdfHandler.getCurrentPage(), pdfContainer);
        updateZoomInfo();
      } else if (lastFitMode === 'page') {
        const containerWidth = pdfContainer.clientWidth;
        const containerHeight = pdfContainer.clientHeight;
        await pdfHandler.fitToPage(containerWidth, containerHeight);
        await pdfHandler.renderPage(pdfHandler.getCurrentPage(), pdfContainer);
        updateZoomInfo();
      }
    }, 100); // 100ms 지연으로 연속된 리사이즈 이벤트 처리
  }
});

// 상세 정보 모달 표시 함수
function showDetailsModal() {
  const detailInfo = pdfHandler.getDetailedPdfInfo();
  
  // 기본 정보 설정
  document.getElementById("detail-filename").textContent = detailInfo.fileName;
  document.getElementById("detail-filesize").textContent = detailInfo.fileSize;
  document.getElementById("detail-filepath").textContent = detailInfo.filePath;
  document.getElementById("detail-pages").textContent = detailInfo.totalPages;
  document.getElementById("detail-created").textContent = detailInfo.creationDate;
  document.getElementById("detail-modified").textContent = detailInfo.modificationDate;
  
  // PDF 메타데이터 설정
  document.getElementById("detail-title").textContent = detailInfo.title;
  document.getElementById("detail-author").textContent = detailInfo.author;
  document.getElementById("detail-subject").textContent = detailInfo.subject;
  document.getElementById("detail-keywords").textContent = detailInfo.keywords;
  document.getElementById("detail-creator").textContent = detailInfo.creator;
  document.getElementById("detail-producer").textContent = detailInfo.producer;
  
  // 기술 정보 설정
  document.getElementById("detail-version").textContent = detailInfo.pdfVersion;
  document.getElementById("detail-pdf-created").textContent = detailInfo.pdfCreationDate;
  document.getElementById("detail-pdf-modified").textContent = detailInfo.pdfModDate;
  document.getElementById("detail-linearized").textContent = detailInfo.linearized ? "예" : "아니오";
  document.getElementById("detail-encrypted").textContent = detailInfo.encrypted ? "예" : "아니오";
  
  // 권한 정보 설정
  const permissionsContainer = document.getElementById("detail-permissions");
  permissionsContainer.innerHTML = "";
  detailInfo.permissions.forEach(permission => {
    const permissionSpan = document.createElement("span");
    permissionSpan.className = "permission-item";
    permissionSpan.textContent = permission;
    permissionsContainer.appendChild(permissionSpan);
  });
  
  // 모달 표시
  detailsModal.style.display = "block";
}