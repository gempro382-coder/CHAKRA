import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { rng, signTexture } from './textures.js'
import { M, G, B, C, S, Inst, Spin, Puffs, Sign, Static } from './helpers.jsx'
import { sim, live, useStore } from './store.js'
import { SITE, POLES, HOUSES, energyAt, dieselAt, PUMP_KW } from './data.js'
import { Model, GltfInstances, MODELS } from './Models.jsx'
import { LOW } from './quality.js'

const E = () => live.e || energyAt(sim.t)
const panelMats = [M.alu, M.alu, M.panel, M.alu, M.alu, M.alu]
const PANEL_ROW = Array.from({ length: 12 }, (_, i) => ({ p: [(i - 5.5) * 1.16, 0, 0], s: [1.12, 0.04, 2.05] }))

// ---------- produce crates ----------
const PRODUCE = {
  tomato: { c: ['#d8281c', '#e63b24', '#c4201a'], s: [0.07, 0.065, 0.07] },
  chilli: { c: ['#2f8f2a', '#3fa02f', '#c22a1c'], s: [0.028, 0.028, 0.1] },
  lemon: { c: ['#e9d32c', '#f2e04a', '#cfc22a'], s: [0.06, 0.055, 0.065] },
  greens: { c: ['#3d9a35', '#4fae3f', '#2f7f2c'], s: [0.13, 0.07, 0.12] },
}
const ROT = ['#4a3a22', '#5c4a2a', '#3a2f20', '#6b5a35', '#2e2a1e', '#5a2a1c', '#4f5230']
function crateItems(list, spoiled, seed = 1) {
  const r = rng(seed), boxes = [], produce = []
  list.forEach(([x, y, z, type, ry = 0]) => {
    boxes.push({ p: [x, y + 0.16, z], s: [0.62, 0.32, 0.42], r: [0, ry, 0] })
    const P = PRODUCE[type]
    for (let i = 0; i < 26; i++) {
      const lx = (r() - 0.5) * 0.5, lz = (r() - 0.5) * 0.32, c = Math.cos(ry), s = Math.sin(ry)
      produce.push({
        p: [x + lx * c + lz * s, y + 0.33 + r() * 0.05 - (spoiled ? 0.03 : 0), z - lx * s + lz * c],
        s: [P.s[0], P.s[1] * (spoiled ? 0.6 : 1), P.s[2]], r: [r(), r() * 6, r()],
        c: spoiled && r() > 0.12 ? ROT[(r() * ROT.length) | 0] : P.c[(r() * 3) | 0],
      })
    }
  })
  return { boxes, produce }
}
function Crates({ list, spoiled, seed }) {
  const d = useMemo(() => crateItems(list.filter((l) => l[3] !== 'tomato'), spoiled, seed), [])
  const tom = useMemo(() => list.filter((l) => l[3] === 'tomato').map(([x, y, z, , ry = 0]) => ({ p: [x, y, z], r: [0, ry, 0], s: 0.36, c: spoiled ? '#6a4a3a' : undefined })), [])
  return (
    <>
      <Inst geometry={G.box} material={M.wood} items={d.boxes} />
      <Inst geometry={G.sphereLo} material={M.canopy} items={d.produce} castShadow={false} />
      <GltfInstances url={MODELS.tomatoes} items={tom} />
    </>
  )
}
function Sacks({ list, m = M.jute }) {
  const items = useMemo(() => list.map(([x, y, z, ry = 0]) => ({ p: [x, y + 0.17, z], s: [0.42, 0.19, 0.27], r: [0, ry, 0] })), [])
  return <Inst geometry={G.sphere} material={m} items={items} />
}

// ---------- Zone 1: solar array, Bridge shed, battery ----------
function SolarArray() {
  const [ax, , az] = SITE.array
  return (
    <group position={[ax, 0, az]}>
      {[-4.6, 0, 4.6].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <group position={[0, 1.55, 0]} rotation={[0.44, 0, 0]}>
            <Inst geometry={G.box} material={panelMats} items={PANEL_ROW} />
            <B p={[0, -0.07, 0.65]} s={[14, 0.08, 0.08]} m={M.alu} />
            <B p={[0, -0.07, -0.65]} s={[14, 0.08, 0.08]} m={M.alu} />
          </group>
          {[-6.2, -2.1, 2.1, 6.2].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <B p={[0, 0.63, 0.62]} s={[0.09, 1.26, 0.09]} m={M.steel} />
              <B p={[0, 0.92, -0.62]} s={[0.09, 1.84, 0.09]} m={M.steel} />
              <B p={[0, 0.75, 0]} s={[0.05, 0.05, 1.45]} r={[0.42, 0, 0]} m={M.steel} />
              <B p={[0, 0.08, 0.62]} s={[0.4, 0.16, 0.4]} m={M.concrete} />
              <B p={[0, 0.08, -0.62]} s={[0.4, 0.16, 0.4]} m={M.concrete} />
            </group>
          ))}
          <B p={[7.3, 0.55, -0.4]} s={[0.35, 0.5, 0.2]} m={M.white} />
        </group>
      ))}
    </group>
  )
}

