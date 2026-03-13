/* ============================================================
   cw-canvas-input.js - Canvas Pointer & Gesture Handling
   ============================================================ */

'use strict';

CW.CanvasInput = (function () {
  var gestureState = {
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

  function init(canvasEl) {
    CW.PanelDetector.setupColorPicker(canvasEl);

    canvasEl.addEventListener('touchstart', onTouchStart, { passive: false });
    canvasEl.addEventListener('touchmove', onTouchMove, { passive: false });
    canvasEl.addEventListener('touchend', onTouchEnd, { passive: false });
    canvasEl.addEventListener('touchcancel', onTouchEnd, { passive: false });

    var mouseDown = false;
    var mouseStartX = 0, mouseStartY = 0;
    var mouseStartOffX = 0, mouseStartOffY = 0;

    canvasEl.addEventListener('mousedown', function (e) {
      var layer = CW.LayerStore.getSelected();
      if (!layer) return;
      mouseDown = true;
      var rect = canvasEl.getBoundingClientRect();
      mouseStartX = (e.clientX - rect.left) * (CW.state.internalWidth / rect.width);
      mouseStartY = (e.clientY - rect.top) * (CW.state.internalHeight / rect.height);
      mouseStartOffX = layer.offsetX;
      mouseStartOffY = layer.offsetY;
      canvasEl.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', function (e) {
      if (!mouseDown) return;
      var layer = CW.LayerStore.getSelected();
      if (!layer) return;
      var rect = canvasEl.getBoundingClientRect();
      var dx = (e.clientX - rect.left) * (CW.state.internalWidth / rect.width) - mouseStartX;
      var dy = (e.clientY - rect.top) * (CW.state.internalHeight / rect.height) - mouseStartY;
      layer.offsetX = Math.round(mouseStartOffX + dx);
      layer.offsetY = Math.round(mouseStartOffY + dy);
      CW.LayerStore.clampOffsets(layer);
      CW.emit('render:request');
      CW.emit('input:layerMoved', layer);
    });

    window.addEventListener('mouseup', function () {
      if (mouseDown) {
        mouseDown = false;
        if (canvasEl) canvasEl.style.cursor = 'grab';
      }
    });

    canvasEl.addEventListener('wheel', function (e) {
      var layer = CW.LayerStore.getSelected();
      if (!layer) return;
      e.preventDefault();
      var delta = e.deltaY > 0 ? -0.05 : 0.05;
      layer.scale = Math.min(5, Math.max(0.1, layer.scale + delta));
      CW.emit('render:request');
      CW.emit('input:layerMoved', layer);
    }, { passive: false });
  }

  function getTouchDist(t1, t2) {
    var dx = t2.clientX - t1.clientX;
    var dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchAngle(t1, t2) {
    return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
  }

  function onTouchStart(e) {
    var layer = CW.LayerStore.getSelected();
    if (!layer) return;
    e.preventDefault();
    var canvas = CW.state.displayCanvas;
    var touches = e.touches;

    if (touches.length === 1) {
      var rect = canvas.getBoundingClientRect();
      gestureState.panStartX = (touches[0].clientX - rect.left) * (CW.state.internalWidth / rect.width);
      gestureState.panStartY = (touches[0].clientY - rect.top) * (CW.state.internalHeight / rect.height);
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
    var layer = CW.LayerStore.getSelected();
    if (!layer) return;
    e.preventDefault();
    var canvas = CW.state.displayCanvas;
    var touches = e.touches;

    if (touches.length === 1 && gestureState.lastTouchCount === 1) {
      var rect = canvas.getBoundingClientRect();
      var dx = (touches[0].clientX - rect.left) * (CW.state.internalWidth / rect.width) - gestureState.panStartX;
      var dy = (touches[0].clientY - rect.top) * (CW.state.internalHeight / rect.height) - gestureState.panStartY;
      layer.offsetX = Math.round(gestureState.startOffsetX + dx);
      layer.offsetY = Math.round(gestureState.startOffsetY + dy);
      CW.LayerStore.clampOffsets(layer);
      CW.emit('render:request');
      CW.emit('input:layerMoved', layer);
    } else if (touches.length === 2 && gestureState.active) {
      var dist = getTouchDist(touches[0], touches[1]);
      var angle = getTouchAngle(touches[0], touches[1]);
      layer.scale = Math.min(5, Math.max(0.1, gestureState.startScale * (dist / gestureState.startDist)));
      var angleDelta = angle - gestureState.startAngle;
      layer.rotation = (gestureState.startRotation + angleDelta) % 360;
      if (layer.rotation < 0) layer.rotation += 360;
      CW.emit('render:request');
      CW.emit('input:layerMoved', layer);
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length === 0) {
      gestureState.active = false;
      gestureState.lastTouchCount = 0;
    } else if (e.touches.length === 1) {
      var layer = CW.LayerStore.getSelected();
      if (!layer) return;
      var canvas = CW.state.displayCanvas;
      var rect = canvas.getBoundingClientRect();
      gestureState.panStartX = (e.touches[0].clientX - rect.left) * (CW.state.internalWidth / rect.width);
      gestureState.panStartY = (e.touches[0].clientY - rect.top) * (CW.state.internalHeight / rect.height);
      gestureState.startOffsetX = layer.offsetX;
      gestureState.startOffsetY = layer.offsetY;
      gestureState.active = false;
      gestureState.lastTouchCount = 1;
    }
  }

  return {
    init: init,
  };
})();
