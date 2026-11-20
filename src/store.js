import { create } from 'zustand'
import * as THREE from 'three'
import { VIEWS, TOUR, GUIDE, SITE } from './data.js'

// Mutable per-frame state (read inside useFrame, never triggers React renders)
export const sim = { t: 13, mode: 'before', playing: false, rate: 1 }
// Ramen's state during the narrated walkthrough
export const guide = { x: SITE.ramen[0], z: SITE.ramen[2], yaw: 2.45, path: [], speed: 3, moving: false, arrived: false, wait: 0, waveUntil: 0, snap: false, snapLook: false }
export const live = { e: null, flow: 0, elev: 1, day: 1, night: 0, lights: 0, clock: 0 }
export const nav = { fly: null, walk: null }

export const useStore = create((set, get) => ({
  mode: 'before',
  time: 13,
  playing: false,
  zone: null,
  tour: -1,
  intro: true,
  booking: 0,
  drawer: false,
  setMode: (mode) => { sim.mode = mode; set({ mode }) },
  setTime: (t) => { sim.t = t; set({ time: t }) },
  setPlaying: (p) => { sim.playing = p; set({ playing: p }) },
  setZone: (zone) => set({ zone }),
  setDrawer: (drawer) => set({ drawer }),
  goTo: (key, dur = 2.4) => {
    const v = VIEWS[key]
    if (v) nav.fly = { to: new THREE.Vector3(...v.pos), look: new THREE.Vector3(...v.look), k: 0, dur, started: false }
    nav.walk = null
  },
  visit: (id) => { const b = id + '_b'; get().goTo(get().mode === 'before' && VIEWS[b] ? b : id); set({ zone: id }) },
  startTour: () => { set({ intro: false }); get().tourStep(0) },
  tourStep: (i) => {
    if (i < 0 || i >= TOUR.length) { set({ tour: -1 }); return }
    const s = TOUR[i]
    const st = get()
    st.setMode(s.mode); st.setTime(s.time); st.setPlaying(!!s.play)
    st.goTo(s.view, 2.8)
    set({ tour: i, zone: null, drawer: !!s.drawer })
  },
  endTour: () => set({ tour: -1, drawer: false }),
  explore: () => { set({ intro: false, tour: -1 }); get().goTo('start', 2.5) },
  setBooking: (booking) => set({ booking }),
  // ---- narrated walkthrough ----
  guide: -1,
  lang: 'en',
  guidePaused: false,
  voiceDone: false,
  setLang: (lang) => set({ lang, voiceDone: false }),
  setGuidePaused: (p) => { set({ guidePaused: p }); get().setPlaying(!p && !!(GUIDE[get().guide] || {}).play) },
  setVoiceDone: (v) => set({ voiceDone: v }),
  startGuide: () => {
    guide.x = SITE.ramen[0]; guide.z = SITE.ramen[2]; guide.yaw = 2.45; guide.snap = true; guide.snapLook = true
    nav.fly = null; nav.walk = null
    set({ intro: false, tour: -1, zone: null, booking: 0 })
    get().guideGo(0)
  },
  guideGo: (i) => {
    if (i < 0) i = 0
    if (i >= GUIDE.length) { get().endGuide(true); return }
    const s = GUIDE[i], st = get()
    st.setMode(s.mode); st.setTime(s.time); sim.rate = s.rate || 1; st.setPlaying(!!s.play)
    guide.path = [...(s.via || []), s.spot].map((p) => [...p])
    let len = 0, px = guide.x, pz = guide.z
    for (const [x, z] of guide.path) { len += Math.hypot(x - px, z - pz); px = x; pz = z }
    guide.speed = Math.max(2.2, Math.min(6.5, len / 6.5))
    guide.arrived = false; guide.wait = 0; guide.waveUntil = 0
    if (s.truck) live.clock = 3
    set({ guide: i, guidePaused: false, voiceDone: false, zone: null, drawer: !!s.drawer })
  },
  endGuide: (finished) => {
    sim.rate = 1
    get().setPlaying(false)
    set({ guide: -1, guidePaused: false, voiceDone: false, drawer: !!finished })
    get().goTo(finished ? 'overview' : 'start', 2.6)
  },
}))
