import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { Quality } from '../engine/renderer';

const cosmologyShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uProgress: { value: 0 },
    uAspect: { value: 1 },
    uVelocity: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uPulse;
    uniform float uProgress;
    uniform float uAspect;
    uniform float uVelocity;
    uniform vec2 uPointer;
    varying vec2 vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    float smoother(float a, float b, float value) {
      float x = clamp((value - a) / (b - a), 0.0, 1.0);
      return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
    }

    void main() {
      float horizon = smoother(0.82, 0.985, uProgress);
      vec2 lensCenter = vec2(0.5) + uPointer * vec2(0.004, 0.003) * (1.0 - horizon);
      vec2 q = (vUv - lensCenter) * vec2(uAspect, 1.0);
      float radius = length(q);
      float lensScale = max(min(uAspect, 1.0), 0.42);
      float normalizedRadius = radius / lensScale;
      vec2 direction = q / max(radius, 0.0001);
      float influence = (1.0 - smoothstep(0.12, 0.78, normalizedRadius)) * horizon;
      float bend = influence * 0.009 / (normalizedRadius * normalizedRadius + 0.018);
      vec2 sourceUv = lensCenter + (q * (1.0 + bend)) / vec2(uAspect, 1.0);

      float velocity = clamp(abs(uVelocity) * 0.028, 0.0, 0.008);
      vec2 radialVelocity = direction / vec2(uAspect, 1.0) * velocity;
      sourceUv -= radialVelocity * (1.0 - horizon * 0.7);
      vec2 tangent = vec2(-direction.y, direction.x) / vec2(uAspect, 1.0);
      float photonZone = exp(-abs(normalizedRadius - 0.46) * 28.0) * horizon;

      float aberration = (0.00028 + uPulse * 0.0012 + velocity * 0.2) * smoothstep(0.04, 0.78, normalizedRadius);
      aberration += photonZone * 0.00075;
      float red = texture2D(tDiffuse, sourceUv + direction / vec2(uAspect, 1.0) * aberration).r;
      float green = texture2D(tDiffuse, sourceUv).g;
      float blue = texture2D(tDiffuse, sourceUv - direction / vec2(uAspect, 1.0) * aberration).b;
      vec3 color = vec3(red, green, blue);

      vec3 arcA = texture2D(tDiffuse, sourceUv + tangent * 0.0045).rgb;
      vec3 arcB = texture2D(tDiffuse, sourceUv - tangent * 0.0045).rgb;
      color += (arcA + arcB) * photonZone * 0.095;

      vec2 centered = vUv - 0.5;
      float vignette = 1.0 - smoothstep(0.24, 0.91, length(centered * vec2(uAspect * 0.58, 1.0)));
      color *= mix(0.64, 1.0, vignette);
      float grain = hash21(gl_FragCoord.xy + floor(uTime * 17.0)) - 0.5;
      color += grain * mix(0.0046, 0.0028, horizon);
      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
};

export class Composer {
  private readonly composer?: EffectComposer;
  private readonly renderPass?: RenderPass;
  private readonly bloom?: UnrealBloomPass;
  private readonly cosmology?: ShaderPass;
  private readonly output?: OutputPass;
  private readonly renderScale: number;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    quality: Quality,
    reducedMotion: boolean,
  ) {
    this.renderScale = quality === 'high' ? 0.82 : quality === 'medium' ? 0.68 : 1;
    if (quality === 'low' || reducedMotion) return;

    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    const high = quality === 'high';
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      high ? 0.38 : 0.25,
      high ? 0.34 : 0.25,
      high ? 0.76 : 0.82,
    );
    this.composer.addPass(this.bloom);

    this.cosmology = new ShaderPass(cosmologyShader);
    this.composer.addPass(this.cosmology);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
  }

  update(time: number, pulse: number, progress: number, pointer: THREE.Vector2, velocity: number): void {
    if (!this.cosmology) return;
    this.cosmology.uniforms.uTime!.value = time;
    this.cosmology.uniforms.uPulse!.value = pulse;
    this.cosmology.uniforms.uProgress!.value = progress;
    this.cosmology.uniforms.uAspect!.value = window.innerWidth / Math.max(window.innerHeight, 1);
    this.cosmology.uniforms.uVelocity!.value = velocity;
    (this.cosmology.uniforms.uPointer!.value as THREE.Vector2).copy(pointer);
  }

  render(delta: number): void {
    if (this.composer) this.composer.render(delta);
    else this.renderer.render(this.scene, this.camera);
  }

  setPixelRatio(value: number): void {
    this.composer?.setPixelRatio(value * this.renderScale);
  }

  setSize(width: number, height: number): void {
    this.composer?.setSize(width, height);
  }

  getRenderScale(): number {
    return this.composer ? this.renderScale : 1;
  }

  dispose(): void {
    this.renderPass?.dispose();
    this.bloom?.dispose();
    this.cosmology?.dispose();
    this.output?.dispose();
    this.composer?.dispose();
  }
}
