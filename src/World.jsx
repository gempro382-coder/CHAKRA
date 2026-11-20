import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky, Stars } from '@react-three/drei'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { GltfInstances, MODELS, asset } from './Models.jsx'
import { LOW, n as q } from './quality.js'
import { guide } from './store.js'
import { rng, fbm, T } from './textures.js'
import { M, G, B, Inst, Static, windUniform } from './helpers.jsx'
import { sim, live, nav, useStore } from './store.js'
import { sunAngle, PLOTS, SITE, HOUSES, VIEWS, GUIDE } from './data.js'

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

export function terrainH(x, z) {
  const r = Math.hypot(x, z)
  const k = sstep(105, 300, r)
  if (k === 0) return 0
  const ridge = fbm(x * 0.006 + 3.1, z * 0.006 + 7.7, 4)
  return k * (ridge * 120 + fbm(x * 0.03, z * 0.03, 3) * 12 - 8) + sstep(300, 650, r) * 70 * fbm(x * 0.004 + 9, z * 0.004 + 2, 2)
}

// ---------- Sky, sun, fog ----------
const C_DAY = new THREE.Color('#cfe3e6'), C_DUSK = new THREE.Color('#e9a877'), C_NIGHT = new THREE.Color('#0d1626'), C_HAZE = new THREE.Color('#e3d6b8')
const SUN_DAY = new THREE.Color('#fff3dc'), SUN_LOW = new THREE.Color('#ff9a4a'), MOON = new THREE.Color('#8fb0ff')
export function SkyAndLights() {
  const sky = useRef(), sun = useRef(), hemi = useRef(), stars = useRef()
  const { scene, gl } = useThree()
  const fogC = useMemo(() => new THREE.Color(), [])
  const frame = useRef(0)
  useMemo(() => {
    scene.fog = new THREE.FogExp2('#cfe3e6', 0.0032)
    const pm = new THREE.PMREMGenerator(gl)
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
    // real photographed sky for reflections and ambient colour (swapped in once loaded)
    new RGBELoader().load(asset('hdri/sky.hdr'), (hdr) => { hdr.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pm.fromEquirectangular(hdr).texture; hdr.dispose() })
  }, [scene])
  useFrame(() => {
    const th = sunAngle(sim.t)
    if (sun.current) {
      // The shadow map is only redrawn when it can have changed: often while something moves, rarely otherwise
      const sh = sun.current.shadow, f = frame.current++, st = useStore.getState()
      sh.autoUpdate = false
      const moving = sim.playing || guide.moving || st.guide >= 0 || sim.mode === 'before'
      const changed = Math.abs(sim.t - (sh.userT ?? -9)) > 0.02 || sh.userMode !== sim.mode
      if (f < 12 || changed || f % (moving ? 4 : 45) === 0) { sh.needsUpdate = true; sh.userT = sim.t; sh.userMode = sim.mode }
    }
    const elev = Math.sin(th)
    const day = sstep(-0.1, 0.22, elev)
    const low = 1 - sstep(0.0, 0.45, Math.abs(elev))
    live.elev = elev; live.day = day; live.night = 1 - day
    live.lights = sim.t > 12 ? sstep(0.22, 0.0, elev) : sstep(0.12, -0.05, elev) * 0.6
    const sx = Math.cos(th) * 100, sy = elev * 100, sz = 45
    const before = sim.mode === 'before'
    if (sky.current) {
      const u = sky.current.material.uniforms
      u.sunPosition.value.set(sx, sy, sz)
      u.turbidity.value = before ? 16 : 7
      u.rayleigh.value = (before ? 1.5 : 0.75) + low * 1.8
    }
    if (day > 0.02) {
      sun.current.position.set(sx, Math.max(sy, 6), sz)
      sun.current.color.copy(SUN_DAY).lerp(SUN_LOW, low)
      sun.current.intensity = (before ? 3.4 : 3.0) * day * (1 - low * 0.35)
    } else {
      sun.current.position.set(-50, 90, 40)
      sun.current.color.copy(MOON)
      sun.current.intensity = 0.7
    }
    hemi.current.intensity = 0.34 + day * (before ? 0.4 : 0.5)
    scene.environmentIntensity = 0.04 + day * 0.5
    fogC.copy(C_NIGHT).lerp(before ? C_HAZE : C_DAY, day).lerp(C_DUSK, low * day * 0.75)
    scene.fog.color.copy(fogC)
    scene.fog.density = before ? 0.0042 : 0.0032
    gl.toneMappingExposure = 0.78 + day * 0.08
    if (stars.current) stars.current.visible = day < 0.25
  })
  return (
    <>
      <Sky ref={sky} distance={4500} mieCoefficient={0.004} mieDirectionalG={0.84} />
      <group ref={stars}><Stars radius={900} depth={80} count={2500} factor={9} fade speed={0.4} /></group>
      <hemisphereLight ref={hemi} args={['#dfefff', '#4a5a34', 0.9]} />
      <directionalLight ref={sun} castShadow shadow-mapSize={LOW ? [1024, 1024] : [2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.06}>
        <orthographicCamera attach="shadow-camera" args={[-85, 85, 85, -85, 1, 320]} />
      </directionalLight>
    </>
  )
}

// ---------- Terrain ----------
export function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1500, 1500, 150, 150)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = terrainH(x, z)
      pos.setY(i, h)
      const n = fbm(x * 0.02, z * 0.02, 3)
      c.setRGB(0.82 + n * 0.3, 0.9 + n * 0.25, 0.75 + n * 0.2)
      if (h > 2) c.lerp(new THREE.Color(0.42, 0.62, 0.42), Math.min(1, h / 40))
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [])
  const mat = useMemo(() => { const m = M.grass.clone(); m.vertexColors = true; return m }, [])
  const onClick = (e) => {
    if (e.delta > 6 || useStore.getState().intro || useStore.getState().guide >= 0) return
    const p = e.point
    if (Math.hypot(p.x, p.z) > 96) return
    nav.walk = new THREE.Vector3(p.x, 1.7, p.z); nav.fly = null
  }
  return <mesh geometry={geo} material={mat} receiveShadow onClick={onClick} />
}

