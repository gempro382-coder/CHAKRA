# CHAKRA — One Shared Array, Four Incomes

Walkable 3D village prototype for the Yuva Yodha Energy Tech Hackathon 2026 (Team Aa. A · Aashish Kumar).

## Run it

Needs Node.js 18 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173 in Chrome or Edge.

## Build a version to host

```bash
npm run build
```

The `dist/` folder can be uploaded to any static host (Netlify, Vercel, GitHub Pages).

## What is inside

- `src/` — the site (React + Three.js). Story numbers are in `src/data.js`, narration text in `src/narration.json`.
- `public/` — 3D models, textures, sky and narration audio. Everything is local, so the site runs offline.

Every number shown comes from the deck `CHAKRA_TeamAaA_YuvaYodha2026.pptx`.

Add `?q=high` or `?q=low` to the address to force the detailed or the lighter scene.

## Credits

- **Banana Tree by Poly by Google, CC-BY 3.0 (attribution required)** — https://poly.pizza/m/d0WJSiuOz6o
- Farmer, Pickup Truck, Palm Tree, Trees, Bamboo by Quaternius; Crate of Tomatoes by Kay Lousberg (CC0, via poly.pizza).
- Textures, sky and the crate, condenser, jerry can and utility box models from Poly Haven (CC0).
- English and Hindi narration: Microsoft neural voices. Assamese narration: Meta MMS model `facebook/mms-tts-asm` (CC-BY-NC 4.0, non-commercial).
