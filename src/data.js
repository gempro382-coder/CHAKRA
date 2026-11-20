// All story numbers come from CHAKRA_TeamAaA_YuvaYodha2026.pptx.
// The minute-by-minute kW curve is a simulation built from the deck's ratings
// (15 kWp array, 13 HP pump, 7.5 kW huller, 10 kWh battery, 2.4 kW evening block).

export const T_MIN = 5.5
export const T_MAX = 23
export const SUNRISE = 5
export const SUNSET = 18.5
export const PUMP_KW = 9.7 // 13 HP

export const sunAngle = (t) => (Math.PI * (t - SUNRISE)) / (SUNSET - SUNRISE)
export function solarKW(t) {
  if (t <= SUNRISE || t >= SUNSET) return 0
  return 13.6 * Math.pow(Math.sin(sunAngle(t)), 1.4)
}

const STEP = 1 / 60
const table = []
;(function build() {
  let soc = 0.6
  for (let t = SUNRISE; t <= T_MAX + 1e-6; t += STEP) {
    const solar = solarKW(t)
    const pump = t >= 6 && t < 11 ? Math.min(PUMP_KW, Math.max(0, solar - 0.5)) : 0
    let cold = 0
    if (t >= 6 && t < 12) cold = Math.min(0.5, solar)
    else if (t >= 12 && t < 16) cold = 2.5
    else if (t >= 16 && t < 17) cold = Math.min(0.5, solar)
    else if (t >= 21) cold = 0.6
    const huller = t >= 12 && t < 14.5 ? 7.5 : 0
    const load = pump + cold + huller
    let charge = 0, discharge = 0, exp = 0, imp = 0
    const surplus = solar - load
    if (surplus > 0) {
      charge = Math.min(3, surplus, (10 - soc) / STEP)
      exp = surplus - charge
    } else imp = -surplus
    if (t >= 17 && t < 21 && soc > 0.3) { discharge = 2.4; exp = 0 }
    soc = Math.min(10, Math.max(0, soc + (charge - discharge) * STEP))
    let temp = 5
    if (t >= 12 && t < 16) temp = 5 - (3 * (t - 12)) / 4
    else if (t >= 16 && t < 17) temp = 2
    else if (t >= 17 && t < 21) temp = 2 + (1.8 * (t - 17)) / 4
    else if (t >= 21) temp = 3.8 - Math.min(0.8, (t - 21) * 0.4)
    table.push({ t, solar, pump, cold, huller, load, charge, discharge, exp, imp, soc, temp })
  }
})()

export function energyAt(t) {
  const i = Math.max(0, Math.min(table.length - 1, Math.round((t - SUNRISE) / STEP)))
  return table[i]
}
export const dayCurve = table.filter((_, i) => i % 10 === 0)

// Before-mode (diesel) numbers for the clock time
export function dieselAt(t) {
  const hours = Math.max(0, Math.min(t, 11) - 6)
  return { on: t >= 6 && t < 11, hours, litres: hours * 1.2, cost: hours * 116 }
}
export const ambientTemp = (t) => 24 + 10 * Math.max(0, Math.sin((Math.PI * (t - 6)) / 16))

