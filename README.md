# m1ngsama.github.io

Generative WebGL experiment for [m1ngsama.github.io](https://m1ngsama.github.io/).

## The Fold

The site is a single, reversible scroll film with one subject: a dark procedural surface that folds into a Möbius
ring, carries a narrow signal through its material, and resolves into an event horizon. Visible copy is intentionally
limited to the identity, phase index, and GitHub control.

## Stack

- Vite + TypeScript
- Three.js with custom parameterized geometry and shaders
- Adaptive bloom and a lightweight atmospheric post-process
- Native scroll and pointer input through one render loop
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
    │   ├── Fold.ts
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
