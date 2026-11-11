'use strict';
const { overlayBounds } = require('./policy.cjs');
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
function validPlacement(value) {
  return value && Number.isInteger(value.displayId) &&
    ['x', 'y'].every(key => Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1);
}
// Fractions of available travel preserve the chosen edge when the pill changes size.
function rememberPlacement(bounds, display) {
  const a = display.workArea;
  return { displayId: display.id,
    x: clamp((bounds.x - a.x) / Math.max(1, a.width - bounds.width), 0, 1),
    y: clamp((bounds.y - a.y) / Math.max(1, a.height - bounds.height), 0, 1) };
}
function placedBounds(placement, displays, fallback, collapsed) {
  const display = validPlacement(placement) && displays.find(d => d.id === placement.displayId) || fallback;
  const a = display.workArea;
  const bounds = overlayBounds(a, collapsed ? 204 : 440, collapsed ? 82 : 128);
  bounds.width = Math.max(1, Math.min(bounds.width, a.width));
  bounds.height = Math.max(1, Math.min(bounds.height, a.height));
  if (validPlacement(placement)) {
    bounds.x = Math.round(a.x + placement.x * (a.width - bounds.width));
    bounds.y = Math.round(a.y + placement.y * (a.height - bounds.height));
  }
  bounds.x = clamp(bounds.x, a.x, a.x + a.width - bounds.width);
  bounds.y = clamp(bounds.y, a.y, a.y + a.height - bounds.height);
  return bounds;
}
module.exports = { validPlacement, rememberPlacement, placedBounds };
