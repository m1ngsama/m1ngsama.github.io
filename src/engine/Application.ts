import * as THREE from 'three';
import { Composer } from '../postprocessing/Composer';
import { HeroScene } from '../scenes/hero/HeroScene';
import { createCamera } from './camera';
import { createRenderer, getQuality, maxPixelRatio, type Quality } from './renderer';

interface ApplicationOptions {
  reducedMotion: boolean;
}

export class Application {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera = createCamera();
  private readonly scene = new THREE.Scene();
  private readonly clock = new THREE.Clock(false);
  private readonly pointer = new THREE.Vector2();
  private readonly pointerTarget = new THREE.Vector2();
  private readonly lookTarget = new THREE.Vector3();
  private readonly quality: Quality;
  private readonly hero: HeroScene;
  private readonly composer: Composer;
  private readonly precisePointer = window.matchMedia('(pointer: fine)').matches;
  private frameId = 0;
  private running = false;
  private destroyed = false;
  private scrollCurrent = 0;
  private scrollTarget = 0;
  private lastLowQualityFrame = 0;
  private fpsStartedAt = performance.now();
  private fpsFrames = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: ApplicationOptions,
  ) {
    this.quality = getQuality();
    this.renderer = createRenderer(canvas, this.quality);
    this.scene.fog = new THREE.FogExp2(0x050505, 0.034);
    this.hero = new HeroScene(this.quality);
    this.scene.add(this.hero);
    this.composer = new Composer(
      this.renderer,
      this.scene,
      this.camera,
      this.quality === 'high' && !options.reducedMotion,
    );
    this.updateScroll();
    this.resize();
  }

  start(): void {
    if (this.destroyed) return;
    this.bindEvents();
    this.renderStaticFrame();

    if (!this.options.reducedMotion) {
      this.running = true;
      this.clock.start();
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.resize, { passive: true });
    window.addEventListener('scroll', this.updateScroll, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);

    if (this.precisePointer && !this.options.reducedMotion) {
      window.addEventListener('pointermove', this.handlePointer, { passive: true });
      document.documentElement.addEventListener('pointerleave', this.resetPointer);
    }
  }

  private handlePointer = (event: PointerEvent): void => {
    this.pointerTarget.set(event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5);
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
    } else if (!this.options.reducedMotion && !this.destroyed) {
      this.clock.start();
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

  private tick = (now: number): void => {
    if (!this.running || this.destroyed) return;
    this.frameId = requestAnimationFrame(this.tick);

    if (this.quality === 'low' && now - this.lastLowQualityFrame < 1000 / 30) return;
    this.lastLowQualityFrame = now;

    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    const damping = 1 - Math.exp(-delta * 3.6);
    this.pointer.lerp(this.pointerTarget, damping);
    this.scrollCurrent = THREE.MathUtils.lerp(this.scrollCurrent, this.scrollTarget, damping * 0.72);

    const cameraRange = this.quality === 'low' ? 0.08 : 0.18;
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.pointer.x * cameraRange, damping);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, -this.pointer.y * cameraRange * 0.72, damping);
    this.lookTarget.set(this.pointer.x * 0.08, -this.pointer.y * 0.05, 0);
    this.camera.lookAt(this.lookTarget);

    this.hero.update(elapsed, delta, this.pointer, this.scrollCurrent, window.innerWidth < 760);
    this.composer.render(delta);
    this.checkPerformance(now);
  };

  private checkPerformance(now: number): void {
    if (this.quality === 'low') return;
    this.fpsFrames += 1;
    const sampleTime = now - this.fpsStartedAt;
    if (sampleTime < 2400) return;

    const fps = (this.fpsFrames * 1000) / sampleTime;
    if (fps < 43 && this.renderer.getPixelRatio() > 1) {
      this.renderer.setPixelRatio(Math.max(1, this.renderer.getPixelRatio() - 0.25));
      this.composer.setSize(window.innerWidth, window.innerHeight);
    }
    this.fpsFrames = 0;
    this.fpsStartedAt = now;
  }

  private renderStaticFrame(): void {
    this.hero.update(0.8, 0, this.pointer, this.scrollTarget, window.innerWidth < 760);
    this.composer.render(0);
  }

  private resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.fov = width < 760 ? 50 : 42;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio(this.quality)));
    this.composer.setSize(width, height);
    if (this.options.reducedMotion) this.renderStaticFrame();
  };

  private stopLoop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.clock.stop();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('scroll', this.updateScroll);
    window.removeEventListener('pointermove', this.handlePointer);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    document.documentElement.removeEventListener('pointerleave', this.resetPointer);
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.hero.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
