import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function fragmentShader(quality: Quality): string {
  const octaves = quality === 'high' ? 5 : quality === 'medium' ? 4 : 3;
  return /* glsl */ `
    uniform float uTime;
    uniform float uPresence;
    uniform float uEnergy;
    varying vec2 vUv;

    const float TAU = 6.283185307179586;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise2(vec2 p) {
      vec2 cell = floor(p);
      vec2 local = fract(p);
      local = local * local * (3.0 - 2.0 * local);
      return mix(
        mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), local.x),
        mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0, 1.0)), local.x),
        local.y
      );
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int octave = 0; octave < ${octaves}; octave++) {
        value += noise2(p) * amplitude;
        p = p * 2.07 + vec2(7.3, 3.7);
        amplitude *= 0.49;
      }
      return value;
    }

    float circularDistance(float a, float b) {
      return abs(fract((a - b) / TAU + 0.5) - 0.5) * TAU;
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      float radius = length(p);
      if (radius > 1.0) discard;
      float angle = atan(p.y, p.x);
      float safeRadius = max(radius, 0.035);

      vec2 warp = vec2(
        fbm(p * 2.9 + vec2(uTime * 0.006, 4.1)),
        fbm(p * 2.9 + vec2(9.7, -uTime * 0.005))
      ) - 0.5;
      float phase = angle * 3.0 - log(safeRadius) * 5.15 + warp.x * 1.45;
      float majorArms = pow(0.5 + 0.5 * cos(phase), 6.0);
      float feather = pow(0.5 + 0.5 * cos(phase * 2.0 + radius * 19.0 + warp.y * 2.3), 11.0);
      float broken = smoothstep(0.34, 0.78, fbm(p * 8.2 + warp * 2.7));
      float armDensity = majorArms * mix(0.34, 1.0, broken) + feather * 0.16;

      float core = exp(-pow(radius / 0.17, 1.35));
      float disk = exp(-radius * 2.15) * (1.0 - smoothstep(0.9, 1.0, radius));
      float outerFalloff = 1.0 - smoothstep(0.68, 1.0, radius);
      float dustPhase = circularDistance(phase + 0.42 + warp.y * 0.5, 0.0);
      float dustLane = exp(-dustPhase * 4.8) * smoothstep(0.12, 0.38, radius) * outerFalloff;
      dustLane *= mix(0.55, 1.0, broken);
      float knots = pow(smoothstep(0.58, 0.91, fbm(p * 17.0 + warp * 4.0)), 2.0) * armDensity;

      float opticalDepth = dustLane * (0.055 + disk * 0.08);
      float luminous = disk * armDensity * (0.028 + knots * 0.07);
      float coreLuminance = core * 0.105;
      float alpha = (opticalDepth + luminous + coreLuminance) * uPresence;
      alpha *= 0.82 + uEnergy * 0.12;
      if (alpha < 0.002) discard;

      vec3 cold = vec3(0.075, 0.105, 0.21);
      vec3 warm = vec3(0.29, 0.245, 0.205);
      vec3 color = cold * luminous;
      color += warm * coreLuminance;
      color += vec3(0.08, 0.13, 0.32) * knots * 0.035;
      color *= 1.0 - dustLane * 0.72;
      gl_FragColor = vec4(max(color, 0.0), alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;
}

export class GalaxyVolume extends THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  constructor(quality: Quality) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPresence: { value: 0 },
        uEnergy: { value: 0 },
      },
      vertexShader,
      fragmentShader: fragmentShader(quality),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      toneMapped: true,
    });

    super(new THREE.PlaneGeometry(13.2, 13.2), material);
    this.name = 'Absorptive Galactic Medium';
    this.position.z = -0.055;
    this.renderOrder = -2;
    this.frustumCulled = false;
    this.visible = false;
  }

  update(time: number, presence: number, energy: number): void {
    this.visible = presence > 0.002;
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uPresence!.value = presence;
    this.material.uniforms.uEnergy!.value = energy;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
