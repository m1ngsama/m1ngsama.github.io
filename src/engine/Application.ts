import * as THREE from 'three';
import { Composer } from '../postprocessing/Composer';
import { HeroScene } from '../scenes/hero/HeroScene';
import { sampleSequence } from '../scenes/hero/sequence';
import { createCamera } from './camera';
import { createRenderer, getQuality, targetPixelRatio, type Quality } from './renderer';

interface ApplicationOptions {
  reducedMotion: boolean;
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
  private scrollVelocity = 0;
  private pulse = 0;
  private charge = 0;
  private pressing = false;
  private adaptiveScale = 1;
  private appliedPixelRatio = 0;
  private recoverySamples = 0;
  private resizeFrame = 0;
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
    this.scene.background = new THREE.Color(0x010103);
    this.hero = new HeroScene(this.quality);
    this.scene.add(this.hero);
    this.composer = new Composer(this.renderer, this.scene, this.camera, this.quality, options.reducedMotion);
    this.updateScroll();
    this.applyResize();
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
      window.addEventListener('pointerup', this.handleRelease, { passive: true });
      window.addEventListener('pointercancel', this.handleRelease, { passive: true });
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
    this.pressing = true;
    this.charge = Math.max(this.charge, 0.16);
    this.pulse = Math.min(1, this.pulse + 0.24);
  };

  private handleRelease = (): void => {
    if (!this.pressing) return;
    this.pressing = false;
    this.pulse = Math.min(1, this.pulse + 0.22 + this.charge * 0.7);
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
      this.pressing = false;
      this.stopLoop();
    } else if (!this.options.reducedMotion && !this.destroyed && !this.paused) {
      this.lastFrameTime = performance.now();
      this.lastRenderTime = this.lastFrameTime;
      this.resetPerformanceSample(this.lastFrameTime);
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
    if (!this.options.reducedMotion && !this.paused && !document.hidden) {
      this.lastFrameTime = performance.now();
      this.lastRenderTime = this.lastFrameTime;
      this.resetPerformanceSample(this.lastFrameTime);
      this.running = true;
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private tick = (now: number): void => {
    if (!this.running || this.destroyed) return;
    this.frameId = requestAnimationFrame(this.tick);

    const frameInterval = this.quality === 'low' ? 1000 / 45 : 1000 / 60;
    if (now - this.lastRenderTime < frameInterval - 1) return;

    const responseDelta = Math.min(Math.max((now - this.lastFrameTime) / 1000, 0), 0.2);
    const delta = Math.min(responseDelta, 0.05);
    this.lastFrameTime = now;
    this.lastRenderTime = now;
    this.elapsed += responseDelta;
    const damping = 1 - Math.exp(-responseDelta * 4.2);
    this.pointer.lerp(this.pointerTarget, damping);
    const previousScroll = this.scrollCurrent;
    this.scrollCurrent = THREE.MathUtils.lerp(this.scrollCurrent, this.scrollTarget, damping * 0.68);
    const instantVelocity = responseDelta > 0 ? (this.scrollCurrent - previousScroll) / responseDelta : 0;
    this.scrollVelocity = THREE.MathUtils.lerp(
      this.scrollVelocity,
      instantVelocity,
      1 - Math.exp(-responseDelta * 8.5),
    );
    if (this.pressing) {
      this.charge = Math.min(1, this.charge + responseDelta * 0.72);
      this.pulse = Math.max(this.pulse, this.charge * 0.58);
    } else {
      this.charge *= Math.exp(-responseDelta * 3.4);
      this.pulse *= Math.exp(-responseDelta * 2.15);
    }

    this.checkPerformance(now);
    const progress = this.visualProgress(this.scrollCurrent);
    this.updateCamera(responseDelta, progress);
    this.hero.update(
      this.elapsed,
      responseDelta,
      this.pointer,
      progress,
      this.isMobile(),
      this.pulse,
      this.scrollVelocity,
    );
    this.composer.update(this.elapsed, this.pulse, progress, this.pointer, this.scrollVelocity);
    this.composer.render(delta);
  };

  private updateCamera(delta: number, progress = this.visualProgress(this.scrollCurrent)): void {
    const mobile = this.isMobile();
    const frame = sampleSequence(progress, mobile);
    const pointerRange = mobile ? 0.035 : 0.13;
    this.cameraTarget.copy(frame.position);
    this.cameraTarget.x += this.pointer.x * pointerRange;
    this.cameraTarget.y += this.pointer.y * pointerRange * 0.7;
    const damping = delta === 0 ? 1 : 1 - Math.exp(-delta * 3.2);
    this.camera.position.lerp(this.cameraTarget, damping);
    this.lookTarget.copy(frame.target);
    this.lookTarget.x += this.pointer.x * 0.04;
    this.lookTarget.y += this.pointer.y * 0.025;
    this.camera.lookAt(this.lookTarget);
    const nextFov = frame.fov;
    if (Math.abs(this.camera.fov - nextFov) > 0.001) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, nextFov, damping);
      this.camera.updateProjectionMatrix();
    }
  }

  private resetPerformanceSample(now = performance.now()): void {
    this.fpsFrames = 0;
    this.fpsStartedAt = now;
  }

  private checkPerformance(now: number): void {
    if (this.quality === 'low') return;
    this.fpsFrames += 1;
    const sampleTime = now - this.fpsStartedAt;
    if (sampleTime < 2800) return;

    const fps = (this.fpsFrames * 1000) / sampleTime;
    if (fps < 46 && this.adaptiveScale > 0.66) {
      this.adaptiveScale = Math.max(0.66, this.adaptiveScale - 0.12);
      this.recoverySamples = 0;
      this.applyPixelRatio();
    } else if (fps > 57 && this.adaptiveScale < 1) {
      this.recoverySamples += 1;
      if (this.recoverySamples >= 3) {
        this.adaptiveScale = Math.min(1, this.adaptiveScale + 0.06);
        this.recoverySamples = 0;
        this.applyPixelRatio();
      }
    } else {
      this.recoverySamples = 0;
    }
    this.fpsFrames = 0;
    this.fpsStartedAt = now;
  }

  private renderStaticFrame(): void {
    const scrollProgress = this.options.reducedMotion ? 0.82 : this.scrollTarget;
    const progress = this.options.reducedMotion ? scrollProgress : this.visualProgress(scrollProgress);
    this.scrollCurrent = scrollProgress;
    this.updateCamera(0, progress);
    const frameTime = this.elapsed > 0 ? this.elapsed : 0.8;
    this.hero.update(frameTime, 0, this.pointer, progress, this.isMobile(), 0, 0);
    this.composer.update(frameTime, 0, progress, this.pointer, 0);
    this.composer.render(0);
  }

  private isMobile(): boolean {
    const portraitLike = window.innerHeight >= window.innerWidth * 0.72;
    return window.innerWidth < 760 && portraitLike;
  }

  private visualProgress(value: number): number {
    return 0.04 + THREE.MathUtils.clamp(value, 0, 1) * 0.96;
  }

  private applyPixelRatio(): void {
    const ratio = targetPixelRatio(this.quality) * this.adaptiveScale;
    if (Math.abs(ratio - this.appliedPixelRatio) < 0.001) return;
    this.appliedPixelRatio = ratio;
    this.renderer.setPixelRatio(ratio);
    this.composer.setPixelRatio(ratio);
    this.hero.setPixelRatio(ratio * this.composer.getRenderScale());
  }

  private resize = (): void => {
    if (this.resizeFrame !== 0) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      this.applyResize();
    });
  };

  private applyResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.applyPixelRatio();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    if (this.options.reducedMotion || this.paused) this.renderStaticFrame();
  }

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
      this.resetPerformanceSample(this.lastFrameTime);
      this.running = true;
      this.frameId = requestAnimationFrame(this.tick);
    }
    return this.paused;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    cancelAnimationFrame(this.resizeFrame);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('scroll', this.updateScroll);
    window.removeEventListener('pointermove', this.handlePointer);
    window.removeEventListener('pointerdown', this.handleImpulse);
    window.removeEventListener('pointerup', this.handleRelease);
    window.removeEventListener('pointercancel', this.handleRelease);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    document.documentElement.removeEventListener('pointerleave', this.resetPointer);
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.hero.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