export function HillForest() {
  const items = useMemo(() => {
    const r = rng(77), out = [], greens = ['#2f5f33', '#3b6e3a', '#28542f', '#4a7c40', '#35663c']
    while (out.length < q(1900, 1000)) {
      const a = r() * Math.PI * 2, d = 114 + Math.pow(r(), 0.75) * 430
      const x = Math.cos(a) * d, z = Math.sin(a) * d, h = terrainH(x, z)
      if (fbm(x * 0.012 + 40, z * 0.012 + 11, 2) < 0.36) continue // clearings
      const s = 4.5 + r() * 5 + d * 0.006
      out.push({ p: [x, h + s * 0.35, z], s: [s * 1.25, s * (0.8 + r() * 0.5), s * 1.25], r: [0, r() * 6, 0], c: greens[(r() * greens.length) | 0] })
    }
    return out
  }, [])
  return <Inst geometry={G.canopyLo} material={M.foliage} items={items} castShadow={false} receiveShadow={false} />
}

// ---------- Paths ----------
function ribbon(points, width, vRepeat = 0.25) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], 0.05, p[1])))
  const n = Math.ceil(curve.getLength() / 1.5), pos = [], uv = [], idx = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = curve.getPointAt(t), tan = curve.getTangentAt(t)
    const nx = -tan.z, nz = tan.x
    pos.push(p.x + nx * width * 0.5, 0.05, p.z + nz * width * 0.5, p.x - nx * width * 0.5, 0.05, p.z - nz * width * 0.5)
    uv.push(0, t * curve.getLength() * vRepeat, 1, t * curve.getLength() * vRepeat)
    if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx); g.computeVertexNormals()
  return g
}
const ROADS = [
  { pts: [[-110, -78], [-70, -46], [-40, -34], [-24, -14], [-10, 8], [6, 12.5], [14, 17], [18, 21]], w: 4.2 },
  { pts: [[-10, 8], [-12, 16], [-10, 24], [-4, 27.6], [10, 28.2], [40, 28.4]], w: 3 },
  { pts: [[6, 12.5], [14, 6], [16.5, 1.5]], w: 2.6 },
  { pts: [[-12, 16], [-14.5, 18]], w: 2.6 },
  { pts: [[-40, -34], [-50, -42], [-58, -44]], w: 3 },
  { pts: [[-10, 8], [-11, 3], [-12.5, 0.5]], w: 2.4 },
]
export function Paths() {
  const geos = useMemo(() => ROADS.map((r) => ribbon(r.pts, r.w)), [])
  return geos.map((g, i) => <mesh key={i} geometry={g} material={M.path} receiveShadow renderOrder={1} />)
}