function Leds({ n = 6, p, gap = 0.09 }) {
  const refs = useRef([])
  useFrame(() => {
    const t = live.clock
    refs.current.forEach((m, i) => { if (m) m.material = Math.sin(t * (2 + i * 1.3) + i * 2.1) > -0.2 ? (i % 3 === 2 ? M.ledAmber : M.ledGreen) : M.ledOff })
  })
  return Array.from({ length: n }, (_, i) => (
    <mesh key={i} userData={{ dyn: true }} ref={(m) => (refs.current[i] = m)} geometry={G.sphere} scale={0.028} position={[p[0] + i * gap, p[1], p[2]]} material={M.ledGreen} />
  ))
}

function ControlShed() {
  const sign = useMemo(() => signTexture(['CHAKRA NODE', 'Community energy hub · Barak Valley']), [])
  const bridgeSign = useMemo(() => signTexture(['CHAKRA BRIDGE'], { bg: '#f5a623', fg: '#0d3b36', accent: '#0d3b36', h: 160 }), [])
  const light = useRef()
  useFrame(() => { if (light.current) light.current.intensity = 2 + live.lights * 14 })
  const [x, , z] = SITE.shed
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.1, 0]} s={[5.6, 0.2, 4.6]} m={M.concrete} />
      <B p={[0, 1.6, -1.9]} s={[5, 2.8, 0.22]} m={M.brick} />
      <B p={[-2.4, 1.6, 0]} s={[0.22, 2.8, 4]} m={M.brick} />
      <B p={[2.4, 1.6, 0]} s={[0.22, 2.8, 4]} m={M.brick} />
      <B p={[-1.95, 1.6, 1.9]} s={[1.1, 2.8, 0.22]} m={M.brick} />
      <B p={[1.95, 1.6, 1.9]} s={[1.1, 2.8, 0.22]} m={M.brick} />
      <B p={[0, 2.75, 1.9]} s={[2.8, 0.5, 0.22]} m={M.brick} />
      <B p={[0, 3.35, 0.1]} s={[6, 0.08, 5.4]} r={[0.14, 0, 0]} m={M.tinGreen} />
      <Sign tex={sign} p={[0, 2.78, 2.03]} w={2.7} h={0.62} />
      {/* Bridge controller cabinet */}
      <group position={[-0.5, 0.2, -1.5]}>
        <B p={[0, 1.0, 0]} s={[1.1, 1.7, 0.42]} m={M.teal} />
        <B p={[0, 1.38, 0.215]} s={[0.62, 0.36, 0.02]} m={M.glassDark} />
        <mesh position={[0, 1.38, 0.228]} scale={[0.56, 0.3, 1]} geometry={G.plane}><meshBasicMaterial color="#2ee6a8" toneMapped={false} transparent opacity={0.85} /></mesh>
        <Sign tex={bridgeSign} p={[0, 1.72, 0.215]} w={0.9} h={0.14} />
        <Leds n={7} p={[-0.27, 1.08, 0.225]} />
        <Leds n={7} p={[-0.27, 0.96, 0.225]} />
        <B p={[0, 0.55, 0.22]} s={[0.8, 0.5, 0.02]} m={M.darkSteel} />
        <C p={[0.42, 2.1, 0]} rad={0.015} h={0.6} m={M.black} />
      </group>
      {/* inverter + switchgear */}
      <B p={[1.2, 1.5, -1.7]} s={[0.8, 1.0, 0.3]} m={M.white} />
      <B p={[1.2, 1.25, -1.54]} s={[0.5, 0.2, 0.02]} m={M.orange} />
      <Leds n={3} p={[1.0, 1.75, -1.54]} />
      <B p={[1.2, 0.6, -1.7]} s={[0.6, 0.5, 0.25]} m={M.steel} />
      {!LOW && <pointLight ref={light} position={[0, 2.5, 0.2]} color="#ffe2b0" distance={14} decay={1.6} />}
    </group>
  )
}

