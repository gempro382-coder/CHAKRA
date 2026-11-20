import React, { useEffect, useMemo, useRef, useState } from 'react'
import NARRATION from './narration.json'
import { useStore } from './store.js'
import { ZONES, TOUR, GUIDE, LANGS, T_MIN, T_MAX, energyAt, dieselAt, ambientTemp, fmtTime, phaseOf, dayCurve, FLOW_COLORS } from './data.js'

const f1 = (x) => x.toFixed(1)

function LangPicker({ short }) {
  const lang = useStore((s) => s.lang), setLang = useStore((s) => s.setLang)
  const names = short ? { en: 'EN', hi: 'हिं', as: 'অস' } : null
  return <div className="langs" role="group" aria-label="Narration language">{LANGS.map(([k, n]) => <button key={k} title={n} className={lang === k ? 'on' : ''} onClick={() => setLang(k)}>{names ? names[k] : n}</button>)}</div>
}

function Intro() {
  const startTour = useStore((s) => s.startTour), explore = useStore((s) => s.explore), startGuide = useStore((s) => s.startGuide)
  return (
    <div className="intro">
      <div className="intro-card">
        <div className="kicker">YUVA YODHA ENERGY TECH HACKATHON 2026 · CHALLENGE 01 — SUSTAINABLE AGRICULTURE</div>
        <div className="tagline">one shared array, four incomes</div>
        <h1>CHAKRA</h1>
        <p>A village-scale solar node that sells irrigation by the hour, cools the harvest, mills the grain — and bends the village's own demand away from the evening peak.</p>
        <div className="pills"><span className="g">No capital for the farmer</span><span className="a">₹55 / pump-hour</span><span className="c">Zero diesel</span></div>
        <p className="sub">This is a walkable village in Barak Valley, Assam. See it as it is today, then switch the CHAKRA node on.</p>
        <div className="row">
          <button className="btn primary" onClick={startGuide}>🎙 Walk the village with Ramen</button>
          <LangPicker />
        </div>
        <div className="row second">
          <button className="btn" onClick={startTour}>▶ Silent guided tour</button>
          <button className="btn" onClick={explore}>Explore on my own</button>
        </div>
        <div className="foot">Team Aa. A · Aashish Kumar</div>
        <div className="credits">3D assets: Poly Haven, Quaternius, Kay Lousberg (CC0) · Banana tree by Poly by Google (CC-BY 3.0)</div>
      </div>
    </div>
  )
}

// One slim caption strip shared by the silent tour and the narrated walkthrough.
function Strip({ mode, kicker, title, count, text, textClass = '', lang, children }) {
  return (
    <div className={`strip glass ${mode}`}>
      <div className="strip-head">
        <span className="kicker">{kicker}</span><b className="strip-title">{title}</b>
        <span className="grow" /><span className="count">{count}</span>
        <div className="strip-ctl">{children}</div>
      </div>
      {text && <p className={textClass} lang={lang}>{text}</p>}
    </div>
  )
}

// Narrated walkthrough: plays Ramen's voice for the current scene and shows it as a subtitle.
function GuidePlayer() {
  const i = useStore((s) => s.guide), lang = useStore((s) => s.lang), paused = useStore((s) => s.guidePaused), subs = useStore((s) => s.subs !== false)
  const audio = useRef(null), timer = useRef(0)
  const sc = i >= 0 ? GUIDE[i] : null
  useEffect(() => {
    const a = audio.current
    clearTimeout(timer.current)
    if (!a) return
    if (!sc) { a.pause(); return }
    const done = () => useStore.getState().setVoiceDone(true)
    // if the browser blocks or cannot load the clip, keep the story moving on a reading-speed timer
    const fallback = () => { clearTimeout(timer.current); timer.current = setTimeout(done, 2500 + NARRATION[sc.id][lang].length * 62) }
    a.onended = done
    a.onerror = fallback
    a.src = `${import.meta.env.BASE_URL}audio/${lang}/${sc.id}.${lang === 'as' ? 'wav' : 'mp3'}`
    a.currentTime = 0
    const p = a.play()
    if (p && p.catch) p.catch(fallback)
    return () => clearTimeout(timer.current)
  }, [i, lang])
  useEffect(() => {
    const a = audio.current
    if (!a || !sc) return
    if (paused) a.pause(); else if (a.paused && !a.ended && a.currentTime > 0) a.play().catch(() => {})
  }, [paused])
  const { guideGo, endGuide, setGuidePaused } = useStore.getState()
  return (
    <>
      <audio ref={audio} preload="auto" />
      {sc && (
        <Strip mode={sc.mode} kicker={`🎙 ${sc.kicker}`} title={sc.title} count={`${i + 1}/${GUIDE.length}`} text={subs ? NARRATION[sc.id][lang] : null} textClass={`subtitle ${lang}`} lang={lang}>
          <button className="ib" onClick={() => guideGo(i - 1)} disabled={i === 0} title="Previous (←)" aria-label="Previous scene">⏮</button>
          <button className="ib amber" onClick={() => setGuidePaused(!paused)} title="Pause / resume (Space)" aria-label={paused ? 'Resume' : 'Pause'}>{paused ? '▶' : '❚❚'}</button>
          <button className="ib" onClick={() => guideGo(i + 1)} title="Next (→)" aria-label="Next scene">⏭</button>
          <LangPicker short />
          <button className={`ib ${subs ? 'sel' : ''}`} onClick={() => useStore.setState({ subs: !subs })} title="Show or hide subtitles" aria-label="Subtitles">CC</button>
          <button className="ib" onClick={() => endGuide(false)} title="Exit (Esc)" aria-label="Exit walkthrough">✕</button>
        </Strip>
      )}
    </>
  )
}

