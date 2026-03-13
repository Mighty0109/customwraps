/* ============================================================
   canvas-engine.js - Canvas Compositing & Export Engine
   (Layer-based architecture)
   ============================================================ */

'use strict';

const CanvasEngine = (function () {
  let displayCanvas = null;
  let displayCtx = null;
  let offscreen = null;
  let offCtx = null;

  let templateImage = null;
  let maskCanvas = null;
  let userLayerCanvas = null;
  let userLayerCtx = null;
  let internalSize = 1024;
  let internalWidth = 1024;
  let internalHeight = 1024;

  // Layer system
  let layers = [];
  let selectedLayerId = null;

  // Touch gesture state
  let gestureState = {
    active: false,
    startDist: 0,
    startAngle: 0,
    startScale: 1,
    startRotation: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    panStartX: 0,
    panStartY: 0,
    lastTouchCount: 0,
  };

  let checkerPattern = null;
  let showPanelNumbers = false;
  let panelMasks = [];  // per-panel flood-fill masks
  let panelCentroids = [];  // actual center of each panel's filled area {x, y} in 0..1
  let panelColors = [];  // per-panel background color (null or CSS color string)
  let tempLayerCanvas = null;
  let tempLayerCtx = null;
  let combinedMaskCanvas = null;
  let combinedMaskCtx = null;
  let colorPickerEl = null;  // hidden <input type="color"> for panel color picking

  // ========================
  // Init
  // ========================

  function init(canvasEl) {
    displayCanvas = canvasEl;
    displayCtx = displayCanvas.getContext('2d');

    offscreen = document.createElement('canvas');
    offscreen.width = internalWidth;
    offscreen.height = internalHeight;
    offCtx = offscreen.getContext('2d');

    userLayerCanvas = document.createElement('canvas');
    userLayerCanvas.width = internalWidth;
    userLayerCanvas.height = internalHeight;
    userLayerCtx = userLayerCanvas.getContext('2d');

    createCheckerboard();
    setupInputEvents();
    render();

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => render(), 100);
    });
  }

  function createCheckerboard() {
    const cSize = 16;
    const c = document.createElement('canvas');
    c.width = cSize * 2;
    c.height = cSize * 2;
    const cx = c.getContext('2d');
    cx.fillStyle = '#2A2A2A';
    cx.fillRect(0, 0, cSize * 2, cSize * 2);
    cx.fillStyle = '#222222';
    cx.fillRect(0, 0, cSize, cSize);
    cx.fillRect(cSize, cSize, cSize, cSize);
    checkerPattern = displayCtx.createPattern(c, 'repeat');
  }

  // ========================
  // Layer Management
  // ========================

  function createLayerDefaults() {
    return {
      visible: true,
      opacity: 1.0,
      blendMode: 'source-over',
      backgroundColor: null,
      selectedPanels: null,  // null = all panels, or array of panel indices
      scale: 1.0,
      rotation: 0,
      fillMode: 'tile',
      offsetX: 0,
      offsetY: 0,
    };
  }

  const MAX_LAYERS = 20;

  function addLayer(img, id, name) {
    if (layers.length >= MAX_LAYERS) {
      UI.showToast('레이어는 최대 ' + MAX_LAYERS + '개까지 추가할 수 있습니다.');
      return;
    }
    const layer = {
      id: id,
      image: img,
      name: name || 'Layer',
      ...createLayerDefaults(),
    };
    autoPlaceLayer(layer);
    layers.push(layer);
    if (!selectedLayerId) selectedLayerId = id;
    render();
    return layer;
  }

  function removeLayer(id) {
    layers = layers.filter(l => l.id !== id);
    if (selectedLayerId === id) {
      selectedLayerId = layers.length > 0 ? layers[layers.length - 1].id : null;
    }
    render();
  }

  function updateLayer(id, props) {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    Object.assign(layer, props);
    clampLayerOffsets(layer);
    render();
  }

  function updateLayerImage(id, newImage) {
    const layer = layers.find(l => l.id === id);
    if (layer) {
      layer.image = newImage;
      render();
    }
  }

  function getLayer(id) {
    return layers.find(l => l.id === id) || null;
  }

  function getLayers() {
    return layers;
  }

  function getLayerCount() {
    return layers.length;
  }

  function setSelectedLayer(id) {
    selectedLayerId = id;
  }

  function getSelectedLayer() {
    if (!selectedLayerId) return null;
    return layers.find(l => l.id === selectedLayerId) || null;
  }

  function getSelectedLayerId() {
    return selectedLayerId;
  }

  function moveLayer(id, direction) {
    const idx = layers.findIndex(l => l.id === id);
    if (idx < 0) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= layers.length) return;
    const tmp = layers[idx];
    layers[idx] = layers[targetIdx];
    layers[targetIdx] = tmp;
    render();
  }

  function resetLayer(id) {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    Object.assign(layer, createLayerDefaults());
    if (layer.image) autoPlaceLayer(layer);
    render();
    syncUIFromState();
  }

  function clearLayers() {
    layers = [];
    selectedLayerId = null;
    render();
  }

  function hasLayers() {
    return layers.length > 0;
  }

  // ========================
  // Auto-placement
  // ========================

  function autoPlaceLayer(layer) {
    const img = layer.image;
    if (!img) return;
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    const ratio = imgW / imgH;

    if (ratio > 3 || ratio < 0.33) {
      layer.fillMode = 'tile';
      layer.scale = Math.min(2, internalSize / Math.max(imgW, imgH));
    } else if (imgW < internalSize * 0.3 && imgH < internalSize * 0.3) {
      layer.fillMode = 'tile';
      layer.scale = 1.0;
    } else {
      layer.fillMode = 'fit';
      layer.scale = 1.0;
    }

    layer.rotation = 0;
    layer.opacity = 1.0;
    layer.offsetX = 0;
    layer.offsetY = 0;

    // Brightness analysis
    const sampleCanvas = document.createElement('canvas');
    const sampleSize = 64;
    sampleCanvas.width = sampleSize;
    sampleCanvas.height = sampleSize;
    const sCtx = sampleCanvas.getContext('2d');
    sCtx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const data = sCtx.getImageData(0, 0, sampleSize, sampleSize).data;
    let totalBright = 0;
    const pixels = sampleSize * sampleSize;
    for (let i = 0; i < data.length; i += 4) {
      totalBright += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
    const avgBright = totalBright / pixels;
    if (avgBright < 50) {
      layer.opacity = 1.0;
    } else if (avgBright > 200) {
      layer.opacity = 0.85;
    } else {
      layer.opacity = 0.95;
    }
  }

  function clampLayerOffsets(layer) {
    layer.offsetX = Math.max(-internalSize, Math.min(internalSize, layer.offsetX));
    layer.offsetY = Math.max(-internalSize, Math.min(internalSize, layer.offsetY));
  }

  // ========================
  // Input Events (Mouse + Touch)
  // ========================

  function setupInputEvents() {
    if (!displayCanvas) return;

    setupPanelColorPicker();

    displayCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
    displayCanvas.addEventListener('touchmove', onTouchMove, { passive: false });
    displayCanvas.addEventListener('touchend', onTouchEnd, { passive: false });
    displayCanvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    let mouseDown = false;
    let mouseStartX = 0, mouseStartY = 0;
    let mouseStartOffX = 0, mouseStartOffY = 0;

    displayCanvas.addEventListener('mousedown', (e) => {
      const layer = getSelectedLayer();
      if (!layer) return;
      mouseDown = true;
      const rect = displayCanvas.getBoundingClientRect();
      mouseStartX = (e.clientX - rect.left) * (internalWidth / rect.width);
      mouseStartY = (e.clientY - rect.top) * (internalHeight / rect.height);
      mouseStartOffX = layer.offsetX;
      mouseStartOffY = layer.offsetY;
      displayCanvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!mouseDown) return;
      const layer = getSelectedLayer();
      if (!layer) return;
      const rect = displayCanvas.getBoundingClientRect();
      const dx = (e.clientX - rect.left) * (internalWidth / rect.width) - mouseStartX;
      const dy = (e.clientY - rect.top) * (internalHeight / rect.height) - mouseStartY;
      layer.offsetX = Math.round(mouseStartOffX + dx);
      layer.offsetY = Math.round(mouseStartOffY + dy);
      clampLayerOffsets(layer);
      render();
      syncUIFromState();
    });

    window.addEventListener('mouseup', () => {
      if (mouseDown) {
        mouseDown = false;
        if (displayCanvas) displayCanvas.style.cursor = 'grab';
      }
    });

    displayCanvas.addEventListener('wheel', (e) => {
      const layer = getSelectedLayer();
      if (!layer) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      layer.scale = Math.min(5, Math.max(0.1, layer.scale + delta));
      render();
      syncUIFromState();
    }, { passive: false });
  }

  function getTouchDist(t1, t2) {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchAngle(t1, t2) {
    return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
  }

  function onTouchStart(e) {
    const layer = getSelectedLayer();
    if (!layer) return;
    e.preventDefault();

    const touches = e.touches;
    if (touches.length === 1) {
      const rect = displayCanvas.getBoundingClientRect();
      gestureState.panStartX = (touches[0].clientX - rect.left) * (internalWidth / rect.width);
      gestureState.panStartY = (touches[0].clientY - rect.top) * (internalHeight / rect.height);
      gestureState.startOffsetX = layer.offsetX;
      gestureState.startOffsetY = layer.offsetY;
      gestureState.lastTouchCount = 1;
    } else if (touches.length === 2) {
      gestureState.active = true;
      gestureState.startDist = getTouchDist(touches[0], touches[1]);
      gestureState.startAngle = getTouchAngle(touches[0], touches[1]);
      gestureState.startScale = layer.scale;
      gestureState.startRotation = layer.rotation;
      gestureState.lastTouchCount = 2;
    }
  }

  function onTouchMove(e) {
    const layer = getSelectedLayer();
    if (!layer) return;
    e.preventDefault();

    const touches = e.touches;
    if (touches.length === 1 && gestureState.lastTouchCount === 1) {
      const rect = displayCanvas.getBoundingClientRect();
      const dx = (touches[0].clientX - rect.left) * (internalWidth / rect.width) - gestureState.panStartX;
      const dy = (touches[0].clientY - rect.top) * (internalHeight / rect.height) - gestureState.panStartY;
      layer.offsetX = Math.round(gestureState.startOffsetX + dx);
      layer.offsetY = Math.round(gestureState.startOffsetY + dy);
      clampLayerOffsets(layer);
      render();
      syncUIFromState();
    } else if (touches.length === 2 && gestureState.active) {
      const dist = getTouchDist(touches[0], touches[1]);
      const angle = getTouchAngle(touches[0], touches[1]);
      layer.scale = Math.min(5, Math.max(0.1, gestureState.startScale * (dist / gestureState.startDist)));
      const angleDelta = angle - gestureState.startAngle;
      layer.rotation = (gestureState.startRotation + angleDelta) % 360;
      if (layer.rotation < 0) layer.rotation += 360;
      render();
      syncUIFromState();
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length === 0) {
      gestureState.active = false;
      gestureState.lastTouchCount = 0;
    } else if (e.touches.length === 1) {
      const layer = getSelectedLayer();
      if (!layer) return;
      const rect = displayCanvas.getBoundingClientRect();
      gestureState.panStartX = (e.touches[0].clientX - rect.left) * (internalWidth / rect.width);
      gestureState.panStartY = (e.touches[0].clientY - rect.top) * (internalHeight / rect.height);
      gestureState.startOffsetX = layer.offsetX;
      gestureState.startOffsetY = layer.offsetY;
      gestureState.active = false;
      gestureState.lastTouchCount = 1;
    }
  }

  function syncUIFromState() {
    const layer = getSelectedLayer();
    if (layer && typeof App !== 'undefined' && App.syncControlsFromEngine) {
      App.syncControlsFromEngine(layer);
    }
  }

  // ========================
  // Template & Mask
  // ========================

  let currentModel = null;

  function setTemplate(model) {
    currentModel = model;
    const src = getTemplatePath(model);
    loadImage(src).then(img => {
      templateImage = img;
      internalWidth = img.naturalWidth || img.width;
      internalHeight = img.naturalHeight || img.height;
      internalSize = Math.max(internalWidth, internalHeight);
      resizeInternalCanvases();
      generateMask();
      generatePanelMasks();
      render();
    }).catch(() => {
      console.warn('Real template not found, using placeholder');
      internalWidth = 1024;
      internalHeight = 1024;
      internalSize = 1024;
      resizeInternalCanvases();
      templateImage = generatePlaceholderTemplate(model, internalSize);
      generateMask();
      generatePanelMasks();
      render();
    });
  }

  function resizeInternalCanvases() {
    offscreen.width = internalWidth;
    offscreen.height = internalHeight;
    offCtx = offscreen.getContext('2d');
    userLayerCanvas.width = internalWidth;
    userLayerCanvas.height = internalHeight;
    userLayerCtx = userLayerCanvas.getContext('2d');
  }

  function generateMask() {
    if (!templateImage) return;
    maskCanvas = document.createElement('canvas');
    maskCanvas.width = internalWidth;
    maskCanvas.height = internalHeight;
    const mCtx = maskCanvas.getContext('2d');
    mCtx.drawImage(templateImage, 0, 0, internalWidth, internalHeight);
    const imageData = mCtx.getImageData(0, 0, internalWidth, internalHeight);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const brightness = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = Math.round(brightness);
    }
    mCtx.putImageData(imageData, 0, 0);
  }

  function generatePanelMasks() {
    panelMasks = [];
    panelCentroids = [];
    panelColors = [];
    if (!templateImage) return;

    const w = internalWidth;
    const h = internalHeight;

    // Get template brightness data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(templateImage, 0, 0, w, h);
    const imageData = tempCtx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // Build brightness array
    const bright = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      bright[i] = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    }

    // High threshold treats anti-aliased boundary pixels as walls
    // (no expensive erosion needed)
    const THRESHOLD = 245;
    const MIN_REGION_PIXELS = 500;

    // Connected-component labeling: auto-detect all panel regions
    const labels = new Int32Array(w * h);
    let nextLabel = 1;
    const regions = [];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (bright[idx] >= THRESHOLD && labels[idx] === 0) {
          const label = nextLabel++;
          let count = 0, sumX = 0, sumY = 0;
          const queue = [idx];
          labels[idx] = label;
          let head = 0;

          while (head < queue.length) {
            const ci = queue[head++];
            const cx = ci % w;
            const cy = (ci - cx) / w;
            count++;
            sumX += cx;
            sumY += cy;

            if (cy > 0     && labels[ci - w] === 0 && bright[ci - w] >= THRESHOLD) { labels[ci - w] = label; queue.push(ci - w); }
            if (cy < h - 1 && labels[ci + w] === 0 && bright[ci + w] >= THRESHOLD) { labels[ci + w] = label; queue.push(ci + w); }
            if (cx > 0     && labels[ci - 1] === 0 && bright[ci - 1] >= THRESHOLD) { labels[ci - 1] = label; queue.push(ci - 1); }
            if (cx < w - 1 && labels[ci + 1] === 0 && bright[ci + 1] >= THRESHOLD) { labels[ci + 1] = label; queue.push(ci + 1); }
          }

          if (count >= MIN_REGION_PIXELS) {
            regions.push({ label, count, sumX, sumY });
          }
        }
      }
    }

    // Sort: top-to-bottom rows, then left-to-right within each row
    const ROW_HEIGHT = h * 0.08;
    regions.sort((a, b) => {
      const ay = a.sumY / a.count;
      const by = b.sumY / b.count;
      const aRow = Math.floor(ay / ROW_HEIGHT);
      const bRow = Math.floor(by / ROW_HEIGHT);
      if (aRow !== bRow) return aRow - bRow;
      return (a.sumX / a.count) - (b.sumX / b.count);
    });

    // Generate mask and centroid for each detected region
    for (const region of regions) {
      panelCentroids.push({
        x: (region.sumX / region.count) / w,
        y: (region.sumY / region.count) / h,
      });

      const mc = document.createElement('canvas');
      mc.width = w;
      mc.height = h;
      const mCtx = mc.getContext('2d');
      const maskData = mCtx.createImageData(w, h);
      const md = maskData.data;

      for (let i = 0; i < w * h; i++) {
        const mi = i * 4;
        md[mi] = 255;
        md[mi + 1] = 255;
        md[mi + 2] = 255;
        md[mi + 3] = labels[i] === region.label ? Math.round(bright[i]) : 0;
      }

      mCtx.putImageData(maskData, 0, 0);
      panelMasks.push(mc);
    }
  }

  // ========================
  // Panel Color Picker
  // ========================

  function hitTestPanel(clientX, clientY) {
    if (!showPanelNumbers || !panelCentroids.length || !displayCanvas) return -1;
    const rect = displayCanvas.getBoundingClientRect();
    const cssW = parseInt(displayCanvas.style.width) || rect.width;
    const cssH = parseInt(displayCanvas.style.height) || rect.height;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const hitR = 15;
    for (let i = 0; i < panelCentroids.length; i++) {
      const cx = panelCentroids[i].x * cssW;
      const cy = panelCentroids[i].y * cssH;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= hitR * hitR) return i;
    }
    return -1;
  }

  function setupPanelColorPicker() {
    // Create color input positioned offscreen but functional
    colorPickerEl = document.createElement('input');
    colorPickerEl.type = 'color';
    colorPickerEl.style.cssText = 'position:fixed;top:-100px;left:0;width:1px;height:1px;opacity:0.01;';
    document.body.appendChild(colorPickerEl);

    let pickerPanelIdx = -1;

    colorPickerEl.addEventListener('input', () => {
      if (pickerPanelIdx >= 0) {
        panelColors[pickerPanelIdx] = colorPickerEl.value;
        render();
      }
    });

    // Use pointerup to detect taps (works for both mouse and touch)
    let pointerStartX = 0, pointerStartY = 0;

    displayCanvas.addEventListener('pointerdown', (e) => {
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
    });

    displayCanvas.addEventListener('pointerup', (e) => {
      const dx = e.clientX - pointerStartX;
      const dy = e.clientY - pointerStartY;
      if (dx * dx + dy * dy > 100) return; // drag, not tap

      const idx = hitTestPanel(e.clientX, e.clientY);
      if (idx >= 0) {
        e.stopPropagation();
        pickerPanelIdx = idx;
        colorPickerEl.value = panelColors[idx] || '#3478f6';
        // Position near the tap and trigger
        colorPickerEl.style.top = e.clientY + 'px';
        colorPickerEl.style.left = e.clientX + 'px';
        colorPickerEl.focus();
        colorPickerEl.click();
      }
    });
  }

  function setPanelColor(idx, color) {
    if (idx >= 0 && idx < panelMasks.length) {
      panelColors[idx] = color;
      render();
    }
  }

  function clearPanelColors() {
    panelColors = [];
    render();
  }

  // ========================
  // Rendering
  // ========================

  function render() {
    if (!displayCanvas || !displayCtx) return;

    const container = displayCanvas.parentElement;
    if (container) {
      const canvasArea = container.closest('.canvas-area');
      const isFullWidth = canvasArea && canvasArea.classList.contains('full-width-mode');
      const containerW = isFullWidth ? (canvasArea.clientWidth || container.clientWidth) : container.clientWidth;
      const containerH = container.clientHeight || containerW;
      const dpr = window.devicePixelRatio || 1;
      const aspectRatio = internalWidth / internalHeight;

      let cssW, cssH;
      if (isFullWidth) {
        // Full width mode: fill 90% of container width, height follows aspect ratio
        cssW = containerW * 0.9;
        cssH = cssW / aspectRatio;
      } else if (aspectRatio >= 1) {
        cssW = Math.min(containerW, containerH * aspectRatio);
        cssH = cssW / aspectRatio;
      } else {
        cssH = Math.min(containerH, containerW / aspectRatio);
        cssW = cssH * aspectRatio;
      }
      if (!isFullWidth) {
        if (cssW > containerW) { cssW = containerW; cssH = cssW / aspectRatio; }
        if (cssH > containerH) { cssH = containerH; cssW = cssH * aspectRatio; }
      }

      displayCanvas.style.width = Math.round(cssW) + 'px';
      displayCanvas.style.height = Math.round(cssH) + 'px';
      displayCanvas.width = Math.round(cssW * dpr);
      displayCanvas.height = Math.round(cssH * dpr);
      displayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const cssW = parseInt(displayCanvas.style.width) || displayCanvas.width;
    const cssH = parseInt(displayCanvas.style.height) || displayCanvas.height;

    displayCtx.save();
    displayCtx.fillStyle = checkerPattern || '#222';
    displayCtx.fillRect(0, 0, cssW, cssH);
    displayCtx.restore();

    renderOffscreen();
    displayCtx.drawImage(offscreen, 0, 0, cssW, cssH);

    if (showPanelNumbers) {
      drawPanelNumbers(displayCtx, cssW, cssH);
    }

    // Sync layer sidebar height with canvas height
    const canvasArea = displayCanvas.closest('.canvas-area');
    if (canvasArea && canvasArea.classList.contains('split-mode')) {
      const sidebar = canvasArea.querySelector('.layer-sidebar');
      if (sidebar) {
        sidebar.style.maxHeight = displayCanvas.style.height;
      }
    }
  }

  function drawPanelNumbers(ctx, w, h) {
    if (!panelCentroids.length) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < panelCentroids.length; i++) {
      const centroid = panelCentroids[i];
      const cx = centroid.x * w;
      const cy = centroid.y * h;

      const fontSize = 9;
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;

      // Number badge
      const r = fontSize * 0.75;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.fillText(i + 1, cx, cy);
    }
    ctx.restore();
  }

  function renderOffscreen() {
    const w = internalWidth;
    const h = internalHeight;
    offCtx.clearRect(0, 0, w, h);
    offCtx.fillStyle = '#FFFFFF';
    offCtx.fillRect(0, 0, w, h);

    // Draw per-panel background colors
    if (panelColors.length > 0 && panelMasks.length > 0) {
      if (!tempLayerCanvas || tempLayerCanvas.width !== w || tempLayerCanvas.height !== h) {
        tempLayerCanvas = document.createElement('canvas');
        tempLayerCanvas.width = w;
        tempLayerCanvas.height = h;
        tempLayerCtx = tempLayerCanvas.getContext('2d');
      }
      for (let i = 0; i < panelColors.length; i++) {
        if (!panelColors[i] || !panelMasks[i]) continue;
        tempLayerCtx.clearRect(0, 0, w, h);
        tempLayerCtx.fillStyle = panelColors[i];
        tempLayerCtx.fillRect(0, 0, w, h);
        tempLayerCtx.save();
        tempLayerCtx.globalCompositeOperation = 'destination-in';
        tempLayerCtx.drawImage(panelMasks[i], 0, 0);
        tempLayerCtx.restore();
        offCtx.drawImage(tempLayerCanvas, 0, 0);
      }
    }

    const visibleLayers = layers.filter(l => l.visible);
    if (visibleLayers.length > 0) {
      if (userLayerCanvas.width !== w || userLayerCanvas.height !== h) {
        userLayerCanvas.width = w;
        userLayerCanvas.height = h;
        userLayerCtx = userLayerCanvas.getContext('2d');
      }
      userLayerCtx.clearRect(0, 0, w, h);

      // Ensure temp canvas for per-panel masking
      if (!tempLayerCanvas || tempLayerCanvas.width !== w || tempLayerCanvas.height !== h) {
        tempLayerCanvas = document.createElement('canvas');
        tempLayerCanvas.width = w;
        tempLayerCanvas.height = h;
        tempLayerCtx = tempLayerCanvas.getContext('2d');
      }

      for (const layer of visibleLayers) {
        const usePanelMask = layer.selectedPanels && layer.selectedPanels.length > 0
          && panelMasks.length > 0;

        if (usePanelMask) {
          // 1) Build combined mask (union) on combinedMaskCanvas
          if (!combinedMaskCanvas || combinedMaskCanvas.width !== w || combinedMaskCanvas.height !== h) {
            combinedMaskCanvas = document.createElement('canvas');
            combinedMaskCanvas.width = w;
            combinedMaskCanvas.height = h;
            combinedMaskCtx = combinedMaskCanvas.getContext('2d');
          }
          combinedMaskCtx.clearRect(0, 0, w, h);
          for (const idx of layer.selectedPanels) {
            if (panelMasks[idx]) {
              combinedMaskCtx.drawImage(panelMasks[idx], 0, 0);
            }
          }

          // 2) Render layer image on tempLayerCanvas
          tempLayerCtx.clearRect(0, 0, w, h);
          tempLayerCtx.save();
          tempLayerCtx.globalAlpha = layer.opacity;
          if (layer.image) {
            drawLayerImage(tempLayerCtx, w, h, layer);
          }
          tempLayerCtx.restore();

          // 3) Clip to combined mask
          tempLayerCtx.save();
          tempLayerCtx.globalCompositeOperation = 'destination-in';
          tempLayerCtx.drawImage(combinedMaskCanvas, 0, 0);
          tempLayerCtx.restore();

          // 4) Draw onto userLayerCanvas
          userLayerCtx.drawImage(tempLayerCanvas, 0, 0);
        } else {
          // No panel selection - render directly
          userLayerCtx.save();
          userLayerCtx.globalAlpha = layer.opacity;
          if (layer.image) {
            drawLayerImage(userLayerCtx, w, h, layer);
          }
          userLayerCtx.restore();
        }
      }

      if (maskCanvas) {
        userLayerCtx.save();
        userLayerCtx.globalCompositeOperation = 'destination-in';
        userLayerCtx.drawImage(maskCanvas, 0, 0, w, h);
        userLayerCtx.restore();
      }

      offCtx.drawImage(userLayerCanvas, 0, 0);
    }

    if (templateImage) {
      offCtx.save();
      offCtx.globalCompositeOperation = 'multiply';
      offCtx.drawImage(templateImage, 0, 0, w, h);
      offCtx.restore();
    }
  }

  function drawLayerImage(ctx, canvasW, canvasH, layer) {
    const img = layer.image;
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    const cx = canvasW / 2;
    const cy = canvasH / 2;

    switch (layer.fillMode) {
      case 'tile': {
        ctx.save();
        const pattern = ctx.createPattern(img, 'repeat');
        if (pattern) {
          const matrix = new DOMMatrix();
          matrix.translateSelf(cx + layer.offsetX, cy + layer.offsetY);
          matrix.rotateSelf(layer.rotation);
          matrix.scaleSelf(layer.scale, layer.scale);
          matrix.translateSelf(-cx, -cy);
          pattern.setTransform(matrix);
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, canvasW, canvasH);
        }
        ctx.restore();
        break;
      }
      case 'stretch': {
        ctx.save();
        ctx.translate(cx + layer.offsetX, cy + layer.offsetY);
        ctx.rotate(layer.rotation * Math.PI / 180);
        ctx.scale(layer.scale, layer.scale);
        ctx.drawImage(img, -canvasW / 2, -canvasH / 2, canvasW, canvasH);
        ctx.restore();
        break;
      }
      case 'fit': {
        const fitScale = Math.min(canvasW / imgW, canvasH / imgH) * layer.scale;
        const drawW = imgW * fitScale;
        const drawH = imgH * fitScale;
        ctx.save();
        ctx.translate(cx + layer.offsetX, cy + layer.offsetY);
        ctx.rotate(layer.rotation * Math.PI / 180);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
        break;
      }
      case 'center': {
        const drawW = imgW * layer.scale;
        const drawH = imgH * layer.scale;
        ctx.save();
        ctx.translate(cx + layer.offsetX, cy + layer.offsetY);
        ctx.rotate(layer.rotation * Math.PI / 180);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
        break;
      }
    }
  }

  // ========================
  // Export
  // ========================

  async function exportPNG(resolution) {
    const aspectRatio = internalWidth / internalHeight;
    const exportW = resolution;
    const exportH = Math.round(resolution / aspectRatio);

    const origW = internalWidth;
    const origH = internalHeight;
    const origSize = internalSize;
    const origOff = offscreen;
    const origCtx = offCtx;

    const tempOff = document.createElement('canvas');
    tempOff.width = exportW;
    tempOff.height = exportH;

    internalWidth = exportW;
    internalHeight = exportH;
    internalSize = Math.max(exportW, exportH);
    offscreen = tempOff;
    offCtx = tempOff.getContext('2d');

    renderOffscreen();

    internalWidth = origW;
    internalHeight = origH;
    internalSize = origSize;
    offscreen = origOff;
    offCtx = origCtx;

    return new Promise((resolve) => {
      tempOff.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  function getPreviewDataURL(previewSize) {
    const aspectRatio = internalWidth / internalHeight;
    const pw = previewSize;
    const ph = Math.round(previewSize / aspectRatio);
    const c = document.createElement('canvas');
    c.width = pw;
    c.height = ph;
    c.getContext('2d').drawImage(offscreen, 0, 0, pw, ph);
    return c.toDataURL('image/png');
  }

  function getTemplateOnlyDataURL(previewSize) {
    const aspectRatio = internalWidth / internalHeight;
    const pw = previewSize;
    const ph = Math.round(previewSize / aspectRatio);
    const c = document.createElement('canvas');
    c.width = pw;
    c.height = ph;
    const ctx2 = c.getContext('2d');
    ctx2.fillStyle = '#FFFFFF';
    ctx2.fillRect(0, 0, pw, ph);
    if (templateImage) ctx2.drawImage(templateImage, 0, 0, pw, ph);
    return c.toDataURL('image/png');
  }

  return {
    init,
    setTemplate,
    // Layer API
    addLayer,
    removeLayer,
    updateLayer,
    updateLayerImage,
    getLayer,
    getLayers,
    getLayerCount,
    setSelectedLayer,
    getSelectedLayer,
    getSelectedLayerId,
    moveLayer,
    resetLayer,
    clearLayers,
    hasLayers,
    getCurrentModel: () => currentModel,
    getPanelCount: () => panelMasks.length,
    setPanelColor,
    clearPanelColors,
    getPanelColors: () => [...panelColors],
    setShowPanelNumbers: (v) => { showPanelNumbers = v; render(); },
    // Rendering
    render,
    exportPNG,
    getPreviewDataURL,
    getTemplateOnlyDataURL,
  };
})();