function Battery() {
  const sign = useMemo(() => signTexture(['10 kWh LFP', 'sized for the peak, not the night'], { bg: '#14261f', accent: '#7dffa0' }), [])
  const bars = useRef([])
  useFrame(() => {
    const e = E(), lit = Math.round((e.soc / 10) * 10), busy = e.charge > 0.05 || e.discharge > 0.05
    bars.current.forEach((m, i) => { if (m) m.material = i < lit ? (busy && i === lit - 1 && Math.sin(live.clock * 6) > 0 ? M.ledOff : e.discharge > 0.05 ? M.ledAmber : M.ledGreen) : M.ledOff })
  })
  const [x, , z] = SITE.battery
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.08, 0]} s={[2.4, 0.16, 1.5]} m={M.concrete} />
      <B p={[0, 1.0, -0.1]} s={[1.9, 1.7, 0.75]} m={M.white} />
      <B p={[0, 1.0, 0.28]} s={[1.7, 1.5, 0.02]} m={M.darkSteel} />
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} userData={{ dyn: true }} ref={(m) => (bars.current[i] = m)} geometry={G.box} position={[-0.72 + i * 0.16, 1.2, 0.295]} scale={[0.11, 0.42, 0.01]} material={M.ledGreen} />
      ))}
      <Sign tex={sign} p={[0, 0.62, 0.295]} w={1.5} h={0.36} />
      <B p={[0, 2.15, 0.1]} s={[2.5, 0.06, 1.7]} r={[0.2, 0, 0]} m={M.tinGrey} />
      {[-1.1, 1.1].map((px) => <B key={px} p={[px, 1.1, 0.7]} s={[0.07, 2.0, 0.07]} m={M.steel} />)}
    </group>
  )
}

