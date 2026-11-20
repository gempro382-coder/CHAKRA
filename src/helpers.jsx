import React, { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildTextures, fbm } from './textures.js'
import { live } from './store.js'

const T = buildTextures()
const std = (o) => new THREE.MeshStandardMaterial(o)
// Lambert is far cheaper per pixel than PBR; used for everything matte that fills the screen (ground, foliage, walls)
const lam = (o) => new THREE.MeshLambertMaterial(o)
const flat = (name, rx, ry, o = {}) => lam({ map: scan(name, 'diff', rx, ry), ...o })
// scanned PBR texture sets from Poly Haven (public/textures); they stream in after first paint
const texLoader = new THREE.TextureLoader()
const BASE = import.meta.env.BASE_URL
function scan(name, kind, rx, ry) {
  const t = texLoader.load(`${BASE}textures/${name}_${kind}.jpg`)
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8
  if (kind === 'diff') t.colorSpace = THREE.SRGBColorSpace
  return t
}
const pbr = (name, rx, ry, o = {}) => std({ map: scan(name, 'diff', rx, ry), normalMap: scan(name, 'nor', rx, ry), roughnessMap: scan(name, 'rough', rx, ry), roughness: 1, ...o })
const pathAlpha = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 4
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 0)
  gr.addColorStop(0, '#000'); gr.addColorStop(0.24, '#fff'); gr.addColorStop(0.76, '#fff'); gr.addColorStop(1, '#000')
  g.fillStyle = gr; g.fillRect(0, 0, 64, 4)
  return new THREE.CanvasTexture(c)
})()
export const windUniform = { value: 0 }

