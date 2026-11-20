import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { G } from './helpers.jsx'
import { sim, live, useStore } from './store.js'
import { ZONES, SITE, POLES, FLOW_COLORS, energyAt, dieselAt, ambientTemp, PUMP_KW } from './data.js'

const _o = new THREE.Object3D()
const conduit = new THREE.MeshStandardMaterial({ color: '#1b1e20', roughness: 0.7 })

// ---------- energy flow pulses ----------
const g2 = (pts) => pts.map((p) => (p.length === 3 ? new THREE.Vector3(...p) : new THREE.Vector3(p[0], 0.2, p[1])))
const S0 = [-13, -0.7]
const CABLES = [
  { id: 'solar', color: FLOW_COLORS.solar, pts: [[-7.4, 0.5, -3.9], [-9, 0.2, -5.6], [-10.4, 0.2, -5.6], [-10.5, 0.6, -4.6]], level: (e) => e.solar / 13.6 },
  { id: 'pump', color: FLOW_COLORS.pump, pts: [S0, [-11.5, 4.5], [-3, 9.8], [8, 14.6], [15, 20], [19.6, 22.3]], level: (e) => e.pump / PUMP_KW },
  { id: 'cold', color: FLOW_COLORS.cold, pts: [S0, [-10.5, 5], [-2, 6.6], [7.5, 5.6], [11.6, 1.2], [12, -3.4]], level: (e) => e.cold / 2.5 },
  { id: 'huller', color: FLOW_COLORS.huller, pts: [S0, [-14.6, 4], [-16.4, 9], [-17.4, 14.2]], level: (e) => e.huller / 7.5 },
  { id: 'battery', color: FLOW_COLORS.battery, pts: [[-10.6, 0.5, -2.6], [-10.1, 0.25, -2.2], [-9.4, 0.25, -2.5], [-8.9, 0.6, -2.9]], level: (e) => (e.charge > 0.05 ? e.charge / 3 : e.discharge > 0.05 ? -0.8 : 0) },
  { id: 'grid', color: FLOW_COLORS.grid, overhead: true, pts: [[-13, 3.5, -5], [-13, 7.2, -11], ...POLES.slice(1, 5).map(([x, z]) => [x, 7.5, z])], level: (e) => (e.discharge > 0.05 ? 0.9 : Math.min(1, e.exp / 4)) },
]
function Cable({ c }) {
  const ref = useRef()
  const { curve, len, n, tube, mat } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(g2(c.pts), false, 'catmullrom', 0.25)
    const len = curve.getLength()
    return { curve, len, n: Math.max(4, Math.ceil(len / 2.4)), tube: new THREE.TubeGeometry(curve, 80, 0.05, 6), mat: new THREE.MeshBasicMaterial({ color: c.color, toneMapped: false }) }
  }, [])
  const phase = useRef(0)
  useFrame((_, dt) => {
    const lv = c.level(live.e || energyAt(sim.t))
    const a = Math.min(1, Math.abs(lv))
    const mesh = ref.current
    mesh.visible = a > 0.03
    if (!mesh.visible) return
    phase.current = (phase.current + (Math.sign(lv) * dt * (3 + a * 5)) / len + 1) % 1
    for (let i = 0; i < n; i++) {
      const t = (i / n + phase.current) % 1
      const p = curve.getPointAt(t)
      _o.position.set(p.x, p.y + (c.overhead ? 0 : 0.12), p.z)
      const edge = Math.min(1, t * 12, (1 - t) * 12)
      _o.scale.setScalar((0.11 + a * 0.13) * edge * (c.overhead ? 1.5 : 1))
      _o.updateMatrix(); mesh.setMatrixAt(i, _o.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      {!c.overhead && <mesh geometry={tube} material={conduit} />}
      <instancedMesh ref={ref} args={[G.sphereLo, mat, n]} frustumCulled={false} />
    </>
  )
}
export function Flows() { return CABLES.map((c) => <Cable key={c.id} c={c} />) }

// ---------- zone markers ----------
function Marker({ z }) {
  const mode = useStore((s) => s.mode), active = useStore((s) => s.zone === z.id), visit = useStore((s) => s.visit), tour = useStore((s) => (s.guide >= 0 ? 0 : s.tour)), intro = useStore((s) => s.intro)
  const gem = useRef()
  const color = mode === 'after' ? '#f5a623' : '#ff5a3c'
  useFrame(() => { gem.current.rotation.y = live.clock * 1.2; gem.current.position.y = 5.6 + Math.sin(live.clock * 2 + z.n) * 0.18 })
  return (
    <group position={z.anchor}>
      <mesh position={[0, 2.9, 0]}><cylinderGeometry args={[0.035, 0.035, 5.2, 6]} /><meshBasicMaterial color={color} transparent opacity={0.35} toneMapped={false} depthWrite={false} /></mesh>
      <mesh ref={gem} position={[0, 5.6, 0]} scale={[0.34, 0.5, 0.34]}><octahedronGeometry args={[1, 0]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      {!intro && (
        <Html position={[0, 6.7, 0]} center zIndexRange={[30, 10]}>
          <button className={`marker ${mode} ${active ? 'on' : ''} ${tour >= 0 ? 'quiet' : ''}`} onClick={() => visit(z.id)}>
            <b>{z.n}</b><span>{mode === 'after' ? z.short : z.leak}</span>
          </button>
        </Html>
      )}
    </group>
  )
}
export function Markers() { return ZONES.map((z) => <Marker key={z.id} z={z} />) }

// ---------- live callouts ----------
function Callout({ p, kind = '', children, far = 30 }) {
  const ref = useRef(), v = useMemo(() => new THREE.Vector3(...p), [])
  const { camera } = useThree()
  // only labels close to the viewer are shown; fewer still while a story is playing
  useFrame(() => { if (!ref.current) return; const st = useStore.getState(); const lim = st.guide >= 0 || st.tour >= 0 ? Math.min(far, 20) : Math.min(far, 34); ref.current.style.display = camera.position.distanceTo(v) > lim ? 'none' : '' })
  return <Html position={p} center zIndexRange={[9, 1]} style={{ pointerEvents: 'none' }}><div ref={ref} className={`callout ${kind}`}>{children}</div></Html>
}
const f1 = (x) => x.toFixed(1)
export function Callouts() {
  const mode = useStore((s) => s.mode), t = useStore((s) => s.time), intro = useStore((s) => s.intro)
  if (intro) return null
  if (mode === 'before') {
    const d = dieselAt(t)
    return (
      <>
        <Callout p={[19.4, 3.4, 23]} kind="bad">{d.on ? <>Diesel pump ON · <b>₹116/hr</b> · 1.2 L/hr</> : t < 6 ? <>Diesel pump · ₹97 a litre</> : <>Today: <b>{f1(d.litres)} L</b> burnt · <b>₹{Math.round(d.cost)}</b> in cash</>}</Callout>
        <Callout p={[-22, 2.6, 46]} kind="bad" far={70}>No water, no transplanting — fields stay bare</Callout>
        <Callout p={[15, 2.4, -3]} kind="bad"><b>{Math.round(ambientTemp(t))} °C</b> · 15–20% of the harvest spoils here</Callout>
        <Callout p={[-11, 2.6, 25.4]} kind="bad">Raw paddy → town mill. The margin leaves with it.</Callout>
        {t >= 17 && t < 21 && <Callout p={[-36, 8.5, -31]} kind="bad" far={90}>Evening peak — the feeder is stressed</Callout>}
      </>
    )
  }
  const e = energyAt(t)
  return (
    <>
      <Callout p={[0, 4.3, -3.5]} kind="sun">☀ 15 kWp array · <b>{f1(e.solar)} kW</b> now</Callout>
      <Callout p={[-13, 4.6, -3]}>CHAKRA Bridge · decides who gets the next unit</Callout>
      <Callout p={[-8.6, 3.0, -3.2]} kind="bat">Battery <b>{Math.round(e.soc * 10)}%</b>{e.charge > 0.05 ? ' · charging' : e.discharge > 0.05 ? ' · releasing 2.4 kW' : ''}</Callout>
      <Callout p={[19.4, 3.4, 23]} kind="water">{e.pump > 0.3 ? <>Solar pump <b>{f1(e.pump)} kW</b> · ₹55/hr</> : t < 6 ? <>Pump booked for 6:00 am</> : t >= 17 && t < 21 ? <>Pump OFF — evening peak</> : <>Pump idle · today's slots done</>}</Callout>
      <Callout p={[15, 4.5, -4]} kind="cold">Cold room <b>{f1(e.temp)} °C</b> · {e.cold > 1 ? 'pre-cooling on solar surplus' : t >= 17 && t < 21 ? 'chiller OFF, coasting' : 'holding'}</Callout>
      <Callout p={[-18, 4.9, 16]} kind="mill">{e.huller > 1 ? <>Huller milling · <b>7.5 kW</b></> : <>Huller waits for the afternoon sun</>}</Callout>
      <Callout p={[-13, 9.2, -11]} kind="grid" far={70}>{e.discharge > 0.05 ? <>Battery → village lights · <b>2.4 kW</b> off the feeder</> : e.exp > 0.3 ? <>Surplus → APDCL grid · <b>{f1(e.exp)} kW</b></> : <>APDCL feeder</>}</Callout>

    </>
  )
}