// ---------- Zone 3: cold room ----------
const COLD_CRATES = [
  [-1.3, 0.25, -0.9, 'tomato'], [-1.3, 0.6, -0.9, 'tomato'], [-1.3, 0.95, -0.9, 'chilli'], [-0.55, 0.25, -0.9, 'lemon'], [-0.55, 0.6, -0.9, 'greens'],
  [0.2, 0.25, -0.9, 'greens'], [0.2, 0.6, -0.9, 'tomato'], [0.95, 0.25, -0.9, 'chilli'], [0.95, 0.6, -0.9, 'lemon'], [0.95, 0.95, -0.9, 'tomato'],
  [-1.3, 0.25, -0.2, 'lemon'], [-1.3, 0.6, -0.2, 'greens'], [1.5, 0.25, 0.1, 'tomato', 1.57], [1.5, 0.6, 0.1, 'chilli', 1.57],
  [0.6, 0.2, 2.9, 'tomato', 0.3], [1.35, 0.2, 3.0, 'greens', -0.2], [0.95, 0.52, 2.95, 'lemon', 0.1],
]
function ColdRoom() {
  const sign = useMemo(() => signTexture(['5 MT SOLAR COLD ROOM', 'pre-cooled by midday surplus'], { bg: '#e9f6fb', fg: '#0d3b36', accent: '#1d7fa8' }), [])
  const chilling = () => (E().cold > 1 ? 1 : E().cold > 0.1 ? 0.35 : 0)
  const [x, , z] = SITE.cold
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.12, 0.4]} s={[6, 0.24, 6]} m={M.concrete} />
      <B p={[0, 1.75, -2]} s={[5, 3, 0.16]} m={M.coldPanel} />
      <B p={[-2.5, 1.75, 0]} s={[0.16, 3, 4.16]} m={M.coldPanel} />
      <B p={[2.5, 1.75, 0]} s={[0.16, 3, 4.16]} m={M.coldPanel} />
      <B p={[-1.6, 1.75, 2]} s={[1.96, 3, 0.16]} m={M.coldPanel} />
      <B p={[1.9, 1.75, 2]} s={[1.36, 3, 0.16]} m={M.coldPanel} />
      <B p={[0.3, 2.85, 2]} s={[1.9, 0.8, 0.16]} m={M.coldPanel} />
      <B p={[0, 3.3, 0]} s={[5.2, 0.14, 4.3]} m={M.coldPanel} />
      {/* door swung open + strip curtain */}
      <group position={[1.22, 0.25, 2.1]} rotation={[0, 1.9, 0]}>
        <B p={[-0.92, 1.1, 0]} s={[1.84, 2.2, 0.12]} m={M.coldPanel} />
        <B p={[-1.6, 1.1, 0.09]} s={[0.06, 0.5, 0.06]} m={M.steel} />
      </group>
      {[-0.4, 0, 0.4, 0.8].map((dx, i) => (
        <mesh key={i} position={[0.1 + dx, 1.45, 2.0]} scale={[0.36, 2.0, 1]} geometry={G.plane}>
          <meshStandardMaterial color="#cfefff" transparent opacity={0.22} roughness={0.1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Sign tex={sign} p={[0, 3.75, 2.05]} w={4.4} h={0.8} />
      <Crates list={COLD_CRATES} seed={4} />
      <Model url={MODELS.crate} node="wooden_crate_02_crate" size={0.5} position={[-1.7, 0.24, 2.9]} rotation={[0, 0.35, 0]} />
      <Model url={MODELS.crate} node="wooden_crate_02_crate" size={0.5} position={[-1.5, 0.74, 2.95]} rotation={[0, 0.2, 0]} />
      {/* condenser unit, fan, frosted pipes */}
      <group position={[3.0, 0.24, 0.4]} rotation={[0, Math.PI, 0]}>
        <Model url={MODELS.aircon} node="exterior_aircon_unit" size={1.7} rotation={[0, -Math.PI / 2, 0]} />
        <C p={[0.2, 1.5, 0.4]} rad={0.045} h={0.9} m={M.frost} />
        <C p={[0.2, 1.5, 0.6]} rad={0.045} h={0.9} m={M.frost} />
        <C p={[0.35, 1.95, 0.4]} rad={0.045} h={0.4} r={[0, 0, Math.PI / 2]} m={M.frost} />
        <C p={[0.35, 1.95, 0.6]} rad={0.045} h={0.4} r={[0, 0, Math.PI / 2]} m={M.frost} />
      </group>
      {/* evaporator inside */}
      <B p={[-1, 2.85, -1.5]} s={[1.6, 0.4, 0.6]} m={M.steel} />
      <Puffs position={[0.3, 0.3, 2.4]} material={M.mist} active={chilling} count={9} rise={0.7} spread={1.4} size={0.22} drift={[0, 0, 1.6]} />
    </group>
  )
}

// ---------- Zone 4: huller ----------
function Huller() {
  const sign = useMemo(() => signTexture(['VILLAGE RICE HULLER · 7.5 kW', 'the margin stays home'], { bg: '#3a2a16', accent: '#f5a623' }), [])
  const on = () => (E().huller > 1 ? 1 : 0)
  const machine = useRef()
  useFrame(() => { machine.current.position.x = on() ? Math.sin(live.clock * 60) * 0.006 : 0 })
  const [x, , z] = SITE.huller
  return (
    <group position={[x, 0, z]} rotation={[0, 0.35, 0]}>
      <B p={[0, 0.1, 0]} s={[8, 0.2, 6]} m={M.concrete} />
      {[[-3.7, -2.7], [3.7, -2.7], [-3.7, 2.7], [3.7, 2.7], [0, -2.7]].map(([px, pz], i) => <C key={i} p={[px, 1.7, pz]} rad={0.1} h={3.2} m={M.bamboo} lo />)}
      <B p={[0, 3.75, -1.6]} s={[8.8, 0.07, 3.6]} r={[-0.38, 0, 0]} m={M.tinRed} />
      <B p={[0, 3.75, 1.6]} s={[8.8, 0.07, 3.6]} r={[0.38, 0, 0]} m={M.tinRed} />
      <B p={[0, 1.2, -2.75]} s={[7.4, 2.0, 0.08]} m={M.thatch} />
      <Sign tex={sign} p={[0, 2.72, 3.25]} w={3.6} h={0.8} />
      <group ref={machine} scale={1.3} userData={{ dyn: true }}>
        <B p={[0, 0.3, 0]} s={[2.2, 0.2, 1.1]} m={M.darkSteel} />
        <B p={[-0.2, 0.95, 0]} s={[1.0, 1.1, 0.8]} m={M.green} />
        <C p={[-0.2, 1.1, 0.42]} rad={0.42} h={0.1} r={[Math.PI / 2, 0, 0]} m={M.steel} />
        <mesh position={[-0.2, 2.05, 0]} rotation={[Math.PI, 0, 0]} material={M.tinGrey} castShadow><coneGeometry args={[0.75, 1.0, 4, 1, true]} /></mesh>
        <S p={[-0.2, 2.3, 0]} s={[0.55, 0.12, 0.55]} m={M.paddyGrain} />
        <C p={[1.0, 0.72, 0]} rad={0.26} h={0.7} r={[Math.PI / 2, 0, 0]} m={M.blue} />
        <group position={[1.0, 0.72, 0.45]}><Spin speed={() => on() * 24}><C rad={0.16} h={0.08} r={[Math.PI / 2, 0, 0]} m={M.steel} /><B p={[0.1, 0, 0.05]} s={[0.06, 0.06, 0.02]} m={M.black} shadow={false} /></Spin></group>
        <group position={[-0.2, 1.1, 0.5]}><Spin speed={() => on() * 9}><C rad={0.36} h={0.06} r={[Math.PI / 2, 0, 0]} m={M.darkSteel} /><B p={[0.25, 0, 0.04]} s={[0.1, 0.1, 0.02]} m={M.ledAmber} shadow={false} /></Spin></group>
        <B p={[0.42, 0.93, 0.5]} s={[1.25, 0.03, 0.05]} r={[0, 0, -0.3]} m={M.rubber} shadow={false} />
        <B p={[-1.0, 0.75, 0]} s={[0.8, 0.06, 0.4]} r={[0, 0, 0.5]} m={M.tinGrey} />
        <B p={[-0.2, 0.6, -0.65]} s={[0.35, 0.06, 0.7]} r={[-0.5, 0, 0]} m={M.tinGrey} />
      </group>
      <mesh position={[-2.3, 0.5, 0.2]} scale={[0.9, 0.65, 0.9]} geometry={G.cone} material={M.rice} castShadow />
      <mesh position={[-0.3, 0.4, -1.9]} scale={[0.65, 0.42, 0.65]} geometry={G.cone} material={M.bran} castShadow />
      <Sacks list={[[2.4, 0.2, 1.2], [2.4, 0.5, 1.2], [3.0, 0.2, 0.6, 0.4], [2.5, 0.2, 0.3, 1.2], [2.8, 0.5, 0.5, 0.8], [2.6, 0.8, 0.9, 0.2], [3.1, 0.2, 1.6, 1.5]]} />
      <Sacks m={M.rice} list={[[-2.9, 0.2, 1.4], [-2.9, 0.5, 1.4], [-3.1, 0.2, 0.6, 0.5], [-2.6, 0.2, 2.0, 1.4]]} />
      <Puffs position={[-1.5, 0.8, 0]} material={M.dust} active={on} count={16} rise={2.2} spread={2} size={0.4} drift={[-0.5, 0, 0.3]} />
    </group>
  )
}

// ---------- Zone 2: pump station (shared discharge) + solar pump + diesel pump ----------
function Discharge() {
  const jet = useRef()
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#bfe9f5', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.8 }), [])
  const geo = useMemo(() => {
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.62, 1.45), new THREE.Vector3(0, 0.66, 2.0), new THREE.Vector3(0, 0.08, 2.35))
    return new THREE.TubeGeometry(c, 14, 0.085, 8)
  }, [])
  useFrame(() => { jet.current.visible = live.flow > 0.05; jet.current.scale.set(0.4 + live.flow * 0.6 + Math.sin(live.clock * 30) * 0.04, 1, 1) })
  return (
    <>
      <C p={[0, 0.62, 0.95]} rad={0.09} h={1.0} r={[Math.PI / 2, 0, 0]} m={M.steel} />
      <B p={[0, 0.72, 0.9]} s={[0.24, 0.2, 0.22]} m={M.blue} />
      <C p={[0, 0.84, 0.9]} rad={0.07} h={0.03} m={M.white} />
      <B p={[0, 0.3, 1.2]} s={[0.12, 0.6, 0.12]} m={M.concrete} />
      <mesh ref={jet} userData={{ dyn: true }} geometry={geo} material={mat} />
      <Puffs position={[0, 0.15, 2.35]} material={M.mist} active={() => live.flow} count={10} rise={0.7} spread={1.2} size={0.22} drift={[0, 0, 0.3]} />
      <B p={[0, 0.1, 2.4]} s={[1.6, 0.2, 1.3]} m={M.concrete} />
      <C p={[2.6, 0.3, -0.2]} rad={0.07} h={5.2} r={[0, 0, Math.PI / 2]} m={M.black} />
    </>
  )
}
function SolarPump() {
  const sign = useMemo(() => signTexture(['13 HP SOLAR PUMP', '₹55 / hour · book by missed call'], { bg: '#0b3554', accent: '#4fc3ff' }), [])
  const led = useRef()
  useFrame(() => { led.current.material = E().pump > 0.3 ? M.ledGreen : M.ledAmber })
  return (
    <group>
      <B p={[0, 0.1, 0]} s={[2.6, 0.2, 2.2]} m={M.concrete} />
      <C p={[0.15, 0.62, -0.2]} rad={0.27} h={0.9} r={[0, 0, Math.PI / 2]} m={M.blue} />
      {[-0.2, 0, 0.2, 0.4].map((dx) => <C key={dx} p={[0.15 + dx, 0.62, -0.2]} rad={0.29} h={0.03} r={[0, 0, Math.PI / 2]} m={M.darkSteel} />)}
      <C p={[-0.5, 0.62, -0.2]} rad={0.34} h={0.3} r={[0, 0, Math.PI / 2]} m={M.steel} />
      <C p={[-0.5, 0.62, 0.15]} rad={0.09} h={0.7} r={[Math.PI / 2, 0, 0]} m={M.steel} />
      <C p={[-0.25, 0.62, 0.45]} rad={0.09} h={0.5} r={[0, 0, Math.PI / 2]} m={M.steel} />
      <B p={[0, 0.28, -0.2]} s={[1.5, 0.16, 0.5]} m={M.darkSteel} />
      {/* VFD / control box on post */}
      <Model url={MODELS.utility} size={1.25} position={[1.0, 0.2, -0.8]} />
      <mesh ref={led} userData={{ dyn: true }} geometry={G.sphere} scale={0.04} position={[1.0, 1.52, -0.8]} material={M.ledGreen} />
      <Sign tex={sign} p={[-0.6, 1.75, -1.0]} w={2.0} h={0.5} />
      <C p={[-1.1, 0.9, -1.0]} rad={0.04} h={1.8} m={M.steel} /><C p={[-0.1, 0.9, -1.0]} rad={0.04} h={1.8} m={M.steel} />
    </group>
  )
}
function DieselPump() {
  const g = useRef()
  const on = () => (dieselAt(sim.t).on ? 1 : 0)
  useFrame(() => { const a = on(); g.current.position.set(Math.sin(live.clock * 70) * 0.012 * a, Math.abs(Math.sin(live.clock * 55)) * 0.01 * a, 0) })
  return (
    <group>
      <B p={[0, 0.06, 0]} s={[2.2, 0.12, 1.6]} m={M.wood} />
      <group ref={g} userData={{ dyn: true }}>
        <B p={[0, 0.5, -0.2]} s={[0.9, 0.65, 0.6]} m={M.black} />
        <B p={[0.1, 0.95, -0.2]} s={[0.5, 0.3, 0.45]} m={M.rust} />
        <B p={[-0.25, 1.2, -0.2]} s={[0.6, 0.28, 0.5]} m={M.red} />
        <C p={[-0.25, 1.37, -0.2]} rad={0.05} h={0.06} m={M.black} />
        <group position={[0.55, 0.55, -0.2]} rotation={[0, Math.PI / 2, 0]}><Spin speed={() => on() * 30}><C rad={0.33} h={0.1} r={[Math.PI / 2, 0, 0]} m={M.darkSteel} /><B p={[0.2, 0, 0.06]} s={[0.1, 0.06, 0.02]} m={M.rust} shadow={false} /></Spin></group>
        <C p={[0.3, 1.5, -0.4]} rad={0.045} h={1.2} m={M.rust} />
        <C p={[0.3, 2.12, -0.4]} rad={0.07} h={0.2} m={M.black} />
        <C p={[-0.55, 0.62, 0.0]} rad={0.2} h={0.3} r={[0, 0, Math.PI / 2]} m={M.rust} />
        <C p={[-0.5, 0.62, 0.25]} rad={0.09} h={0.5} r={[Math.PI / 2, 0, 0]} m={M.rust} />
        <C p={[-0.25, 0.62, 0.45]} rad={0.09} h={0.5} r={[0, 0, Math.PI / 2]} m={M.rust} />
      </group>
      <Puffs position={[0.3, 2.2, -0.4]} material={M.smoke} active={on} count={26} rise={5.5} spread={2.2} size={0.5} drift={[0.9, 0, -0.3]} />
      {/* jerry cans + oil stain */}
      <Model url={MODELS.jerrycan} size={0.47} position={[1.25, 0.12, 0.45]} rotation={[0, 0.3, 0]} />
      <Model url={MODELS.jerrycan} size={0.47} position={[1.55, 0.12, 0.1]} rotation={[0, 1.2, 0]} />
      <mesh position={[0.6, 0.07, 0.7]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.7, 20]} /><meshStandardMaterial color="#1a1510" roughness={0.3} transparent opacity={0.7} /></mesh>
    </group>
  )
}
export function PumpStation({ mode }) {
  const [x, , z] = SITE.pump
  return (
    <group position={[x - 0.8, 0, z - 1]} scale={1.35}>
      <Static><Discharge /></Static>
      <group visible={mode === 'after'}><Static><SolarPump /></Static></group>
      <group visible={mode === 'before'}><Static><DieselPump /></Static></group>
    </group>
  )
}

