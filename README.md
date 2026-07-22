# m1ngsama.github.io

Generative WebGL experiment for [m1ngsama.github.io](https://m1ngsama.github.io/).

## One Surface Cosmology

A nearly textless, reversible WebGL film. One parameterized surface moves through six connected states: spacetime,
a shadowed world, a twisted orbit, a tidal ribbon, a spiral galaxy, and an event horizon. Surface-born stars, a
lensed deep field, a procedural particle galaxy, and a narrow accretion memory all share the same scroll timeline,
pointer field, velocity response, and press impulse.

The visual system is procedural: there are no image textures, stock space assets, or remote runtime dependencies.

## Stack

- Vite + TypeScript + Three.js
- Custom GLSL geometry morphing, materials, particles, bloom, lensing, chromatic aberration, and film grain
- Adaptive pixel ratio and quality-specific geometry/particle budgets
- WebGL2 capability check, context recovery, background-tab pause, reduced-motion still frame, and CSS fallback
- GitHub Pages from `main / root`

## Structure

```text
src/index.html
├── main.ts
├── ui/motion.ts
└── engine/Application.ts
    ├── engine/renderer.ts
    ├── engine/camera.ts
    ├── scenes/hero/HeroScene.ts
    │   ├── sequence.ts
    │   ├── CosmicSurface.ts
    │   ├── ParticleCosmos.ts
    │   ├── WorldCore.ts
    │   ├── Galaxy.ts
    │   ├── Starfield.ts
    │   ├── AccretionDisk.ts
    │   └── Backdrop.ts
    └── postprocessing/Composer.ts
```

## Development

```bash
npm ci
npm run dev
npm run typecheck
npm run build
npm run sync:pages
npm run verify:pages
```

`npm run sync:pages` builds the site and mirrors `dist/` to the repository root. The Pages validation workflow rejects
stale publishing artifacts.
