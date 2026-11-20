import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { sim, live, nav, useStore } from './store.js'
import { energyAt, dieselAt, T_MIN, T_MAX, ZONES, SITE, HOUSES } from './data.js'

const EYE = 1.7
const OBST = [[SITE.shed[0], SITE.shed[2], 3.6], [SITE.cold[0], SITE.cold[2], 3.6], [SITE.pond[0], SITE.pond[2], 9.5], [-18, 16, 1.8], [19.2, 23, 1.6], [-8.6, -3.2, 1.6],
  ...[-5, 0, 5].flatMap((x) => [-8.1, -3.5, 1.1].map((z) => [x, z, 2.2])), ...HOUSES.map((h) => [h[0], h[1], 4.6])]
const lerpAngle = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t }

export function Controller() {
  const { camera, gl } = useThree()
  const s = useRef({ yaw: 0, pitch: 0, keys: {}, drag: null, orbit: 1.05 }).current
  useEffect(() => {
    const el = gl.domElement
    const down = (e) => { s.drag = [e.clientX, e.clientY] }
    const move = (e) => {
      if (!s.drag || useStore.getState().intro) return
      const dx = e.clientX - s.drag[0], dy = e.clientY - s.drag[1]
      s.drag = [e.clientX, e.clientY]
      if (nav.fly) return
      s.yaw -= dx * 0.0042; s.pitch = Math.max(-1.3, Math.min(1.2, s.pitch - dy * 0.0042))
    }
    const up = () => { s.drag = null }
    const kd = (e) => { if (e.target.tagName === 'INPUT') e.target.blur(); s.keys[e.code] = true; if (e.code.startsWith('Arrow')) e.preventDefault() }
    const ku = (e) => { s.keys[e.code] = false }
    el.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    return () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [])
  const acc = useRef(0), lastNear = useRef(null)
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const st = useStore.getState()
    // --- simulation clock ---
    live.clock += dt
    if (sim.playing) { sim.t += dt * 0.3 * (sim.rate || 1); if (sim.t > T_MAX) sim.t = T_MIN }
    live.e = energyAt(sim.t)
    const target = sim.mode === 'after' ? (live.e.pump > 0.3 ? 1 : 0) : dieselAt(sim.t).on ? 1 : 0
    live.flow += (target - live.flow) * Math.min(1, dt * 1.5)

    // --- camera ---
    if (st.guide >= 0) {
      // the walkthrough owns the camera; keep our angles in step so hand-back is seamless
      camera.rotation.reorder('YXZ'); s.yaw = camera.rotation.y; s.pitch = camera.rotation.x
    } else if (st.intro) {
      s.orbit += dt * 0.04
      camera.position.set(Math.cos(s.orbit) * 84, 30, Math.sin(s.orbit) * 84 + 10)
      camera.lookAt(0, 2, 8)
      camera.rotation.reorder('YXZ')
      s.yaw = camera.rotation.y; s.pitch = camera.rotation.x
    } else if (nav.fly) {
      const f = nav.fly
      if (!f.started) {
        f.started = true; f.from = camera.position.clone(); f.yaw0 = s.yaw; f.pitch0 = s.pitch
        const d = f.look.clone().sub(f.to)
        f.yaw1 = Math.atan2(-d.x, -d.z); f.pitch1 = Math.atan2(d.y, Math.hypot(d.x, d.z))
        f.arc = Math.min(12, f.from.distanceTo(f.to) * 0.1)
      }
      f.k = Math.min(1, f.k + dt / f.dur)
      const e = f.k * f.k * (3 - 2 * f.k)
      camera.position.lerpVectors(f.from, f.to, e)
      camera.position.y += Math.sin(Math.PI * e) * f.arc
      s.yaw = lerpAngle(f.yaw0, f.yaw1, e); s.pitch = f.pitch0 + (f.pitch1 - f.pitch0) * e
      if (f.k >= 1) nav.fly = null
    } else {
      const k = s.keys
      const fw = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)
      const sd = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0)
      const turn = (k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0)
      s.yaw += turn * dt * 1.6
      const speed = (k.ShiftLeft || k.ShiftRight ? 14 : 6.5) * dt
      const p = camera.position
      if (fw || sd) {
        nav.walk = null
        const sin = Math.sin(s.yaw), cos = Math.cos(s.yaw)
        p.x += (-sin * fw + cos * sd) * speed; p.z += (-cos * fw - sin * sd) * speed
      } else if (nav.walk) {
        const dx = nav.walk.x - p.x, dz = nav.walk.z - p.z, d = Math.hypot(dx, dz)
        if (d < 0.4) nav.walk = null
        else { const m = Math.min(d, 9 * dt); p.x += (dx / d) * m; p.z += (dz / d) * m }
      }
      if (fw || sd || nav.walk) {
        p.y += (EYE - p.y) * Math.min(1, dt * 3)
        if (p.y < 4) for (const [ox, oz, r] of OBST) { const dx = p.x - ox, dz = p.z - oz, d = Math.hypot(dx, dz); if (d < r && d > 0.001) { p.x = ox + (dx / d) * r; p.z = oz + (dz / d) * r } }
        const rr = Math.hypot(p.x, p.z); if (rr > 100) { p.x *= 100 / rr; p.z *= 100 / rr }
      }
    }
    if (!st.intro && st.guide < 0) camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ')

    // --- sync React state a few times a second ---
    acc.current += dt
    if (acc.current > 0.2) {
      acc.current = 0
      if (Math.abs(st.time - sim.t) > 1e-4) useStore.setState({ time: sim.t })
      if (!st.intro && st.tour < 0 && st.guide < 0 && !nav.fly && camera.position.y < 3) {
        let near = null
        for (const z of ZONES) if (Math.hypot(camera.position.x - z.anchor[0], camera.position.z - z.anchor[2]) < 9) near = z.id
        if (near !== lastNear.current) { lastNear.current = near; if (near) useStore.setState({ zone: near }) }
      }
    }
  })
  return null
}
