// pdf-handler.js
const fs = require("fs");

class PDFHandler {
  constructor() {
    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.5; // 기본 확대 비율
    this.fileName = '';
    this.fileSize = 0;
    this.thumbnails = new Map(); // 썸네일 캐시
  }

  async loadPDF(filePath) {
    try {
      console.log("PDF 로드 시작:", filePath);

      const data = new Uint8Array(fs.readFileSync(filePath));
      console.log("파일 읽기 완료, 크기:", data.length);

      // 파일 정보 저장
      this.fileName = filePath.split('\\').pop().split('/').pop();
      this.fileSize = data.length;

      this.pdfDoc = await window.pdfjsLib.getDocument({ data }).promise;
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;

      console.log("PDF 문서 로드 완료, 총 페이지:", this.totalPages);

      return true;
    } catch (error) {
      console.error("PDF 로드 실패:", error);
      throw error;
    }
  }

  async renderPage(pageNum, container) {
    try {
      console.log("페이지 렌더링 시작:", pageNum);

      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;


      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      container.innerHTML = "";
      container.appendChild(canvas);

      await page.render(renderContext).promise;

      this.currentPage = pageNum;

      console.log("페이지 렌더링 완료:", pageNum);
    } catch (error) {
      console.error("페이지 렌더링 실패:", error);
    }
  }

  nextPage() {
    return this.currentPage < this.totalPages
      ? this.currentPage + 1
      : this.currentPage;
  }

  prevPage() {
    return this.currentPage > 1 ? this.currentPage - 1 : this.currentPage;
  }

  getCurrentPage() {
    return this.currentPage;
  }

  getTotalPages() {
    return this.totalPages;
  }

  // 페이지 점프
  gotoPage(pageNum) {
    if (pageNum >= 1 && pageNum <= this.totalPages) {
      this.currentPage = pageNum;
      return pageNum;
    }
    return this.currentPage;
  }

  // 확대
  zoomIn() {
    this.scale = Math.min(this.scale * 1.2, 5.0); // 최대 500%
    return this.scale;
  }

  // 축소
  zoomOut() {
    this.scale = Math.max(this.scale / 1.2, 0.5); // 최소 50%
    return this.scale;
  }

  // 원본 크기로 리셋
  resetZoom() {
    this.scale = 1.0;
    return this.scale;
  }

  // 현재 확대 비율 가져오기 (퍼센트)
  getZoomPercent() {
    return Math.round(this.scale * 100);
  }

  // 확대 비율 설정
  setScale(scale) {
    this.scale = Math.max(0.5, Math.min(scale, 5.0));
    return this.scale;
  }

  // 폭맞춤 - 컨테이너 너비에 맞춤
  async fitToWidth(containerWidth) {
    try {
      if (!this.pdfDoc) return this.scale;
      
      const page = await this.pdfDoc.getPage(this.currentPage);
      const viewport = page.getViewport({ scale: 1.0 });
      
      // 여백을 고려해서 계산 (좌우 30px 여백)
      const availableWidth = containerWidth - 30;
      this.scale = Math.max(0.5, Math.min(availableWidth / viewport.width, 5.0));
      
      console.log(`폭맞춤: 컨테이너 너비 ${containerWidth}px, 스케일 ${this.scale.toFixed(2)}`);
      return this.scale;
    } catch (error) {
      console.error("폭맞춤 실패:", error);
      return this.scale;
    }
  }

  // 페이지맞춤 - 컨테이너에 페이지 전체가 보이도록 맞춤
  async fitToPage(containerWidth, containerHeight) {
    try {
      if (!this.pdfDoc) return this.scale;
      
      const page = await this.pdfDoc.getPage(this.currentPage);
      const viewport = page.getViewport({ scale: 1.0 });
      
      // 여백을 고려해서 계산 (좌우 30px, 상하 30px 여백)
      const availableWidth = containerWidth - 30;
      const availableHeight = containerHeight - 30;
      
      const scaleX = availableWidth / viewport.width;
      const scaleY = availableHeight / viewport.height;
      
      this.scale = Math.max(0.5, Math.min(Math.min(scaleX, scaleY), 5.0));
      
      console.log(`페이지맞춤: 컨테이너 ${containerWidth}x${containerHeight}px, 스케일 ${this.scale.toFixed(2)}`);
      return this.scale;
    } catch (error) {
      console.error("페이지맞춤 실패:", error);
      return this.scale;
    }
  }

  // PDF 정보 가져오기
  getPdfInfo() {
    return {
      fileName: this.fileName,
      fileSize: this.formatFileSize(this.fileSize),
      totalPages: this.totalPages,
      currentPage: this.currentPage
    };
  }

  // 파일 크기를 읽기 쉬운 형태로 변환
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 썸네일 생성 - 개선된 버전
  async generateThumbnail(pageNum, maxWidth = 150) {
    try {
      // 캐시에서 확인
      if (this.thumbnails.has(pageNum)) {
        return this.thumbnails.get(pageNum);
      }

      console.log(`썸네일 생성 중: 페이지 ${pageNum}`);
      
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      
      // 썸네일 크기 계산 (비율 유지)
      const scale = Math.min(maxWidth / viewport.width, 200 / viewport.height);
      const thumbnailViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = thumbnailViewport.height;
      canvas.width = thumbnailViewport.width;

      // 배경을 흰색으로 설정
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: thumbnailViewport,
      };

      await page.render(renderContext).promise;
      
      console.log(`썸네일 생성 완료: 페이지 ${pageNum} (${canvas.width}x${canvas.height})`);
      
      // 캐시에 저장
      this.thumbnails.set(pageNum, canvas);
      return canvas;
    } catch (error) {
      console.error(`썸네일 생성 실패 (페이지 ${pageNum}):`, error);
      return null;
    }
  }

  // 썸네일 캐시 초기화
  clearThumbnailCache() {
    this.thumbnails.clear();
  }
}

// CommonJS 방식으로 export
if (typeof module !== "undefined" && module.exports) {
  module.exports = PDFHandler;
} else {
  window.PDFHandler = PDFHandler;
}
