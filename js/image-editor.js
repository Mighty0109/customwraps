/* ============================================================
   image-editor.js - Image Background Eraser Editor
   ============================================================ */

'use strict';

const ImageEditor = (function () {
  let overlay = null;
  let editorCanvas = null;
  let editorCtx = null;
  let checkerCanvas = null;
  let displayCanvas = null;
  let displayCtx = null;
  let imgWidth = 0;
  let imgHeight = 0;
  let brushSize = 30;
  let isDrawing = false;
  let lastX = 0, lastY = 0;
  let history = [];
  const MAX_HISTORY = 30;
  let onSaveCallback = null;
  let mouseUpHandler = null;

  function open(sourceImage, callback) {
    onSaveCallback = callback;
    imgWidth = sourceImage.naturalWidth || sourceImage.width;
    imgHeight = sourceImage.naturalHeight || sourceImage.height;

    // Create editor canvas at source resolution
    editorCanvas = document.createElement('canvas');
    editorCanvas.width = imgWidth;
    editorCanvas.height = imgHeight;
    editorCtx = editorCanvas.getContext('2d');
    editorCtx.drawImage(sourceImage, 0, 0);

    // Checkerboard background canvas (same size, drawn once)
    checkerCanvas = document.createElement('canvas');
    checkerCanvas.width = imgWidth;
    checkerCanvas.height = imgHeight;
    const cCtx = checkerCanvas.getContext('2d');
    const cSize = Math.max(8, Math.round(imgWidth / 80));
    for (let y = 0; y < imgHeight; y += cSize) {
      for (let x = 0; x < imgWidth; x += cSize) {
        cCtx.fillStyle = ((x / cSize + y / cSize) % 2 === 0) ? '#3a3a3a' : '#2a2a2a';
        cCtx.fillRect(x, y, cSize, cSize);
      }
    }

    history = [];
    pushHistory();

    buildUI();
    setupEvents();
    fitCanvas();
    renderDisplay();
  }

  function buildUI() {
    overlay = document.createElement('div');
    overlay.className = 'img-editor-overlay';
    overlay.innerHTML = `
      <div class="img-editor-header">
        <button class="btn-icon img-editor-close" aria-label="취소">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="img-editor-title">배경 지우기</span>
        <button class="btn btn-primary btn-sm img-editor-save">완료</button>
      </div>
      <div class="img-editor-canvas-area">
        <div class="img-editor-canvas-wrap"></div>
      </div>
      <div class="img-editor-toolbar">
        <button class="btn-icon img-editor-undo" aria-label="되돌리기" disabled>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 10H16C18.76 10 21 12.24 21 15C21 17.76 18.76 20 16 20H11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 6L3 10L7 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="img-editor-brush-control">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="img-editor-brush-icon">
            <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" stroke-dasharray="4 2"/>
          </svg>
          <input type="range" class="slider-input img-editor-brush-slider" min="5" max="150" value="30" step="1">
          <span class="img-editor-brush-value">30</span>
        </div>
        <button class="btn-icon img-editor-reset" aria-label="초기화" title="원본 복원">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M1 4V10H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3.51 15A9 9 0 105.64 5.64L1 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;

    // Create display canvas (composites checker + editor for smooth display)
    displayCanvas = document.createElement('canvas');
    displayCanvas.width = imgWidth;
    displayCanvas.height = imgHeight;
    displayCanvas.className = 'img-editor-canvas';
    displayCtx = displayCanvas.getContext('2d');

    const canvasWrap = overlay.querySelector('.img-editor-canvas-wrap');
    canvasWrap.appendChild(displayCanvas);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
  }

  function setupEvents() {
    // Close
    overlay.querySelector('.img-editor-close').addEventListener('click', close);

    // Save
    overlay.querySelector('.img-editor-save').addEventListener('click', save);

    // Undo
    overlay.querySelector('.img-editor-undo').addEventListener('click', undo);

    // Reset
    overlay.querySelector('.img-editor-reset').addEventListener('click', resetToOriginal);

    // Brush size
    const slider = overlay.querySelector('.img-editor-brush-slider');
    const valueEl = overlay.querySelector('.img-editor-brush-value');
    slider.addEventListener('input', () => {
      brushSize = parseInt(slider.value);
      valueEl.textContent = brushSize;
      updateSliderFill(slider);
    });
    updateSliderFill(slider);

    // Mouse drawing
    displayCanvas.addEventListener('mousedown', onMouseDown);
    displayCanvas.addEventListener('mousemove', onMouseMove);
    mouseUpHandler = onMouseUp.bind(this);
    window.addEventListener('mouseup', mouseUpHandler);

    // Touch drawing
    displayCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
    displayCanvas.addEventListener('touchmove', onTouchMove, { passive: false });
    displayCanvas.addEventListener('touchend', onTouchEnd, { passive: false });
    displayCanvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    // Resize
    window.addEventListener('resize', fitCanvas);
  }

  function updateSliderFill(input) {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const val = parseFloat(input.value);
    const pct = ((val - min) / (max - min)) * 100;
    input.style.setProperty('--fill', pct + '%');
  }

  function fitCanvas() {
    if (!overlay || !displayCanvas) return;
    const area = overlay.querySelector('.img-editor-canvas-area');
    if (!area) return;
    const areaRect = area.getBoundingClientRect();
    const pad = 12;
    const maxW = areaRect.width - pad * 2;
    const maxH = areaRect.height - pad * 2;
    if (maxW <= 0 || maxH <= 0) return;

    const aspectRatio = imgWidth / imgHeight;
    let displayW, displayH;

    if (maxW / maxH > aspectRatio) {
      displayH = maxH;
      displayW = displayH * aspectRatio;
    } else {
      displayW = maxW;
      displayH = displayW / aspectRatio;
    }

    displayCanvas.style.width = Math.round(displayW) + 'px';
    displayCanvas.style.height = Math.round(displayH) + 'px';
  }

  function getCanvasCoords(clientX, clientY) {
    const rect = displayCanvas.getBoundingClientRect();
    const scaleX = imgWidth / rect.width;
    const scaleY = imgHeight / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // --- Mouse events ---
  function onMouseDown(e) {
    isDrawing = true;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    lastX = x;
    lastY = y;
    eraseAt(x, y);
    renderDisplay();
  }

  function onMouseMove(e) {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    eraseLine(lastX, lastY, x, y);
    lastX = x;
    lastY = y;
    renderDisplay();
  }

  function onMouseUp() {
    if (isDrawing) {
      isDrawing = false;
      pushHistory();
      updateUndoBtn();
    }
  }

  // --- Touch events ---
  function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length !== 1) return;
    isDrawing = true;
    const t = e.touches[0];
    const { x, y } = getCanvasCoords(t.clientX, t.clientY);
    lastX = x;
    lastY = y;
    eraseAt(x, y);
    renderDisplay();
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (!isDrawing || e.touches.length !== 1) return;
    const t = e.touches[0];
    const { x, y } = getCanvasCoords(t.clientX, t.clientY);
    eraseLine(lastX, lastY, x, y);
    lastX = x;
    lastY = y;
    renderDisplay();
  }

  function onTouchEnd(e) {
    e.preventDefault();
    if (isDrawing) {
      isDrawing = false;
      pushHistory();
      updateUndoBtn();
    }
  }

  // --- Erase operations ---
  function eraseAt(x, y) {
    editorCtx.save();
    editorCtx.globalCompositeOperation = 'destination-out';
    editorCtx.beginPath();
    editorCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    editorCtx.fill();
    editorCtx.restore();
  }

  function eraseLine(x1, y1, x2, y2) {
    editorCtx.save();
    editorCtx.globalCompositeOperation = 'destination-out';
    editorCtx.lineWidth = brushSize;
    editorCtx.lineCap = 'round';
    editorCtx.lineJoin = 'round';
    editorCtx.beginPath();
    editorCtx.moveTo(x1, y1);
    editorCtx.lineTo(x2, y2);
    editorCtx.stroke();
    editorCtx.restore();
  }

  // --- Display rendering (checker + image) ---
  function renderDisplay() {
    displayCtx.clearRect(0, 0, imgWidth, imgHeight);
    displayCtx.drawImage(checkerCanvas, 0, 0);
    displayCtx.drawImage(editorCanvas, 0, 0);
  }

  // --- History ---
  function pushHistory() {
    if (history.length >= MAX_HISTORY) {
      history.shift();
    }
    history.push(editorCtx.getImageData(0, 0, imgWidth, imgHeight));
  }

  function undo() {
    if (history.length <= 1) return;
    history.pop();
    const prev = history[history.length - 1];
    editorCtx.putImageData(prev, 0, 0);
    renderDisplay();
    updateUndoBtn();
  }

  function resetToOriginal() {
    if (history.length <= 1) return;
    const first = history[0];
    editorCtx.putImageData(first, 0, 0);
    history = [first];
    pushHistory();
    renderDisplay();
    updateUndoBtn();
  }

  function updateUndoBtn() {
    if (!overlay) return;
    const btn = overlay.querySelector('.img-editor-undo');
    if (btn) btn.disabled = history.length <= 1;
  }

  // --- Save / Close ---
  function save() {
    const dataUrl = editorCanvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => {
      if (onSaveCallback) onSaveCallback(img);
      close();
    };
    img.src = dataUrl;
  }

  function close() {
    if (!overlay) return;
    window.removeEventListener('mouseup', mouseUpHandler);
    window.removeEventListener('resize', fitCanvas);

    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      overlay = null;
      editorCanvas = null;
      editorCtx = null;
      checkerCanvas = null;
      displayCanvas = null;
      displayCtx = null;
      history = [];
      onSaveCallback = null;
    }, 300);
  }

  return { open };
})();
