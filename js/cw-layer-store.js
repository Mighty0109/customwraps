/* ============================================================
   cw-layer-store.js - Layer Data Management (no DOM dependency)
   ============================================================ */

'use strict';

CW.LayerStore = (function () {
  var layers = [];
  var selectedLayerId = null;
  var MAX_LAYERS = 20;

  function createDefaults() {
    return {
      visible: true,
      opacity: 1.0,
      blendMode: 'source-over',
      backgroundColor: null,
      selectedPanels: null,
      scale: 1.0,
      rotation: 0,
      fillMode: 'tile',
      offsetX: 0,
      offsetY: 0,
    };
  }

  function autoPlace(layer) {
    var img = layer.image;
    if (!img) return;
    var imgW = img.naturalWidth || img.width;
    var imgH = img.naturalHeight || img.height;
    var ratio = imgW / imgH;
    var size = CW.state.internalSize;

    if (ratio > 3 || ratio < 0.33) {
      layer.fillMode = 'tile';
      layer.scale = Math.min(2, size / Math.max(imgW, imgH));
    } else if (imgW < size * 0.3 && imgH < size * 0.3) {
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

    // Brightness analysis for auto opacity
    var sampleCanvas = document.createElement('canvas');
    var sampleSize = 64;
    sampleCanvas.width = sampleSize;
    sampleCanvas.height = sampleSize;
    var sCtx = sampleCanvas.getContext('2d');
    sCtx.drawImage(img, 0, 0, sampleSize, sampleSize);
    var data = sCtx.getImageData(0, 0, sampleSize, sampleSize).data;
    var totalBright = 0;
    var pixels = sampleSize * sampleSize;
    for (var i = 0; i < data.length; i += 4) {
      totalBright += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
    var avgBright = totalBright / pixels;
    if (avgBright < 50) {
      layer.opacity = 1.0;
    } else if (avgBright > 200) {
      layer.opacity = 0.85;
    } else {
      layer.opacity = 0.95;
    }
  }

  function clampOffsets(layer) {
    var size = CW.state.internalSize;
    layer.offsetX = Math.max(-size, Math.min(size, layer.offsetX));
    layer.offsetY = Math.max(-size, Math.min(size, layer.offsetY));
  }

  function add(img, id, name) {
    if (layers.length >= MAX_LAYERS) {
      UI.showToast('레이어는 최대 ' + MAX_LAYERS + '개까지 추가할 수 있습니다.');
      return null;
    }
    var layer = { id: id, image: img, name: name || 'Layer' };
    Object.assign(layer, createDefaults());
    autoPlace(layer);
    layers.push(layer);
    if (!selectedLayerId) selectedLayerId = id;
    CW.emit('layer:added', layer);
    return layer;
  }

  function remove(id) {
    layers = layers.filter(function (l) { return l.id !== id; });
    if (selectedLayerId === id) {
      selectedLayerId = layers.length > 0 ? layers[layers.length - 1].id : null;
    }
    CW.emit('layer:removed', { id: id });
  }

  function update(id, props) {
    var layer = layers.find(function (l) { return l.id === id; });
    if (!layer) return;
    Object.assign(layer, props);
    clampOffsets(layer);
    CW.emit('layer:updated', layer);
  }

  function updateImage(id, newImage) {
    var layer = layers.find(function (l) { return l.id === id; });
    if (layer) {
      layer.image = newImage;
      CW.emit('layer:imageUpdated', layer);
    }
  }

  function get(id) {
    return layers.find(function (l) { return l.id === id; }) || null;
  }

  function getAll() { return layers; }
  function getCount() { return layers.length; }
  function getMaxLayers() { return MAX_LAYERS; }

  function setSelected(id) {
    selectedLayerId = id;
    CW.emit('layer:selected', { id: id });
  }

  function getSelected() {
    if (!selectedLayerId) return null;
    return layers.find(function (l) { return l.id === selectedLayerId; }) || null;
  }

  function getSelectedId() { return selectedLayerId; }

  function move(id, direction) {
    var idx = layers.findIndex(function (l) { return l.id === id; });
    if (idx < 0) return;
    var targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= layers.length) return;
    var tmp = layers[idx];
    layers[idx] = layers[targetIdx];
    layers[targetIdx] = tmp;
    CW.emit('layer:moved');
  }

  function reset(id) {
    var layer = layers.find(function (l) { return l.id === id; });
    if (!layer) return;
    Object.assign(layer, createDefaults());
    if (layer.image) autoPlace(layer);
    CW.emit('layer:updated', layer);
    CW.emit('input:layerMoved', layer);
  }

  function clear() {
    layers = [];
    selectedLayerId = null;
    CW.emit('layer:cleared');
  }

  function hasLayers() { return layers.length > 0; }

  return {
    add: add,
    remove: remove,
    update: update,
    updateImage: updateImage,
    get: get,
    getAll: getAll,
    getCount: getCount,
    getMaxLayers: getMaxLayers,
    setSelected: setSelected,
    getSelected: getSelected,
    getSelectedId: getSelectedId,
    move: move,
    reset: reset,
    clear: clear,
    hasLayers: hasLayers,
    clampOffsets: clampOffsets,
  };
})();
