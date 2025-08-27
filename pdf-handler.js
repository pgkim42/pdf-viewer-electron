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
    this.filePath = '';
    this.thumbnails = new Map(); // 썸네일 캐시
    this.metadata = null; // PDF 메타데이터
    this.fileStats = null; // 파일 시스템 정보
  }

  async loadPDF(filePath) {
    try {
      console.log("PDF 로드 시작:", filePath);

      const data = new Uint8Array(fs.readFileSync(filePath));
      console.log("파일 읽기 완료, 크기:", data.length);

      // 파일 정보 저장
      this.fileName = filePath.split('\\').pop().split('/').pop();
      this.fileSize = data.length;
      this.filePath = filePath;

      this.pdfDoc = await window.pdfjsLib.getDocument({ data }).promise;
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;

      // 메타데이터 로드
      await this.loadMetadata();

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

  // PDF 메타데이터 로드
  async loadMetadata() {
    try {
      // PDF 문서 메타데이터
      this.metadata = await this.pdfDoc.getMetadata();
      
      // 파일 시스템 정보
      this.fileStats = fs.statSync(this.filePath);
      
      console.log("메타데이터 로드 완료:", this.metadata);
    } catch (error) {
      console.error("메타데이터 로드 실패:", error);
      this.metadata = null;
      this.fileStats = null;
    }
  }

  // 상세한 PDF 정보 가져오기
  getDetailedPdfInfo() {
    const basicInfo = this.getPdfInfo();
    
    // 메타데이터에서 정보 추출
    const info = this.metadata?.info || {};
    const metadata = this.metadata?.metadata || null;
    
    return {
      // 기본 정보
      fileName: basicInfo.fileName,
      fileSize: basicInfo.fileSize,
      filePath: this.filePath,
      totalPages: basicInfo.totalPages,
      currentPage: basicInfo.currentPage,
      
      // 파일 시스템 정보
      creationDate: this.fileStats ? this.fileStats.birthtime.toLocaleString('ko-KR') : '알 수 없음',
      modificationDate: this.fileStats ? this.fileStats.mtime.toLocaleString('ko-KR') : '알 수 없음',
      
      // PDF 메타데이터
      title: info.Title || '제목 없음',
      author: info.Author || '작성자 없음',
      subject: info.Subject || '주제 없음',
      creator: info.Creator || '생성 프로그램 없음',
      producer: info.Producer || '생성자 없음',
      keywords: info.Keywords || '키워드 없음',
      
      // PDF 생성/수정 날짜
      pdfCreationDate: info.CreationDate ? this.formatPdfDate(info.CreationDate) : '알 수 없음',
      pdfModDate: info.ModDate ? this.formatPdfDate(info.ModDate) : '알 수 없음',
      
      // PDF 버전
      pdfVersion: this.pdfDoc._pdfInfo?.version || '알 수 없음',
      
      // 보안 정보
      encrypted: this.metadata?.info?.IsAcroFormPresent || false,
      permissions: this.getPermissionsInfo(),
      
      // 추가 기술 정보
      pdfFormatVersion: this.metadata?.info?.PDFFormatVersion || '알 수 없음',
      linearized: this.pdfDoc._pdfInfo?.linearized || false,
    };
  }

  // PDF 날짜 형식 변환 (D:20210101120000+09'00' -> 읽기 쉬운 형식)
  formatPdfDate(pdfDateStr) {
    try {
      if (!pdfDateStr || !pdfDateStr.startsWith('D:')) return '알 수 없음';
      
      const dateStr = pdfDateStr.substring(2, 16); // D: 제거하고 년월일시분초 추출
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const hour = dateStr.substring(8, 10);
      const minute = dateStr.substring(10, 12);
      const second = dateStr.substring(12, 14);
      
      const date = new Date(year, month - 1, day, hour, minute, second);
      return date.toLocaleString('ko-KR');
    } catch (error) {
      console.error("PDF 날짜 변환 실패:", error);
      return '형식 오류';
    }
  }

  // PDF 권한 정보
  getPermissionsInfo() {
    const info = this.metadata?.info || {};
    const permissions = [];
    
    // 일반적인 PDF 권한들
    if (info.Printing !== false) permissions.push('인쇄 가능');
    if (info.ModifyContents !== false) permissions.push('내용 수정 가능');
    if (info.CopyContents !== false) permissions.push('내용 복사 가능');
    if (info.ModifyAnnotations !== false) permissions.push('주석 수정 가능');
    if (info.FillIn !== false) permissions.push('양식 작성 가능');
    if (info.ExtractForAccessibility !== false) permissions.push('접근성 추출 가능');
    if (info.Assemble !== false) permissions.push('문서 조립 가능');
    if (info.PrintHighQuality !== false) permissions.push('고품질 인쇄 가능');
    
    return permissions.length > 0 ? permissions : ['제한 정보 없음'];
  }
}

// CommonJS 방식으로 export
if (typeof module !== "undefined" && module.exports) {
  module.exports = PDFHandler;
} else {
  window.PDFHandler = PDFHandler;
}
