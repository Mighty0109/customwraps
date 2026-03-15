/* ============================================================
   cw-panel-detector.js - Panel Auto-Detection & Color Picker
   ============================================================ */

'use strict';

CW.PanelDetector = (function () {
  var panelMasks = [];
  var panelCentroids = [];
  var panelColors = [];
  var colorPickerEl = null;
  var showNumbers = false;

  function detect() {
    panelMasks = [];
    panelCentroids = [];
    panelColors = [];

    var templateImage = CW.state.templateImage;
    if (!templateImage) return;

    var w = CW.state.internalWidth;
    var h = CW.state.internalHeight;

    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    var tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(templateImage, 0, 0, w, h);
    var imageData = tempCtx.getImageData(0, 0, w, h);
    var data = imageData.data;

    var bright = new Float32Array(w * h);
    for (var i = 0; i < w * h; i++) {
      var idx = i * 4;
      bright[i] = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    }

    var THRESHOLD = 245;
    var MIN_REGION_PIXELS = 500;

    // Build connectivity mask from brightness threshold
    var conn = new Uint8Array(w * h);
    for (var ci2 = 0; ci2 < w * h; ci2++) {
      conn[ci2] = bright[ci2] >= THRESHOLD ? 1 : 0;
    }

    // Cybertruck: dilate bright mask by 1px to bridge boundaries ≤ 2px
    var isCybertruck = CW.state.currentModel && CW.state.currentModel.id === 'cybertruck';
    if (isCybertruck) {
      var dilated = new Uint8Array(w * h);
      for (var dy = 0; dy < h; dy++) {
        for (var dx = 0; dx < w; dx++) {
          var di = dy * w + dx;
          if (conn[di]) { dilated[di] = 1; continue; }
          if ((dy > 0     && conn[di - w]) ||
              (dy < h - 1 && conn[di + w]) ||
              (dx > 0     && conn[di - 1]) ||
              (dx < w - 1 && conn[di + 1])) {
            dilated[di] = 1;
          }
        }
      }
      conn = dilated;
    }

    var labels = new Int32Array(w * h);
    var nextLabel = 1;
    var regions = [];

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var pidx = y * w + x;
        if (conn[pidx] && labels[pidx] === 0) {
          var label = nextLabel++;
          var count = 0, sumX = 0, sumY = 0;
          var queue = [pidx];
          labels[pidx] = label;
          var head = 0;

          while (head < queue.length) {
            var ci = queue[head++];
            var cx = ci % w;
            var cy = (ci - cx) / w;
            count++;
            sumX += cx;
            sumY += cy;

            if (cy > 0     && labels[ci - w] === 0 && conn[ci - w]) { labels[ci - w] = label; queue.push(ci - w); }
            if (cy < h - 1 && labels[ci + w] === 0 && conn[ci + w]) { labels[ci + w] = label; queue.push(ci + w); }
            if (cx > 0     && labels[ci - 1] === 0 && conn[ci - 1]) { labels[ci - 1] = label; queue.push(ci - 1); }
            if (cx < w - 1 && labels[ci + 1] === 0 && conn[ci + 1]) { labels[ci + 1] = label; queue.push(ci + 1); }
          }

          if (count >= MIN_REGION_PIXELS) {
            regions.push({ label: label, count: count, sumX: sumX, sumY: sumY });
          }
        }
      }
    }

    var ROW_HEIGHT = h * 0.08;
    regions.sort(function (a, b) {
      var ay = a.sumY / a.count;
      var by = b.sumY / b.count;
      var aRow = Math.floor(ay / ROW_HEIGHT);
      var bRow = Math.floor(by / ROW_HEIGHT);
      if (aRow !== bRow) return aRow - bRow;
      return (a.sumX / a.count) - (b.sumX / b.count);
    });

    for (var ri = 0; ri < regions.length; ri++) {
      var region = regions[ri];
      panelCentroids.push({
        x: (region.sumX / region.count) / w,
        y: (region.sumY / region.count) / h,
      });

      var mc = document.createElement('canvas');
      mc.width = w;
      mc.height = h;
      var mCtx = mc.getContext('2d');
      var maskData = mCtx.createImageData(w, h);
      var md = maskData.data;

      for (var mi = 0; mi < w * h; mi++) {
        var mdi = mi * 4;
        md[mdi] = 255;
        md[mdi + 1] = 255;
        md[mdi + 2] = 255;
        if (labels[mi] === region.label) {
          // Dilated boundary pixels (originally dark) get full alpha
          md[mdi + 3] = bright[mi] >= THRESHOLD ? Math.round(bright[mi]) : 255;
        } else {
          md[mdi + 3] = 0;
        }
      }

      mCtx.putImageData(maskData, 0, 0);
      panelMasks.push(mc);
    }

    CW.emit('panels:detected');
  }

  function generateGlobalMask() {
    var templateImage = CW.state.templateImage;
    if (!templateImage) return;
    var w = CW.state.internalWidth;
    var h = CW.state.internalHeight;

    var maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    var mCtx = maskCanvas.getContext('2d');
    mCtx.drawImage(templateImage, 0, 0, w, h);
    var imageData = mCtx.getImageData(0, 0, w, h);
    var d = imageData.data;
    for (var i = 0; i < d.length; i += 4) {
      var brightness = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = Math.round(brightness);
    }
    mCtx.putImageData(imageData, 0, 0);
    CW.state.maskCanvas = maskCanvas;
  }

  // Hit testing
  function hitTest(clientX, clientY) {
    var canvas = CW.state.displayCanvas;
    if (!showNumbers || !panelCentroids.length || !canvas) return -1;
    var rect = canvas.getBoundingClientRect();
    var cssW = parseInt(canvas.style.width) || rect.width;
    var cssH = parseInt(canvas.style.height) || rect.height;
    var x = clientX - rect.left;
    var y = clientY - rect.top;
    var hitR = 15;
    for (var i = 0; i < panelCentroids.length; i++) {
      var cx = panelCentroids[i].x * cssW;
      var cy = panelCentroids[i].y * cssH;
      var dx = x - cx;
      var dy = y - cy;
      if (dx * dx + dy * dy <= hitR * hitR) return i;
    }
    return -1;
  }

  // Color picker setup
  function setupColorPicker(canvasEl) {
    colorPickerEl = document.createElement('input');
    colorPickerEl.type = 'color';
    colorPickerEl.style.cssText = 'position:fixed;top:-100px;left:0;width:1px;height:1px;opacity:0.01;';
    document.body.appendChild(colorPickerEl);

    var pickerPanelIdx = -1;

    colorPickerEl.addEventListener('input', function () {
      if (pickerPanelIdx >= 0) {
        panelColors[pickerPanelIdx] = colorPickerEl.value;
        CW.emit('panels:colorChanged');
      }
    });

    var pointerStartX = 0, pointerStartY = 0;

    canvasEl.addEventListener('pointerdown', function (e) {
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
    });

    canvasEl.addEventListener('pointerup', function (e) {
      var dx = e.clientX - pointerStartX;
      var dy = e.clientY - pointerStartY;
      if (dx * dx + dy * dy > 100) return;

      var idx = hitTest(e.clientX, e.clientY);
      if (idx >= 0) {
        e.stopPropagation();
        pickerPanelIdx = idx;
        colorPickerEl.value = panelColors[idx] || '#3478f6';
        colorPickerEl.style.top = e.clientY + 'px';
        colorPickerEl.style.left = e.clientX + 'px';
        colorPickerEl.focus();
        colorPickerEl.click();
      }
    });
  }

  function drawNumbers(ctx, w, h) {
    if (!panelCentroids.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < panelCentroids.length; i++) {
      var centroid = panelCentroids[i];
      var cx = centroid.x * w;
      var cy = centroid.y * h;
      var fontSize = 9;
      ctx.font = 'bold ' + fontSize + 'px system-ui, sans-serif';
      var r = fontSize * 0.75;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(i + 1, cx, cy);
    }
    ctx.restore();
  }

  function setColor(idx, color) {
    if (idx >= 0 && idx < panelMasks.length) {
      panelColors[idx] = color;
      CW.emit('panels:colorChanged');
    }
  }

  function clearColors() {
    panelColors = [];
    CW.emit('panels:colorChanged');
  }

  function setShowNumbers(v) {
    showNumbers = v;
    CW.emit('render:request');
  }

  return {
    detect: detect,
    generateGlobalMask: generateGlobalMask,
    setupColorPicker: setupColorPicker,
    drawNumbers: drawNumbers,
    getMasks: function () { return panelMasks; },
    getCentroids: function () { return panelCentroids; },
    getColors: function () { return panelColors.slice(); },
    getColorsRaw: function () { return panelColors; },
    getCount: function () { return panelMasks.length; },
    getShowNumbers: function () { return showNumbers; },
    setShowNumbers: setShowNumbers,
    setColor: setColor,
    clearColors: clearColors,
    hitTest: hitTest,
  };
})();
