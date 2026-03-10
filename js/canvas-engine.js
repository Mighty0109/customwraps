/* ============================================================
   canvas-engine.js - Canvas Compositing & Export Engine
   ============================================================ */

'use strict';

const CanvasEngine = (function () {
  let displayCanvas = null;
  let displayCtx = null;
  let offscreen = null;
  let offCtx = null;

  let templateImage = null;
  let userImage = null;
  let internalSize = 1024;
  let internalWidth = 1024;
  let internalHeight = 1024;

  // Transform state
  let state = {
    scale: 1.0,
    rotation: 0,
    opacity: 1.0,
    fillMode: 'tile',  // tile | stretch | fit | center
    offsetX: 0,
    offsetY: 0,
  };

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

  // Checkerboard pattern cache
  let checkerPattern = null;

  function init(canvasEl) {
    displayCanvas = canvasEl;
    displayCtx = displayCanvas.getContext('2d');

    offscreen = document.createElement('canvas');
    offscreen.width = internalWidth;
    offscreen.height = internalHeight;
    offCtx = offscreen.getContext('2d');

    createCheckerboard();
    setupTouchEvents();
    render();

    // Re-render on resize
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

  function setupTouchEvents() {
    if (!displayCanvas) return;

    displayCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
    displayCanvas.addEventListener('touchmove', onTouchMove, { passive: false });
    displayCanvas.addEventListener('touchend', onTouchEnd, { passive: false });
    displayCanvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    // Mouse drag support
    let mouseDown = false;
    let mouseStartX = 0, mouseStartY = 0;
    let mouseStartOffX = 0, mouseStartOffY = 0;

    displayCanvas.addEventListener('mousedown', (e) => {
      if (!userImage) return;
      mouseDown = true;
      const rect = displayCanvas.getBoundingClientRect();
      const ratioX = internalWidth / rect.width;
      const ratioY = internalHeight / rect.height;
      mouseStartX = e.clientX * ratioX;
      mouseStartY = e.clientY * ratioY;
      mouseStartOffX = state.offsetX;
      mouseStartOffY = state.offsetY;
      displayCanvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!mouseDown) return;
      const rect = displayCanvas.getBoundingClientRect();
      const ratioX = internalWidth / rect.width;
      const ratioY = internalHeight / rect.height;
      const dx = e.clientX * ratioX - mouseStartX;
      const dy = e.clientY * ratioY - mouseStartY;
      state.offsetX = Math.round(mouseStartOffX + dx);
      state.offsetY = Math.round(mouseStartOffY + dy);
      clampOffsets();
      render();
      syncUIFromState();
    });

    window.addEventListener('mouseup', () => {
      if (mouseDown) {
        mouseDown = false;
        if (displayCanvas) displayCanvas.style.cursor = 'grab';
      }
    });

    // Mouse wheel zoom
    displayCanvas.addEventListener('wheel', (e) => {
      if (!userImage) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      state.scale = Math.min(5, Math.max(0.1, state.scale + delta));
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
    if (!userImage) return;
    e.preventDefault();

    const touches = e.touches;
    if (touches.length === 1) {
      const rect = displayCanvas.getBoundingClientRect();
      const ratioX = internalWidth / rect.width;
      const ratioY = internalHeight / rect.height;
      gestureState.panStartX = touches[0].clientX * ratioX;
      gestureState.panStartY = touches[0].clientY * ratioY;
      gestureState.startOffsetX = state.offsetX;
      gestureState.startOffsetY = state.offsetY;
      gestureState.lastTouchCount = 1;
    } else if (touches.length === 2) {
      gestureState.active = true;
      gestureState.startDist = getTouchDist(touches[0], touches[1]);
      gestureState.startAngle = getTouchAngle(touches[0], touches[1]);
      gestureState.startScale = state.scale;
      gestureState.startRotation = state.rotation;
      gestureState.lastTouchCount = 2;
    }
  }

  function onTouchMove(e) {
    if (!userImage) return;
    e.preventDefault();

    const touches = e.touches;
    if (touches.length === 1 && gestureState.lastTouchCount === 1) {
      // Pan
      const rect = displayCanvas.getBoundingClientRect();
      const ratioX = internalWidth / rect.width;
      const ratioY = internalHeight / rect.height;
      const dx = touches[0].clientX * ratioX - gestureState.panStartX;
      const dy = touches[0].clientY * ratioY - gestureState.panStartY;
      state.offsetX = Math.round(gestureState.startOffsetX + dx);
      state.offsetY = Math.round(gestureState.startOffsetY + dy);
      clampOffsets();
      render();
      syncUIFromState();
    } else if (touches.length === 2 && gestureState.active) {
      // Pinch zoom + rotation
      const dist = getTouchDist(touches[0], touches[1]);
      const angle = getTouchAngle(touches[0], touches[1]);
      const scaleRatio = dist / gestureState.startDist;
      state.scale = Math.min(5, Math.max(0.1, gestureState.startScale * scaleRatio));
      const angleDelta = angle - gestureState.startAngle;
      state.rotation = (gestureState.startRotation + angleDelta) % 360;
      if (state.rotation < 0) state.rotation += 360;
      render();
      syncUIFromState();
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length === 0) {
      gestureState.active = false;
      gestureState.lastTouchCount = 0;
    } else if (e.touches.length === 1) {
      // Transition from pinch to pan
      const rect = displayCanvas.getBoundingClientRect();
      const ratioX = internalWidth / rect.width;
      const ratioY = internalHeight / rect.height;
      gestureState.panStartX = e.touches[0].clientX * ratioX;
      gestureState.panStartY = e.touches[0].clientY * ratioY;
      gestureState.startOffsetX = state.offsetX;
      gestureState.startOffsetY = state.offsetY;
      gestureState.active = false;
      gestureState.lastTouchCount = 1;
    }
  }

  function clampOffsets() {
    state.offsetX = Math.max(-internalSize, Math.min(internalSize, state.offsetX));
    state.offsetY = Math.max(-internalSize, Math.min(internalSize, state.offsetY));
  }

  function syncUIFromState() {
    if (typeof App !== 'undefined' && App.syncControlsFromEngine) {
      App.syncControlsFromEngine(state);
    }
  }

  let currentModelRef = null;

  function setTemplate(model) {
    currentModelRef = model;
    // Load real template PNG
    const src = getTemplatePath(model);
    loadImage(src).then(img => {
      templateImage = img;
      // Update internal dimensions to match actual template size
      internalWidth = img.naturalWidth || img.width;
      internalHeight = img.naturalHeight || img.height;
      internalSize = Math.max(internalWidth, internalHeight);
      offscreen.width = internalWidth;
      offscreen.height = internalHeight;
      offCtx = offscreen.getContext('2d');
      render();
    }).catch(() => {
      // Fallback to placeholder
      console.warn('Real template not found, using placeholder');
      internalWidth = 1024;
      internalHeight = 1024;
      internalSize = 1024;
      offscreen.width = internalWidth;
      offscreen.height = internalHeight;
      offCtx = offscreen.getContext('2d');
      templateImage = generatePlaceholderTemplate(model, internalSize);
      render();
    });
  }

  function setUserImage(img) {
    userImage = img;
    if (img) {
      autoPlace(img);
    }
    render();
  }

  /**
   * Auto-placement: analyze image and set initial transform.
   */
  function autoPlace(img) {
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    const ratio = imgW / imgH;

    if (ratio > 3 || ratio < 0.33) {
      // Very wide or tall -> tile mode
      state.fillMode = 'tile';
      state.scale = Math.min(2, internalSize / Math.max(imgW, imgH));
    } else if (imgW < internalSize * 0.3 && imgH < internalSize * 0.3) {
      // Small image -> tile
      state.fillMode = 'tile';
      state.scale = 1.0;
    } else {
      // Normal image -> fit to canvas
      state.fillMode = 'fit';
      state.scale = 1.0;
    }

    state.rotation = 0;
    state.opacity = 1.0;
    state.offsetX = 0;
    state.offsetY = 0;

    // Analyze average brightness to adjust opacity
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

    // Very dark images might need slightly higher opacity
    if (avgBright < 50) {
      state.opacity = 1.0;
    } else if (avgBright > 200) {
      state.opacity = 0.85;
    } else {
      state.opacity = 0.95;
    }

    syncUIFromState();
  }

  function updateState(newState) {
    Object.assign(state, newState);
    clampOffsets();
    render();
  }

  function getState() {
    return { ...state };
  }

  function resetState() {
    state = {
      scale: 1.0,
      rotation: 0,
      opacity: 1.0,
      fillMode: 'tile',
      offsetX: 0,
      offsetY: 0,
    };
    if (userImage) {
      autoPlace(userImage);
    }
    render();
    syncUIFromState();
  }

  function render() {
    if (!displayCanvas || !displayCtx) return;

    // Resize display canvas to match container, preserving template aspect ratio
    const container = displayCanvas.parentElement;
    if (container) {
      const containerW = container.clientWidth;
      const containerH = container.clientHeight || containerW;
      const dpr = window.devicePixelRatio || 1;
      const aspectRatio = internalWidth / internalHeight;

      let cssW, cssH;
      if (aspectRatio >= 1) {
        // Wider than tall
        cssW = Math.min(containerW, containerH * aspectRatio);
        cssH = cssW / aspectRatio;
      } else {
        // Taller than wide
        cssH = Math.min(containerH, containerW / aspectRatio);
        cssW = cssH * aspectRatio;
      }

      // Ensure it fits in container
      if (cssW > containerW) {
        cssW = containerW;
        cssH = cssW / aspectRatio;
      }
      if (cssH > containerH) {
        cssH = containerH;
        cssW = cssH * aspectRatio;
      }

      displayCanvas.style.width = Math.round(cssW) + 'px';
      displayCanvas.style.height = Math.round(cssH) + 'px';
      displayCanvas.width = Math.round(cssW * dpr);
      displayCanvas.height = Math.round(cssH * dpr);
      displayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const cssW = parseInt(displayCanvas.style.width) || displayCanvas.width;
    const cssH = parseInt(displayCanvas.style.height) || displayCanvas.height;

    // Draw checkerboard
    displayCtx.save();
    displayCtx.fillStyle = checkerPattern || '#222';
    displayCtx.fillRect(0, 0, cssW, cssH);
    displayCtx.restore();

    // Render offscreen at internal resolution
    renderOffscreen();

    // Draw offscreen to display canvas (maintaining aspect ratio)
    displayCtx.drawImage(offscreen, 0, 0, cssW, cssH);
  }

  function renderOffscreen() {
    const w = internalWidth;
    const h = internalHeight;
    offCtx.clearRect(0, 0, w, h);

    // 1. White base (so multiply works correctly)
    offCtx.fillStyle = '#FFFFFF';
    offCtx.fillRect(0, 0, w, h);

    // 2. Draw user image
    if (userImage) {
      offCtx.save();
      offCtx.globalAlpha = state.opacity;
      drawUserImage(offCtx, w, h);
      offCtx.restore();
    }

    // 3. Multiply blend template on top
    if (templateImage) {
      offCtx.save();
      offCtx.globalAlpha = 1;
      offCtx.globalCompositeOperation = 'multiply';
      offCtx.drawImage(templateImage, 0, 0, w, h);
      offCtx.globalCompositeOperation = 'source-over';
      offCtx.restore();
    }
  }

  function drawUserImage(ctx, canvasW, canvasH) {
    const img = userImage;
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    const cx = canvasW / 2;
    const cy = canvasH / 2;

    switch (state.fillMode) {
      case 'tile': {
        ctx.save();
        const pattern = ctx.createPattern(img, 'repeat');
        if (pattern) {
          const matrix = new DOMMatrix();
          matrix.translateSelf(cx + state.offsetX, cy + state.offsetY);
          matrix.rotateSelf(state.rotation);
          matrix.scaleSelf(state.scale, state.scale);
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
        ctx.translate(cx + state.offsetX, cy + state.offsetY);
        ctx.rotate(state.rotation * Math.PI / 180);
        ctx.scale(state.scale, state.scale);
        ctx.drawImage(img, -canvasW / 2, -canvasH / 2, canvasW, canvasH);
        ctx.restore();
        break;
      }

      case 'fit': {
        const fitScale = Math.min(canvasW / imgW, canvasH / imgH) * state.scale;
        const drawW = imgW * fitScale;
        const drawH = imgH * fitScale;
        ctx.save();
        ctx.translate(cx + state.offsetX, cy + state.offsetY);
        ctx.rotate(state.rotation * Math.PI / 180);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
        break;
      }

      case 'center': {
        const cs = state.scale;
        const drawW2 = imgW * cs;
        const drawH2 = imgH * cs;
        ctx.save();
        ctx.translate(cx + state.offsetX, cy + state.offsetY);
        ctx.rotate(state.rotation * Math.PI / 180);
        ctx.drawImage(img, -drawW2 / 2, -drawH2 / 2, drawW2, drawH2);
        ctx.restore();
        break;
      }
    }
  }

  /**
   * Export the composited image as a PNG blob.
   */
  async function exportPNG(resolution, filename) {
    // Scale export dimensions proportionally to template aspect ratio
    const aspectRatio = internalWidth / internalHeight;
    const exportW = resolution;
    const exportH = Math.round(resolution / aspectRatio);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    const ectx = exportCanvas.getContext('2d');

    // Render at export resolution
    const origW = internalWidth;
    const origH = internalHeight;
    const origSize = internalSize;
    const origOff = offscreen;
    const origCtx = offCtx;

    const tempOff = document.createElement('canvas');
    tempOff.width = exportW;
    tempOff.height = exportH;
    const tempCtx = tempOff.getContext('2d');

    internalWidth = exportW;
    internalHeight = exportH;
    internalSize = Math.max(exportW, exportH);
    offscreen = tempOff;
    offCtx = tempCtx;

    renderOffscreen();

    ectx.drawImage(tempOff, 0, 0);

    // Restore
    internalWidth = origW;
    internalHeight = origH;
    internalSize = origSize;
    offscreen = origOff;
    offCtx = origCtx;

    // Convert to blob
    return new Promise((resolve) => {
      exportCanvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }

  /**
   * Render a preview at a given size and return a data URL.
   */
  function getPreviewDataURL(previewSize) {
    const aspectRatio = internalWidth / internalHeight;
    const pw = previewSize;
    const ph = Math.round(previewSize / aspectRatio);
    const c = document.createElement('canvas');
    c.width = pw;
    c.height = ph;
    const ctx2 = c.getContext('2d');
    ctx2.drawImage(offscreen, 0, 0, pw, ph);
    return c.toDataURL('image/png');
  }

  /**
   * Get template-only render for Before/After.
   */
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
    if (templateImage) {
      ctx2.drawImage(templateImage, 0, 0, pw, ph);
    }
    return c.toDataURL('image/png');
  }

  function hasUserImage() {
    return !!userImage;
  }

  function clearUserImage() {
    userImage = null;
    resetState();
    render();
  }

  return {
    init,
    setTemplate,
    setUserImage,
    updateState,
    getState,
    resetState,
    render,
    exportPNG,
    getPreviewDataURL,
    getTemplateOnlyDataURL,
    hasUserImage,
    clearUserImage,
  };
})();