// ---------- Before-mode props ----------
const SPOILED = [[-1.2, 0.72, 0, 'tomato'], [-0.45, 0.72, 0.05, 'greens', 0.1], [0.3, 0.72, 0, 'chilli'], [1.05, 0.72, 0.05, 'lemon', -0.1], [-0.9, 0, 1.1, 'tomato', 0.4], [0, 0, 1.2, 'greens', -0.3], [0.9, 0, 1.0, 'tomato', 0.2], [1.6, 0, 0.4, 'lemon', 1.2], [-0.4, 0.32, 1.15, 'greens', 0.1]]
function SpoilageStall() {
  const [x, , z] = SITE.stall
  const flies = useRef()
  useFrame(() => { flies.current.children.forEach((m, i) => m.position.set(Math.sin(live.clock * (2 + i * 0.4) + i) * 1.2, 1.3 + Math.sin(live.clock * 3 + i * 2) * 0.3, Math.cos(live.clock * (1.7 + i * 0.3) + i * 3) * 0.6 + 0.4)) })
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.68, 0]} s={[3.4, 0.06, 0.9]} m={M.wood} />
      {[[-1.6, -0.35], [1.6, -0.35], [-1.6, 0.35], [1.6, 0.35]].map(([px, pz], i) => <C key={i} p={[px, 0.34, pz]} rad={0.05} h={0.68} m={M.bamboo} lo />)}
      <Crates list={SPOILED} spoiled seed={9} />
      <group ref={flies} userData={{ dyn: true }}>{Array.from({ length: 9 }, (_, i) => <mesh key={i} geometry={G.sphereLo} scale={0.018} material={M.black} />)}</group>
    </group>
  )
}
const TRUCK_YAW = 0
function Truck() {
  const g = useRef()
  const path = useMemo(() => new THREE.CatmullRomCurve3([[-9, 24.2], [-12, 16], [-10, 8], [-24, -14], [-40, -34], [-70, -46], [-110, -78]].map(([x, z]) => new THREE.Vector3(x, 0, z))), [])
  const wheels = useRef([])
  useFrame(() => {
    const s = live.clock % 30
    const k = s < 10 ? 0 : Math.min(1, (s - 10) / 18)
    const e = k * k * (3 - 2 * k) * 0.999
    const p = path.getPointAt(e), t = path.getTangentAt(Math.max(0.002, e))
    g.current.position.copy(p)
    g.current.rotation.y = Math.atan2(t.x, t.z)
    g.current.visible = s < 28.5
    wheels.current.forEach((w) => { if (w && k > 0 && k < 1) w.rotation.x += 0.12 })
  })
  const sacks = useMemo(() => { const out = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) for (let l = 0; l < 2 + (i === 1 ? 1 : 0); l++) out.push([-0.6 + i * 0.6, 1.05 + l * 0.33, -2.4 + j * 0.75, (i + j + l) * 0.9]); return out }, [])
  return (
    <group ref={g}>
      <Model url={MODELS.truck} fit="z" size={5.4} rotation={[0, TRUCK_YAW, 0]} />
      <Sacks list={sacks} />
    </group>
  )
}
export function BeforeProps() {
  return (<><Static><SpoilageStall /></Static><Truck /><Sacks list={[[-11.2, 0, 25.2], [-11.2, 0.3, 25.2], [-11.9, 0, 24.6, 0.6], [-10.6, 0, 25.9, 1.1]]} /></>)
}
export function ChakraNode() {
  return (<Static><SolarArray /><ControlShed /><Battery /><ColdRoom /><Huller /></Static>)
}