function sway(mat, amp) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = windUniform
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float ph = instanceMatrix[3][0]*0.35 + instanceMatrix[3][2]*0.27;
      float hh = position.y*position.y;
      transformed.x += sin(uTime*1.6+ph)*${amp}*hh;
      transformed.z += cos(uTime*1.15+ph*1.3)*${amp}*0.6*hh;
      #endif`)
    // foliage is lit as if always facing the sky, whichever side is seen
    s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      normal = normalize(vNormal); nonPerturbedNormal = normal;`)
  }
  return mat
}

export const M = {
  grass: flat('leafy_grass', 300, 300, { color: new THREE.Color(0.6, 1.18, 0.42) }),
  dirt: flat('dirt', 3, 1, { color: new THREE.Color(1.75, 1.45, 1.15) }),
  path: flat('dirt', 1, 1, { color: new THREE.Color(2.0, 1.6, 1.2), alphaMap: pathAlpha, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  cracked: flat('mud_cracked_dry_03', 6, 6, { color: '#e2c79c' }),
  mud: std({ map: scan('brown_mud_02', 'diff', 5, 5), normalMap: scan('brown_mud_02', 'nor', 5, 5), roughness: 0.2, metalness: 0, color: '#aab79a' }),
  mudDry: flat('brown_mud_02', 4, 1, { color: new THREE.Color(1.3, 1.1, 0.9) }),
  tinRed: pbr('corrugated_iron_02', 3, 1.5, { color: new THREE.Color(1.7, 0.62, 0.45), metalness: 0.3, side: THREE.DoubleSide }),
  tinGrey: pbr('corrugated_iron_02', 3, 1.5, { color: new THREE.Color(1.5, 1.5, 1.5), metalness: 0.45, side: THREE.DoubleSide }),
  tinGreen: pbr('corrugated_iron_02', 3, 1.5, { color: new THREE.Color(0.65, 1.35, 1.0), metalness: 0.3, side: THREE.DoubleSide }),
  panel: std({ map: T.panel, roughness: 0.16, metalness: 0.55, envMapIntensity: 1.4 }),
  alu: std({ color: '#c3c8cc', roughness: 0.35, metalness: 0.9 }),
  steel: std({ color: '#8d949a', roughness: 0.45, metalness: 0.85 }),
  darkSteel: std({ color: '#2b2f33', roughness: 0.5, metalness: 0.8 }),
  rust: std({ color: '#5a3a26', roughness: 0.9, metalness: 0.4 }),
  black: std({ color: '#17191b', roughness: 0.7, metalness: 0.4 }),
  rubber: std({ color: '#121212', roughness: 0.95 }),
  plaster: lam({ map: T.plaster }),
  wood: pbr('wood_planks', 1, 1),
  bamboo: std({ map: T.bamboo, roughness: 0.6 }),
  concrete: pbr('concrete_floor_worn_001', 2, 2),
  coldPanel: std({ map: T.coldPanel, roughness: 0.35, metalness: 0.25 }),
  jute: lam({ map: T.jute }),
  brick: pbr('red_brick_03', 2.2, 1.4),
  thatch: pbr('bamboo_wall', 3, 1, { side: THREE.DoubleSide }),
  white: std({ color: '#f1f1ec', roughness: 0.6 }),
  rice: lam({ color: '#f6f1e3' }),
  bran: lam({ color: '#b98d54' }),
  paddyGrain: lam({ color: '#c9a646' }),
  teal: std({ color: '#0f4a43', roughness: 0.55, metalness: 0.3 }),
  blue: std({ color: '#1d5fa8', roughness: 0.4, metalness: 0.5 }),
  green: std({ color: '#1f8f63', roughness: 0.5, metalness: 0.3 }),
  orange: std({ color: '#e4772e', roughness: 0.5, metalness: 0.3 }),
  red: std({ color: '#b3261e', roughness: 0.6 }),
  skin: std({ color: '#9c6a45', roughness: 0.8 }),
  cloth: std({ color: '#c9902c', roughness: 0.9 }),
  dhoti: std({ color: '#efe9d8', roughness: 0.95 }),
  frost: std({ color: '#dff4ff', roughness: 0.9, emissive: '#7fc8ff', emissiveIntensity: 0.15 }),
  glassDark: std({ color: '#0c1114', roughness: 0.15, metalness: 0.6 }),
  window: std({ color: '#2a2418', emissive: '#ffb347', emissiveIntensity: 0, roughness: 0.6 }),
  ledGreen: new THREE.MeshBasicMaterial({ color: '#39ff88', toneMapped: false }),
  ledAmber: new THREE.MeshBasicMaterial({ color: '#ffb020', toneMapped: false }),
  ledRed: new THREE.MeshBasicMaterial({ color: '#ff3b2f', toneMapped: false }),
  ledOff: new THREE.MeshBasicMaterial({ color: '#20262a' }),
  paddy: sway(lam({ color: '#ffffff', side: THREE.DoubleSide }), '0.28'),
  leaf: sway(lam({ color: '#ffffff', side: THREE.DoubleSide }), '0.004'),
  trunk: lam({ color: '#6b5a44' }),
  bananaTrunk: lam({ color: '#8a9a4e' }),
  canopy: lam({ color: '#ffffff' }),
  foliage: lam({ color: '#ffffff', vertexColors: true }),
  bank: lam({ color: '#6f7f42' }),
  smoke: new THREE.MeshBasicMaterial({ color: '#1c1c1c', transparent: true, opacity: 0.3, depthWrite: false }),
  dust: new THREE.MeshBasicMaterial({ color: '#e8dcc0', transparent: true, opacity: 0.25, depthWrite: false }),
  mist: new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0.22, depthWrite: false }),
}

export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  sphereLo: new THREE.IcosahedronGeometry(1, 1),
  cone: new THREE.ConeGeometry(1, 1, 20),
  plane: new THREE.PlaneGeometry(1, 1),
}
// lumpy, smooth-shaded foliage mass with baked light/dark mottling (detail 2 up close, 1 for distant hills)
const makeCanopy = (detail) => {
  let g = new THREE.IcosahedronGeometry(1, detail)
  g.deleteAttribute('uv'); g.deleteAttribute('normal')
  g = mergeVertices(g)
  const p = g.attributes.position, col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const n = fbm(x * 1.7 + 5, y * 1.7 + z * 1.3 + 9, 3), n2 = fbm(x * 4 + z * 3, y * 4 - z * 2, 2)
    const d = 0.72 + n * 0.55 + n2 * 0.14
    p.setXYZ(i, x * d, y * d * (y < 0 ? 0.7 : 1), z * d)
    const shade = 0.5 + (d - 0.72) * 0.9 + Math.max(0, y) * 0.3
    col[i * 3] = shade * 0.95; col[i * 3 + 1] = shade; col[i * 3 + 2] = shade * 0.85
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}
G.canopy = makeCanopy(2)
G.canopyLo = makeCanopy(1)

export function B({ p = [0, 0, 0], s = [1, 1, 1], r, m = M.white, shadow = true, ...rest }) {
  return <mesh geometry={G.box} material={m} position={p} scale={s} rotation={r} castShadow={shadow} receiveShadow {...rest} />
}
// cylinder: rad, height (axis y by default)
export function C({ p = [0, 0, 0], rad = 0.5, h = 1, r, m = M.steel, top, lo, shadow = true }) {
  const geo = useMemo(() => (top !== undefined ? new THREE.CylinderGeometry(top, rad, h, 16) : null), [top, rad, h])
  if (geo) return <mesh geometry={geo} material={m} position={p} rotation={r} castShadow={shadow} receiveShadow />
  return <mesh geometry={lo ? G.cyl8 : G.cyl} material={m} position={p} scale={[rad, h, rad]} rotation={r} castShadow={shadow} receiveShadow />
}
export function S({ p = [0, 0, 0], s = 1, m = M.white, shadow = true }) {
  return <mesh geometry={G.sphere} material={m} position={p} scale={s} castShadow={shadow} receiveShadow />
}

const _o = new THREE.Object3D()
const _c = new THREE.Color()
// items: [{p,r,s,c}]
export function Inst({ geometry, material, items, castShadow = true, receiveShadow = true, count }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    items.forEach((it, i) => {
      _o.position.set(it.p[0], it.p[1], it.p[2])
      _o.rotation.set(0, 0, 0)
      if (it.q) _o.quaternion.copy(it.q)
      else if (it.r) _o.rotation.set(it.r[0], it.r[1], it.r[2], 'YXZ')
      if (Array.isArray(it.s)) _o.scale.set(it.s[0], it.s[1], it.s[2]); else _o.scale.setScalar(it.s ?? 1)
      _o.updateMatrix()
      mesh.setMatrixAt(i, _o.matrix)
      if (it.c) mesh.setColorAt(i, _c.set(it.c))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} count={count ?? items.length} castShadow={castShadow} receiveShadow={receiveShadow} />
}

// Draw-call saver. Everything static inside is merged into one mesh per material after mounting,
// so a building made of dozens of boxes costs a handful of draw calls instead of dozens.
// Parts that move or swap materials opt out with userData={{ dyn: true }}.
const KEEP = ['position', 'normal', 'uv']
export function Static({ children, ...props }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const root = ref.current
    root.updateWorldMatrix(true, true)
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
    const skip = (o) => { for (let p = o; p && p !== root; p = p.parent) if (p.userData.dyn || p.visible === false) return true; return false }
    const groups = new Map()
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.userData.baked || skip(o)) return
      const k = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '')
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(o)
    })
    const made = [], hidden = []
    groups.forEach((list) => {
      if (list.length < 2) return
      const geos = list.map((o) => {
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
        Object.keys(g.attributes).forEach((a) => { if (!KEEP.includes(a)) g.deleteAttribute(a) })
        if (!g.attributes.normal) g.computeVertexNormals()
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
        g.morphAttributes = {}
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))
        return g
      })
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      if (!merged) return
      const m = new THREE.Mesh(merged, list[0].material)
      m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow; m.userData.baked = true
      root.add(m); made.push(m)
      list.forEach((o) => { o.visible = false; hidden.push(o) })
    })
    return () => { made.forEach((m) => { root.remove(m); m.geometry.dispose() }); hidden.forEach((o) => { o.visible = true }) }
  }, [])
  return <group ref={ref} {...props}>{children}</group>
}

// rotating part; speed() returns rad/s
export function Spin({ speed, axis = 'z', children, ...rest }) {
  const ref = useRef()
  useFrame((_, dt) => { ref.current.rotation[axis] += speed() * dt })
  return <group ref={ref} userData={{ dyn: true }} {...rest}>{children}</group>
}

// soft rising puffs (smoke, dust, cold mist)
export function Puffs({ position, material = M.smoke, active, count = 22, rise = 4, spread = 1.2, size = 0.5, drift = [0.6, 0, 0.2] }) {
  const ref = useRef()
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => [Math.sin(i * 12.9) * 0.5, Math.cos(i * 7.3) * 0.5, i / count]), [count])
  useFrame(() => {
    const a = active()
    const mesh = ref.current
    mesh.visible = a > 0.02
    if (!mesh.visible) return
    const t = live.clock
    seeds.forEach((s, i) => {
      const age = (t * 0.35 + s[2]) % 1
      _o.position.set(s[0] * spread * age + drift[0] * age * rise * 0.5, age * rise, s[1] * spread * age + drift[2] * age * rise * 0.5)
      _o.rotation.set(0, 0, 0)
      _o.scale.setScalar(size * (0.35 + age * 1.6) * a * (1 - age * 0.35))
      _o.updateMatrix(); mesh.setMatrixAt(i, _o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[G.sphereLo, material, count]} position={position} frustumCulled={false} />
}

export function Sign({ tex, p, r, w = 3, h = 0.75 }) {
  return (
    <group position={p} rotation={r}>
      {[0, Math.PI].map((ry) => (
        <mesh key={ry} rotation={[0, ry, 0]} position={[0, 0, ry ? -0.035 : 0.035]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={tex} roughness={0.7} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.25} />
        </mesh>
      ))}
      <mesh><boxGeometry args={[w + 0.08, h + 0.08, 0.04]} /><meshStandardMaterial color="#20262a" roughness={0.6} /></mesh>
    </group>
  )
}
