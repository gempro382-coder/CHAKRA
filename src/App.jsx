import React, { Suspense, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { useStore, sim, nav, live } from './store.js'
import { SkyAndLights, Terrain, HillForest, Paths, Pond, Canals, Fields, Vegetation, WaterTicker } from './World.jsx'
import { ChakraNode, BeforeProps, PumpStation, Village } from './Structures.jsx'
import { GuideDirector, Ramen } from './Guide.jsx'
import { Flows, Markers, Callouts } from './Overlay3D.jsx'
import { Controller } from './Controller.jsx'
import UI from './UI.jsx'
import { LOW } from './quality.js'

function DevHook() {
  const state = useThree()
  if (import.meta.env.DEV) window.__chakra = { state, useStore, sim, nav, live }
  return null
}

function Scene() {
  const mode = useStore((s) => s.mode)
  const after = mode === 'after'
  return (
    <>
      <DevHook />
      <Controller />
      <GuideDirector />
      <WaterTicker />
      <SkyAndLights />
      <Terrain />
      <HillForest />
      <Paths />
      <Pond />
      <Canals />
      <Fields mode={mode} />
      <Vegetation />
      <Village />
      <Ramen />
      <PumpStation mode={mode} />
      <group visible={after}><ChakraNode /></group>
      <group visible={!after}><BeforeProps /></group>
      {after && <Flows />}
      <Markers />
      <Callouts />
    </>
  )
}

const MAX_DPR = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, LOW ? 1 : 1.25)
export default function App() {
  // resolution steps down by itself on slower machines and back up when there is headroom
  const [dpr, setDpr] = useState(MAX_DPR)
  return (
    <>
      <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={dpr} camera={{ fov: 58, near: 0.15, far: 4000, position: [60, 34, 100] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'high-performance' }}>
        <PerformanceMonitor bounds={() => [38, 58]} flipflops={4} onDecline={() => setDpr((d) => Math.max(0.75, d - 0.125))} onIncline={() => setDpr((d) => Math.min(MAX_DPR, d + 0.15))} />
        <Suspense fallback={null}><Scene /></Suspense>
      </Canvas>
      <UI />
    </>
  )
}
