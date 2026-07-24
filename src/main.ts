import './styles/global.css';
import { initMotion } from './ui/motion';

const root = document.documentElement;
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let app: import('./engine/Application').Application | undefined;
let destroyMotion = initMotion(motionQuery.matches);
let loadVersion = 0;
const motionToggle = document.querySelector<HTMLButtonElement>('#motion-toggle');

function setMotionControl(paused: boolean, enabled: boolean): void {
  if (!motionToggle) return;
  motionToggle.disabled = !enabled;
  motionToggle.setAttribute('aria-pressed', String(paused));
  motionToggle.setAttribute('aria-label', paused ? 'Resume animation' : 'Pause animation');
}

function supportsWebGL2(): boolean {
  try {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    });
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

async function loadExperience(): Promise<void> {
  const version = ++loadVersion;
  const canvas = document.querySelector<HTMLCanvasElement>('#webgl');
  if (!canvas) return;

  app?.destroy();
  app = undefined;
  setMotionControl(false, false);
  root.classList.remove('webgl-ready', 'webgl-fallback');

  if (!supportsWebGL2()) {
    root.classList.add('webgl-fallback');
    return;
  }

  try {
    const { Application } = await import('./engine/Application');
    if (version !== loadVersion) return;
    app = new Application(canvas, { reducedMotion: motionQuery.matches });
    app.start();
    root.classList.add('webgl-ready');
    setMotionControl(false, !motionQuery.matches);
  } catch (error) {
    app?.destroy();
    app = undefined;
    root.classList.remove('webgl-ready');
    root.classList.add('webgl-fallback');
    console.warn('The WebGL experiment could not be started.', error);
  }
}

requestAnimationFrame(() => window.setTimeout(() => void loadExperience(), 32));

motionToggle?.addEventListener('click', () => {
  if (!app) return;
  const paused = app.togglePaused();
  setMotionControl(paused, true);
});

motionQuery.addEventListener('change', () => {
  destroyMotion();
  destroyMotion = initMotion(motionQuery.matches);
  void loadExperience();
});

window.addEventListener('pagehide', () => {
  loadVersion += 1;
  app?.destroy();
  app = undefined;
  destroyMotion();
});

window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  destroyMotion = initMotion(motionQuery.matches);
  void loadExperience();
});