// ---------- Water ----------
const waters = []
function useWater(rx, ry, speed, opts = {}) {
  return useMemo(() => {
    const t = T.water.clone(); t.needsUpdate = true; t.repeat.set(rx, ry)
    const m = new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.6, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.86, color: opts.color || '#9fd8e6' })
    const w = { t, m, speed, flowing: opts.flowing }
    waters.push(w)
    return w
  }, [])
}
export function WaterTicker() {
  useFrame((_, dt) => {
    windUniform.value += dt
    for (const w of waters) {
      const f = w.flowing ? live.flow : 1
      w.t.offset.x -= dt * w.speed * f
      if (!w.flowing) w.t.offset.y += dt * w.speed * 0.4
    }
  })
  return null
}

export function Pond() {
  const w = useWater(3, 3, 0.02, { color: '#7fb8b0' })
  const [px, , pz] = SITE.pond
  const reeds = useMemo(() => {
    const r = rng(5), out = []
    for (let i = 0; i < 90; i++) {
      const a = r() * 6.28, d = 8.2 + r() * 1.6
      out.push({ p: [px + Math.cos(a) * d, 0.3, pz + Math.sin(a) * d * 0.85], s: [1.6, 2.2 + r() * 1.6, 1.6], r: [0, r() * 6, 0], c: r() > 0.5 ? '#3f7028' : '#56803a' })
    }
    return out
  }, [])
  const pads = useMemo(() => {
    const r = rng(6)
    return Array.from({ length: 22 }, () => { const a = r() * 6.28, d = r() * 6.5; return { p: [px + Math.cos(a) * d, 0.34, pz + Math.sin(a) * d * 0.8], s: [0.3 + r() * 0.3, 0.02, 0.3 + r() * 0.3], c: '#3f7a35' } })
  }, [])
  return (
    <group>
      <mesh position={[px, 0.05, pz]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.85, 0.32]} material={M.bank} receiveShadow>
        <torusGeometry args={[9.3, 1.7, 10, 48]} />
      </mesh>
      <mesh position={[px, 0.3, pz]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.85, 1]} material={w.m} receiveShadow>
        <circleGeometry args={[8.8, 48]} />
      </mesh>
      <Inst geometry={tuftGeo} material={M.paddy} items={reeds} castShadow={false} />
      <Inst geometry={G.cyl} material={M.canopy} items={pads} castShadow={false} />
    </group>
  )
}

