import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { Quality } from '../engine/renderer';

const atmosphereShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uProgress: { value: 0 },
    uAspect: { value: 1 },
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
    varying vec2 vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      vec2 lens = centered * dot(centered, centered) * 0.007;
      float aberration = (0.00032 + uPulse * 0.0015) * smoothstep(0.08, 0.78, length(centered));
      vec2 direction = normalize(centered + vec2(0.0001));
      vec2 warped = vUv - lens;

      float red = texture2D(tDiffuse, warped + direction * aberration).r;
      float green = texture2D(tDiffuse, warped).g;
      float blue = texture2D(tDiffuse, warped - direction * aberration).b;
      vec3 color = vec3(red, green, blue);

      float vignette = smoothstep(0.88, 0.24, length(centered * vec2(uAspect * 0.58, 1.0)));
      color *= mix(0.68, 1.0, vignette);
      float grain = hash21(gl_FragCoord.xy + floor(uTime * 18.0)) - 0.5;
      color += grain * mix(0.0055, 0.0035, uProgress);
      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
};

export class Composer {
  private readonly composer?: EffectComposer;
  private readonly atmosphere?: ShaderPass;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    quality: Quality,
    reducedMotion: boolean,
  ) {
    if (quality === 'low' || reducedMotion) return;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    const high = quality === 'high';
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      high ? 0.31 : 0.19,
      high ? 0.42 : 0.28,
      high ? 0.42 : 0.55,
    );
    this.composer.addPass(bloom);

    this.atmosphere = new ShaderPass(atmosphereShader);
    this.composer.addPass(this.atmosphere);
    this.composer.addPass(new OutputPass());
  }

  update(time: number, pulse: number, progress: number): void {
    if (!this.atmosphere) return;
    this.atmosphere.uniforms.uTime!.value = time;
    this.atmosphere.uniforms.uPulse!.value = pulse;
    this.atmosphere.uniforms.uProgress!.value = progress;
    this.atmosphere.uniforms.uAspect!.value = window.innerWidth / Math.max(window.innerHeight, 1);
  }

  render(delta: number): void {
    if (this.composer) this.composer.render(delta);
    else this.renderer.render(this.scene, this.camera);
  }

  setPixelRatio(value: number): void {
    this.composer?.setPixelRatio(value);
  }

  setSize(width: number, height: number): void {
    this.composer?.setSize(width, height);
  }

  dispose(): void {
    this.composer?.dispose();
  }
}
