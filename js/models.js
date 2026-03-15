/* ============================================================
   models.js - Tesla Model Definitions & Placeholder Templates
   ============================================================ */

'use strict';

var EXAMPLES_COMMON = [
  'Acid_Drip', 'Ani', 'Apocalypse', 'Avocado_Green', 'Camo', 'Cosmic_Burst',
  'Divide', 'Doge', 'Dot_Matrix', 'Ice_Cream', 'Leopard', 'Pixel_Art',
  'Reindeer', 'Rudi', 'Sakura', 'Sketch', 'String_Lights', 'Valentine',
  'Vintage_Gradient', 'Vintage_Stripes'
];

var EXAMPLES_CYBERTRUCK = [
  'Ani', 'Camo_Blue', 'Camo_Brown', 'Camo_Green', 'Camo_Pink', 'Camo_Sand',
  'Camo_Snow', 'Camo_Stealth', 'Clay', 'Cosmic_Burst', 'Digital_Camo_Green',
  'Digital_Camo_Snow', 'Digital_Camo_Stealth', 'Doge_Camo', 'Gradient_Black',
  'Gradient_Burn', 'Gradient_Cotton_Candy', 'Gradient_Green', 'Gradient_Purple_Burn',
  'Gradient_Sunburst', 'Graffiti_back', 'Graffiti_green', 'Graffiti_orange',
  'Grandmas_Sofa', 'Houndstooth', 'Leopard', 'Mika', 'Rc_prototype', 'Retro',
  'Rudi', 'Rust', 'Valentine', 'Woody', 'Xmas_Camo', 'Xmas_Lights', 'Xray'
];

