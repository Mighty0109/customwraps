/* ============================================================
   app.js - Main App Orchestration, Routing, State
   (Layer-based architecture)
   ============================================================ */

'use strict';

const App = (function () {
  let currentModel = null;
  let currentScreen = 'select';
  let currentTab = 'upload';

  const MAX_LAYERS = 5;

  let controlRefs = {};
  let layerListContainer = null;
  let uploadZoneContainer = null;
  let controlsContainer = null;

  function init() {
    renderModelSelection();
    setupEditorUI();
    setupExportButton();
    setupBeforeAfter();
    showScreen('select');
  }

  // ========================
  // Screen Management
  // ========================

  function showScreen(screen) {
    currentScreen = screen;
    document.getElementById('screen-select').classList.toggle('hidden', screen !== 'select');
    document.getElementById('screen-editor').classList.toggle('hidden', screen !== 'editor');
    if (screen === 'editor') {
      setTimeout(() => CanvasEngine.render(), 50);
    }
  }

  // ========================
  // Model Selection
  // ========================

  function renderModelSelection() {
    const grid = document.getElementById('model-grid');
    grid.innerHTML = '';
    TeslaModels.forEach(model => {
      const card = document.createElement('button');
      card.className = 'model-card';
      card.setAttribute('aria-label', model.name + (model.subtitle ? ' ' + model.subtitle : ''));
      const thumbUrl = getVehicleImagePath(model);
      const fallbackSvg = generateThumbnailSVG(model);
      card.innerHTML = `
        <div class="model-card-thumb">
          <img src="${thumbUrl}" alt="${model.name}" loading="lazy"
               onerror="this.src='${fallbackSvg}'">
        </div>
        <div class="model-card-info">
          <div class="model-card-name">${model.name}</div>
          ${model.subtitle ? `<div class="model-card-subtitle">${model.subtitle}</div>` : ''}
        </div>
      `;
      card.addEventListener('click', () => selectModel(model));
      grid.appendChild(card);
    });
  }

  function selectModel(model) {
    currentModel = model;
    document.getElementById('editor-model-name').textContent =
      model.name + (model.subtitle ? ' ' + model.subtitle : '');
    const canvasEl = document.getElementById('main-canvas');
    CanvasEngine.init(canvasEl);
    CanvasEngine.setTemplate(model);
    CanvasEngine.clearLayers();
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
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });
    document.getElementById('btn-back').addEventListener('click', () => {
      CanvasEngine.setShowPanelNumbers(false);
      showScreen('select');
    });

    // Containers
    layerListContainer = document.getElementById('layer-list-container');
    uploadZoneContainer = document.getElementById('upload-zone-container');
    controlsContainer = document.getElementById('controls-container');

    // Drop zone
    const zone = UI.createDropZone({ onFile: handleImageUpload, multiple: true });
    uploadZoneContainer.appendChild(zone);

    // Build controls (once)
    buildControls();
  }

  function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('hidden', panel.dataset.tab !== tab);
    });
    // Only show panel numbers when controls tab is active and a layer is selected
    if (tab !== 'controls') {
      CanvasEngine.setShowPanelNumbers(false);
    } else if (CanvasEngine.getSelectedLayer()) {
      CanvasEngine.setShowPanelNumbers(true);
    }
  }

  // ========================
  // Layer Upload
  // ========================

  function handleImageUpload(fileInfo) {
    if (CanvasEngine.getLayerCount() >= MAX_LAYERS) {
      UI.showToast(`최대 ${MAX_LAYERS}개 레이어까지 추가할 수 있습니다.`);
      return;
    }
    const id = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    fileInfo.id = id;
    CanvasEngine.addLayer(fileInfo.image, id, fileInfo.name);
    CanvasEngine.setSelectedLayer(id);
    refreshLayerList();
    refreshControls();

    if (CanvasEngine.getLayerCount() === 1 && window.innerWidth < 1200) {
      setTimeout(() => showTab('controls'), 300);
    }
  }

  // ========================
  // Layer List UI
  // ========================

  function refreshLayerList() {
    layerListContainer.innerHTML = '';
    const layers = CanvasEngine.getLayers();
    const selectedId = CanvasEngine.getSelectedLayerId();

    // Count header
    const header = document.createElement('div');
    header.className = 'layer-list-header';
    header.textContent = `레이어 ${layers.length} / ${MAX_LAYERS}`;
    layerListContainer.appendChild(header);

    if (layers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'layer-list-empty';
      empty.textContent = '이미지를 업로드하여 레이어를 추가하세요';
      layerListContainer.appendChild(empty);
    }

    // Render layers (top = last in array = front)
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const item = document.createElement('div');
      item.className = 'layer-item' + (layer.id === selectedId ? ' selected' : '') +
        (!layer.visible ? ' layer-hidden' : '');

      // Visibility toggle
      const visBtn = document.createElement('button');
      visBtn.className = 'btn-icon layer-vis-btn';
      visBtn.innerHTML = layer.visible
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        CanvasEngine.updateLayer(layer.id, { visible: !layer.visible });
        refreshLayerList();
      });

      // Thumbnail
      const thumb = document.createElement('div');
      thumb.className = 'layer-thumb';
      if (layer.backgroundColor) {
        thumb.style.backgroundColor = layer.backgroundColor;
      }
      if (layer.image) {
        const img = document.createElement('img');
        img.src = layer.image.src;
        img.alt = layer.name;
        thumb.appendChild(img);
      }

      // Name
      const name = document.createElement('div');
      name.className = 'layer-name';
      name.textContent = layer.name;

      // Actions
      const actions = document.createElement('div');
      actions.className = 'layer-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn-icon layer-action-btn';
      editBtn.title = '배경 지우기';
      editBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M14.85 2.85a1.5 1.5 0 012.1 2.1L6.5 15.4l-3.5 1 1-3.5L14.85 2.85z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openImageEditor(layer);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon layer-action-btn layer-del-btn';
      delBtn.title = '레이어 삭제';
      delBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        CanvasEngine.removeLayer(layer.id);
        refreshLayerList();
        refreshControls();
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      item.appendChild(visBtn);
      item.appendChild(thumb);
      item.appendChild(name);
      item.appendChild(actions);

      // Select on click
      item.addEventListener('click', () => {
        CanvasEngine.setSelectedLayer(layer.id);
        refreshLayerList();
        refreshControls();
      });

      layerListContainer.appendChild(item);
    }

    // Clear all button
    if (layers.length >= 2) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'btn btn-secondary btn-sm layer-clear-all';
      clearBtn.textContent = '전체 삭제';
      clearBtn.addEventListener('click', () => {
        CanvasEngine.clearLayers();
        refreshLayerList();
        refreshControls();
      });
      layerListContainer.appendChild(clearBtn);
    }

    // Show/hide drop zone
    uploadZoneContainer.classList.toggle('is-full', layers.length >= MAX_LAYERS);
    uploadZoneContainer.classList.toggle('has-image', layers.length > 0);
  }

  function openImageEditor(layer) {
    ImageEditor.open(layer.image, (newImage) => {
      CanvasEngine.updateLayerImage(layer.id, newImage);
      refreshLayerList();
    });
  }

  // ========================
  // Controls (per-layer)
  // ========================

  function buildControls() {
    controlsContainer.innerHTML = '';

    // Empty state message
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'controls-empty';
    emptyMsg.id = 'controls-empty';
    emptyMsg.textContent = '레이어를 선택하세요';
    controlsContainer.appendChild(emptyMsg);

    // Controls wrapper (hidden when no selection)
    const wrap = document.createElement('div');
    wrap.className = 'controls-wrap';
    wrap.id = 'controls-wrap';

    // Panel selection
    const panelLabel = document.createElement('div');
    panelLabel.className = 'control-section-label';
    panelLabel.textContent = '표시 영역 (패널 선택)';
    wrap.appendChild(panelLabel);

    const panelWrap = document.createElement('div');
    panelWrap.className = 'panel-selector';
    panelWrap.id = 'panel-selector';
    wrap.appendChild(panelWrap);

    controlRefs.panelSelector = {
      container: panelWrap,
      rebuild: () => buildPanelSelector(panelWrap),
    };

    buildPanelSelector(panelWrap);

    // Scale
    const scaleSlider = UI.createSlider({
      id: 'ctrl-scale', label: '크기 (Scale)',
      min: 10, max: 500, step: 1, value: 100, unit: '%',
      onChange: (v) => updateSelectedLayer({ scale: v / 100 }),
    });
    controlRefs.scale = scaleSlider;
    wrap.appendChild(scaleSlider.wrapper);

    // Rotation
    const rotSlider = UI.createSlider({
      id: 'ctrl-rotation', label: '회전 (Rotation)',
      min: 0, max: 360, step: 1, value: 0, unit: '\u00B0',
      onChange: (v) => updateSelectedLayer({ rotation: v }),
    });
    controlRefs.rotation = rotSlider;
    wrap.appendChild(rotSlider.wrapper);

    // Opacity
    const opacSlider = UI.createSlider({
      id: 'ctrl-opacity', label: '투명도 (Opacity)',
      min: 0, max: 100, step: 1, value: 100, unit: '%',
      onChange: (v) => updateSelectedLayer({ opacity: v / 100 }),
    });
    controlRefs.opacity = opacSlider;
    wrap.appendChild(opacSlider.wrapper);

    // Offset X
    const offXSlider = UI.createSlider({
      id: 'ctrl-offset-x', label: 'X 오프셋',
      min: -512, max: 512, step: 1, value: 0, unit: 'px',
      onChange: (v) => updateSelectedLayer({ offsetX: v }),
    });
    controlRefs.offsetX = offXSlider;
    wrap.appendChild(offXSlider.wrapper);

    // Offset Y
    const offYSlider = UI.createSlider({
      id: 'ctrl-offset-y', label: 'Y 오프셋',
      min: -512, max: 512, step: 1, value: 0, unit: 'px',
      onChange: (v) => updateSelectedLayer({ offsetY: v }),
    });
    controlRefs.offsetY = offYSlider;
    wrap.appendChild(offYSlider.wrapper);

    // Reset
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-secondary btn-reset';
    resetBtn.textContent = '레이어 초기화';
    resetBtn.addEventListener('click', () => {
      const layer = CanvasEngine.getSelectedLayer();
      if (layer) {
        CanvasEngine.resetLayer(layer.id);
        refreshControls();
        refreshLayerList();
      }
    });
    wrap.appendChild(resetBtn);

    controlsContainer.appendChild(wrap);
  }

  function updateSelectedLayer(props) {
    const layer = CanvasEngine.getSelectedLayer();
    if (!layer) return;
    CanvasEngine.updateLayer(layer.id, props);
    refreshLayerList();
  }

  function refreshControls() {
    const layer = CanvasEngine.getSelectedLayer();
    const emptyEl = document.getElementById('controls-empty');
    const wrapEl = document.getElementById('controls-wrap');
    if (!emptyEl || !wrapEl) return;

    if (!layer) {
      emptyEl.classList.remove('hidden');
      wrapEl.classList.add('hidden');
      CanvasEngine.setShowPanelNumbers(false);
      return;
    }

    emptyEl.classList.add('hidden');
    wrapEl.classList.remove('hidden');
    syncControlsFromEngine(layer);
  }

  let panelSelectorInitialized = false;

  function buildPanelSelector(container) {
    const count = CanvasEngine.getPanelCount();
    const layer = CanvasEngine.getSelectedLayer();
    const selected = layer ? layer.selectedPanels : null;

    // Only rebuild DOM if panel count changed
    const currentCount = container.querySelectorAll('.panel-check').length;
    if (currentCount !== count || !currentModel) {
      container.innerHTML = '';
      if (!currentModel || count === 0) return;

      for (let i = 0; i < count; i++) {
        const label = document.createElement('label');
        label.className = 'panel-check';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.idx = i;
        const span = document.createElement('span');
        span.textContent = (i + 1);
        label.appendChild(cb);
        label.appendChild(span);
        container.appendChild(label);
      }
    }

    // Update checked state without rebuilding DOM
    container.querySelectorAll('.panel-check').forEach(l => {
      const cb = l.querySelector('input');
      const idx = parseInt(cb.dataset.idx);
      const isChecked = selected && selected.includes(idx);
      cb.checked = isChecked;
      l.classList.toggle('checked', isChecked);
    });

    CanvasEngine.setShowPanelNumbers(true);

    // Attach listener only once
    if (!panelSelectorInitialized) {
      panelSelectorInitialized = true;
      container.addEventListener('change', () => {
        const checked = container.querySelectorAll('input[type="checkbox"]:checked');
        const indices = Array.from(checked).map(cb => parseInt(cb.dataset.idx));
        container.querySelectorAll('.panel-check').forEach(l => {
          const cb = l.querySelector('input');
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
  // Settings Tab
  // ========================

  // (HTML content, no JS needed)

  // ========================
  // Before/After
  // ========================

  function setupBeforeAfter() {
    const btn = document.getElementById('btn-before-after');
    if (!btn) return;
    const canvas = document.getElementById('main-canvas');

    btn.addEventListener('mousedown', showTemplate);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); showTemplate(); });
    btn.addEventListener('mouseup', restoreImage);
    btn.addEventListener('mouseleave', restoreImage);
    btn.addEventListener('touchend', (e) => { e.preventDefault(); restoreImage(); });
    btn.addEventListener('touchcancel', restoreImage);

    function showTemplate() {
      if (!CanvasEngine.hasLayers()) return;
      btn.classList.add('active');
      const ctx = canvas.getContext('2d');
      const cssW = parseInt(canvas.style.width) || canvas.width;
      const cssH = parseInt(canvas.style.height) || canvas.height;
      const dataUrl = CanvasEngine.getTemplateOnlyDataURL(cssW);
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.drawImage(img, 0, 0, cssW, cssH);
      };
      img.src = dataUrl;
    }

    function restoreImage() {
      btn.classList.remove('active');
      CanvasEngine.render();
    }
  }

  // ========================
  // Export
  // ========================

  function setupExportButton() {
    document.getElementById('btn-export').addEventListener('click', openExportSheet);
  }

  function openExportSheet() {
    if (!CanvasEngine.hasLayers()) {
      UI.showToast('먼저 이미지를 업로드해 주세요.');
      return;
    }

    const content = document.createElement('div');
    content.className = 'export-content';
    const previewSize = 256;
    const previewUrl = CanvasEngine.getPreviewDataURL(previewSize);
    content.innerHTML = `
      <h3 class="export-title">내보내기</h3>
      <div class="export-preview">
        <img src="${previewUrl}" alt="미리보기" width="${previewSize}" height="${previewSize}">
      </div>
      <div class="export-field">
        <label for="export-resolution">해상도</label>
        <div class="export-resolution-btns">
          <button class="btn btn-sm res-btn" data-res="512">512px</button>
          <button class="btn btn-sm res-btn active" data-res="768">768px</button>
          <button class="btn btn-sm res-btn" data-res="1024">1024px</button>
        </div>
      </div>
      <div class="export-field">
        <label for="export-filename">파일 이름</label>
        <div class="export-filename-wrap">
          <input type="text" id="export-filename" value="my_wrap" maxlength="30"
                 pattern="[a-zA-Z0-9_-]+" placeholder="영문, 숫자, _, -">
          <span class="export-filename-ext">.png</span>
        </div>
      </div>
      <button class="btn btn-primary btn-download" id="btn-download">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 3V13M10 13L6 9M10 13L14 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 15V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        다운로드
      </button>
      <div class="export-size-warning hidden" id="export-size-warning"></div>
      <div class="export-usb-info">
        <h4>USB 설정 안내</h4>
        <ol>
          <li>USB를 FAT32 또는 exFAT로 포맷합니다.</li>
          <li>루트에 <code>/Wraps/</code> 폴더를 만듭니다.</li>
          <li>PNG 파일을 <code>/Wraps/</code> 안에 복사합니다.</li>
          <li>Tesla에서 <strong>Toybox > Paint Shop</strong>을 엽니다.</li>
        </ol>
      </div>
    `;

    const sheet = UI.createBottomSheet(content);

    let selectedRes = 768;
    content.querySelectorAll('.res-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        content.querySelectorAll('.res-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedRes = parseInt(btn.dataset.res);
      });
    });

    const filenameInput = content.querySelector('#export-filename');
    filenameInput.addEventListener('input', () => {
      filenameInput.value = filenameInput.value.replace(/[^a-zA-Z0-9_-]/g, '');
    });

    content.querySelector('#btn-download').addEventListener('click', async () => {
      const filename = filenameInput.value.trim() || 'my_wrap';
      const downloadBtn = content.querySelector('#btn-download');
      const warningEl = content.querySelector('#export-size-warning');
      downloadBtn.disabled = true;
      downloadBtn.textContent = '생성 중...';

      try {
        let blob = await CanvasEngine.exportPNG(selectedRes);
        if (blob.size > 1048576) {
          const lowerRes = selectedRes === 1024 ? 768 : 512;
          warningEl.textContent = `파일 크기가 ${UI.formatFileSize(blob.size)}입니다. ${lowerRes}px로 축소합니다.`;
          warningEl.classList.remove('hidden');
          blob = await CanvasEngine.exportPNG(lowerRes);
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        UI.showToast('다운로드가 시작되었습니다!');
        setTimeout(() => UI.closeBottomSheet(sheet), 500);
      } catch (err) {
        UI.showToast('내보내기 중 오류가 발생했습니다.');
        console.error(err);
      } finally {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 3V13M10 13L6 9M10 13L14 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3 15V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          다운로드`;
      }
    });
  }

  return {
    init,
    getCurrentModel,
    syncControlsFromEngine,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
