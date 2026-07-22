import './styles/global.css';
import { initMotion } from './ui/motion';

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let app: import('./engine/Application').Application | undefined;
let destroyMotion = initMotion(motionQuery.matches);

function supportsWebGL2(): boolean {
  try {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2', { powerPreference: 'low-power' });
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

async function loadExperience() {
  const canvas = document.querySelector<HTMLCanvasElement>('#webgl');
  if (!canvas) return;

  if (!supportsWebGL2()) {
    document.documentElement.classList.add('webgl-fallback');
    return;
  }

  try {
    const { Application } = await import('./engine/Application');
    app = new Application(canvas, { reducedMotion: motionQuery.matches });
    app.start();
    document.documentElement.classList.add('webgl-ready');
  } catch (error) {
    document.documentElement.classList.add('webgl-fallback');
    console.warn('The WebGL experience could not be started.', error);
  }
}

requestAnimationFrame(() => window.setTimeout(loadExperience, 40));

motionQuery.addEventListener('change', () => {
  app?.destroy();
  destroyMotion();
  destroyMotion = initMotion(motionQuery.matches);
  void loadExperience();
});

window.addEventListener(
  'pagehide',
  () => {
    app?.destroy();
    destroyMotion();
  },
  { once: true },
);
