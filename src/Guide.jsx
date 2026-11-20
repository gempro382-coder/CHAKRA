import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore, guide, live } from './store.js'
import { GUIDE, SITE } from './data.js'
import { Model, MODELS } from './Models.jsx'

const lerpAngle = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t }
const _cam = new THREE.Vector3(), _look = new THREE.Vector3(), _cur = new THREE.Vector3()

// Drives the narrated walkthrough: moves Ramen along his route and keeps the camera on him.
export function GuideDirector() {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(0, 1.4, 20))
  useFrame((_, rawDt) => {
    const st = useStore.getState()
    const i = st.guide
    if (i < 0) return
    const dt = Math.min(rawDt, 0.05), sc = GUIDE[i]
    if (!st.guidePaused) {
      // walk
      if (guide.path.length) {
        const [tx, tz] = guide.path[0], dx = tx - guide.x, dz = tz - guide.z, d = Math.hypot(dx, dz), step = guide.speed * dt
        if (d <= step) { guide.x = tx; guide.z = tz; guide.path.shift() }
        else { guide.x += (dx / d) * step; guide.z += (dz / d) * step; guide.yaw = lerpAngle(guide.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8)) }
      }
      guide.moving = guide.path.length > 0
      if (!guide.moving) {
        // stop and turn to the viewer
        guide.yaw = lerpAngle(guide.yaw, Math.atan2(camera.position.x - guide.x, camera.position.z - guide.z), Math.min(1, dt * 5))
        if (!guide.arrived) { guide.arrived = true; if (sc.wave) guide.waveUntil = live.clock + 2.6 }
        if (st.voiceDone) { guide.wait += dt; if (guide.wait > 0.9) st.guideGo(i + 1) }
      }
    } else guide.moving = false
    // camera: viewer — Ramen — station, in one line
    const ax = guide.x - sc.focus[0], az = guide.z - sc.focus[2], al = Math.hypot(ax, az) || 1
    const nx = ax / al, nz = az / al, dist = sc.dist || 5.6
    _cam.set(guide.x + nx * dist - nz * 1.7, sc.height || 2.3, guide.z + nz * dist + nx * 1.7)
    _look.set(guide.x + (sc.focus[0] - guide.x) * 0.22, 0.75 + (sc.focus[1] - 0.75) * 0.22, guide.z + (sc.focus[2] - guide.z) * 0.22)
    const k = guide.snap ? 1 : 1 - Math.exp(-dt * 2.2)
    guide.snap = false
    camera.position.lerp(_cam, k)
    look.current.lerp(_look, guide.snapLook ? 1 : 1 - Math.exp(-dt * 3))
    guide.snapLook = false
    camera.lookAt(look.current)
  })
  return null
}

// Ramen: idle by the canal normally; walks, waves and turns during the walkthrough.
export function Ramen() {
  const g = useRef(), acts = useRef(null), cur = useRef('')
  const on = useStore((s) => s.guide >= 0)
  const play = (name, scale = 1) => {
    const a = acts.current; if (!a) return
    const key = Object.keys(a).find((n) => n.endsWith('|' + name)) || Object.keys(a)[0]
    if (!a[key]) return
    a[key].timeScale = scale
    if (cur.current === key) return
    if (a[cur.current]) a[cur.current].fadeOut(0.25)
    a[key].reset().fadeIn(0.25).play()
    cur.current = key
  }
  useEffect(() => { if (!on && g.current) { g.current.position.set(SITE.ramen[0], 0, SITE.ramen[2]); g.current.rotation.y = 2.45; play('Idle') } }, [on])
  useFrame(() => {
    if (!on || !g.current) return
    g.current.position.set(guide.x, 0, guide.z)
    g.current.rotation.y = guide.yaw
    if (guide.moving) guide.speed > 3.4 ? play('Run', guide.speed / 5.2) : play('Walk', guide.speed / 1.75)
    else play(guide.waveUntil > live.clock ? 'Wave' : 'Idle')
  })
  return (
    <group ref={g} position={[SITE.ramen[0], 0, SITE.ramen[2]]} rotation={[0, 2.45, 0]}>
      <Model url={MODELS.farmer} skinned size={1.72} onReady={(a) => { acts.current = a; play('Idle') }} />
    </group>
  )
}