// earthen channel between two points; water rises with live.flow
function Channel({ a, b, width = 1.2, dryInBefore }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
  const w = useWater(len / 3, 1, 0.55, { flowing: true })
  const ref = useRef()
  useFrame(() => {
    const f = dryInBefore && sim.mode === 'before' ? 0 : live.flow
    ref.current.position.y = 0.04 + f * 0.2
    ref.current.visible = f > 0.03
  })
  return (
    <group position={[(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]} rotation={[0, ang, 0]}>
      <B p={[0, 0.14, width / 2 + 0.3]} s={[len + 0.6, 0.3, 0.6]} m={M.dirt} />
      <B p={[0, 0.14, -width / 2 - 0.3]} s={[len + 0.6, 0.3, 0.6]} m={M.dirt} />
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[len, width, 1]} geometry={G.plane} material={M.mudDry} receiveShadow />
      <mesh ref={ref} userData={{ dyn: true }} rotation={[-Math.PI / 2, 0, 0]} scale={[len, width, 1]} geometry={G.plane} material={w.m} />
    </group>
  )
}
export function Canals() {
  return (
    <Static>
      <Channel a={[19.2, 25.2]} b={[19.2, 31.5]} />
      <Channel a={[19.2, 31.5]} b={[45, 31.5]} />
      <Channel a={[19.2, 31.5]} b={[0, 31.5]} />
      <Channel a={[0, 31.5]} b={[-45, 31.5]} dryInBefore />
      <Channel a={[0, 32.1]} b={[0, 79]} />
      <Channel a={[0.6, 56.2]} b={[45, 56.2]} width={0.9} />
      <Channel a={[-0.6, 56.2]} b={[-45, 56.2]} width={0.9} dryInBefore />
    </Static>
  )
}

// ---------- Geometry builders ----------
function makeTuft(blades = 5, h = 0.8, w = 0.065, lean = 0.27) {
  const pos = [], nor = []
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + i * 0.7, ca = Math.cos(a), sa = Math.sin(a)
    const px = -sa * w, pz = ca * w, bh = h * (0.7 + ((i * 37) % 10) / 30)
    const P = (k, y, side) => [ca * lean * k * k + px * side * (1 - k * 0.6), y, sa * lean * k * k + pz * side * (1 - k * 0.6)]
    const b0 = P(0, 0, -1), b1 = P(0, 0, 1), m0 = P(0.55, bh * 0.55, -1), m1 = P(0.55, bh * 0.55, 1), tip = [ca * lean * 1.2, bh, sa * lean * 1.2]
    ;[b0, b1, m0, b1, m1, m0, m0, m1, tip].forEach((v) => { pos.push(...v); nor.push(0, 1, 0) })
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return g
}
const tuftGeo = makeTuft()
function makeLeaf(len = 2.6, wid = 0.75, droop = 1.0) {
  const g = new THREE.PlaneGeometry(wid, len, 2, 8)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const v = (p.getY(i) + len / 2) / len, x = p.getX(i)
    const taper = Math.sin(Math.PI * Math.min(1, v * 0.88 + 0.1))
    p.setXYZ(i, x * taper, len * (v - 0.22 * v * v * droop), droop * v * v + Math.abs(x) * 0.28)
  }
  g.computeVertexNormals()
  const nn = g.attributes.normal
  for (let i = 0; i < nn.count; i++) { const v = new THREE.Vector3(nn.getX(i) * 0.35, Math.abs(nn.getY(i)) * 0.35 + 1, nn.getZ(i) * 0.35).normalize(); nn.setXYZ(i, v.x, v.y, v.z) }
  return g
}
const leafGeo = makeLeaf()
const frondGeo = makeLeaf(2.4, 0.5, 1.5)

