/* ============================================================
   app.js - Main App Orchestration, Routing, UI
   ============================================================ */

'use strict';

var App = (function () {
  var currentModel = null;
  var currentScreen = 'select';
  var currentTab = 'upload';

  var controlRefs = {};
  var layerListContainer = null;
  var uploadZoneContainer = null;
  var controlsContainer = null;

  function init() {
    renderModelSelection();
    setupEditorUI();
    setupExportButton();
    setupBeforeAfter();
    setupEventListeners();
    showScreen('select');
  }

  // ========================
  // Event Bus Listeners
  // ========================

  function setupEventListeners() {
    CW.on('input:layerMoved', function (layer) {
      syncControlsFromEngine(layer);
    });
  }

  // ========================
  // Screen Management
  // ========================

  function showScreen(screen) {
    currentScreen = screen;
    document.getElementById('screen-select').classList.toggle('hidden', screen !== 'select');
    document.getElementById('screen-editor').classList.toggle('hidden', screen !== 'editor');
    if (screen === 'editor') {
      setTimeout(function () { CW.Renderer.render(); }, 50);
    }
  }

  // ========================
  // Model Selection
  // ========================

  function renderModelSelection() {
    var grid = document.getElementById('model-grid');
    grid.innerHTML = '';
    TeslaModels.forEach(function (model) {
      var card = document.createElement('button');
      card.className = 'model-card';
      card.setAttribute('aria-label', model.name + (model.subtitle ? ' ' + model.subtitle : ''));
      var thumbUrl = getVehicleImagePath(model);
      var fallbackSvg = generateThumbnailSVG(model);
      card.innerHTML =
        '<div class="model-card-thumb">' +
          '<img src="' + thumbUrl + '" alt="' + model.name + '" loading="lazy"' +
          ' onerror="this.src=\'' + fallbackSvg + '\'">' +
          '<div class="model-card-info">' +
            '<div class="model-card-name">' + model.name + '</div>' +
            (model.subtitle ? '<div class="model-card-subtitle">' + model.subtitle + '</div>' : '') +
          '</div>' +
        '</div>';
      card.addEventListener('click', function () { selectModel(model); });
      grid.appendChild(card);
    });
  }

  function selectModel(model) {
    currentModel = model;
    document.getElementById('editor-model-name').textContent =
      model.name + (model.subtitle ? ' ' + model.subtitle : '');
    var canvasEl = document.getElementById('main-canvas');
    CW.Renderer.init(canvasEl);
    CW.CanvasInput.init(canvasEl);
    CW.Renderer.setTemplate(model);
    CW.LayerStore.clear();
    showTab('upload');
    showScreen('editor');
    refreshLayerList();
    refreshControls();
  }

  function getCurrentModel() {
    return currentModel;
  }

  // ========================
  // Editor Tabs
  // ========================

  function setupEditorUI() {
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { showTab(btn.dataset.tab); });
    });
    document.getElementById('btn-back').addEventListener('click', function () {
      CW.PanelDetector.setShowNumbers(false);
      showScreen('select');
    });

    layerListContainer = document.getElementById('layer-list-container');
    uploadZoneContainer = document.getElementById('upload-zone-container');
    controlsContainer = document.getElementById('controls-container');

    var zone = UI.createDropZone({ onFile: handleImageUpload, multiple: true });
    uploadZoneContainer.appendChild(zone);

    buildTextInput(uploadZoneContainer);
    buildControls();
  }

  function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(function (panel) {
      panel.classList.toggle('hidden', panel.dataset.tab !== tab);
    });

    var canvasArea = document.querySelector('.canvas-area');
    var layerSidebar = document.getElementById('layer-list-container');
    if (tab === 'settings') {
      canvasArea.classList.add('hidden');
      canvasArea.classList.remove('split-mode', 'full-width-mode');
      layerSidebar.classList.add('hidden');
    } else if (tab === 'upload') {
      canvasArea.classList.remove('hidden');
      canvasArea.classList.add('split-mode');
      canvasArea.classList.remove('full-width-mode');
      layerSidebar.classList.remove('hidden');
    } else {
      canvasArea.classList.remove('hidden');
      canvasArea.classList.remove('split-mode');
      canvasArea.classList.add('full-width-mode');
      layerSidebar.classList.add('hidden');
    }

    if (tab !== 'controls') {
      CW.PanelDetector.setShowNumbers(false);
    } else if (CW.LayerStore.getSelected()) {
      CW.PanelDetector.setShowNumbers(true);
    }

    CW.Renderer.render();
  }

  // ========================
  // Text Layer
  // ========================

  var TEXT_FONTS = [
    { value: "'Noto Sans KR', sans-serif", label: 'Noto Sans KR' },
    { value: "'Noto Serif KR', serif", label: 'Noto Serif KR' },
    { value: "'Black Han Sans', sans-serif", label: 'Black Han Sans' },
    { value: "'Jua', sans-serif", label: 'Jua' },
    { value: "'Do Hyeon', sans-serif", label: 'Do Hyeon' },
  ];

  function buildTextInput(container) {
    var wrap = document.createElement('div');
    wrap.className = 'text-input-section';

    var label = document.createElement('div');
    label.className = 'control-section-label';
    label.textContent = '\ud14d\uc2a4\ud2b8 \ucd94\uac00';
    wrap.appendChild(label);

    var inputRow = document.createElement('div');
    inputRow.className = 'text-input-row';

    var textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'text-layer-input';
    textInput.placeholder = '\ud14d\uc2a4\ud2b8 \uc785\ub825...';
    inputRow.appendChild(textInput);

    var addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-text-add';
    addBtn.textContent = '\ucd94\uac00';
    inputRow.appendChild(addBtn);
    wrap.appendChild(inputRow);

    var optionsRow = document.createElement('div');
    optionsRow.className = 'text-options-row';

    var fontSelect = document.createElement('select');
    fontSelect.className = 'text-font-select';
    TEXT_FONTS.forEach(function (f) {
      var opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.label;
      opt.style.fontFamily = f.value;
      fontSelect.appendChild(opt);
    });
    optionsRow.appendChild(fontSelect);

    var colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'text-color-input';
    colorInput.value = '#000000';
    optionsRow.appendChild(colorInput);

    wrap.appendChild(optionsRow);
    container.appendChild(wrap);

    addBtn.addEventListener('click', function () {
      var text = textInput.value.trim();
      if (!text) return;
      addTextLayer(text, fontSelect.value, colorInput.value);
      textInput.value = '';
    });

    textInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') addBtn.click();
    });
  }

  function addTextLayer(text, fontFamily, color) {
    if (CW.LayerStore.getCount() >= CW.LayerStore.getMaxLayers()) {
      UI.showToast('\ucd5c\ub300 ' + CW.LayerStore.getMaxLayers() + '\uac1c \ub808\uc774\uc5b4\uae4c\uc9c0 \ucd94\uac00\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.');
      return;
    }

    var size = 1024;
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');

    var fontSize = 120;
    ctx.font = 'bold ' + fontSize + 'px ' + fontFamily;
    var measured = ctx.measureText(text);
    while (measured.width > size * 0.85 && fontSize > 20) {
      fontSize -= 4;
      ctx.font = 'bold ' + fontSize + 'px ' + fontFamily;
      measured = ctx.measureText(text);
    }

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = color;
    ctx.font = 'bold ' + fontSize + 'px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);

    var img = new Image();
    img.onload = function () {
      var id = 'text_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      CW.LayerStore.add(img, id, text);
      CW.LayerStore.setSelected(id);
      refreshLayerList();
      refreshControls();
    };
    img.src = canvas.toDataURL('image/png');
  }

  // ========================
  // Layer Upload
  // ========================

  function handleImageUpload(fileInfo) {
    if (CW.LayerStore.getCount() >= CW.LayerStore.getMaxLayers()) {
      UI.showToast('\ucd5c\ub300 ' + CW.LayerStore.getMaxLayers() + '\uac1c \ub808\uc774\uc5b4\uae4c\uc9c0 \ucd94\uac00\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.');
      return;
    }
    var id = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    fileInfo.id = id;
    CW.LayerStore.add(fileInfo.image, id, fileInfo.name);
    CW.LayerStore.setSelected(id);
    refreshLayerList();
    refreshControls();

  }

  // ========================
  // Layer List UI
  // ========================

  function refreshLayerList() {
    layerListContainer.innerHTML = '';
    var layers = CW.LayerStore.getAll();
    var selectedId = CW.LayerStore.getSelectedId();

    if (layers.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'layer-list-empty';
      empty.textContent = '\uc774\ubbf8\uc9c0\ub97c \uc5c5\ub85c\ub4dc\ud558\uc5ec \ub808\uc774\uc5b4\ub97c \ucd94\uac00\ud558\uc138\uc694';
      layerListContainer.appendChild(empty);
    }

    for (var i = layers.length - 1; i >= 0; i--) {
      var layer = layers[i];
      var item = document.createElement('div');
      item.className = 'layer-item' + (layer.id === selectedId ? ' selected' : '') +
        (!layer.visible ? ' layer-hidden' : '');

      var visBtn = document.createElement('button');
      visBtn.className = 'btn-icon layer-vis-btn';
      visBtn.innerHTML = layer.visible
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      (function (lid, vis) {
        visBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          CW.LayerStore.update(lid, { visible: !vis });
          refreshLayerList();
        });
      })(layer.id, layer.visible);

      var thumb = document.createElement('div');
      thumb.className = 'layer-thumb';
      if (layer.image) {
        var img = document.createElement('img');
        img.src = layer.image.src;
        img.alt = layer.name;
        thumb.appendChild(img);
      }

      var name = document.createElement('div');
      name.className = 'layer-name';
      name.textContent = layer.name;

      var reorder = document.createElement('div');
      reorder.className = 'layer-reorder';
      var upBtn = document.createElement('button');
      upBtn.className = 'btn-icon layer-reorder-btn';
      upBtn.title = '\uc704\ub85c';
      upBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var downBtn = document.createElement('button');
      downBtn.className = 'btn-icon layer-reorder-btn';
      downBtn.title = '\uc544\ub798\ub85c';
      downBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      // UI is rendered top=last, so up in UI = +1 in array, down in UI = -1
      (function (lid, idx, len) {
        if (idx >= len - 1) upBtn.disabled = true;
        if (idx <= 0) downBtn.disabled = true;
        upBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          CW.LayerStore.move(lid, 1);
          refreshLayerList();
          refreshControls();
        });
        downBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          CW.LayerStore.move(lid, -1);
          refreshLayerList();
          refreshControls();
        });
      })(layer.id, i, layers.length);
      reorder.appendChild(upBtn);
      reorder.appendChild(downBtn);

      var actions = document.createElement('div');
      actions.className = 'layer-actions';

      var editBtn = document.createElement('button');
      editBtn.className = 'btn-icon layer-action-btn';
      editBtn.title = '\ubc30\uacbd \uc9c0\uc6b0\uae30';
      editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M14.85 2.85a1.5 1.5 0 012.1 2.1L6.5 15.4l-3.5 1 1-3.5L14.85 2.85z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      (function (l) {
        editBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          openImageEditor(l);
        });
      })(layer);

      var delBtn = document.createElement('button');
      delBtn.className = 'btn-icon layer-action-btn layer-del-btn';
      delBtn.title = '\ub808\uc774\uc5b4 \uc0ad\uc81c';
      delBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      (function (lid) {
        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          CW.LayerStore.remove(lid);
          refreshLayerList();
          refreshControls();
        });
      })(layer.id);

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      item.appendChild(reorder);
      item.appendChild(visBtn);
      item.appendChild(thumb);
      item.appendChild(name);
      item.appendChild(actions);

      (function (lid) {
        item.addEventListener('click', function () {
          CW.LayerStore.setSelected(lid);
          refreshLayerList();
          refreshControls();
        });
      })(layer.id);

      layerListContainer.appendChild(item);
    }

    if (layers.length >= 2) {
      var clearBtn = document.createElement('button');
      clearBtn.className = 'btn btn-secondary btn-sm layer-clear-all';
      clearBtn.textContent = '\uc804\uccb4 \uc0ad\uc81c';
      clearBtn.addEventListener('click', function () {
        CW.LayerStore.clear();
        refreshLayerList();
        refreshControls();
      });
      layerListContainer.appendChild(clearBtn);
    }

    var maxLayers = CW.LayerStore.getMaxLayers();
    uploadZoneContainer.classList.toggle('is-full', layers.length >= maxLayers);
    uploadZoneContainer.classList.toggle('has-image', layers.length > 0);

    // Update drop zone hint with layer count
    var hint = uploadZoneContainer.querySelector('.drop-zone-hint');
    if (hint) {
      hint.textContent = 'PNG, JPG, WebP (' + layers.length + '/' + maxLayers + ')';
    }
  }

  function openImageEditor(layer) {
    ImageEditor.open(layer.image, function (newImage) {
      CW.LayerStore.updateImage(layer.id, newImage);
      refreshLayerList();
    });
  }

  // ========================
  // Controls (per-layer)
  // ========================

  function buildControls() {
    controlsContainer.innerHTML = '';

    var emptyMsg = document.createElement('div');
    emptyMsg.className = 'controls-empty';
    emptyMsg.id = 'controls-empty';
    emptyMsg.textContent = '\ub808\uc774\uc5b4\ub97c \uc120\ud0dd\ud558\uc138\uc694';
    controlsContainer.appendChild(emptyMsg);

    var wrap = document.createElement('div');
    wrap.className = 'controls-wrap';
    wrap.id = 'controls-wrap';

    // Panel header with reset
    var panelHeader = document.createElement('div');
    panelHeader.className = 'control-section-header';

    var panelLabel = document.createElement('div');
    panelLabel.className = 'control-section-label';
    panelLabel.textContent = '\ud45c\uc2dc \uc601\uc5ed (\ud328\ub110 \uc120\ud0dd)';
    panelHeader.appendChild(panelLabel);

    var resetBtn = document.createElement('button');
    resetBtn.className = 'btn-reset-inline';
    resetBtn.textContent = '\ucd08\uae30\ud654';
    resetBtn.addEventListener('click', function () {
      var layer = CW.LayerStore.getSelected();
      if (layer) {
        CW.LayerStore.reset(layer.id);
        refreshControls();
        refreshLayerList();
      }
    });
    panelHeader.appendChild(resetBtn);
    wrap.appendChild(panelHeader);

    var panelWrap = document.createElement('div');
    panelWrap.className = 'panel-selector';
    panelWrap.id = 'panel-selector';
    wrap.appendChild(panelWrap);

    controlRefs.panelSelector = {
      container: panelWrap,
      rebuild: function () { buildPanelSelector(panelWrap); },
    };

    buildPanelSelector(panelWrap);

    // Toggle button
    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-secondary btn-toggle-sliders';
    toggleBtn.id = 'btn-toggle-sliders';
    toggleBtn.textContent = '\ucee8\ud2b8\ub864 \uc2ac\ub77c\uc774\ub354 \ud3bc\uce58\uae30';
    wrap.appendChild(toggleBtn);

    // Collapsible sliders
    var slidersWrap = document.createElement('div');
    slidersWrap.className = 'sliders-collapsible collapsed';
    slidersWrap.id = 'sliders-collapsible';

    var scaleSlider = UI.createSlider({
      id: 'ctrl-scale', label: '\ud06c\uae30 (Scale)',
      min: 10, max: 500, step: 1, value: 100, unit: '%',
      onChange: function (v) { updateSelectedLayer({ scale: v / 100 }); },
    });
    controlRefs.scale = scaleSlider;
    slidersWrap.appendChild(scaleSlider.wrapper);

    var rotSlider = UI.createSlider({
      id: 'ctrl-rotation', label: '\ud68c\uc804 (Rotation)',
      min: 0, max: 360, step: 1, value: 0, unit: '\u00B0',
      onChange: function (v) { updateSelectedLayer({ rotation: v }); },
    });
    controlRefs.rotation = rotSlider;
    slidersWrap.appendChild(rotSlider.wrapper);

    var opacSlider = UI.createSlider({
      id: 'ctrl-opacity', label: '\ud22c\uba85\ub3c4 (Opacity)',
      min: 0, max: 100, step: 1, value: 100, unit: '%',
      onChange: function (v) { updateSelectedLayer({ opacity: v / 100 }); },
    });
    controlRefs.opacity = opacSlider;
    slidersWrap.appendChild(opacSlider.wrapper);

    var offXSlider = UI.createSlider({
      id: 'ctrl-offset-x', label: 'X \uc624\ud504\uc14b',
      min: -512, max: 512, step: 1, value: 0, unit: 'px',
      onChange: function (v) { updateSelectedLayer({ offsetX: v }); },
    });
    controlRefs.offsetX = offXSlider;
    slidersWrap.appendChild(offXSlider.wrapper);

    var offYSlider = UI.createSlider({
      id: 'ctrl-offset-y', label: 'Y \uc624\ud504\uc14b',
      min: -512, max: 512, step: 1, value: 0, unit: 'px',
      onChange: function (v) { updateSelectedLayer({ offsetY: v }); },
    });
    controlRefs.offsetY = offYSlider;
    slidersWrap.appendChild(offYSlider.wrapper);

    wrap.appendChild(slidersWrap);

    toggleBtn.addEventListener('click', function () {
      var collapsed = slidersWrap.classList.toggle('collapsed');
      toggleBtn.textContent = collapsed ? '\ucee8\ud2b8\ub864 \uc2ac\ub77c\uc774\ub354 \ud3bc\uce58\uae30' : '\ucee8\ud2b8\ub864 \uc2ac\ub77c\uc774\ub354 \uc811\uae30';
    });

    controlsContainer.appendChild(wrap);
  }

  function updateSelectedLayer(props) {
    var layer = CW.LayerStore.getSelected();
    if (!layer) return;
    CW.LayerStore.update(layer.id, props);
    refreshLayerList();
  }

  function refreshControls() {
    var layer = CW.LayerStore.getSelected();
    var emptyEl = document.getElementById('controls-empty');
    var wrapEl = document.getElementById('controls-wrap');
    if (!emptyEl || !wrapEl) return;

    if (!layer) {
      emptyEl.classList.remove('hidden');
      wrapEl.classList.add('hidden');
      CW.PanelDetector.setShowNumbers(false);
      return;
    }

    emptyEl.classList.add('hidden');
    wrapEl.classList.remove('hidden');
    syncControlsFromEngine(layer);
  }

  var panelSelectorInitialized = false;

  function buildPanelSelector(container) {
    var count = CW.PanelDetector.getCount();
    var layer = CW.LayerStore.getSelected();
    var selected = layer ? layer.selectedPanels : null;

    var currentCount = container.querySelectorAll('.panel-check').length;
    if (currentCount !== count || !currentModel) {
      container.innerHTML = '';
      if (!currentModel || count === 0) return;

      for (var i = 0; i < count; i++) {
        var label = document.createElement('label');
        label.className = 'panel-check';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.idx = i;
        var span = document.createElement('span');
        span.textContent = (i + 1);
        label.appendChild(cb);
        label.appendChild(span);
        container.appendChild(label);
      }
    }

    container.querySelectorAll('.panel-check').forEach(function (l) {
      var cb = l.querySelector('input');
      var idx = parseInt(cb.dataset.idx);
      var isChecked = selected && selected.includes(idx);
      cb.checked = isChecked;
      l.classList.toggle('checked', isChecked);
    });

    if (currentTab === 'controls') {
      CW.PanelDetector.setShowNumbers(true);
    }

    if (!panelSelectorInitialized) {
      panelSelectorInitialized = true;
      container.addEventListener('change', function () {
        var checked = container.querySelectorAll('input[type="checkbox"]:checked');
        var indices = Array.from(checked).map(function (cb) { return parseInt(cb.dataset.idx); });
        container.querySelectorAll('.panel-check').forEach(function (l) {
          var cb = l.querySelector('input');
          l.classList.toggle('checked', cb.checked);
        });
        updateSelectedLayer({ selectedPanels: indices.length > 0 ? indices : null });
      });
    }
  }

  function syncControlsFromEngine(layer) {
    if (!layer) return;
    if (controlRefs.scale) controlRefs.scale.updateValue(Math.round(layer.scale * 100));
    if (controlRefs.rotation) controlRefs.rotation.updateValue(Math.round(layer.rotation));
    if (controlRefs.opacity) controlRefs.opacity.updateValue(Math.round(layer.opacity * 100));
    if (controlRefs.offsetX) controlRefs.offsetX.updateValue(Math.round(layer.offsetX));
    if (controlRefs.offsetY) controlRefs.offsetY.updateValue(Math.round(layer.offsetY));
    if (controlRefs.panelSelector) controlRefs.panelSelector.rebuild();
  }

  // ========================
  // Before/After
  // ========================

  function setupBeforeAfter() {
    var btn = document.getElementById('btn-before-after');
    if (!btn) return;
    var canvas = document.getElementById('main-canvas');

    btn.addEventListener('mousedown', showTemplate);
    btn.addEventListener('touchstart', function (e) { e.preventDefault(); showTemplate(); });
    btn.addEventListener('mouseup', restoreImage);
    btn.addEventListener('mouseleave', restoreImage);
    btn.addEventListener('touchend', function (e) { e.preventDefault(); restoreImage(); });
    btn.addEventListener('touchcancel', restoreImage);

    function showTemplate() {
      if (!CW.LayerStore.hasLayers()) return;
      btn.classList.add('active');
      var ctx = canvas.getContext('2d');
      var cssW = parseInt(canvas.style.width) || canvas.width;
      var cssH = parseInt(canvas.style.height) || canvas.height;
      var dataUrl = CW.Export.getTemplateOnlyDataURL(cssW);
      var img = new Image();
      img.onload = function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.drawImage(img, 0, 0, cssW, cssH);
      };
      img.src = dataUrl;
    }

    function restoreImage() {
      btn.classList.remove('active');
      CW.Renderer.render();
    }
  }

  // ========================
  // Export
  // ========================

  function setupExportButton() {
    document.getElementById('btn-export').addEventListener('click', openExportSheet);
  }

  function openExportSheet() {
    if (!CW.LayerStore.hasLayers()) {
      UI.showToast('\uba3c\uc800 \uc774\ubbf8\uc9c0\ub97c \uc5c5\ub85c\ub4dc\ud574 \uc8fc\uc138\uc694.');
      return;
    }

    var content = document.createElement('div');
    content.className = 'export-content';
    var previewSize = 256;
    var previewUrl = CW.Export.getPreviewDataURL(previewSize);
    content.innerHTML =
      '<h3 class="export-title">\ub0b4\ubcf4\ub0b4\uae30</h3>' +
      '<div class="export-preview">' +
        '<img src="' + previewUrl + '" alt="\ubbf8\ub9ac\ubcf4\uae30" width="' + previewSize + '" height="' + previewSize + '">' +
      '</div>' +
      '<div class="export-field">' +
        '<label for="export-filename">\ud30c\uc77c \uc774\ub984</label>' +
        '<div class="export-filename-wrap">' +
          '<input type="text" id="export-filename" value="my_wrap" maxlength="30" pattern="[a-zA-Z0-9_-]+" placeholder="\uc601\ubb38, \uc22b\uc790, _, -">' +
          '<span class="export-filename-ext">.png</span>' +
        '</div>' +
      '</div>' +
      '<button class="btn btn-primary btn-download" id="btn-download">' +
        '<svg width="20" height="20" viewBox="0 0 20 20" fill="none">' +
          '<path d="M4 12V15C4 15.55 4.45 16 5 16H15C15.55 16 16 15.55 16 15V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M7 8L10 11L13 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M10 4V11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
        '</svg>' +
        '\uc800\uc7a5 / \uacf5\uc720' +
      '</button>' +
      '<div class="export-size-warning hidden" id="export-size-warning"></div>' +
      '<div class="export-usb-info">' +
        '<h4>USB \uc124\uc815 \uc548\ub0b4</h4>' +
        '<ol>' +
          '<li>USB\ub97c FAT32 \ub610\ub294 exFAT\uc73c\ub85c \ud3ec\ub9f7\ud569\ub2c8\ub2e4.</li>' +
          '<li>\ub8e8\ud2b8\uc5d0 <code>/Wraps/</code> \ud3f4\ub354\ub97c \ub9cc\ub4ed\ub2c8\ub2e4.</li>' +
          '<li>PNG \ud30c\uc77c\uc744 <code>/Wraps/</code> \uc548\uc5d0 \ubcf5\uc0ac\ud569\ub2c8\ub2e4.</li>' +
          '<li>Tesla\uc5d0\uc11c <strong>Toybox > Paint Shop</strong>\uc744 \uc5fd\ub2c8\ub2e4.</li>' +
        '</ol>' +
      '</div>';

    var sheet = UI.createBottomSheet(content);

    var selectedRes = 1024;

    var filenameInput = content.querySelector('#export-filename');
    filenameInput.addEventListener('input', function () {
      filenameInput.value = filenameInput.value.replace(/[^a-zA-Z0-9_-]/g, '');
    });

    content.querySelector('#btn-download').addEventListener('click', function () {
      var filename = filenameInput.value.trim() || 'my_wrap';
      var downloadBtn = content.querySelector('#btn-download');
      var warningEl = content.querySelector('#export-size-warning');
      downloadBtn.disabled = true;
      downloadBtn.textContent = '\uc0dd\uc131 \uc911...';

      CW.Export.toPNG(selectedRes).then(function (blob) {
        var file = new File([blob], filename + '.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator.share({
            files: [file],
            title: filename,
          }).then(function () {
            UI.showToast('\uac00\uc838\uac14\uc2b5\ub2c8\ub2e4!');
            setTimeout(function () { UI.closeBottomSheet(sheet); }, 500);
          }).catch(function (e) {
            if (e.name !== 'AbortError') throw e;
          });
        } else {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = filename + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          UI.showToast('\ub2e4\uc6b4\ub85c\ub4dc\uac00 \uc2dc\uc791\ub418\uc5c8\uc2b5\ub2c8\ub2e4!');
          setTimeout(function () { UI.closeBottomSheet(sheet); }, 500);
        }
      }).catch(function (err) {
        UI.showToast('\ub0b4\ubcf4\ub0b4\uae30 \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.');
        console.error(err);
      }).finally(function () {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML =
          '<svg width="20" height="20" viewBox="0 0 20 20" fill="none">' +
            '<path d="M10 3V13M10 13L6 9M10 13L14 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M3 15V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
          '\ub2e4\uc6b4\ub85c\ub4dc';
      });
    });
  }

  return {
    init: init,
    getCurrentModel: getCurrentModel,
    syncControlsFromEngine: syncControlsFromEngine,
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
