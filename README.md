# m1ngsama.github.io

Generative WebGL experiment for [m1ngsama.github.io](https://m1ngsama.github.io/).

## One Surface Cosmology

The site is a text-free, reversible WebGL film. One procedural surface moves through six connected states: spacetime,
a shadowed world, a continuous orbit, a tidal ribbon, a spiral galaxy, and an event horizon. A lensed starfield,
surface-born stars, orbital lines, a procedural accretion disk, and a GPU particle galaxy all respond to the same
timeline, pointer field, scroll velocity, and press-to-charge impulse.

## Stack

- Vite + TypeScript
- Three.js with custom parameterized geometry, procedural worlds, and GPU particle systems
- Localized gravitational lensing, adaptive bloom, and a compact cosmology post-process
- Native scroll, pointer parallax, velocity response, and press-to-charge interaction through one render loop
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
    │   ├── Galaxy.ts
    │   ├── Starfield.ts
    │   ├── ParticleCosmos.ts
    │   ├── WorldCore.ts
    │   ├── OrbitalSystem.ts
    │   ├── AccretionDisk.ts
    │   └── Backdrop.ts
    └── postprocessing/Composer.ts
```

The Three.js bundle is dynamically imported after the static poster and interface are available. WebGL2 is checked
before import; reduced motion renders a single composed frame; context loss, background tabs, BFCache restores,
coarse pointers, high pixel density, and low frame rates all have explicit handling.

## Development

```bash
npm ci
npm run dev
npm run typecheck
npm run build
npm run sync:pages
npm run verify:pages
```

`npm run sync:pages` creates the production build and copies it to the repository root because this user-site
repository is published by GitHub Pages from `main / root`. The validation workflow rejects stale root artifacts.