function TourCaption() {
  const i = useStore((s) => s.tour), step = useStore((s) => s.tourStep), end = useStore((s) => s.endTour), setBooking = useStore((s) => s.setBooking), booking = useStore((s) => s.booking)
  if (i < 0 || booking > 0) return null
  const s = TOUR[i], last = i === TOUR.length - 1
  return (
    <Strip mode={s.mode} kicker={s.kicker} title={s.title} count={`${i + 1}/${TOUR.length}`} text={s.text}>
      {s.action === 'booking' && <button className="ib wide amber" onClick={() => setBooking(1)}>📞 Simulate call</button>}
      <button className="ib" onClick={() => step(i - 1)} disabled={i === 0} title="Back (←)" aria-label="Back">←</button>
      <button className="ib wide primary" onClick={() => (last ? end() : step(i + 1))} title="Next (→)">{last ? 'Done ✓' : 'Next →'}</button>
      <button className="ib" onClick={end} title="Exit (Esc)" aria-label="Exit tour">✕</button>
    </Strip>
  )
}

function Status() {
  const t = useStore((s) => s.time), mode = useStore((s) => s.mode)
  const e = energyAt(t), d = dieselAt(t)
  return (
    <div className="topleft">
      <div className="logo" title="One Shared Array, Four Incomes — Barak Valley, Assam">CHAKRA</div>
      <div className={`status glass ${mode}`}>
        <span className="clk">{fmtTime(t)}</span>
        {mode === 'after' ? (
          <>
            <span title="Solar output" style={{ color: FLOW_COLORS.solar }}>☀ {f1(e.solar)} kW</span>
            <span title="Node load">Load {f1(e.load)} kW</span>
            <span title="Battery" style={{ color: FLOW_COLORS.battery }}>🔋 {Math.round(e.soc * 10)}%</span>
          </>
        ) : (
          <>
            <span title="No solar array in the village">☀ 0 kW</span>
            <span className="coral" title="Diesel pump">Diesel {d.on ? '₹116/hr' : 'off'}</span>
            <span title="Outside temperature">{Math.round(ambientTemp(t))} °C</span>
          </>
        )}
      </div>
    </div>
  )
}

function ModeToggle() {
  const mode = useStore((s) => s.mode), setMode = useStore((s) => s.setMode)
  return (
    <div className="toggle glass">
      <button className={mode === 'before' ? 'on bad' : ''} onClick={() => setMode('before')} title="The village today: the 3 leaks">Current Reality</button>
      <button className={mode === 'after' ? 'on good' : ''} onClick={() => setMode('after')} title="The same village with a CHAKRA node">With CHAKRA Node</button>
    </div>
  )
}