// ---------- Village, poles, farmer ----------
const prism = new THREE.CylinderGeometry(1, 1, 1, 3)
function House({ x, z, rot, v }) {
  const roof = [M.tinRed, M.tinGrey, M.tinGreen][v]
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <B p={[0, 0.2, 0.5]} s={[7.4, 0.4, 6.4]} m={M.concrete} />
      <B p={[0, 1.7, 0]} s={[6.4, 2.6, 4.2]} m={M.plaster} />
      <mesh geometry={prism} material={M.plaster} position={[0, 3.52, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1.05, 6.4, 2.42]} castShadow />
      <B p={[0, 3.72, -1.3]} s={[7.4, 0.06, 3.3]} r={[-0.56, 0, 0]} m={roof} />
      <B p={[0, 3.72, 1.3]} s={[7.4, 0.06, 3.3]} r={[0.56, 0, 0]} m={roof} />
      <B p={[0, 2.75, 3.2]} s={[7.2, 0.05, 2.2]} r={[0.22, 0, 0]} m={roof} />
      {[-3.3, -1.1, 1.1, 3.3].map((px) => <C key={px} p={[px, 1.45, 4.0]} rad={0.07} h={2.2} m={M.wood} lo />)}
      <B p={[0, 1.35, 2.11]} s={[0.95, 1.9, 0.06]} m={M.wood} />
      <B p={[-2, 1.75, 2.11]} s={[0.9, 0.8, 0.05]} m={M.window} /><B p={[2, 1.75, 2.11]} s={[0.9, 0.8, 0.05]} m={M.window} />
      <B p={[3.21, 1.75, 0]} s={[0.05, 0.8, 0.9]} m={M.window} /><B p={[-3.21, 1.75, 0]} s={[0.05, 0.8, 0.9]} m={M.window} />
      <B p={[0, 1.75, -2.11]} s={[0.9, 0.8, 0.05]} m={M.window} />
    </group>
  )
}
function wire(a, b, sag = 0.9, n = 14) {
  const pts = []
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t)) }
  return pts
}
const wireMat = new THREE.LineBasicMaterial({ color: '#15171a' })
export function Village() {
  const lights = useRef([])
  const lamp = useRef()
  useFrame(() => {
    let k = live.lights
    if (sim.mode === 'before' && sim.t > 17.5 && sim.t < 21) k *= 0.55 + 0.2 * Math.sin(live.clock * 9) * Math.sin(live.clock * 2.3) // brown-out flicker on a stressed feeder
    M.window.emissiveIntensity = k * (LOW ? 3.4 : 2.6)
    lights.current.forEach((l) => { if (l) l.intensity = k * 40 })
  })
  const lines = useMemo(() => {
    const segs = []
    for (let i = 0; i < POLES.length - 1; i++) {
      const a = POLES[i], b = POLES[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l
      ;[-0.75, 0, 0.75].forEach((o) => segs.push(wire([a[0] + nx * o, 7.75, a[1] + nz * o], [b[0] + nx * o, 7.75, b[1] + nz * o])))
    }
    segs.push(wire([POLES[0][0], 7.2, POLES[0][1]], [SITE.shed[0], 3.6, SITE.shed[2] - 2], 0.5))
    ;[[1, 0], [1, 6], [2, 1], [2, 0], [3, 2], [3, 4], [2, 3]].forEach(([p, h]) => segs.push(wire([POLES[p][0], 7.2, POLES[p][1]], [HOUSES[h][0], 3.9, HOUSES[h][1]], 0.7)))
    return segs.map((pts) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat))
  }, [])
  return (
    <group>
      <Static>{HOUSES.map(([x, z, rot, v], i) => <House key={i} x={x} z={z} rot={rot} v={v} />)}</Static>
      {!LOW && [0, 2].map((i, k) => <pointLight key={i} ref={(l) => (lights.current[k] = l)} position={[HOUSES[i][0], 2.6, HOUSES[i][1] + 3.4]} color="#ffb060" distance={22} decay={1.5} intensity={0} />)}
      <Static>
      {POLES.map(([x, z], i) => {
        const nb = POLES[Math.min(i + 1, POLES.length - 1)], pv = POLES[Math.max(i - 1, 0)]
        const ry = Math.atan2(nb[0] - pv[0], nb[1] - pv[1])
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
            <C p={[0, 4, 0]} rad={0.14} top={0.1} h={8} m={M.concrete} />
            <B p={[0, 7.55, 0]} s={[1.9, 0.1, 0.1]} m={M.steel} />
            {[-0.75, 0, 0.75].map((o) => <C key={o} p={[o, 7.68, 0]} rad={0.05} h={0.16} m={M.white} />)}
            {i === 0 && (<><C p={[0.45, 5.6, 0]} rad={0.32} h={0.9} m={M.steel} /><B p={[0.2, 5.1, 0]} s={[0.7, 0.08, 0.5]} m={M.steel} /><B p={[-0.25, 1.5, 0.16]} s={[0.4, 0.5, 0.18]} m={M.white} /></>)}
          </group>
        )
      })}
      </Static>
      {lines.map((l, i) => <primitive key={i} object={l} />)}
    </group>
  )
}
