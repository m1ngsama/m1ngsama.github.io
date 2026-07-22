import * as THREE from 'three';
import { Composer } from '../postprocessing/Composer';
import { HeroScene } from '../scenes/hero/HeroScene';
import { createCamera } from './camera';
import { createRenderer, getQuality, targetPixelRatio, type Quality } from './renderer';

interface ApplicationOptions {
  reducedMotion: boolean;
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

export class Application {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera = createCamera();
  private readonly scene = new THREE.Scene();
  private readonly pointer = new THREE.Vector2();
  private readonly pointerTarget = new THREE.Vector2();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly quality: Quality;
  private readonly hero: HeroScene;
  private readonly composer: Composer;
  private readonly precisePointer = window.matchMedia('(pointer: fine)').matches;
  private frameId = 0;
  private running = false;
  private paused = false;
  private destroyed = false;
  private scrollCurrent = 0;
  private scrollTarget = 0;
  private pulse = 0;
  private adaptiveScale = 1;
  private fpsStartedAt = performance.now();
  private fpsFrames = 0;
  private elapsed = 0;
  private lastFrameTime = 0;
  private lastRenderTime = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: ApplicationOptions,
  ) {
    this.quality = getQuality();
    this.renderer = createRenderer(canvas, this.quality);
    this.scene.background = new THREE.Color(0x020204);
    this.hero = new HeroScene(this.quality);
    this.scene.add(this.hero);
    this.composer = new Composer(this.renderer, this.scene, this.camera, this.quality, options.reducedMotion);
    this.updateScroll();
    this.resize();
  }