const TeslaModels = [
  {
    id: 'cybertruck',
    name: 'Cybertruck',
    subtitle: '',
    folder: 'cybertruck',
    examples: EXAMPLES_CYBERTRUCK,
    panels: [
      { x: 0.05, y: 0.02, w: 0.35, h: 0.18, label: 'Hood' },
      { x: 0.60, y: 0.02, w: 0.35, h: 0.18, label: 'Roof' },
      { x: 0.02, y: 0.24, w: 0.22, h: 0.35, label: 'L-Front' },
      { x: 0.76, y: 0.24, w: 0.22, h: 0.35, label: 'R-Front' },
      { x: 0.26, y: 0.24, w: 0.48, h: 0.20, label: 'Front' },
      { x: 0.26, y: 0.46, w: 0.48, h: 0.20, label: 'Rear' },
      { x: 0.02, y: 0.62, w: 0.22, h: 0.35, label: 'L-Rear' },
      { x: 0.76, y: 0.62, w: 0.22, h: 0.35, label: 'R-Rear' },
      { x: 0.26, y: 0.70, w: 0.48, h: 0.12, label: 'Tailgate' },
      { x: 0.10, y: 0.85, w: 0.35, h: 0.12, label: 'L-Bed' },
      { x: 0.55, y: 0.85, w: 0.35, h: 0.12, label: 'R-Bed' },
    ]
  },
  {
    id: 'model3',
    name: 'Model 3',
    subtitle: '',
    folder: 'model3',
    examples: EXAMPLES_COMMON,
    panels: [
      { x: 0.15, y: 0.02, w: 0.70, h: 0.16, label: 'Hood' },
      { x: 0.02, y: 0.02, w: 0.11, h: 0.28, label: 'L-Fender-F' },
      { x: 0.87, y: 0.02, w: 0.11, h: 0.28, label: 'R-Fender-F' },
      { x: 0.02, y: 0.32, w: 0.20, h: 0.36, label: 'L-Door-F' },
      { x: 0.78, y: 0.32, w: 0.20, h: 0.36, label: 'R-Door-F' },
      { x: 0.24, y: 0.20, w: 0.52, h: 0.24, label: 'Roof' },
      { x: 0.24, y: 0.46, w: 0.52, h: 0.20, label: 'Front Bumper' },
      { x: 0.02, y: 0.70, w: 0.20, h: 0.28, label: 'L-Door-R' },
      { x: 0.78, y: 0.70, w: 0.20, h: 0.28, label: 'R-Door-R' },
      { x: 0.24, y: 0.68, w: 0.52, h: 0.14, label: 'Trunk' },
      { x: 0.24, y: 0.84, w: 0.52, h: 0.14, label: 'Rear Bumper' },
    ]
  },
  {
    id: 'model3-2024-std',
    name: 'Model 3 (2024+)',
    subtitle: 'Standard & Premium',
    folder: 'model3-2024-base',
    examples: EXAMPLES_COMMON,
    panels: [
      { x: 0.12, y: 0.02, w: 0.76, h: 0.16, label: 'Hood' },
      { x: 0.02, y: 0.02, w: 0.08, h: 0.30, label: 'L-A-Pillar' },
      { x: 0.90, y: 0.02, w: 0.08, h: 0.30, label: 'R-A-Pillar' },
      { x: 0.02, y: 0.34, w: 0.22, h: 0.32, label: 'L-Door-F' },
      { x: 0.76, y: 0.34, w: 0.22, h: 0.32, label: 'R-Door-F' },
      { x: 0.26, y: 0.20, w: 0.48, h: 0.22, label: 'Roof' },
      { x: 0.26, y: 0.44, w: 0.48, h: 0.18, label: 'Front Bumper' },
      { x: 0.02, y: 0.68, w: 0.22, h: 0.30, label: 'L-Door-R' },
      { x: 0.76, y: 0.68, w: 0.22, h: 0.30, label: 'R-Door-R' },
      { x: 0.26, y: 0.64, w: 0.48, h: 0.16, label: 'Trunk' },
      { x: 0.26, y: 0.82, w: 0.48, h: 0.16, label: 'Rear Bumper' },
    ]
  },
  {
    id: 'model3-2024-perf',
    name: 'Model 3 (2024+)',
    subtitle: 'Performance',
    folder: 'model3-2024-performance',
    examples: EXAMPLES_COMMON,
    panels: [
      { x: 0.10, y: 0.02, w: 0.80, h: 0.16, label: 'Hood' },
      { x: 0.02, y: 0.02, w: 0.06, h: 0.30, label: 'L-A-Pillar' },
      { x: 0.92, y: 0.02, w: 0.06, h: 0.30, label: 'R-A-Pillar' },
      { x: 0.02, y: 0.34, w: 0.24, h: 0.32, label: 'L-Door-F' },
      { x: 0.74, y: 0.34, w: 0.24, h: 0.32, label: 'R-Door-F' },
      { x: 0.28, y: 0.20, w: 0.44, h: 0.22, label: 'Roof' },
      { x: 0.28, y: 0.44, w: 0.44, h: 0.18, label: 'Front Bumper' },
      { x: 0.02, y: 0.68, w: 0.24, h: 0.30, label: 'L-Door-R' },
      { x: 0.74, y: 0.68, w: 0.24, h: 0.30, label: 'R-Door-R' },
      { x: 0.28, y: 0.64, w: 0.44, h: 0.14, label: 'Trunk' },
      { x: 0.18, y: 0.80, w: 0.64, h: 0.18, label: 'Rear Bumper + Diffuser' },
    ]
  },
  {
    id: 'modely',
    name: 'Model Y',
    subtitle: '',
    folder: 'modely',
    examples: EXAMPLES_COMMON,
    panels: [
      { x: 0.15, y: 0.02, w: 0.70, h: 0.18, label: 'Hood' },
      { x: 0.02, y: 0.02, w: 0.11, h: 0.30, label: 'L-Fender' },
      { x: 0.87, y: 0.02, w: 0.11, h: 0.30, label: 'R-Fender' },
      { x: 0.02, y: 0.34, w: 0.20, h: 0.32, label: 'L-Door-F' },
      { x: 0.78, y: 0.34, w: 0.20, h: 0.32, label: 'R-Door-F' },
      { x: 0.24, y: 0.22, w: 0.52, h: 0.24, label: 'Roof' },
      { x: 0.24, y: 0.48, w: 0.52, h: 0.18, label: 'Front Bumper' },
      { x: 0.02, y: 0.68, w: 0.20, h: 0.30, label: 'L-Door-R' },
      { x: 0.78, y: 0.68, w: 0.20, h: 0.30, label: 'R-Door-R' },
      { x: 0.24, y: 0.68, w: 0.52, h: 0.14, label: 'Liftgate' },
      { x: 0.24, y: 0.84, w: 0.52, h: 0.14, label: 'Rear Bumper' },
    ]
  },
  {
    id: 'modely-2025-std',
    name: 'Model Y (2025+)',
    subtitle: 'Standard',
    folder: 'modely-2025-base',
    examples: EXAMPLES_COMMON,
    panels: [
      { x: 0.12, y: 0.02, w: 0.76, h: 0.18, label: 'Hood' },
      { x: 0.02, y: 0.04, w: 0.08, h: 0.26, label: 'L-Fender' },
      { x: 0.90, y: 0.04, w: 0.08, h: 0.26, label: 'R-Fender' },
      { x: 0.02, y: 0.32, w: 0.22, h: 0.34, label: 'L-Door-F' },
      { x: 0.76, y: 0.32, w: 0.22, h: 0.34, label: 'R-Door-F' },
      { x: 0.26, y: 0.22, w: 0.48, h: 0.22, label: 'Roof' },
      { x: 0.26, y: 0.46, w: 0.48, h: 0.18, label: 'Front Bumper' },
      { x: 0.02, y: 0.68, w: 0.22, h: 0.30, label: 'L-Door-R' },
      { x: 0.76, y: 0.68, w: 0.22, h: 0.30, label: 'R-Door-R' },
      { x: 0.26, y: 0.66, w: 0.48, h: 0.16, label: 'Liftgate' },
      { x: 0.26, y: 0.84, w: 0.48, h: 0.14, label: 'Rear Bumper' },
    ]
  },
  {
    id: 'modely-2025-prem',
    name: 'Model Y (2025+)',
    subtitle: 'Premium',
    folder: 'modely-2025-premium',
    examples: EXAMPLES_COMMON,
    panels: [
      { x: 0.10, y: 0.02, w: 0.80, h: 0.18, label: 'Hood' },
      { x: 0.02, y: 0.04, w: 0.06, h: 0.28, label: 'L-Fender' },
      { x: 0.92, y: 0.04, w: 0.06, h: 0.28, label: 'R-Fender' },
      { x: 0.02, y: 0.34, w: 0.24, h: 0.32, label: 'L-Door-F' },
      { x: 0.74, y: 0.34, w: 0.24, h: 0.32, label: 'R-Door-F' },
      { x: 0.28, y: 0.22, w: 0.44, h: 0.24, label: 'Roof + Glass' },
      { x: 0.28, y: 0.48, w: 0.44, h: 0.16, label: 'Front Bumper' },
      { x: 0.02, y: 0.68, w: 0.24, h: 0.30, label: 'L-Door-R' },
      { x: 0.74, y: 0.68, w: 0.24, h: 0.30, label: 'R-Door-R' },
      { x: 0.28, y: 0.66, w: 0.44, h: 0.16, label: 'Liftgate' },
      { x: 0.28, y: 0.84, w: 0.44, h: 0.14, label: 'Rear Bumper' },
    ]
  },
  {
    id: 'modely-2025-perf',
    name: 'Model Y (2025+)',
    subtitle: 'Performance',
    folder: 'modely-2025-performance',
    examples: EXAMPLES_COMMON,
    panels: [
      { x: 0.08, y: 0.02, w: 0.84, h: 0.18, label: 'Hood' },
      { x: 0.02, y: 0.04, w: 0.04, h: 0.28, label: 'L-Fender' },
      { x: 0.94, y: 0.04, w: 0.04, h: 0.28, label: 'R-Fender' },
      { x: 0.02, y: 0.34, w: 0.24, h: 0.32, label: 'L-Door-F' },
      { x: 0.74, y: 0.34, w: 0.24, h: 0.32, label: 'R-Door-F' },
      { x: 0.28, y: 0.22, w: 0.44, h: 0.24, label: 'Roof' },
      { x: 0.28, y: 0.48, w: 0.44, h: 0.16, label: 'Front Bumper' },
      { x: 0.02, y: 0.68, w: 0.24, h: 0.30, label: 'L-Door-R' },
      { x: 0.74, y: 0.68, w: 0.24, h: 0.30, label: 'R-Door-R' },
      { x: 0.28, y: 0.66, w: 0.44, h: 0.14, label: 'Liftgate' },
      { x: 0.16, y: 0.82, w: 0.68, h: 0.16, label: 'Rear Bumper + Diffuser' },
    ]
  },
  {
    id: 'modely-l',
    name: 'Model Y L',
    subtitle: '',
    folder: 'modely-l',
    examples: EXAMPLES_COMMON,
    panels: [
      { x: 0.12, y: 0.02, w: 0.76, h: 0.16, label: 'Hood' },
      { x: 0.02, y: 0.02, w: 0.08, h: 0.28, label: 'L-Fender' },
      { x: 0.90, y: 0.02, w: 0.08, h: 0.28, label: 'R-Fender' },
      { x: 0.02, y: 0.32, w: 0.20, h: 0.34, label: 'L-Door-F' },
      { x: 0.78, y: 0.32, w: 0.20, h: 0.34, label: 'R-Door-F' },
      { x: 0.24, y: 0.20, w: 0.52, h: 0.24, label: 'Roof' },
      { x: 0.24, y: 0.46, w: 0.52, h: 0.18, label: 'Front Bumper' },
      { x: 0.02, y: 0.68, w: 0.20, h: 0.34, label: 'L-Door-R' },
      { x: 0.78, y: 0.68, w: 0.20, h: 0.34, label: 'R-Door-R' },
      { x: 0.24, y: 0.66, w: 0.52, h: 0.16, label: 'Liftgate' },
      { x: 0.24, y: 0.84, w: 0.52, h: 0.14, label: 'Rear Bumper' },
    ]
  }
];