function Drawer() {
  const open = useStore((s) => s.drawer), setDrawer = useStore((s) => s.setDrawer)
  return (
    <div className="topright">
      <button className="btn glass drawer-btn" onClick={() => setDrawer(!open)}>{open ? '✕ Close' : '₹ Impact'}</button>
      {open && (
        <div className="drawer glass">
          <div className="big"><b>₹17,825</b><span>extra farmer income per acre, per year</span></div>
          <div className="split"><span>₹7,625 saved on irrigation</span><span>₹4,200 less spoilage</span><span>₹6,000 third season + milling</span></div>
          <div className="grid2">
            <div><b>3,840 L</b><span>diesel avoided / node / yr</span></div>
            <div><b>16.1 t</b><span>CO₂e avoided / node / yr</span></div>
            <div><b>2.4 kW</b><span>evening demand made flexible</span></div>
            <div><b>1,25,000 L</b><span>water saved per acre</span></div>
          </div>
          <div className="kicker">A YEAR AT ONE NODE</div>
          <div className="grid3">
            <div><b>₹5.09 L</b><span>revenue</span></div>
            <div><b>₹2.79 L</b><span>running cost</span></div>
            <div><b className="g">₹2.30 L</b><span>surplus</span></div>
          </div>
          <div className="kicker">WHO PAYS THE ₹28.1 LAKH · FARMERS INVEST ₹0</div>
          <div className="fund"><i style={{ flex: 13.7, background: '#1f8f63' }}>Grants ₹13.7 L</i><i style={{ flex: 10.9, background: '#e4572e' }}>AIF loan ₹10.9 L</i><i style={{ flex: 3.5, background: '#8a5a2b' }}>Community ₹3.5 L</i></div>
          <p className="note">PM-KUSUM 50% central + 30% state on PV and pumps; MIDH + PMFME on cold room and huller. Loan repaid from service revenue; DSCR 1.52, break-even at 55% of expected revenue.</p>
          <div className="kicker">AT 8,000 NODES</div>
          <p className="note strong">3.6 lakh people · 4 lakh acres · ₹298 crore of diesel a year not bought · 1.3 lakh tonnes CO₂ avoided · three paid operator jobs per node.</p>
        </div>
      )}
    </div>
  )
}

function metrics(id, mode, t) {
  const e = energyAt(t), d = dieselAt(t)
  if (mode === 'before') {
    if (id === 'water') return [['Diesel pump', d.on ? 'ON' : 'off'], ['Burnt today', `${f1(d.litres)} L`], ['Cash spent', `₹${Math.round(d.cost)}`]]
    if (id === 'cold') return [['Outside', `${Math.round(ambientTemp(t))} °C`], ['Cold storage', '25–40 km'], ['Lost', '15–20%']]
    if (id === 'huller') return [['Milled here', '0'], ['Margin', 'leaves']]
    if (id === 'grid') return [['APDCL peak', '3,150 MW'], ['Flexibility', '0 kW']]
    return [['Irrigated', '21.5%'], ['India', '49.9%'], ['Diesel', '₹97/L']]
  }
  if (id === 'hub') return [['Solar now', `${f1(e.solar)} kW`], ['Node load', `${f1(e.load)} kW`], ['Battery', `${Math.round(e.soc * 10)}%`], ['Export', `${f1(e.exp)} kW`]]
  if (id === 'water') return [['Pump', e.pump > 0.3 ? `${f1(e.pump)} kW` : 'idle'], ['Price', '₹55/hr'], ['Diesel was', '₹116/hr'], ['Farmer keeps', '₹61/hr']]
  if (id === 'cold') return [['Room', `${f1(e.temp)} °C`], ['Chiller', e.cold > 1 ? 'pre-cooling' : e.cold > 0.1 ? 'holding' : 'off'], ['Outside', `${Math.round(ambientTemp(t))} °C`]]
  if (id === 'huller') return [['Huller', e.huller > 1 ? '7.5 kW' : 'waiting'], ['Slot', '12:00–2:30 pm'], ['Distance', '800 m']]
  return [['Battery', `${Math.round(e.soc * 10)}%`], ['To village', `${f1(e.discharge)} kW`], ['Export', `${f1(e.exp)} kW`], ['Flex block', '2.4 kW']]
}