// ---------- Fields ----------
function plotTufts(plot, seed, spacing, keep = 1) {
  const r = rng(seed), out = []
  for (let x = -plot.w / 2 + 0.5; x < plot.w / 2 - 0.3; x += spacing) for (let z = -plot.d / 2 + 0.5; z < plot.d / 2 - 0.3; z += spacing) {
    if (r() > keep) { r(); r(); r(); r(); continue }
    out.push({ p: [plot.x + x + (r() - 0.5) * 0.25, 0.06, plot.z + z + (r() - 0.5) * 0.25], r: [0, r() * 6.28, 0], s: [1, 0.8 + r() * 0.5, 1], c: '' })
  }
  return out
}
export function Fields({ mode }) {
  const after = mode === 'after'
  const east = PLOTS.filter((p) => !p.dry), west = PLOTS.filter((p) => p.dry)
  const greens = ['#3f8f2a', '#4a9a30', '#388526', '#57a53a']
  const eastT = useMemo(() => { const r = rng(1); return east.flatMap((p, i) => plotTufts(p, 100 + i, 0.64)).map((t) => ({ ...t, c: greens[(r() * 4) | 0] })) }, [])
  const westT = useMemo(() => { const r = rng(2); return west.flatMap((p, i) => plotTufts(p, 200 + i, 0.64)).map((t) => ({ ...t, c: greens[(r() * 4) | 0] })) }, [])
  const stubble = useMemo(() => { const r = rng(3); return west.flatMap((p, i) => plotTufts(p, 300 + i, 0.9, 0.16)).map((t) => ({ ...t, s: [0.8, 0.35 + r() * 0.3, 0.8], c: r() > 0.5 ? '#b89a55' : '#9c8748' })) }, [])
  const probes = useMemo(() => PLOTS.map((p) => [p.x + p.w * 0.22, p.z - p.d * 0.2]), [])
  return (
    <group>
      <Static>
      {PLOTS.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh userData={{ dyn: true }} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={[p.w, p.d, 1]} geometry={G.plane} material={after || !p.dry ? M.mud : M.cracked} receiveShadow />
          <B p={[0, 0.12, p.d / 2 + 0.3]} s={[p.w + 1.2, 0.26, 0.6]} m={M.dirt} shadow={false} />
          <B p={[0, 0.12, -p.d / 2 - 0.3]} s={[p.w + 1.2, 0.26, 0.6]} m={M.dirt} shadow={false} />
          <B p={[p.w / 2 + 0.3, 0.12, 0]} s={[0.6, 0.26, p.d]} m={M.dirt} shadow={false} />
          <B p={[-p.w / 2 - 0.3, 0.12, 0]} s={[0.6, 0.26, p.d]} m={M.dirt} shadow={false} />
        </group>
      ))}
      </Static>
      <Inst geometry={tuftGeo} material={M.paddy} items={eastT} castShadow={false} />
      <group visible={after}><Inst geometry={tuftGeo} material={M.paddy} items={westT} castShadow={false} /></group>
      <group visible={!after}><Inst geometry={tuftGeo} material={M.paddy} items={stubble} castShadow={false} /></group>
      <group visible={after}>
        <Static>
        {probes.map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <B p={[0, 0.55, 0]} s={[0.04, 1.1, 0.04]} m={M.steel} />
            <B p={[0, 1.12, 0]} s={[0.2, 0.26, 0.12]} m={M.white} />
            <B p={[0, 1.3, 0]} s={[0.22, 0.02, 0.16]} m={M.panel} r={[0.4, 0, 0]} />
            <mesh position={[0, 1.14, 0.065]} geometry={G.sphere} scale={0.025} material={M.ledGreen} />
          </group>
        ))}
        </Static>
      </group>
    </group>
  )
}

