// ── Custom cursors (High Contrast Native) ──────────────────

// Added a black outline behind the white pencil paths
const pencilCursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <g stroke="black" stroke-width="4">
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
    <path d="m15 5 4 4"/>
  </g>
  <g stroke="white" stroke-width="2">
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
    <path d="m15 5 4 4"/>
  </g>
</svg>`
export const PENCIL_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(pencilCursorSvg)}") 2 22, crosshair`

// Added a black outline behind the white eraser circle
const eraserCursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="12" fill="none" stroke="black" stroke-width="4" opacity="0.8"/>
  <circle cx="14" cy="14" r="12" fill="none" stroke="white" stroke-width="2" opacity="0.8"/>
</svg>`
export const ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(eraserCursorSvg)}") 14 14, crosshair`

export const TEXT_CURSOR = "text"