  start(): void {
    if (this.destroyed) return;
    this.bindEvents();
    this.renderStaticFrame();

    if (!this.options.reducedMotion) {
      this.running = true;
      this.lastFrameTime = performance.now();
      this.lastRenderTime = this.lastFrameTime;
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.resize, { passive: true });
    window.addEventListener('scroll', this.updateScroll, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    if (!this.options.reducedMotion) {
      window.addEventListener('pointermove', this.handlePointer, { passive: true });
      window.addEventListener('pointerdown', this.handleImpulse, { passive: true });
      if (this.precisePointer) document.documentElement.addEventListener('pointerleave', this.resetPointer);
    }
  }

  private handlePointer = (event: PointerEvent): void => {
    this.pointerTarget.set(
      (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2,
      -(event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2,
    );
  };

  private handleImpulse = (event: PointerEvent): void => {
    this.handlePointer(event);
    this.pulse = Math.min(1, this.pulse + 0.82);
  };

  private resetPointer = (): void => {
    this.pointerTarget.set(0, 0);
  };

  private updateScroll = (): void => {
    const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    this.scrollTarget = THREE.MathUtils.clamp(window.scrollY / max, 0, 1);
  };

  private handleVisibility = (): void => {
    if (document.hidden) {
      this.stopLoop();
    } else if (!this.options.reducedMotion && !this.destroyed && !this.paused) {
      this.lastFrameTime = performance.now();
      this.lastRenderTime = this.lastFrameTime;
      this.running = true;
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.stopLoop();
    document.documentElement.classList.remove('webgl-ready');
    document.documentElement.classList.add('webgl-fallback');
  };

  private handleContextRestored = (): void => {
    if (this.destroyed) return;
    document.documentElement.classList.remove('webgl-fallback');
    document.documentElement.classList.add('webgl-ready');
    this.resize();
    this.renderStaticFrame();
    if (!this.options.reducedMotion && !this.paused) {
      this.lastFrameTime = performance.now();
      this.lastRenderTime = this.lastFrameTime;
      this.running = true;
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private tick = (now: number): void => {
    if (!this.running || this.destroyed) return;
    this.frameId = requestAnimationFrame(this.tick);

    const frameInterval = this.quality === 'low' ? 1000 / 30 : 1000 / 60;
    if (now - this.lastRenderTime < frameInterval - 1) return;

    const delta = Math.min(Math.max((now - this.lastFrameTime) / 1000, 0), 0.05);
    this.lastFrameTime = now;
    this.lastRenderTime = now;
    this.elapsed += delta;
    const damping = 1 - Math.exp(-delta * 4.2);
    this.pointer.lerp(this.pointerTarget, damping);
    this.scrollCurrent = THREE.MathUtils.lerp(this.scrollCurrent, this.scrollTarget, damping * 0.68);
    this.pulse *= Math.exp(-delta * 2.15);

    this.updateCamera(delta);
    this.hero.update(
      this.elapsed,
      delta,
      this.pointer,
      this.scrollCurrent,
      this.isMobile(),
      this.pulse,
    );
    this.composer.update(this.elapsed, this.pulse, this.scrollCurrent);
    this.composer.render(delta);
    this.checkPerformance(now);
  };

  private updateCamera(delta: number): void {
    const progress = this.scrollCurrent;
    const reveal = smoothStep(0.06, 0.48, progress);
    const orbit = smoothStep(0.47, 0.72, progress);
    const horizon = smoothStep(0.78, 0.99, progress);
    const mobile = this.isMobile();
    const wideZ = mobile ? 9.1 : 7.45;

    let x = THREE.MathUtils.lerp(mobile ? 0.1 : 0.58, mobile ? 0.35 : 1.05, reveal);
    x = THREE.MathUtils.lerp(x, mobile ? -0.35 : -1.05, orbit);
    x = THREE.MathUtils.lerp(x, 0, horizon);
    let y = THREE.MathUtils.lerp(-0.05, 0.38, reveal);
    y = THREE.MathUtils.lerp(y, -0.14, orbit);
    y = THREE.MathUtils.lerp(y, 0, horizon);
    let z = THREE.MathUtils.lerp(mobile ? 3.75 : 3.05, wideZ, reveal);
    z -= orbit * (mobile ? 0.18 : 0.68);
    z += horizon * (mobile ? 0.72 : 0.58);

    const pointerRange = mobile ? 0.035 : 0.13;
    this.cameraTarget.set(
      x + this.pointer.x * pointerRange,
      y + this.pointer.y * pointerRange * 0.7,
      z,
    );
    const damping = delta === 0 ? 1 : 1 - Math.exp(-delta * 3.2);
    this.camera.position.lerp(this.cameraTarget, damping);

    const earlyFocus = THREE.MathUtils.lerp(0.45, 0, reveal);
    this.lookTarget.set(
      earlyFocus + this.pointer.x * 0.045,
      this.pointer.y * 0.03,
      0,
    );
    this.camera.lookAt(this.lookTarget);
  }

  private checkPerformance(now: number): void {
    if (this.quality === 'low') return;
    this.fpsFrames += 1;
    const sampleTime = now - this.fpsStartedAt;
    if (sampleTime < 2800) return;

    const fps = (this.fpsFrames * 1000) / sampleTime;
    if (fps < 46 && this.adaptiveScale > 0.66) {
      this.adaptiveScale = Math.max(0.66, this.adaptiveScale - 0.12);
      this.applyPixelRatio();
    }
    this.fpsFrames = 0;
    this.fpsStartedAt = now;
  }

  private renderStaticFrame(): void {
    const progress = this.options.reducedMotion ? 0.7 : this.scrollTarget;
    this.scrollCurrent = progress;
    this.updateCamera(0);
    this.hero.update(0.8, 0, this.pointer, progress, this.isMobile(), 0);
    this.composer.update(0.8, 0, progress);
    this.composer.render(0);
  }

  private isMobile(): boolean {
    return window.innerWidth < 760 || window.matchMedia('(pointer: coarse)').matches;
  }

  private applyPixelRatio(): void {
    const ratio = targetPixelRatio(this.quality) * this.adaptiveScale;
    this.renderer.setPixelRatio(ratio);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  private resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.fov = width < 760 ? 38 : 34;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.applyPixelRatio();
    if (this.options.reducedMotion) this.renderStaticFrame();
  };

  private stopLoop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  togglePaused(): boolean {
    if (this.options.reducedMotion || this.destroyed) return true;
    this.paused = !this.paused;
    if (this.paused) {
      this.stopLoop();
    } else {
      this.lastFrameTime = performance.now();
      this.lastRenderTime = this.lastFrameTime;
      this.running = true;
      this.frameId = requestAnimationFrame(this.tick);
    }
    return this.paused;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('scroll', this.updateScroll);
    window.removeEventListener('pointermove', this.handlePointer);
    window.removeEventListener('pointerdown', this.handleImpulse);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    document.documentElement.removeEventListener('pointerleave', this.resetPointer);
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.hero.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
