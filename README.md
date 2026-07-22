# m1ngsama.github.io

Personal developer site for [m1ngsama.github.io](https://m1ngsama.github.io/).

## Direction

**The Signal** is a restrained WebGL identity system built around a simple idea: complexity should be resolved by the system, not transferred to the person using it. The interface uses an almost-black palette, editorial typography, generous space, and a persistent procedural object that becomes calmer as the page moves from introduction to detail.

## Stack

- Vite + TypeScript
- Three.js with a small adaptive post-processing pipeline
- GSAP + ScrollTrigger for DOM choreography
- Lenis for subtle desktop wheel smoothing
- GitHub Actions deployment to GitHub Pages

## Structure

```text
src/index.html
└── main.ts
├── ui/motion.ts
└── engine/Application.ts
    ├── engine/renderer.ts
    ├── engine/camera.ts
    ├── scenes/hero/HeroScene.ts
    │   ├── SignalCore.ts
    │   └── ParticleField.ts
    └── postprocessing/Composer.ts
```

The WebGL layer is progressive enhancement. Semantic page content remains readable if JavaScript, WebGL, or animation is unavailable. Reduced-motion preferences render a static composition and disable smooth scrolling and continuous animation.

## Development

```bash
npm ci
npm run dev
npm run typecheck
npm run build
npm run sync:pages
```

GitHub Pages currently publishes from `main / root`. `npm run sync:pages` creates the production build and copies
its deterministic output to the repository root; the validation workflow rebuilds it on every push and rejects stale
published artifacts. GitHub's built-in Pages deployment then publishes that verified root output.
