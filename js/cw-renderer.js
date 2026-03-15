/* ============================================================
   cw-renderer.js - Canvas Rendering Pipeline
   ============================================================ */

'use strict';

CW.Renderer = (function () {
  var tempLayerCanvas = null;
  var tempLayerCtx = null;
  var combinedMaskCanvas = null;
  var combinedMaskCtx = null;

  // rAF render throttling - batch all render requests to max 1 per frame
  var renderPending = false;

  function requestRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(function () {
      renderPending = false;
      render();
    });
  }

  // Panel mask cache - avoid regenerating combined masks every frame
  var combinedMaskCache = {};

  function init(canvasEl) {
    var s = CW.state;
    s.displayCanvas = canvasEl;
    s.displayCtx = canvasEl.getContext('2d');

    s.offscreen = document.createElement('canvas');
    s.offscreen.width = s.internalWidth;
    s.offscreen.height = s.internalHeight;
    s.offCtx = s.offscreen.getContext('2d');

    s.userLayerCanvas = document.createElement('canvas');
    s.userLayerCanvas.width = s.internalWidth;
    s.userLayerCanvas.height = s.internalHeight;
    s.userLayerCtx = s.userLayerCanvas.getContext('2d');

    createCheckerboard();

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { render(); }, 100);
    });
  }

  function createCheckerboard() {
    var cSize = 16;
    var c = document.createElement('canvas');
    c.width = cSize * 2;
    c.height = cSize * 2;
    var cx = c.getContext('2d');
    cx.fillStyle = '#2A2A2A';
    cx.fillRect(0, 0, cSize * 2, cSize * 2);
    cx.fillStyle = '#222222';
    cx.fillRect(0, 0, cSize, cSize);
    cx.fillRect(cSize, cSize, cSize, cSize);
    CW.state.checkerPattern = CW.state.displayCtx.createPattern(c, 'repeat');
  }

  function resizeInternalCanvases() {
    var s = CW.state;
    s.offscreen.width = s.internalWidth;
    s.offscreen.height = s.internalHeight;
    s.offCtx = s.offscreen.getContext('2d');
    s.userLayerCanvas.width = s.internalWidth;
    s.userLayerCanvas.height = s.internalHeight;
    s.userLayerCtx = s.userLayerCanvas.getContext('2d');
  }

  function setTemplate(model) {
    CW.state.currentModel = model;
    var src = getTemplatePath(model);
    return loadImage(src).then(function (img) {
      CW.state.templateImage = img;
      CW.state.internalWidth = img.naturalWidth || img.width;
      CW.state.internalHeight = img.naturalHeight || img.height;
      CW.state.internalSize = Math.max(CW.state.internalWidth, CW.state.internalHeight);
      resizeInternalCanvases();
      CW.PanelDetector.generateGlobalMask();
      CW.PanelDetector.detect();
      render();
    }).catch(function () {
      console.warn('Real template not found, using placeholder');
      CW.state.internalWidth = 1024;
      CW.state.internalHeight = 1024;
      CW.state.internalSize = 1024;
      resizeInternalCanvases();
      CW.state.templateImage = generatePlaceholderTemplate(model, 1024);
      CW.PanelDetector.generateGlobalMask();
      CW.PanelDetector.detect();
      render();
    });
  }

  function render() {
    var s = CW.state;
    if (!s.displayCanvas || !s.displayCtx) return;

    var container = s.displayCanvas.parentElement;
    if (container) {
      var canvasArea = container.closest('.canvas-area');
      var isFullWidth = canvasArea && canvasArea.classList.contains('full-width-mode');
      var containerW = isFullWidth ? (canvasArea.clientWidth || container.clientWidth) : container.clientWidth;
      var containerH = container.clientHeight || containerW;
      var dpr = window.devicePixelRatio || 1;
      var aspectRatio = s.internalWidth / s.internalHeight;

      var cssW, cssH;
      if (isFullWidth) {
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

      s.displayCanvas.style.width = Math.round(cssW) + 'px';
      s.displayCanvas.style.height = Math.round(cssH) + 'px';
      s.displayCanvas.width = Math.round(cssW * dpr);
      s.displayCanvas.height = Math.round(cssH * dpr);
      s.displayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    var cssW2 = parseInt(s.displayCanvas.style.width) || s.displayCanvas.width;
    var cssH2 = parseInt(s.displayCanvas.style.height) || s.displayCanvas.height;

    s.displayCtx.save();
    s.displayCtx.fillStyle = s.checkerPattern || '#222';
    s.displayCtx.fillRect(0, 0, cssW2, cssH2);
    s.displayCtx.restore();

    renderOffscreen();
    s.displayCtx.drawImage(s.offscreen, 0, 0, cssW2, cssH2);

    if (CW.PanelDetector.getShowNumbers()) {
      CW.PanelDetector.drawNumbers(s.displayCtx, cssW2, cssH2);
    }

    // Sync sidebar height in split mode
    var canvasArea2 = s.displayCanvas.closest('.canvas-area');
    if (canvasArea2 && canvasArea2.classList.contains('split-mode')) {
      var sidebar = canvasArea2.querySelector('.layer-sidebar');
      if (sidebar) {
        sidebar.style.maxHeight = s.displayCanvas.style.height;
      }
    }
  }

  function renderOffscreen() {
    var s = CW.state;
    var w = s.internalWidth;
    var h = s.internalHeight;
    var panelMasks = CW.PanelDetector.getMasks();
    var panelColors = CW.PanelDetector.getColorsRaw();

    s.offCtx.clearRect(0, 0, w, h);
    s.offCtx.fillStyle = '#FFFFFF';
    s.offCtx.fillRect(0, 0, w, h);

    // Panel background colors
    if (panelColors.length > 0 && panelMasks.length > 0) {
      ensureTempCanvas(w, h);
      for (var i = 0; i < panelColors.length; i++) {
        if (!panelColors[i] || !panelMasks[i]) continue;
        tempLayerCtx.clearRect(0, 0, w, h);
        tempLayerCtx.fillStyle = panelColors[i];
        tempLayerCtx.fillRect(0, 0, w, h);
        tempLayerCtx.save();
        tempLayerCtx.globalCompositeOperation = 'destination-in';
        tempLayerCtx.drawImage(panelMasks[i], 0, 0);
        tempLayerCtx.restore();
        s.offCtx.drawImage(tempLayerCanvas, 0, 0);
      }
    }

    // Layers
    var layers = CW.LayerStore.getAll();
    var visibleLayers = layers.filter(function (l) { return l.visible; });
    if (visibleLayers.length > 0) {
      if (s.userLayerCanvas.width !== w || s.userLayerCanvas.height !== h) {
        s.userLayerCanvas.width = w;
        s.userLayerCanvas.height = h;
        s.userLayerCtx = s.userLayerCanvas.getContext('2d');
      }
      s.userLayerCtx.clearRect(0, 0, w, h);

      ensureTempCanvas(w, h);

      for (var li = 0; li < visibleLayers.length; li++) {
        var layer = visibleLayers[li];
        var usePanelMask = layer.selectedPanels && layer.selectedPanels.length > 0 && panelMasks.length > 0;

        if (usePanelMask) {
          var mask = getCombinedMask(layer.selectedPanels, panelMasks, w, h);

          tempLayerCtx.clearRect(0, 0, w, h);
          tempLayerCtx.save();
          tempLayerCtx.globalAlpha = layer.opacity;
          if (layer.image) drawLayerImage(tempLayerCtx, w, h, layer);
          tempLayerCtx.restore();

          tempLayerCtx.save();
          tempLayerCtx.globalCompositeOperation = 'destination-in';
          tempLayerCtx.drawImage(mask, 0, 0);
          tempLayerCtx.restore();

          s.userLayerCtx.drawImage(tempLayerCanvas, 0, 0);
        } else {
          s.userLayerCtx.save();
          s.userLayerCtx.globalAlpha = layer.opacity;
          if (layer.image) drawLayerImage(s.userLayerCtx, w, h, layer);
          s.userLayerCtx.restore();
        }
      }

      if (s.maskCanvas) {
        s.userLayerCtx.save();
        s.userLayerCtx.globalCompositeOperation = 'destination-in';
        s.userLayerCtx.drawImage(s.maskCanvas, 0, 0, w, h);
        s.userLayerCtx.restore();
      }

      s.offCtx.drawImage(s.userLayerCanvas, 0, 0);
    }

    if (s.templateImage) {
      s.offCtx.save();
      s.offCtx.globalCompositeOperation = 'multiply';
      s.offCtx.drawImage(s.templateImage, 0, 0, w, h);
      s.offCtx.restore();
    }
  }

  function ensureTempCanvas(w, h) {
    if (!tempLayerCanvas || tempLayerCanvas.width !== w || tempLayerCanvas.height !== h) {
      tempLayerCanvas = document.createElement('canvas');
      tempLayerCanvas.width = w;
      tempLayerCanvas.height = h;
      tempLayerCtx = tempLayerCanvas.getContext('2d');
    }
  }

  function getCombinedMask(selectedPanels, panelMasks, w, h) {
    var key = selectedPanels.join(',');
    if (combinedMaskCache[key]) return combinedMaskCache[key];
    var mc = document.createElement('canvas');
    mc.width = w; mc.height = h;
    var ctx = mc.getContext('2d');
    for (var i = 0; i < selectedPanels.length; i++) {
      if (panelMasks[selectedPanels[i]]) ctx.drawImage(panelMasks[selectedPanels[i]], 0, 0);
    }
    combinedMaskCache[key] = mc;
    return mc;
  }

  function drawLayerImage(ctx, canvasW, canvasH, layer) {
    var img = layer.image;
    var imgW = img.naturalWidth || img.width;
    var imgH = img.naturalHeight || img.height;
    var cx = canvasW / 2;
    var cy = canvasH / 2;

    switch (layer.fillMode) {
      case 'tile': {
        ctx.save();
        var pattern = ctx.createPattern(img, 'repeat');
        if (pattern) {
          var matrix = new DOMMatrix();
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
        var fitScale = Math.min(canvasW / imgW, canvasH / imgH) * layer.scale;
        var drawW = imgW * fitScale;
        var drawH = imgH * fitScale;
        ctx.save();
        ctx.translate(cx + layer.offsetX, cy + layer.offsetY);
        ctx.rotate(layer.rotation * Math.PI / 180);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
        break;
      }
      case 'center': {
        var dW = imgW * layer.scale;
        var dH = imgH * layer.scale;
        ctx.save();
        ctx.translate(cx + layer.offsetX, cy + layer.offsetY);
        ctx.rotate(layer.rotation * Math.PI / 180);
        ctx.drawImage(img, -dW / 2, -dH / 2, dW, dH);
        ctx.restore();
        break;
      }
    }
  }

  // Listen for events that require re-render (batched via rAF)
  CW.on('layer:added', function () { requestRender(); });
  CW.on('layer:removed', function () { requestRender(); });
  CW.on('layer:updated', function () { requestRender(); });
  CW.on('layer:moved', function () { requestRender(); });
  CW.on('layer:cleared', function () { requestRender(); });
  CW.on('layer:imageUpdated', function () { requestRender(); });
  CW.on('panels:colorChanged', function () { requestRender(); });
  CW.on('render:request', function () { requestRender(); });
  CW.on('panels:detected', function () { combinedMaskCache = {}; });

  return {
    init: init,
    setTemplate: setTemplate,
    render: render,
    requestRender: requestRender,
    renderOffscreen: renderOffscreen,
    drawLayerImage: drawLayerImage,
  };
})();
