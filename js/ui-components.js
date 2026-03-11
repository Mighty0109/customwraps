/* ============================================================
   ui-components.js - Reusable UI Components
   ============================================================ */

'use strict';

const UI = (function () {

  /**
   * Create a styled range slider with label and value display.
   */
  function createSlider(opts) {
    const {
      id, label, min, max, step, value, unit = '',
      onChange, formatValue
    } = opts;

    const wrapper = document.createElement('div');
    wrapper.className = 'control-slider';

    const header = document.createElement('div');
    header.className = 'control-slider-header';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'control-slider-value';
    valueEl.textContent = formatValue ? formatValue(value) : (value + unit);

    header.appendChild(labelEl);
    header.appendChild(valueEl);

    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = min;
    input.max = max;
    input.step = step || 1;
    input.value = value;
    input.className = 'slider-input';

    // Update track fill via CSS variable
    updateSliderFill(input);

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      valueEl.textContent = formatValue ? formatValue(v) : (v + unit);
      updateSliderFill(input);
      if (onChange) onChange(v);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(input);

    return { wrapper, input, valueEl, updateValue: (v) => {
      input.value = v;
      valueEl.textContent = formatValue ? formatValue(v) : (v + unit);
      updateSliderFill(input);
    }};
  }

  function updateSliderFill(input) {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const val = parseFloat(input.value);
    const pct = ((val - min) / (max - min)) * 100;
    input.style.setProperty('--fill', pct + '%');
  }

  /**
   * Create radio button group.
   */
  function createRadioGroup(opts) {
    const { name, options, value, onChange } = opts;

    const wrapper = document.createElement('div');
    wrapper.className = 'radio-group';

    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'radio-btn' + (opt.value === value ? ' active' : '');
      btn.dataset.value = opt.value;
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        wrapper.querySelectorAll('.radio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (onChange) onChange(opt.value);
      });
      wrapper.appendChild(btn);
    });

    return {
      wrapper,
      setValue: (v) => {
        wrapper.querySelectorAll('.radio-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.value === v);
        });
      }
    };
  }

  /**
   * Create drag & drop upload zone.
   */
  function createDropZone(opts) {
    const { onFile, accept = '.png,.jpg,.jpeg,.webp', multiple = false } = opts;

    const zone = document.createElement('div');
    zone.className = 'drop-zone';
    zone.innerHTML = `
      <div class="drop-zone-content">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M24 6L24 30M24 6L16 14M24 6L32 14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 28V38C8 39.1 8.9 40 10 40H38C39.1 40 40 39.1 40 38V28" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p class="drop-zone-text">이미지를 드래그하거나<br>탭하여 선택하세요</p>
        <p class="drop-zone-hint">PNG, JPG, WebP (최대 5장)</p>
      </div>
    `;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = accept;
    if (multiple) fileInput.multiple = true;
    fileInput.style.display = 'none';
    zone.appendChild(fileInput);

    zone.addEventListener('click', () => fileInput.click());

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files);
      files.forEach(file => processFile(file, onFile));
    });

    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files);
      files.forEach(file => processFile(file, onFile));
      fileInput.value = '';
    });

    return zone;
  }

  function processFile(file, callback) {
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      showToast('PNG, JPG, WebP 이미지만 지원됩니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Resize if needed
        const maxSize = 2048;
        let w = img.width;
        let h = img.height;

        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const resized = new Image();
          resized.onload = () => {
            callback({
              image: resized,
              name: file.name,
              size: file.size,
              width: w,
              height: h,
              originalWidth: img.width,
              originalHeight: img.height,
              resized: true,
            });
          };
          resized.src = c.toDataURL('image/png');
        } else {
          callback({
            image: img,
            name: file.name,
            size: file.size,
            width: w,
            height: h,
            originalWidth: w,
            originalHeight: h,
            resized: false,
          });
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Create an image info card (shown after upload).
   */
  function createImageInfo(fileInfo) {
    const card = document.createElement('div');
    card.className = 'image-info-card';

    const thumb = document.createElement('div');
    thumb.className = 'image-info-thumb';
    const thumbImg = document.createElement('img');
    thumbImg.src = fileInfo.image.src;
    thumbImg.alt = fileInfo.name;
    thumb.appendChild(thumbImg);

    const details = document.createElement('div');
    details.className = 'image-info-details';

    const nameEl = document.createElement('div');
    nameEl.className = 'image-info-name';
    nameEl.textContent = fileInfo.name;

    const sizeText = formatFileSize(fileInfo.size);
    const dimText = `${fileInfo.width} x ${fileInfo.height}px`;
    const infoEl = document.createElement('div');
    infoEl.className = 'image-info-meta';
    infoEl.textContent = `${dimText} / ${sizeText}`;

    if (fileInfo.resized) {
      const resizeNote = document.createElement('div');
      resizeNote.className = 'image-info-resize-note';
      resizeNote.textContent = `(${fileInfo.originalWidth}x${fileInfo.originalHeight}에서 리사이즈됨)`;
      details.appendChild(resizeNote);
    }

    details.appendChild(nameEl);
    details.appendChild(infoEl);

    const actions = document.createElement('div');
    actions.className = 'image-info-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon image-info-edit';
    editBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M14.85 2.85a1.5 1.5 0 012.1 2.1L6.5 15.4l-3.5 1 1-3.5L14.85 2.85z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12.5 5.2l2.3 2.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
    editBtn.title = '배경 지우기';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-icon image-info-remove';
    removeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    removeBtn.title = '이미지 제거';

    actions.appendChild(editBtn);
    actions.appendChild(removeBtn);

    card.appendChild(thumb);
    card.appendChild(details);
    card.appendChild(actions);

    return { card, editBtn, removeBtn };
  }

  /**
   * Bottom sheet modal.
   */
  function createBottomSheet(content, opts = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'bottom-sheet-overlay';

    const sheet = document.createElement('div');
    sheet.className = 'bottom-sheet';

    const handle = document.createElement('div');
    handle.className = 'bottom-sheet-handle';
    handle.innerHTML = '<div class="handle-bar"></div>';

    const body = document.createElement('div');
    body.className = 'bottom-sheet-body';
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }

    sheet.appendChild(handle);
    sheet.appendChild(body);
    overlay.appendChild(sheet);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeBottomSheet(overlay);
    });

    // Swipe-down to close
    let startY = 0;
    let currentY = 0;
    handle.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    });
    handle.addEventListener('touchmove', (e) => {
      currentY = e.touches[0].clientY;
      const dy = currentY - startY;
      if (dy > 0) {
        sheet.style.transform = `translateY(${dy}px)`;
      }
    });
    handle.addEventListener('touchend', () => {
      const dy = currentY - startY;
      if (dy > 100) {
        closeBottomSheet(overlay);
      } else {
        sheet.style.transform = '';
      }
    });

    document.body.appendChild(overlay);
    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    return overlay;
  }

  function closeBottomSheet(overlay) {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }

  /**
   * Toast notification.
   */
  function showToast(message, duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  return {
    createSlider,
    createRadioGroup,
    createDropZone,
    createImageInfo,
    createBottomSheet,
    closeBottomSheet,
    showToast,
    formatFileSize,
  };
})();