/**
 * Generate a placeholder UV map template on an offscreen canvas.
 * White background with dark outlines representing car body panels.
 */
function generatePlaceholderTemplate(model, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  // Draw panels
  ctx.strokeStyle = '#1A1A1A';
  ctx.lineWidth = Math.max(2, size * 0.004);
  ctx.lineJoin = 'round';

  model.panels.forEach(p => {
    const px = p.x * size;
    const py = p.y * size;
    const pw = p.w * size;
    const ph = p.h * size;
    const r = size * 0.012;

    // Slightly off-white fill for panels
    ctx.fillStyle = '#F8F8F8';
    roundRect(ctx, px, py, pw, ph, r);
    ctx.fill();
    ctx.stroke();

    // Panel label
    ctx.fillStyle = '#CCCCCC';
    ctx.font = `${Math.max(9, size * 0.018)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, px + pw / 2, py + ph / 2);
  });

  // Outer border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(3, size * 0.005);
  ctx.strokeRect(1, 1, size - 2, size - 2);

  return canvas;
}

/**
 * Generate a simple car silhouette thumbnail SVG as a data URL.
 */
function generateThumbnailSVG(model) {
  const isCybertruck = model.id === 'cybertruck';
  let path;

  if (isCybertruck) {
    path = `<path d="M30 65 L50 30 L170 30 L180 50 L175 65 Z" fill="#3A3A3A" stroke="#555" stroke-width="1.5"/>
            <circle cx="60" cy="68" r="10" fill="#222" stroke="#444"/>
            <circle cx="155" cy="68" r="10" fill="#222" stroke="#444"/>
            <path d="M55 30 L65 45 L140 45 L165 30" fill="none" stroke="#555" stroke-width="1"/>`;
  } else {
    const isY = model.id.includes('modely');
    const bodyH = isY ? 28 : 25;
    path = `<path d="M35 65 L40 ${65 - bodyH} Q50 ${55 - bodyH} 65 ${50 - bodyH} L120 ${50 - bodyH} Q140 ${55 - bodyH} 155 ${60 - bodyH} L170 65 Z" fill="#3A3A3A" stroke="#555" stroke-width="1.5"/>
            <path d="M65 ${50 - bodyH} Q75 ${35 - bodyH} 95 ${32 - bodyH} L125 ${32 - bodyH} Q135 ${35 - bodyH} 140 ${45 - bodyH}" fill="#2A2A2A" stroke="#555" stroke-width="1"/>
            <circle cx="60" cy="68" r="10" fill="#222" stroke="#444"/>
            <circle cx="150" cy="68" r="10" fill="#222" stroke="#444"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 90">${path}</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/**
 * Get template PNG path for a model.
 */
function getTemplatePath(model) {
  return `templates/${model.folder}/template.png`;
}

/**
 * Get vehicle thumbnail path for a model.
 */
function getVehicleImagePath(model) {
  return `templates/${model.folder}/vehicle_image.png`;
}

/**
 * Load an image as a Promise.
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load: ' + src));
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
