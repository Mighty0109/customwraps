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
        <button class="btn btn-sm img-editor-auto-remove" aria-label="자동 지우기" title="배경 자동 제거">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="margin-right:4px;">
            <path d="M12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          자동
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

    // Auto remove background
    overlay.querySelector('.img-editor-auto-remove').addEventListener('click', autoRemoveBackground);

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

  // --- Auto Background Removal ---
  function autoRemoveBackground() {
    const imageData = editorCtx.getImageData(0, 0, imgWidth, imgHeight);
    const data = imageData.data;
    const w = imgWidth;
    const h = imgHeight;
    const tolerance = 35;

    // Sample edge pixels to find background color
    const edgeColors = [];
    const sampleStep = Math.max(1, Math.floor(Math.min(w, h) / 100));
    for (let x = 0; x < w; x += sampleStep) {
      edgeColors.push([data[x * 4], data[x * 4 + 1], data[x * 4 + 2], data[x * 4 + 3]]);
      const bi = ((h - 1) * w + x) * 4;
      edgeColors.push([data[bi], data[bi + 1], data[bi + 2], data[bi + 3]]);
    }
    for (let y = 0; y < h; y += sampleStep) {
      const li = (y * w) * 4;
      edgeColors.push([data[li], data[li + 1], data[li + 2], data[li + 3]]);
      const ri = (y * w + w - 1) * 4;
      edgeColors.push([data[ri], data[ri + 1], data[ri + 2], data[ri + 3]]);
    }

    // Find dominant edge color (most common, ignoring transparent)
    const colorMap = {};
    let bestKey = null;
    let bestCount = 0;
    for (let i = 0; i < edgeColors.length; i++) {
      const c = edgeColors[i];
      if (c[3] < 128) continue;
      const key = (c[0] >> 4) + ',' + (c[1] >> 4) + ',' + (c[2] >> 4);
      colorMap[key] = (colorMap[key] || { count: 0, r: 0, g: 0, b: 0 });
      colorMap[key].count++;
      colorMap[key].r += c[0];
      colorMap[key].g += c[1];
      colorMap[key].b += c[2];
      if (colorMap[key].count > bestCount) {
        bestCount = colorMap[key].count;
        bestKey = key;
      }
    }

    if (!bestKey) return;
    const bg = colorMap[bestKey];
    const bgR = Math.round(bg.r / bg.count);
    const bgG = Math.round(bg.g / bg.count);
    const bgB = Math.round(bg.b / bg.count);

    // Flood-fill from all edges
    const visited = new Uint8Array(w * h);
    const queue = [];

    function colorDist(idx) {
      if (data[idx + 3] < 10) return 0;
      const dr = data[idx] - bgR;
      const dg = data[idx + 1] - bgG;
      const db = data[idx + 2] - bgB;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    // Seed from edges
    for (let x = 0; x < w; x++) {
      if (colorDist(x * 4) <= tolerance) queue.push(x);
      const bi = (h - 1) * w + x;
      if (colorDist(bi * 4) <= tolerance) queue.push(bi);
    }
    for (let y = 1; y < h - 1; y++) {
      const li = y * w;
      if (colorDist(li * 4) <= tolerance) queue.push(li);
      const ri = y * w + w - 1;
      if (colorDist(ri * 4) <= tolerance) queue.push(ri);
    }

    for (let i = 0; i < queue.length; i++) visited[queue[i]] = 1;

    // BFS flood fill
    let head = 0;
    while (head < queue.length) {
      const pos = queue[head++];
      const px = pos % w;
      const py = (pos - px) / w;
      const neighbors = [];
      if (px > 0) neighbors.push(pos - 1);
      if (px < w - 1) neighbors.push(pos + 1);
      if (py > 0) neighbors.push(pos - w);
      if (py < h - 1) neighbors.push(pos + w);

      for (let n = 0; n < neighbors.length; n++) {
        const np = neighbors[n];
        if (visited[np]) continue;
        visited[np] = 1;
        if (colorDist(np * 4) <= tolerance) {
          queue.push(np);
        }
      }
    }

    // Apply: make background pixels transparent, soften edges
    for (let i = 0; i < queue.length; i++) {
      const idx = queue[i] * 4;
      data[idx + 3] = 0;
    }

    // Edge softening: partially transparent pixels near the boundary
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const pos = y * w + x;
        if (visited[pos]) continue;
        const idx = pos * 4;
        if (data[idx + 3] === 0) continue;
        // Check if adjacent to removed pixel
        let adjRemoved = 0;
        if (x > 0 && visited[pos - 1]) adjRemoved++;
        if (x < w - 1 && visited[pos + 1]) adjRemoved++;
        if (y > 0 && visited[pos - w]) adjRemoved++;
        if (y < h - 1 && visited[pos + w]) adjRemoved++;
        if (adjRemoved > 0) {
          const dist = colorDist(idx);
          if (dist < tolerance * 1.5) {
            const alpha = Math.min(255, Math.round(255 * (dist / (tolerance * 1.5))));
            data[idx + 3] = Math.min(data[idx + 3], alpha);
          }
        }
      }
    }

    editorCtx.putImageData(imageData, 0, 0);
    pushHistory();
    updateUndoBtn();
    renderDisplay();
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