export function fmtTime(t) {
  const h = Math.floor(t + 1e-6)
  const m = Math.floor((t - h) * 60 + 1e-6)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

export function phaseOf(t, mode) {
  if (mode === 'before') {
    if (t < 6) return 'Before dawn — the farmer goes looking for a pump to rent'
    if (t < 11) return 'Diesel pump running — ₹116 an hour, paid in cash'
    if (t < 17) return '34 °C — unsold produce spoils, raw paddy leaves for the town mill'
    if (t < 21) return 'Evening peak — the village adds load exactly when the grid is stressed'
    return 'Night'
  }
  if (t < 6) return '5:30 am — Ramen books two hours of water with a missed call'
  if (t < 11) return 'Water first — the pump runs on the rising sun'
  if (t < 12) return 'Irrigation done — surplus starts flowing to cooling'
  if (t < 17) return 'Surplus becomes cold and cash — pre-cool to 2 °C, mill, export'
  if (t < 21) return 'Nothing switches on at peak — battery covers lights, feeder breathes'
  return 'Night — cold room holds, node rests'
}

// ---------- Site plan ----------
export const SITE = {
  array: [0, 0, -3.5],
  shed: [-13, 0, -3],
  battery: [-8.6, 0, -3.2],
  cold: [15, 0, -4],
  huller: [-18, 0, 16],
  pump: [20, 0, 23],
  pond: [31, 0, 19],
  pole: [-13, 0, -11],
  ramen: [5, 0, 28.2],
  truck: [-9, 0, 23],
  stall: [15, 0, -3],
}
export const POLES = [[-13, -11], [-24, -21], [-36, -31], [-50, -41], [-70, -52], [-95, -64]]
export const HOUSES = [
  [-30, -30, 0.5, 0], [-42, -26, -0.3, 1], [-44, -44, 1.2, 2], [-30, -46, 2.2, 0],
  [-56, -34, 0.2, 1], [-58, -50, 1.8, 2], [-22, -40, -1.0, 1],
]
export const PLOTS = []
;[-33, -11, 11, 33].forEach((x, ci) => [44.5, 68].forEach((z) => PLOTS.push({ x, z, w: 20, d: 20.5, dry: ci < 2 })))

export const VIEWS = {
  start: { pos: [9, 1.7, 17], look: [0, 1.6, 0] },
  overview: { pos: [52, 40, 96], look: [-2, 0, 10] },
  hub: { pos: [-1, 3.4, 15], look: [-6, 1.6, -4] },
  water: { pos: [9, 3.6, 17.5], look: [24, 0.6, 30] },
  booking: { pos: [8.5, 2.2, 23.5], look: [4.6, 1.3, 28.6] },
  cold: { pos: [19.5, 2.3, 8.5], look: [15, 1.5, -4] },
  huller: { pos: [-11, 2.4, 26.5], look: [-17.5, 1.4, 16] },
  grid: { pos: [-17, 6.2, -8], look: [-42, 2.6, -34] },
  cold_b: { pos: [18.6, 1.9, 2.4], look: [15, 0.7, -3] },
  huller_b: { pos: [-1.5, 2.6, 29.5], look: [-10.5, 1.2, 22.5] },
  fieldsDry: { pos: [-6, 5, 30], look: [-28, 0, 52] },
}

export const ZONES = [
  {
    id: 'hub', n: 1, anchor: [-6, 0, -3], short: 'Solar & Control Hub', leak: 'No power plant',
    after: {
      tag: 'THE HEART · FARMERS INVEST ₹0',
      title: 'CHAKRA Solar & Control Hub',
      lead: 'One 15 kWp array, one meter, one roof — owned by the community, run by trained village youth, sold to farmers by the hour.',
      points: [
        ['The CHAKRA Bridge', 'The brain in the shed. SENSE: ₹9,000 of clamp meters, flow meter and soil probes, logged every 15 minutes. FORECAST: tomorrow\'s sun and demand. DECIDE: who gets the next unit of sunlight. ACT: ramp limits, pre-cooling, huller slots, battery release.'],
        ['Water first, always', 'Priority ladder: 1 booked irrigation · 2 cold-room safety · 3 milling · 4 peak holding. Farmers keep the veto — water never waits for software.'],
        ['Who pays the ₹28.1 lakh', '₹13.7 lakh grants (PM-KUSUM 50% central + 30% state on PV and pumps; MIDH + PMFME on cold room and huller), an AIF loan repaid from service revenue, and a ₹3.5 lakh community share. Farmers buy the service, never the machine.'],
      ],
    },
    before: {
      tag: 'WHY THIS PROBLEM, WHY NOW',
      title: 'A village with no power plant of its own',
      lead: 'Assam farms on rain — and the rain has stopped arriving on time.',
      points: [
        ['21.5% vs 49.9%', 'Share of sown area that is irrigated: Assam against the national average. A 2.3× gap.'],
        ['2.1 lakh diesel tube wells', 'Most of Assam\'s shallow tube wells run on diesel at ₹97 a litre.'],
        ['85% small or marginal', 'No pump, no capital. "If the rain is two weeks late, we lose the season. If diesel is costly, we lose the crop."'],
        ['The leak nobody prices', 'A village that cannot irrigate on demand also cannot cool, mill or store. One missing kWh locks all four doors.'],
      ],
    },
  },
  {
    id: 'water', n: 2, anchor: [20, 0, 23], short: 'Smart Irrigation', leak: 'Leak 1 · Water',
    after: {
      tag: 'INCOME 1 · WATER ON TAP',
      title: 'Smart Irrigation — ₹55 an hour',
      lead: 'Everyone sells a pump. CHAKRA sells the hours.',
      points: [
        ['13 HP solar pump', 'Runs on the rising sun through a VFD. 3,200 pump-hours a year sold to about 45 households across 50 acres.'],
        ['Booked by missed call', 'No app to learn. An IVR answers in Assamese, confirms the slot and sends a UPI request.'],
        ['Metered to the litre', 'Soil-moisture probes tell the node which field can safely wait two more days — 1,25,000 litres of water saved per acre.'],
        ['₹61 stays in the pocket', 'Every pumping hour: ₹55 instead of ₹116 for the same water.'],
      ],
      action: 'booking',
    },
    before: {
      tag: 'LEAK 01 · WATER',
      title: '₹116 an hour, in cash',
      lead: 'Irrigation is bought by the hour from whoever owns the pump.',
      points: [
        ['Diesel + oil + repairs', '1.2 litres burn every pumping hour at ₹97 a litre. A boro season costs ₹6,000–₹12,000 an acre.'],
        ['The dry half', 'In a dry year rain-fed paddy simply does not get transplanted. Look west — those fields stayed bare.'],
        ['₹1,300 a day', 'What a farmer here pays for diesel while the sun shines for free above the field.'],
      ],
    },
  },
  {
    id: 'cold', n: 3, anchor: [15, 0, -4], short: '5 MT Cold Room', leak: 'Leak 2 · Harvest',
    after: {
      tag: 'INCOME 2 · HARVEST SAVED',
      title: '5 MT Solar Cold Room',
      lead: 'About 15% of the harvest saved — the food now has somewhere cool to sleep.',
      points: [
        ['Pre-cooled by midday surplus', 'From noon to 4 pm the chiller pulls the chamber down to 2 °C using sunlight nobody else needs.'],
        ['A thermal battery', 'At the evening peak the chiller stays off and the room coasts on its thermal mass.'],
        ['No trip to town', 'Tomato, chilli, lemon and leafy greens no longer need a 25–40 km ride to the nearest cold storage.'],
      ],
    },
    before: {
      tag: 'LEAK 02 · HARVEST',
      title: '15–20% lost before it is sold',
      lead: 'These crates were picked this morning.',
      points: [
        ['34 °C heat', 'Tomato, chilli, lemon and leafy greens spoil within a day.'],
        ['25–40 km away', 'The nearest cold storage is in town — and costs a trip.'],
      ],
    },
  },
  {
    id: 'huller', n: 4, anchor: [-18, 0, 16], short: 'Rice Huller', leak: 'Leak 3 · Value-add',
    after: {
      tag: 'INCOME 3 · THE MARGIN STAYS HOME',
      title: 'Village Rice Huller — 7.5 kW',
      lead: 'Paddy is milled 800 m from the field.',
      points: [
        ['Slotted into the sunniest hours', 'The Bridge schedules milling for the afternoon solar peak, after irrigation is done.'],
        ['A fee, not a margin', 'Farmers pay a milling fee instead of a town miller\'s margin plus transport.'],
        ['Rice and bran stay', 'Husking and bran value used to leave with the raw grain. Now it stays in the village.'],
      ],
    },
    before: {
      tag: 'LEAK 03 · VALUE ADD',
      title: '0 processing in the village',
      lead: 'The truck is loading raw paddy for a town mill.',
      points: [
        ['Sold as raw grain', 'Husking, bran and oil margins leave the village with it.'],
        ['No energy, no value-add', 'Every unit of value-add needs an energy source the village does not have.'],
      ],
    },
  },
  {
    id: 'grid', n: 5, anchor: [-22, 0, -19], short: 'APDCL Feeder', leak: 'The 7 pm problem',
    after: {
      tag: 'INCOME 4 · GRID FLEXIBILITY',
      title: 'APDCL Feeder — 2.4 kW of evening flexibility',
      lead: 'The grid needs 7 pm far more than it needs noon.',
      points: [
        ['Nothing switches on at peak', '5–9 pm: pumps stop, the cold room coasts, and the 10 kWh battery covers lights while APDCL\'s feeder breathes.'],
        ['Shifted, not stored', '6,200 of the node\'s 19,500 units a year move into daylight with no battery at all. That is why only 10 kWh is bought.'],
        ['What the DISCOM receives', 'A 15-minute interval record of a 2.4 kW block it can move or release, forecast a day ahead, at a named feeder. Midday leftovers are exported.'],
        ['Honest limit', 'Demand response in Assam is nascent. The first ask is data — the feeder load curve — not money.'],
      ],
    },
    before: {
      tag: 'THE GRID SIDE',
      title: 'The grid needs 7 pm, not noon',
      lead: 'APDCL\'s peak demand crosses 3,150 MW by FY27.',
      points: [
        ['Surplus at noon, stress at night', 'Rooftop solar already pushes surplus into the afternoon and stress into the evening.'],
        ['No flexibility', 'The village switches everything on at dusk — and the DISCOM has no signal it can use.'],
      ],
    },
  },
]

export const TOUR = [
  { mode: 'before', time: 13, view: 'overview', kicker: 'THE PROBLEM', title: 'Assam farms on rain. The rain has stopped arriving on time.',
    text: 'Only 21.5% of Assam\'s sown area is irrigated, against 49.9% nationally. 85% of farmers are small or marginal — no pump, no capital. This is one such village in Barak Valley.' },
  { mode: 'before', time: 8, play: false, view: 'water', kicker: 'LEAK 1 · WATER', title: '₹116 an hour, in cash',
    text: 'Water is bought by the hour from whoever owns a diesel pump: 1.2 litres an hour at ₹97 a litre, plus oil and repairs.' },
  { mode: 'before', time: 9, view: 'fieldsDry', kicker: 'LEAK 1 · WATER', title: 'Half the fields stay bare',
    text: 'In a dry year, rain-fed paddy simply does not get transplanted. "If the rain is two weeks late, we lose the season. If diesel is costly, we lose the crop."' },
  { mode: 'before', time: 13.5, view: 'cold_b', kicker: 'LEAK 2 · HARVEST', title: '15–20% is lost before it is ever sold',
    text: 'Tomato, chilli, lemon and leafy greens spoil within a day at 34 °C. The nearest cold storage is 25–40 km away.' },
  { mode: 'before', time: 15, view: 'huller_b', kicker: 'LEAK 3 · VALUE ADD', title: 'The paddy leaves as raw grain',
    text: 'Husking and bran margins go to a town miller. One missing kWh locks all four doors: the village cannot irrigate, cool, mill or store.' },
  { mode: 'after', time: 10, play: true, view: 'hub', kicker: 'THE SOLUTION', title: 'One shared array. Four jobs. No diesel.',
    text: '15 kWp of solar, a 10 kWh battery and the CHAKRA Bridge controller that decides which load gets the next unit of sunlight. Farmers invest ₹0 — they buy the service, never the machine.' },
  { mode: 'after', time: 5.5, view: 'booking', kicker: 'INCOME 1 · 5:30 AM', title: 'Ramen books water with a missed call',
    text: 'One missed call. An IVR answers in Assamese and sends a UPI request: ₹110 for two hours, instead of ₹232 on diesel.', action: 'booking' },
  { mode: 'after', time: 7.5, play: true, view: 'water', kicker: 'INCOME 1 · 6–11 AM', title: 'The pump runs on the rising sun',
    text: 'Water first, always. Flow is metered to the litre; soil probes tell the node which field can wait. Follow the blue pulses from the hub to the pump.' },
  { mode: 'after', time: 13, play: true, view: 'cold', kicker: 'INCOME 2 · 12–4 PM', title: 'Surplus becomes cold',
    text: 'With irrigation done, midday surplus pre-cools the 5 MT room to 2 °C. About 15% of the harvest is saved, with no trip to town.' },
  { mode: 'after', time: 13.2, play: true, view: 'huller', kicker: 'INCOME 3 · 12–4 PM', title: 'The margin stays home',
    text: 'The 7.5 kW huller runs its milling slots in the sunniest hours. Paddy is milled 800 m from the field for a fee, not a miller\'s margin.' },
  { mode: 'after', time: 17.9, play: true, view: 'grid', kicker: 'INCOME 4 · 5–9 PM', title: 'Nothing switches on at peak',
    text: 'Pumps stop, the cold room coasts, and the battery covers the lights. APDCL gets 2.4 kW of metered evening flexibility at this feeder.' },
  { mode: 'after', time: 16, view: 'overview', drawer: true, kicker: 'THE IMPACT', title: '₹17,825 more per acre, every year',
    text: '3,840 litres of diesel never burnt and 16.1 tonnes of CO₂e avoided per node. The node earns ₹5.09 lakh and spends ₹2.79 lakh a year. Now explore on your own.' },
]

// Narrated walkthrough: where Ramen stands, what he points at, and the village state for each scene.
// Spoken text lives in narration.json (en / hi / as), audio in public/audio.
export const GUIDE = [
  { id: 'intro', mode: 'before', time: 7.5, spot: [5, 28.2], focus: [12, 0.5, 48], wave: true, kicker: 'MEET RAMEN', title: 'A farmer from Barak Valley' },
  { id: 'diesel', mode: 'before', time: 8, spot: [16.2, 20.3], focus: [18.4, 0.8, 22], kicker: 'LEAK 1 · WATER', title: '₹116 an hour, in cash' },
  { id: 'dry', mode: 'before', time: 9, spot: [-9, 29.6], focus: [-24, 0, 46], height: 2.8, kicker: 'LEAK 1 · WATER', title: 'Half the fields stay bare' },
  { id: 'spoil', mode: 'before', time: 13.5, spot: [16.6, 0.4], focus: [15, 0.6, -3], kicker: 'LEAK 2 · HARVEST', title: '15–20% lost before it is sold' },
  { id: 'truck', mode: 'before', time: 15, spot: [-5.2, 27], focus: [-10, 1, 22], truck: true, kicker: 'LEAK 3 · VALUE ADD', title: 'The paddy leaves as raw grain' },
  { id: 'hub', mode: 'after', time: 9.6, play: true, rate: 0.12, spot: [-7.5, 8], focus: [-7, 1.5, -3], dist: 6.4, kicker: 'THE SOLUTION', title: 'One shared array. Four jobs. No diesel.' },
  { id: 'water', mode: 'after', time: 6.2, play: true, rate: 0.15, spot: [16.2, 20.3], focus: [18.4, 0.8, 22], kicker: 'INCOME 1 · WATER', title: '₹110 instead of ₹232' },
  { id: 'cold', mode: 'after', time: 12.4, play: true, rate: 0.12, spot: [17.2, 3.4], focus: [15, 1.5, -4], kicker: 'INCOME 2 · COLD ROOM', title: 'Midday sun becomes cold' },
  { id: 'huller', mode: 'after', time: 12.8, play: true, rate: 0.1, spot: [-12.8, 22.6], focus: [-18, 1.5, 16], kicker: 'INCOME 3 · RICE HULLER', title: 'The margin stays home' },
  { id: 'grid', mode: 'after', time: 17.3, play: true, rate: 0.22, spot: [-20, -9], via: [[-11, 10], [-18.5, 2]], focus: [-40, 3, -34], height: 2.9, kicker: 'INCOME 4 · GRID', title: 'Nothing switches on at peak' },
  { id: 'close', mode: 'after', time: 16, spot: [-2, 28], via: [[-18.5, 3]], focus: [2, 0.5, 52], wave: true, drawer: true, kicker: 'THE IMPACT', title: 'One shared array, four incomes' },
]
export const LANGS = [['en', 'English'], ['hi', 'हिन्दी'], ['as', 'অসমীয়া']]

export const FLOW_COLORS = { solar: '#ffc247', pump: '#4fc3ff', cold: '#b9f3ff', huller: '#ff9a4d', battery: '#7dffa0', grid: '#d6a6ff' }
