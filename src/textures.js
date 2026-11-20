import * as THREE from 'three'

export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5 }
  return s
}

function tex(size, draw, rx = 1, ry = 1, srgb = true) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  draw(g, size)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry)
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

function speckle(g, s, n, colors, r0, r1, a0 = 0.15, a1 = 0.5, seed = 1) {
  const r = rng(seed)
  for (let i = 0; i < n; i++) {
    g.globalAlpha = a0 + r() * (a1 - a0)
    g.fillStyle = colors[(r() * colors.length) | 0]
    const rad = r0 + r() * (r1 - r0)
    g.beginPath(); g.arc(r() * s, r() * s, rad, 0, 6.3); g.fill()
  }
  g.globalAlpha = 1
}
function strokes(g, s, n, colors, len, seed = 2) {
  const r = rng(seed)
  g.lineWidth = 1.4
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.25 + r() * 0.5
    g.strokeStyle = colors[(r() * colors.length) | 0]
    const x = r() * s, y = r() * s, a = -Math.PI / 2 + (r() - 0.5) * 1.2, l = len * (0.5 + r())
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke()
  }
  g.globalAlpha = 1
}

export const T = {}
export function buildTextures() {
  if (T.grass) return T
  T.grass = tex(512, (g, s) => {
    g.fillStyle = '#4c7a2e'; g.fillRect(0, 0, s, s)
    speckle(g, s, 500, ['#3e6a25', '#5c8d34', '#6a9a3c', '#3a5f22', '#74873a'], 6, 40, 0.08, 0.25, 3)
    strokes(g, s, 9000, ['#5f9438', '#3d6a22', '#6ea043', '#2f5a1c', '#7fa448'], 5, 4)
    speckle(g, s, 2500, ['#33591f', '#6f9a3e', '#8a8f45'], 0.5, 1.6, 0.2, 0.5, 21)
  }, 260, 260)
  T.dirt = tex(512, (g, s) => {
    g.fillStyle = '#8a6a48'; g.fillRect(0, 0, s, s)
    speckle(g, s, 900, ['#7a5a3a', '#9b7a55', '#6b4e33', '#a88a66'], 2, 26, 0.1, 0.35, 5)
    speckle(g, s, 1500, ['#5c4630', '#b89c78', '#4a3826'], 0.6, 2.2, 0.3, 0.8, 6)
  }, 6, 6)
  T.path = tex(256, (g, s) => {
    g.clearRect(0, 0, s, s)
    const grad = g.createLinearGradient(0, 0, s, 0)
    grad.addColorStop(0, 'rgba(140,108,74,0)'); grad.addColorStop(0.22, 'rgba(140,108,74,1)')
    grad.addColorStop(0.78, 'rgba(140,108,74,1)'); grad.addColorStop(1, 'rgba(140,108,74,0)')
    g.fillStyle = grad; g.fillRect(0, 0, s, s)
    g.globalCompositeOperation = 'source-atop'
    speckle(g, s, 500, ['#765639', '#a68662', '#5f462e', '#b59873'], 1, 9, 0.15, 0.5, 7)
    g.fillStyle = 'rgba(90,66,44,0.35)'; g.fillRect(s * 0.34, 0, s * 0.07, s); g.fillRect(s * 0.6, 0, s * 0.07, s)
    g.globalCompositeOperation = 'source-over'
  }, 1, 1)
  T.cracked = tex(512, (g, s) => {
    g.fillStyle = '#b39468'; g.fillRect(0, 0, s, s)
    speckle(g, s, 300, ['#a5855a', '#c2a479', '#9a7a52'], 8, 40, 0.1, 0.3, 8)
    const r = rng(9), n = 9, cell = s / n, pts = []
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const jx = i % n === 0 ? 0 : (r() - 0.5) * cell * 0.75, jy = j % n === 0 ? 0 : (r() - 0.5) * cell * 0.75
      pts.push([i * cell + jx, j * cell + jy])
    }
    g.strokeStyle = '#4e3b25'; g.lineCap = 'round'
    const P = (i, j) => pts[j * (n + 1) + i]
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const a = P(i, j)
      const seg = (b) => {
        g.lineWidth = 1.5 + r() * 3
        const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * 10, my = (a[1] + b[1]) / 2 + (r() - 0.5) * 10
        g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(mx, my, b[0], b[1]); g.stroke()
      }
      if (i < n) seg(P(i + 1, j))
      if (j < n) seg(P(i, j + 1))
      if (i < n && j < n && r() > 0.6) seg(P(i + 1, j + 1))
    }
  }, 5, 5)
  T.mud = tex(256, (g, s) => {
    g.fillStyle = '#3d3424'; g.fillRect(0, 0, s, s)
    speckle(g, s, 400, ['#4a3f2b', '#2f281b', '#55482f', '#39412a'], 3, 22, 0.15, 0.4, 10)
  }, 6, 6)
  const corrugated = (base, rust) => tex(256, (g, s) => {
    for (let x = 0; x < s; x++) {
      const k = 0.5 + 0.5 * Math.sin((x / s) * Math.PI * 2 * 16)
      g.fillStyle = `hsl(${base[0]},${base[1]}%,${base[2] - 10 + k * 20}%)`
      g.fillRect(x, 0, 1, s)
    }
    speckle(g, s, rust, ['#7a3d1c', '#8f4a22', '#5a2e16'], 3, 22, 0.1, 0.45, 11)
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, s * 0.5 - 1, s, 2)
  }, 3, 2)
  T.tinRed = corrugated([8, 52, 40], 60)
  T.tinGrey = corrugated([205, 8, 62], 90)
  T.tinGreen = corrugated([160, 30, 34], 40)
  T.tinBump = tex(64, (g, s) => {
    for (let x = 0; x < s; x++) {
      const k = 0.5 + 0.5 * Math.sin((x / s) * Math.PI * 2 * 4); const v = (k * 255) | 0
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, s)
    }
  }, 12, 2, false)
  T.panel = tex(512, (g, s) => {
    g.fillStyle = '#c9ced3'; g.fillRect(0, 0, s, s)
    g.fillStyle = '#0b1830'; g.fillRect(10, 10, s - 20, s - 20)
    const cols = 6, rows = 12, cw = (s - 28) / cols, ch = (s - 28) / rows
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = 14 + i * cw, y = 14 + j * ch
      const gr = g.createLinearGradient(x, y, x + cw, y + ch)
      gr.addColorStop(0, '#12305f'); gr.addColorStop(0.5, '#0d2247'); gr.addColorStop(1, '#173a70')
      g.fillStyle = gr; g.fillRect(x + 1.5, y + 1.5, cw - 3, ch - 3)
      g.fillStyle = 'rgba(200,215,235,0.55)'
      g.fillRect(x + cw * 0.33, y + 1.5, 1, ch - 3); g.fillRect(x + cw * 0.66, y + 1.5, 1, ch - 3)
    }
  })
  T.plaster = tex(256, (g, s) => {
    g.fillStyle = '#e6dcc4'; g.fillRect(0, 0, s, s)
    speckle(g, s, 260, ['#d6c9a9', '#efe7d3', '#c9bb98'], 4, 30, 0.08, 0.3, 12)
    const gr = g.createLinearGradient(0, s * 0.7, 0, s)
    gr.addColorStop(0, 'rgba(110,85,55,0)'); gr.addColorStop(1, 'rgba(110,85,55,0.45)')
    g.fillStyle = gr; g.fillRect(0, 0, s, s)
    g.fillStyle = '#4a3423'
    for (let i = 0; i <= 4; i++) g.fillRect((i * s) / 4 - 4, 0, 8, s)
    g.fillRect(0, s * 0.36, s, 7); g.fillRect(0, 0, s, 8)
  }, 2, 1)
  T.wood = tex(256, (g, s) => {
    g.fillStyle = '#6e4b2c'; g.fillRect(0, 0, s, s)
    const r = rng(13)
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = r() > 0.5 ? 'rgba(60,38,20,0.5)' : 'rgba(150,110,70,0.35)'
      g.lineWidth = 0.6 + r() * 2; const x = r() * s
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + r() * 10 - 5, s / 3, x + r() * 10 - 5, (2 * s) / 3, x + r() * 6 - 3, s); g.stroke()
    }
  })
  T.bamboo = tex(128, (g, s) => {
    const gr = g.createLinearGradient(0, 0, s, 0)
    gr.addColorStop(0, '#5f7d2c'); gr.addColorStop(0.5, '#a9bd58'); gr.addColorStop(1, '#55702a')
    g.fillStyle = gr; g.fillRect(0, 0, s, s)
    g.fillStyle = 'rgba(60,70,25,0.8)'
    for (let j = 0; j < 4; j++) g.fillRect(0, j * (s / 4) + 6, s, 3)
  }, 1, 5)
  T.concrete = tex(256, (g, s) => {
    g.fillStyle = '#a9a69c'; g.fillRect(0, 0, s, s)
    speckle(g, s, 900, ['#989589', '#bcb9ae', '#85827a'], 0.6, 5, 0.15, 0.5, 14)
    speckle(g, s, 30, ['#6e6c63'], 10, 40, 0.05, 0.14, 15)
  })
  T.coldPanel = tex(256, (g, s) => {
    g.fillStyle = '#eef2f3'; g.fillRect(0, 0, s, s)
    for (let i = 0; i < 4; i++) {
      const x = (i * s) / 4
      const gr = g.createLinearGradient(x, 0, x + s / 4, 0)
      gr.addColorStop(0, 'rgba(120,135,145,0.55)'); gr.addColorStop(0.06, 'rgba(255,255,255,0)'); gr.addColorStop(0.94, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(150,165,175,0.4)')
      g.fillStyle = gr; g.fillRect(x, 0, s / 4, s)
    }
    speckle(g, s, 60, ['#cfd8db'], 4, 20, 0.05, 0.2, 16)
  }, 2, 1)
  T.jute = tex(128, (g, s) => {
    g.fillStyle = '#b3945f'; g.fillRect(0, 0, s, s)
    g.strokeStyle = 'rgba(90,68,36,0.55)'; g.lineWidth = 1
    for (let i = 0; i < s; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke() }
    speckle(g, s, 80, ['#c9ad78', '#8d7144'], 2, 8, 0.1, 0.3, 17)
  }, 2, 2)
  T.brick = tex(256, (g, s) => {
    g.fillStyle = '#b9b2a2'; g.fillRect(0, 0, s, s)
    const r = rng(18), bh = s / 10, bw = s / 5
    for (let j = 0; j < 10; j++) for (let i = -1; i < 5; i++) {
      g.fillStyle = `hsl(${12 + r() * 10},${42 + r() * 14}%,${36 + r() * 12}%)`
      g.fillRect(i * bw + (j % 2 ? bw / 2 : 0) + 2, j * bh + 2, bw - 4, bh - 4)
    }
  }, 2, 1.4)
  T.water = tex(256, (g, s) => {
    const img = g.createImageData(s, s)
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      // tileable noise
      const u = x / s, v = y / s
      const n = (fbm(u * 6, v * 6) * (1 - u) + fbm((u - 1) * 6, v * 6) * u) * (1 - v) + (fbm(u * 6, (v - 1) * 6) * (1 - u) + fbm((u - 1) * 6, (v - 1) * 6) * u) * v
      const k = Math.pow(n, 1.6) * 1.6, i = (y * s + x) * 4
      img.data[i] = 40 + k * 90; img.data[i + 1] = 105 + k * 100; img.data[i + 2] = 130 + k * 100; img.data[i + 3] = 255
    }
    g.putImageData(img, 0, 0)
  }, 2, 2)
  T.thatch = tex(256, (g, s) => {
    g.fillStyle = '#a68a4e'; g.fillRect(0, 0, s, s)
    strokes(g, s, 3500, ['#c4a964', '#8a6f3a', '#d6bf7c', '#6f5a30'], 22, 19)
  }, 2, 2)
  return T
}

// crisp world-space signboards
export function signTexture(lines, { bg = '#0d3b36', fg = '#fdf7ec', accent = '#f5a623', w = 1024, h = 256 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')
  g.fillStyle = bg; g.fillRect(0, 0, w, h)
  g.strokeStyle = accent; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20)
  g.textAlign = 'center'; g.textBaseline = 'middle'
  const n = lines.length
  lines.forEach((l, i) => {
    const big = i === 0
    g.fillStyle = big ? fg : accent
    let px = big ? (n > 1 ? h * 0.36 : h * 0.46) : h * 0.19
    do { g.font = `${big ? 800 : 600} ${px}px "Segoe UI", Arial, sans-serif`; px *= 0.94 } while (g.measureText(l).width > w - 70)
    g.fillText(l, w / 2, n === 1 ? h / 2 : big ? h * 0.38 : h * 0.74)
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}
