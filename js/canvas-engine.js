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
  let tempLayerCanvas = null;
  let tempLayerCtx = null;

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

  function addLayer(img, id, name) {
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
    if (!templateImage || !currentModel || !currentModel.panels) return;

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

    const THRESHOLD = 180;

    for (let pi = 0; pi < currentModel.panels.length; pi++) {
      const p = currentModel.panels[pi];
      let cx = Math.round((p.x + p.w / 2) * w);
      let cy = Math.round((p.y + p.h / 2) * h);

      // Ensure starting point is on a bright pixel; search nearby if not
      if (bright[cy * w + cx] < THRESHOLD) {
        let found = false;
        for (let r = 1; r < 50 && !found; r++) {
          for (let dy = -r; dy <= r && !found; dy++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              const nx = cx + dx, ny = cy + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h && bright[ny * w + nx] >= THRESHOLD) {
                cx = nx; cy = ny; found = true;
              }
            }
          }
        }
      }

      // BFS flood fill from center within expanded bounds
      const filled = new Uint8Array(w * h);
      const margin = 20;
      const minX = Math.max(0, Math.floor(p.x * w) - margin);
      const maxX = Math.min(w - 1, Math.ceil((p.x + p.w) * w) + margin);
      const minY = Math.max(0, Math.floor(p.y * h) - margin);
      const maxY = Math.min(h - 1, Math.ceil((p.y + p.h) * h) + margin);

      const queue = new Int32Array(w * h);
      let head = 0, tail = 0;
      const startIdx = cy * w + cx;
      if (cx >= 0 && cx < w && cy >= 0 && cy < h && bright[startIdx] >= THRESHOLD) {
        queue[tail++] = startIdx;
        filled[startIdx] = 1;
      }

      while (head < tail) {
        const idx = queue[head++];
        const x = idx % w;
        const y = (idx - x) / w;

        const neighbors = [
          y > minY ? idx - w : -1,
          y < maxY ? idx + w : -1,
          x > minX ? idx - 1 : -1,
          x < maxX ? idx + 1 : -1,
        ];

        for (const nIdx of neighbors) {
          if (nIdx >= 0 && !filled[nIdx] && bright[nIdx] >= THRESHOLD) {
            filled[nIdx] = 1;
            queue[tail++] = nIdx;
          }
        }
      }

      // Create mask canvas for this panel
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
        md[mi + 3] = filled[i] ? Math.round(bright[i]) : 0;
      }

      mCtx.putImageData(maskData, 0, 0);
      panelMasks.push(mc);
    }
  }

  // ========================
  // Rendering
  // ========================

  function render() {
    if (!displayCanvas || !displayCtx) return;

    const container = displayCanvas.parentElement;
    if (container) {
      const containerW = container.clientWidth;
      const containerH = container.clientHeight || containerW;
      const dpr = window.devicePixelRatio || 1;
      const aspectRatio = internalWidth / internalHeight;

      let cssW, cssH;
      if (aspectRatio >= 1) {
        cssW = Math.min(containerW, containerH * aspectRatio);
        cssH = cssW / aspectRatio;
      } else {
        cssH = Math.min(containerH, containerW / aspectRatio);
        cssW = cssH * aspectRatio;
      }
      if (cssW > containerW) { cssW = containerW; cssH = cssW / aspectRatio; }
      if (cssH > containerH) { cssH = containerH; cssW = cssH * aspectRatio; }

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
  }

  function drawPanelNumbers(ctx, w, h) {
    if (!currentModel || !currentModel.panels) return;
    const panels = currentModel.panels;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < panels.length; i++) {
      const p = panels[i];
      const px = p.x * w;
      const py = p.y * h;
      const pw = p.w * w;
      const ph = p.h * h;
      const cx = px + pw / 2;
      const cy = py + ph / 2;

      const fontSize = Math.max(12, Math.min(pw, ph) * 0.28);
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
          && currentModel && panelMasks.length > 0;

        if (usePanelMask) {
          // Render layer content to temp canvas
          tempLayerCtx.clearRect(0, 0, w, h);
          tempLayerCtx.save();
          tempLayerCtx.globalAlpha = layer.opacity;

          if (layer.backgroundColor) {
            tempLayerCtx.fillStyle = layer.backgroundColor;
            tempLayerCtx.fillRect(0, 0, w, h);
          }
          if (layer.image) {
            drawLayerImage(tempLayerCtx, w, h, layer);
          }
          tempLayerCtx.restore();

          // Build combined panel mask and apply via destination-in
          tempLayerCtx.save();
          tempLayerCtx.globalCompositeOperation = 'destination-in';
          // Draw all selected panel masks (additive - source-over for alpha union)
          for (const idx of layer.selectedPanels) {
            if (panelMasks[idx]) {
              tempLayerCtx.drawImage(panelMasks[idx], 0, 0);
            }
          }
          tempLayerCtx.restore();

          // Composite masked layer onto userLayerCanvas
          userLayerCtx.save();
          userLayerCtx.globalCompositeOperation = layer.blendMode || 'source-over';
          userLayerCtx.drawImage(tempLayerCanvas, 0, 0);
          userLayerCtx.restore();
        } else {
          // No panel selection - render directly
          userLayerCtx.save();
          userLayerCtx.globalAlpha = layer.opacity;
          userLayerCtx.globalCompositeOperation = layer.blendMode || 'source-over';

          if (layer.backgroundColor) {
            userLayerCtx.fillStyle = layer.backgroundColor;
            userLayerCtx.fillRect(0, 0, w, h);
          }
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
    getPanelCount: () => currentModel && currentModel.panels ? currentModel.panels.length : 0,
    setShowPanelNumbers: (v) => { showPanelNumbers = v; render(); },
    // Rendering
    render,
    exportPNG,
    getPreviewDataURL,
    getTemplateOnlyDataURL,
  };
})();
