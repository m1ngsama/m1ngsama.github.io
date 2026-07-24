# m1ngsama.github.io

Generative WebGL experiment for [m1ngsama.github.io](https://m1ngsama.github.io/).

## One Surface Cosmology

A nearly textless, reversible WebGL film. One parameterized surface moves through five connected states: spacetime,
an observed lunar world, a true Möbius orbit, a barred spiral galaxy, and an event horizon. NASA LRO/LOLA lunar data,
a NASA deep-star map, and the NASA/JPL-Caltech/UCLA WISE infrared sky are loaded locally and fused with the procedural
geometry. A lensed deep field, stratified particle galaxy, volumetric galactic medium, and relativistic accretion flow
share the same scroll timeline, pointer field, velocity response, and press impulse.

There are no remote runtime dependencies. Every observational texture is optimized and bundled with the build; the
experience starts with valid procedural fallbacks and promotes itself when the observation data has loaded. Sources,
credits, transformations, and checksums are recorded in [`ASTRONOMY_ASSETS.md`](./ASTRONOMY_ASSETS.md).

## Stack

- Vite + TypeScript + Three.js
- NASA observation textures plus custom GLSL topology transport, finite-difference normals, physically inspired
  differential rotation, Doppler asymmetry, particles, lensing, and film grain
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
    ├── engine/AstronomyAssets.ts
    ├── scenes/hero/HeroScene.ts
    │   ├── sequence.ts
    │   ├── cosmicField.ts
    │   ├── CosmicSurface.ts
    │   ├── ParticleCosmos.ts
    │   ├── WorldCore.ts
    │   ├── Galaxy.ts
    │   ├── GalaxyVolume.ts
    │   ├── ObservedSky.ts
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
