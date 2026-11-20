import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Inst } from './helpers.jsx'

// Downloaded models live in /public. Credits are in CREDITS.md.
export const asset = (p) => import.meta.env.BASE_URL + p
export const MODELS = {
  farmer: asset('models/farmer.glb'), truck: asset('models/truck.glb'), banana: asset('models/banana.glb'), palm: asset('models/palm.glb'),
  bamboo: asset('models/bamboo.glb'), trees: asset('models/trees.glb'), tomatoes: asset('models/tomatoes.glb'),
  crate: asset('ph/wooden_crate_02/wooden_crate_02.gltf'), aircon: asset('ph/exterior_aircon_unit/exterior_aircon_unit.gltf'),
  jerrycan: asset('ph/metal_jerrycan/metal_jerrycan.gltf'), utility: asset('ph/utility_box_01/utility_box_01.gltf'),
}
const axisSize = (v, fit) => (fit === 'x' ? v.x : fit === 'z' ? v.z : fit === 'max' ? Math.max(v.x, v.y, v.z) : v.y)

// Many copies of one model. Each copy is scaled so that `s` is its height in metres.
export function GltfInstances({ url, node, items, castShadow = true, fit = 'y', matte }) {
  const { scene } = useGLTF(url, false)
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true)
    const root = node ? scene.getObjectByName(node) : scene
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3())
    const k = 1 / axisSize(size, fit)
    const norm = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z))
    const out = []
    root.traverse((o) => {
      if (!o.isMesh) return
      const g = o.geometry.clone()
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(norm, o.matrixWorld))
      let m = o.material
      // plants do not need PBR: a Lambert copy of each material shades much faster
      if (matte) { const conv = (x) => new THREE.MeshLambertMaterial({ map: x.map, color: x.color, alphaTest: x.alphaTest, side: x.side, transparent: x.transparent, vertexColors: x.vertexColors }); m = Array.isArray(m) ? m.map(conv) : conv(m) }
      out.push({ g, m })
    })
    return out
  }, [scene, node, fit, matte])
  return parts.map((p, i) => <Inst key={i} geometry={p.g} material={p.m} items={items} castShadow={castShadow} />)
}

// One copy of a model, resized so its `fit` axis measures `size` metres, standing on y = 0.
export function Model({ url, node, fit = 'y', size = 1, tint, skinned, onReady, children, ...props }) {
  const { scene, animations } = useGLTF(url, false)
  const holder = useMemo(() => {
    const src = node ? scene.getObjectByName(node) : scene
    const o = skinned ? cloneSkinned(src) : src.clone(true)
    o.position.set(0, 0, 0)
    const h = new THREE.Group()
    h.add(o); h.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(h)
    const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3())
    o.position.set(-c.x, -box.min.y, -c.z)
    h.scale.setScalar(size / axisSize(sz, fit))
    h.traverse((m) => {
      if (!m.isMesh) return
      m.castShadow = true; m.receiveShadow = true
      if (skinned) m.frustumCulled = false
      if (tint) { m.material = m.material.clone(); m.material.color.multiply(new THREE.Color(tint)) }
    })
    return h
  }, [scene, node, fit, size, tint, skinned])
  const ref = useRef()
  const { actions } = useAnimations(animations, ref)
  useEffect(() => { if (onReady) onReady(actions) }, [actions])
  return <group {...props}><primitive ref={ref} object={holder} />{children}</group>
}

Object.values(MODELS).forEach((u) => useGLTF.preload(u, false))
