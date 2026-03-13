/* ============================================================
   cw-export.js - PNG Export & Preview
   ============================================================ */

'use strict';

CW.Export = (function () {

  function toPNG(resolution) {
    var s = CW.state;
    var aspectRatio = s.internalWidth / s.internalHeight;
    var exportW = resolution;
    var exportH = Math.round(resolution / aspectRatio);

    // Save original state
    var origW = s.internalWidth;
    var origH = s.internalHeight;
    var origSize = s.internalSize;
    var origOff = s.offscreen;
    var origCtx = s.offCtx;

    // Create temp offscreen at export resolution
    var tempOff = document.createElement('canvas');
    tempOff.width = exportW;
    tempOff.height = exportH;

    s.internalWidth = exportW;
    s.internalHeight = exportH;
    s.internalSize = Math.max(exportW, exportH);
    s.offscreen = tempOff;
    s.offCtx = tempOff.getContext('2d');

    CW.Renderer.renderOffscreen();

    // Restore original state
    s.internalWidth = origW;
    s.internalHeight = origH;
    s.internalSize = origSize;
    s.offscreen = origOff;
    s.offCtx = origCtx;

    return new Promise(function (resolve) {
      tempOff.toBlob(function (blob) { resolve(blob); }, 'image/png');
    });
  }

  function getPreviewDataURL(previewSize) {
    var s = CW.state;
    var aspectRatio = s.internalWidth / s.internalHeight;
    var pw = previewSize;
    var ph = Math.round(previewSize / aspectRatio);
    var c = document.createElement('canvas');
    c.width = pw;
    c.height = ph;
    c.getContext('2d').drawImage(s.offscreen, 0, 0, pw, ph);
    return c.toDataURL('image/png');
  }

  function getTemplateOnlyDataURL(previewSize) {
    var s = CW.state;
    var aspectRatio = s.internalWidth / s.internalHeight;
    var pw = previewSize;
    var ph = Math.round(previewSize / aspectRatio);
    var c = document.createElement('canvas');
    c.width = pw;
    c.height = ph;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pw, ph);
    if (s.templateImage) ctx.drawImage(s.templateImage, 0, 0, pw, ph);
    return c.toDataURL('image/png');
  }

  return {
    toPNG: toPNG,
    getPreviewDataURL: getPreviewDataURL,
    getTemplateOnlyDataURL: getTemplateOnlyDataURL,
  };
})();