function ZoneCard() {
  const id = useStore((s) => s.zone), mode = useStore((s) => s.mode), t = useStore((s) => s.time), tour = useStore((s) => s.tour)
  const setZone = useStore((s) => s.setZone), setMode = useStore((s) => s.setMode), setBooking = useStore((s) => s.setBooking), drawer = useStore((s) => s.drawer)
  const guiding = useStore((s) => s.guide >= 0), booking = useStore((s) => s.booking)
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [id, mode])
  if (!id || tour >= 0 || drawer || guiding || booking > 0) return null
  const z = ZONES.find((x) => x.id === id), c = z[mode]
  return (
    <div className={`card glass ${mode}`}>
      <button className="x" onClick={() => setZone(null)} aria-label="Close" title="Close (Esc)">✕</button>
      <div className="kicker">{c.tag}</div>
      <h2>{c.title}</h2>
      <p className="lead">{c.lead}</p>
      <div className="chips">{metrics(id, mode, t).map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
      {more && <div className="points">{c.points.map(([h, b]) => <div key={h}><b>{h}</b><span>{b}</span></div>)}</div>}
      <div className="card-actions">
        <button className="btn small" onClick={() => setMore(!more)}>{more ? 'Less ▴' : 'How it works ▾'}</button>
        {c.action === 'booking' && <button className="btn small primary" onClick={() => setBooking(1)}>📞 Simulate missed call</button>}
        {mode === 'before' && <button className="btn small primary" onClick={() => setMode('after')}>With CHAKRA →</button>}
      </div>
    </div>
  )
}

const ASSAMESE = 'নমস্কাৰ ৰমেন! আপোনাৰ ২ ঘণ্টাৰ পানীৰ স্লট পুৱা ৬ বজাত নিশ্চিত কৰা হ\'ল। ₹১১০ ৰ UPI অনুৰোধ পঠিওৱা হৈছে।'
const STEPS = [
  null,
  { ms: 2400, label: 'Ramen gives a missed call to the node' },
  { ms: 2200, label: 'The call cuts by itself — no charge' },
  { ms: 4200, label: 'The IVR calls back in Assamese' },
  { ms: 3200, label: 'UPI request: ₹110 for two hours' },
  { ms: 3000, label: 'Paid. Slot locked: 6:00–8:00 am' },
  { ms: 3600, label: 'The pump starts with the rising sun' },
]
function Booking() {
  const b = useStore((s) => s.booking), set = useStore((s) => s.setBooking)
  useEffect(() => {
    if (!b) return
    const st = useStore.getState()
    if (b === 1) { st.setMode('after'); st.setPlaying(false); st.setTime(5.5); st.goTo('booking', 1.8) }
    if (b === 6) { st.setTime(6); st.setPlaying(true); st.goTo('water', 2.6) }
    const id = setTimeout(() => set(b >= 6 ? 0 : b + 1), STEPS[b].ms)
    return () => clearTimeout(id)
  }, [b])
  if (!b) return null
  return (
    <div className="booking">
      <div className="phone">
        <div className="speaker" />
        <div className="screen">
          {b === 1 && <><small>CALLING…</small><b>CHAKRA node</b><span className="ring">📞</span><em>missed-call line</em></>}
          {b === 2 && <><small>CALL ENDED · 0:00</small><b>Missed call sent</b><em>No charge</em></>}
          {b === 3 && <><small>INCOMING · CHAKRA IVR</small><p className="as">{ASSAMESE}</p><em>"Your 2-hour water slot is confirmed for 6 am. UPI request for ₹110 sent."</em></>}
          {b === 4 && <><small>UPI REQUEST</small><b className="amt">₹110</b><em>2 pump-hours @ ₹55</em><span className="pay">Pay</span></>}
          {b === 5 && <><small>PAYMENT DONE</small><b className="ok">✓ ₹110 paid</b><em>Slot 6:00–8:00 am</em></>}
          {b === 6 && <><small>6:00 AM</small><b className="ok">Pump ON</b><em>Running on the rising sun</em></>}
        </div>
        <div className="keys">{'123456789*0#'.split('').map((k) => <i key={k}>{k}</i>)}</div>
      </div>
      <div className="steps glass">
        {STEPS.slice(1).map((s, i) => <div key={i} className={`step ${b === i + 1 ? 'now' : b > i + 1 ? 'done' : ''}`}><b>{b > i + 1 ? '✓' : i + 1}</b>{s.label}</div>)}
        <div className="compare"><div><small>ON DIESEL</small><b className="coral">₹232</b></div><div><small>WITH CHAKRA</small><b className="g">₹110</b></div><div><small>HE KEEPS</small><b>₹122</b></div></div>
        <button className="btn small ghost" onClick={() => set(0)}>Skip</button>
      </div>
    </div>
  )
}

