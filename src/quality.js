// Picks a lighter scene on integrated graphics (most laptops, including Intel UHD / Iris).
// Override from the address bar with ?q=high or ?q=low.
function detectLow() {
  try {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q === 'high') return false
    if (q === 'low') return true
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    if (!gl) return true
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext()
    if (/NVIDIA|GeForce|RTX|GTX|Radeon RX|Arc\(TM\)|Apple M/i.test(r)) return false
    return true
  } catch (e) { return true }
}
export const LOW = detectLow()
// plant counts scale with the tier
export const n = (high, low) => (LOW ? low : high)
