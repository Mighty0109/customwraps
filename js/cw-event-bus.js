/* ============================================================
   cw-event-bus.js - Global Namespace, Event Bus & Shared State
   ============================================================ */

'use strict';

window.CW = {
  // Shared state accessible by all modules
  state: {
    templateImage: null,
    internalWidth: 1024,
    internalHeight: 1024,
    internalSize: 1024,
    currentModel: null,
    displayCanvas: null,
    displayCtx: null,
    offscreen: null,
    offCtx: null,
    maskCanvas: null,
    userLayerCanvas: null,
    userLayerCtx: null,
    checkerPattern: null,
  },

  // Event bus
  _handlers: {},

  on: function (event, fn) {
    (this._handlers[event] = this._handlers[event] || []).push(fn);
  },

  off: function (event, fn) {
    var h = this._handlers[event];
    if (h) this._handlers[event] = h.filter(function (f) { return f !== fn; });
  },

  emit: function (event, data) {
    (this._handlers[event] || []).forEach(function (fn) { fn(data); });
  },
};