const SW = T_MAX - T_MIN, sx = (h) => ((h - T_MIN) / SW) * 100, sy = (kw) => 20 - (kw / 14.5) * 19
function Spark({ mode, t }) {
  // the day's curve never changes, so build the paths once; only the cursor moves
  const { area, load } = useMemo(() => {
    const pts = dayCurve.filter((p) => p.t >= T_MIN)
    return {
      area: `M${sx(T_MIN)},20 ` + pts.map((p) => `L${sx(p.t).toFixed(2)},${sy(p.solar).toFixed(2)}`).join(' ') + ` L${sx(T_MAX)},20 Z`,
      load: pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.t).toFixed(2)},${sy(p.load + p.discharge).toFixed(2)}`).join(' '),
    }
  }, [])
  return (
    <svg className="spark" viewBox="0 0 100 20" preserveAspectRatio="none">
      <rect x={sx(17)} y="0" width={sx(21) - sx(17)} height="20" fill="rgba(255,107,74,0.22)" />
      {mode === 'after' ? (<><path d={area} fill="rgba(245,166,35,0.45)" /><path d={load} fill="none" stroke="#eafff6" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.4 }} /></>)
        : <rect x={sx(6)} y={sy(6)} width={sx(11) - sx(6)} height={20 - sy(6)} fill="rgba(160,100,50,0.75)" />}
      <line x1={sx(t)} x2={sx(t)} y1="0" y2="20" stroke="#fff" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
    </svg>
  )
}

function BottomBar() {
  const t = useStore((s) => s.time), mode = useStore((s) => s.mode), playing = useStore((s) => s.playing), zone = useStore((s) => s.zone)
  const { setTime, setPlaying, visit, goTo, startTour, setZone, startGuide } = useStore.getState()
  return (
    <div className="bottom">
      <div className="stations">
        <button className="chip amber" onClick={startGuide} title="Narrated walkthrough in English, Hindi or Assamese">🎙 Walk with Ramen</button>
        <button className="chip" onClick={startTour} title="Step-by-step captions, no audio">▶ Tour</button>
        <button className="chip" onClick={() => { setZone(null); goTo('overview') }}>Overview</button>
        <span className="sep" />
        {ZONES.map((z) => <button key={z.id} className={`chip ${zone === z.id ? 'sel' : ''} ${mode}`} onClick={() => visit(z.id)}><b>{z.n}</b>{mode === 'after' ? z.short : z.leak}</button>)}
      </div>
      <div className="timebar glass">
        <button className="play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause the day' : 'Play the day'} title="Play or pause the day">{playing ? '❚❚' : '▶'}</button>
        <b className="clock">{fmtTime(t)}</b>
        <div className="track" title="Drag to change the time of day. Red band = 5–9 pm evening peak">
          <Spark mode={mode} t={t} />
          <input type="range" min={T_MIN} max={T_MAX} step={1 / 12} value={t} onChange={(e) => setTime(parseFloat(e.target.value))} aria-label="Time of day" />
        </div>
        <div className="phase">{phaseOf(t, mode)}</div>
      </div>
    </div>
  )
}

export default function UI() {
  const intro = useStore((s) => s.intro), tour = useStore((s) => s.tour), guiding = useStore((s) => s.guide >= 0)
  const story = tour >= 0 || guiding
  useEffect(() => {
    const key = (e) => {
      const st = useStore.getState()
      if (st.intro) return
      if (e.code === 'Escape') { if (st.booking) st.setBooking(0); else if (st.guide >= 0) st.endGuide(false); else if (st.tour >= 0) st.endTour(); else if (st.drawer) st.setDrawer(false); else st.setZone(null) }
      if (st.guide >= 0) {
        if (e.code === 'Space') { e.preventDefault(); st.setGuidePaused(!st.guidePaused) }
        if (e.code === 'ArrowRight') st.guideGo(st.guide + 1)
        if (e.code === 'ArrowLeft') st.guideGo(st.guide - 1)
      } else if (st.tour >= 0 && !st.booking) {
        if (e.code === 'ArrowRight' || e.code === 'Space') { e.preventDefault(); st.tour === TOUR.length - 1 ? st.endTour() : st.tourStep(st.tour + 1) }
        if (e.code === 'ArrowLeft' && st.tour > 0) st.tourStep(st.tour - 1)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  if (intro) return <Intro />
  return (
    <div className={`hud ${story ? 'story' : ''}`}>
      <Status />
      {!story && <ModeToggle />}
      <Drawer />
      <ZoneCard />
      <TourCaption />
      <GuidePlayer />
      <Booking />
      {!story && <BottomBar />}
      {!story && <div className="help">Drag to look · W A S D to walk · Shift to run · click the ground to go there</div>}
    </div>
  )
}
