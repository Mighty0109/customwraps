/* ============================================================
   app.js - Main App Orchestration, Routing, State
   ============================================================ */

'use strict';

const App = (function () {
  let currentModel = null;
  let currentScreen = 'select'; // 'select' | 'editor'
  let currentTab = 'upload';    // 'upload' | 'controls' | 'settings'

  // UI element references
  let controlRefs = {};
  let uploadZoneContainer = null;
  let imageInfoContainer = null;
  let currentFileInfo = null;

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
      // Small delay to let layout settle
      setTimeout(() => CanvasEngine.render(), 50);
    }
  }

  // ========================
  // Model Selection Screen
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

    // Init canvas with template
    const canvasEl = document.getElementById('main-canvas');
    CanvasEngine.init(canvasEl);
    CanvasEngine.setTemplate(model);

    // Reset upload state
    clearUploadedImage();
    showTab('upload');
    showScreen('editor');
  }

  function getCurrentModel() {
    return currentModel;
  }

  // ========================
  // Editor Tabs
  // ========================

  function setupEditorUI() {
    // Tab bar
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        showTab(btn.dataset.tab);
      });
    });

    // Back button
    document.getElementById('btn-back').addEventListener('click', () => {
      showScreen('select');
    });

    // Setup upload zone
    setupUploadTab();

    // Setup controls tab
    setupControlsTab();

    // Setup settings tab
    setupSettingsTab();
  }

  function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('hidden', panel.dataset.tab !== tab);
    });
  }

  // ========================
  // Upload Tab
  // ========================

  function setupUploadTab() {
    uploadZoneContainer = document.getElementById('upload-zone-container');
    imageInfoContainer = document.getElementById('image-info-container');

    const zone = UI.createDropZone({
      onFile: handleImageUpload,
    });
    uploadZoneContainer.appendChild(zone);
  }

  function handleImageUpload(fileInfo) {
    currentFileInfo = fileInfo;
    CanvasEngine.setUserImage(fileInfo.image);

    // Show image info
    imageInfoContainer.innerHTML = '';
    const { card, removeBtn } = UI.createImageInfo(fileInfo);
    removeBtn.addEventListener('click', clearUploadedImage);
    imageInfoContainer.appendChild(card);

    // Switch to controls
    uploadZoneContainer.classList.add('has-image');
    imageInfoContainer.classList.remove('hidden');

    // Auto-switch to controls tab on mobile
    if (window.innerWidth < 1200) {
      setTimeout(() => showTab('controls'), 300);
    }
  }

  function clearUploadedImage() {
    currentFileInfo = null;
    CanvasEngine.clearUserImage();
    imageInfoContainer.innerHTML = '';
    imageInfoContainer.classList.add('hidden');
    uploadZoneContainer.classList.remove('has-image');
  }

  // ========================
  // Controls Tab
  // ========================

  function setupControlsTab() {
    const container = document.getElementById('controls-container');
    container.innerHTML = '';

    // Fill mode
    const fillModeGroup = UI.createRadioGroup({
      name: 'fillMode',
      options: [
        { value: 'tile', label: '타일' },
        { value: 'stretch', label: '늘리기' },
        { value: 'fit', label: '맞추기' },
        { value: 'center', label: '가운데' },
      ],
      value: 'tile',
      onChange: (v) => CanvasEngine.updateState({ fillMode: v }),
    });
    controlRefs.fillMode = fillModeGroup;

    const fillLabel = document.createElement('div');
    fillLabel.className = 'control-section-label';
    fillLabel.textContent = '채우기 모드 (Fill Mode)';
    container.appendChild(fillLabel);
    container.appendChild(fillModeGroup.wrapper);

    // Scale
    const scaleSlider = UI.createSlider({
      id: 'ctrl-scale',
      label: '크기 (Scale)',
      min: 10, max: 500, step: 1, value: 100,
      unit: '%',
      onChange: (v) => CanvasEngine.updateState({ scale: v / 100 }),
    });
    controlRefs.scale = scaleSlider;
    container.appendChild(scaleSlider.wrapper);

    // Rotation
    const rotSlider = UI.createSlider({
      id: 'ctrl-rotation',
      label: '회전 (Rotation)',
      min: 0, max: 360, step: 1, value: 0,
      unit: '\u00B0',
      onChange: (v) => CanvasEngine.updateState({ rotation: v }),
    });
    controlRefs.rotation = rotSlider;
    container.appendChild(rotSlider.wrapper);

    // Opacity
    const opacSlider = UI.createSlider({
      id: 'ctrl-opacity',
      label: '투명도 (Opacity)',
      min: 0, max: 100, step: 1, value: 100,
      unit: '%',
      onChange: (v) => CanvasEngine.updateState({ opacity: v / 100 }),
    });
    controlRefs.opacity = opacSlider;
    container.appendChild(opacSlider.wrapper);

    // Offset X
    const offXSlider = UI.createSlider({
      id: 'ctrl-offset-x',
      label: 'X 오프셋',
      min: -512, max: 512, step: 1, value: 0,
      unit: 'px',
      onChange: (v) => CanvasEngine.updateState({ offsetX: v }),
    });
    controlRefs.offsetX = offXSlider;
    container.appendChild(offXSlider.wrapper);

    // Offset Y
    const offYSlider = UI.createSlider({
      id: 'ctrl-offset-y',
      label: 'Y 오프셋',
      min: -512, max: 512, step: 1, value: 0,
      unit: 'px',
      onChange: (v) => CanvasEngine.updateState({ offsetY: v }),
    });
    controlRefs.offsetY = offYSlider;
    container.appendChild(offYSlider.wrapper);

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-secondary btn-reset';
    resetBtn.textContent = '초기화 (Reset All)';
    resetBtn.addEventListener('click', () => {
      CanvasEngine.resetState();
    });
    container.appendChild(resetBtn);
  }

  /**
   * Sync control UI from engine state (called after gesture/auto-place).
   */
  function syncControlsFromEngine(st) {
    if (controlRefs.scale) controlRefs.scale.updateValue(Math.round(st.scale * 100));
    if (controlRefs.rotation) controlRefs.rotation.updateValue(Math.round(st.rotation));
    if (controlRefs.opacity) controlRefs.opacity.updateValue(Math.round(st.opacity * 100));
    if (controlRefs.offsetX) controlRefs.offsetX.updateValue(Math.round(st.offsetX));
    if (controlRefs.offsetY) controlRefs.offsetY.updateValue(Math.round(st.offsetY));
    if (controlRefs.fillMode) controlRefs.fillMode.setValue(st.fillMode);
  }

  // ========================
  // Settings Tab
  // ========================

  function setupSettingsTab() {
    // Settings tab content is in HTML, nothing dynamic needed for now
  }

  // ========================
  // Before/After Toggle
  // ========================

  function setupBeforeAfter() {
    const btn = document.getElementById('btn-before-after');
    if (!btn) return;

    const canvas = document.getElementById('main-canvas');

    let originalSrc = null;

    btn.addEventListener('mousedown', showTemplate);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); showTemplate(); });
    btn.addEventListener('mouseup', restoreImage);
    btn.addEventListener('mouseleave', restoreImage);
    btn.addEventListener('touchend', (e) => { e.preventDefault(); restoreImage(); });
    btn.addEventListener('touchcancel', restoreImage);

    function showTemplate() {
      if (!CanvasEngine.hasUserImage()) return;
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
    if (!CanvasEngine.hasUserImage()) {
      UI.showToast('먼저 이미지를 업로드해 주세요.');
      return;
    }

    const content = document.createElement('div');
    content.className = 'export-content';

    // Preview
    const previewSize = 256;
    const previewUrl = CanvasEngine.getPreviewDataURL(previewSize);
    content.innerHTML = `
      <h3 class="export-title">내보내기 (Export)</h3>
      <div class="export-preview">
        <img src="${previewUrl}" alt="미리보기" width="${previewSize}" height="${previewSize}">
      </div>
      <div class="export-field">
        <label for="export-resolution">해상도 (Resolution)</label>
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
        <div class="export-filename-hint">영문, 숫자, 밑줄(_), 하이픈(-) / 최대 30자</div>
      </div>
      <button class="btn btn-primary btn-download" id="btn-download">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 3V13M10 13L6 9M10 13L14 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 15V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        다운로드 (Download)
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

    // Resolution buttons
    let selectedRes = 768;
    content.querySelectorAll('.res-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        content.querySelectorAll('.res-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedRes = parseInt(btn.dataset.res);
      });
    });

    // Filename validation
    const filenameInput = content.querySelector('#export-filename');
    filenameInput.addEventListener('input', () => {
      filenameInput.value = filenameInput.value.replace(/[^a-zA-Z0-9_-]/g, '');
    });

    // Download
    content.querySelector('#btn-download').addEventListener('click', async () => {
      const filename = filenameInput.value.trim() || 'my_wrap';
      const downloadBtn = content.querySelector('#btn-download');
      const warningEl = content.querySelector('#export-size-warning');

      downloadBtn.disabled = true;
      downloadBtn.textContent = '생성 중...';

      try {
        let blob = await CanvasEngine.exportPNG(selectedRes, filename);

        // Check size
        if (blob.size > 1048576) {
          // Try lower resolution
          const lowerRes = selectedRes === 1024 ? 768 : 512;
          warningEl.textContent = `파일 크기가 ${UI.formatFileSize(blob.size)}입니다. ${lowerRes}px로 자동 축소합니다.`;
          warningEl.classList.remove('hidden');
          blob = await CanvasEngine.exportPNG(lowerRes, filename);
        }

        // Download
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
          다운로드 (Download)`;
      }
    });
  }

  return {
    init,
    getCurrentModel,
    syncControlsFromEngine,
  };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