// ---------- Vegetation ----------
// keep plants out of every camera position and out of Ramen's way
const CLEAR = [
  ...Object.values(VIEWS).filter((v) => v.pos[1] < 10).flatMap((v) => [[v.pos[0], v.pos[2], 6], [(v.pos[0] * 2 + v.look[0]) / 3, (v.pos[2] * 2 + v.look[2]) / 3, 4]]),
  ...GUIDE.flatMap((g) => { const ax = g.spot[0] - g.focus[0], az = g.spot[1] - g.focus[2], l = Math.hypot(ax, az) || 1; return [[g.spot[0], g.spot[1], 5], [g.spot[0] + (ax / l) * 6, g.spot[1] + (az / l) * 6, 6.5], ...(g.via || []).map((v) => [v[0], v[1], 3])] }),
]
function blocked(x, z) {
  for (const [cx, cz, cr] of CLEAR) if (Math.hypot(x - cx, z - cz) < cr) return true
  if (x > -47 && x < 47 && z > 27 && z < 81) return true
  if (x > -22 && x < 24 && z > -15 && z < 13) return true
  if (Math.hypot(x - SITE.huller[0], z - SITE.huller[2]) < 9) return true
  if (Math.hypot(x - SITE.pond[0], z - SITE.pond[2]) < 12) return true
  if (Math.hypot(x - 20, z - 23) < 6) return true
  if (Math.hypot(x + 9, z - 23) < 7) return true
  for (const h of HOUSES) if (Math.hypot(x - h[0], z - h[1]) < 7) return true
  for (const rd of ROADS) for (let i = 0; i < rd.pts.length - 1; i++) {
    const a = rd.pts[i], b = rd.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)))
    if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < rd.w * 0.5 + 1.2) return true
  }
  return false
}
export function Vegetation() {
  const data = useMemo(() => {
    const r = rng(42)
    const spot = (rmin, rmax, cx = 0, cz = 0) => { for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = rmin + r() * (rmax - rmin), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (!blocked(x, z) && Math.hypot(x, z) < 108) return [x, z] } return null }
    const bananaP = [], palmP = [], bambooP = [], treeP = [[], [], [], [], []], treeFarP = [[], [], [], [], []]
    const bananaTrunks = [], bananaLeaves = [], palmTrunks = [], fronds = [], culms = [], bambooLeaves = [], trunks = [], canopies = [], grass = []
    const bGreens = ['#4f9a35', '#5aa83c', '#458b30', '#68b145'], dGreens = ['#2f6b2f', '#3a7a35', '#2a5f2c', '#447f3a']
    const banana = (x, z) => {
      bananaP.push({ p: [x, 0, z], r: [0, r() * 6.28, 0], s: 3 + r() * 1.8 })
      const h = 2 + r() * 1.3
      bananaTrunks.push({ p: [x, h / 2, z], s: [0.15, h, 0.15], r: [(r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.12] })
      const n = 7 + ((r() * 3) | 0)
      for (let i = 0; i < n; i++) bananaLeaves.push({ p: [x, h - 0.15, z], r: [0.35 + r() * 0.75, (i / n) * 6.28 + r() * 0.5, 0], s: 0.8 + r() * 0.5, c: bGreens[(r() * 4) | 0] })
    }
    const palm = (x, z) => {
      palmP.push({ p: [x, 0, z], r: [0, r() * 6.28, 0], s: 5.5 + r() * 3 })
      const h = 8 + r() * 5, lx = (r() - 0.5) * 0.08, lz = (r() - 0.5) * 0.08
      palmTrunks.push({ p: [x + lz * h * 0.5, h / 2, z - lx * h * 0.5], s: [0.1, h, 0.1], r: [lx, 0, lz] })
      for (let i = 0; i < 10; i++) fronds.push({ p: [x + lz * h, h - 0.1, z - lx * h], r: [0.5 + r() * 0.8, (i / 10) * 6.28 + r() * 0.4, 0], s: 0.9 + r() * 0.4, c: dGreens[(r() * 4) | 0] })
    }
    const bambooGrove = (cx, cz) => {
      for (let i = 0; i < q(6, 4); i++) bambooP.push({ p: [cx + (r() - 0.5) * 3.4, 0, cz + (r() - 0.5) * 3.4], r: [0, r() * 6.28, 0], s: ((h) => [h * 0.42, h, h * 0.42])(7.5 + r() * 4.5) })
      const n = 12 + ((r() * 8) | 0)
      for (let i = 0; i < n; i++) {
        const a = r() * 6.28, d = r() * 1.6, h = 7 + r() * 5, lx = Math.cos(a) * (0.08 + r() * 0.14), lz = Math.sin(a) * (0.08 + r() * 0.14)
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d
        culms.push({ p: [x + lx * h * 0.5, h / 2, z + lz * h * 0.5], s: [0.055, h, 0.055], r: [lz, 0, -lx] })
        for (let k = 0; k < 3; k++) { const f = 0.6 + k * 0.18; bambooLeaves.push({ p: [x + lx * h * f * 1.1, h * f, z + lz * h * f * 1.1], s: [1.1 + r() * 0.6, 1.4 + r(), 1.1 + r() * 0.6], r: [r(), r() * 6, r()], c: ['#7fa84a', '#6c983f', '#8db557'][(r() * 3) | 0] }) }
      }
    }
    const tree = (x, z) => {
      ;(Math.hypot(x, z) < 60 ? treeP : treeFarP)[(r() * 5) | 0].push({ p: [x, 0, z], r: [0, r() * 6.28, 0], s: 8 + r() * 5, c: ['#86b06c', '#7aa862', '#93b877'][(r() * 3) | 0] })
      const h = 3.5 + r() * 3
      trunks.push({ p: [x, h / 2, z], s: [0.28, h, 0.28], r: [0, 0, (r() - 0.5) * 0.1] })
      for (let k = 0; k < 5; k++) { const s = 2.2 + r() * 1.8; canopies.push({ p: [x + (r() - 0.5) * 3, h + 0.6 + r() * 2, z + (r() - 0.5) * 3], s: [s, s * 0.75, s], r: [r(), r() * 6, r()], c: dGreens[(r() * 4) | 0] }) }
    }
    // hand-placed clusters so every station is framed by foliage
    ;[[-36, -24], [-48, -30], [-26, -36], [-52, -46], [-36, -50], [24, -12], [28, 6], [40, 12], [38, 26], [-26, 10], [-26, 22], [-16, 27], [4, 17], [-4, -18], [10, -16], [48, 24], [-48, 22], [26, 14]].forEach(([cx, cz]) => {
      const n = q(3, 2) + ((r() * q(3, 2)) | 0)
      for (let i = 0; i < n; i++) { const s = spot(0, 4, cx, cz); if (s) banana(s[0], s[1]) }
    })
    ;[[-62, -26], [-66, -56], [-20, -52], [34, -22], [58, 6], [-58, 8], [-60, 40], [62, 50], [52, -30], [-8, -38], [70, 24], [-74, -10]].forEach(([cx, cz]) => { if (!blocked(cx, cz)) bambooGrove(cx, cz) })
    for (let i = 0; i < q(46, 28); i++) { const s = i < q(22, 12) ? spot(0, 16, -42, -38) : spot(20, 100); if (s) palm(s[0], s[1]) }
    for (let i = 0; i < q(44, 18); i++) { const s = spot(48, 106); if (s) tree(s[0], s[1]) }
    for (let i = 0; i < q(14, 7); i++) { const s = spot(0, 22, -42, -40); if (s) tree(s[0], s[1]) }
    for (let i = 0; i < q(26, 8); i++) { const s = spot(60, 104); if (s) banana(s[0], s[1]) }
    for (let i = 0; i < q(3400, 2200); i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * 104, x = Math.cos(a) * d, z = Math.sin(a) * d
      if (blocked(x, z)) continue
      grass.push({ p: [x, 0, z], r: [0, r() * 6, 0], s: [1.3, 0.5 + r() * 0.9, 1.3], c: ['#3f7a26', '#4a862c', '#356d22', '#5f8a34'][(r() * 4) | 0] })
    }
    return { bananaP, palmP, bambooP, treeP, treeFarP, grass }
  }, [])
  return (
    <group>
      <GltfInstances matte url={MODELS.banana} items={data.bananaP} />
      <GltfInstances matte url={MODELS.palm} items={data.palmP} />
      <GltfInstances matte url={MODELS.bamboo} items={data.bambooP} />
      {data.treeP.map((items, i) => items.length > 0 && <GltfInstances matte key={i} url={MODELS.trees} node={`NormalTree_${i + 1}`} items={items} />)}
      {data.treeFarP.map((items, i) => items.length > 0 && <GltfInstances matte key={'f' + i} url={MODELS.trees} node={`NormalTree_${i + 1}`} items={items} castShadow={false} />)}
      <Inst geometry={tuftGeo} material={M.paddy} items={data.grass} castShadow={false} />
    </group>
  )
}
