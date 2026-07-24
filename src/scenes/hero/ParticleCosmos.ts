import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';
import { cosmicFieldGLSL } from './cosmicField';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createGeometry(quality: Quality): THREE.BufferGeometry {
  const count = quality === 'high' ? 2800 : quality === 'medium' ? 1200 : 240;
  const positions = new Float32Array(count * 3);
  const parameters = new Float32Array(count * 2);
  const seeds = new Float32Array(count * 3);
  const random = seededRandom(0x6d316e67);

  for (let index = 0; index < count; index += 1) {
    const u = Math.pow(random(), 0.82);
    const spread = (random() + random() + random() - 1.5) / 1.5;
    parameters[index * 2] = u;
    parameters[index * 2 + 1] = THREE.MathUtils.clamp(spread * 0.96, -1, 1);
    seeds[index * 3] = random();
    seeds[index * 3 + 1] = random();
    seeds[index * 3 + 2] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aParam', new THREE.BufferAttribute(parameters, 2));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
  return geometry;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPulse;
  uniform float uPixelRatio;
  uniform float uMobile;
  uniform vec2 uPointer;
  attribute vec2 aParam;
  attribute vec3 aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRay;

  ${cosmicFieldGLSL}

  void main() {
    float veil;
    float planet;
    float orbit;
    float galaxy;
    float horizon;
    cosmicPhases(aParam, veil, planet, orbit, galaxy, horizon);
    vec3 transformed = cosmicSurfacePoint(aParam);
    vec3 surfaceNormal = cosmicSurfaceNormal(aParam);
    float detachment = (aSeed.x - 0.5) * (0.035 + galaxy * 0.095 + horizon * 0.045);
    transformed += surfaceNormal * detachment;

    float ripple = sin(length(transformed.xy) * 9.0 - uTime * 7.0 + aSeed.z * COSMIC_TAU);
    transformed += normalize(transformed + vec3(0.001)) * ripple * uPulse * 0.075;
    transformed.xy += uPointer * 0.012 * (0.3 + aSeed.z);

    float selection = smoothstep(0.82, 0.995, aSeed.y + galaxy * 0.36);
    float planetSelection = step(0.988, aSeed.y);
    float horizonSelection = smoothstep(0.94, 0.997, aSeed.y);
    float asymmetricArc = smoothstep(-0.35, 0.92, cos(aParam.x * COSMIC_TAU - 0.7));
    vAlpha = (planet * planetSelection * 0.24
      + galaxy * selection
      + horizon * horizonSelection * asymmetricArc * 0.46)
      * (0.32 + aSeed.x * 0.68);

    vec3 cold = mix(vec3(0.32, 0.48, 1.0), vec3(0.76, 0.86, 1.0), aSeed.x);
    vec3 warm = vec3(1.0, 0.76, 0.52);
    float coreHeat = (1.0 - smoothstep(0.0, 0.3, aParam.x)) * galaxy;
    vColor = mix(cold, warm, coreHeat * (0.28 + aSeed.y * 0.42));
    vRay = step(0.9975, aSeed.z);

    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float size = mix(0.72, 2.25, aSeed.x * aSeed.x) * uPixelRatio;
    size *= mix(0.85, 1.28, galaxy);
    gl_PointSize = clamp(size * (13.0 / max(-viewPosition.z, 0.8)), 0.8, 8.5 * uPixelRatio);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRay;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float distanceToCenter = length(p);
    float core = 1.0 - smoothstep(0.025, 0.24, distanceToCenter);
    float halo = (1.0 - smoothstep(0.0, 0.5, distanceToCenter)) * 0.24;
    float horizontalRay = exp(-abs(p.y) * 54.0) * (1.0 - smoothstep(0.06, 0.49, abs(p.x)));
    float verticalRay = exp(-abs(p.x) * 54.0) * (1.0 - smoothstep(0.06, 0.49, abs(p.y)));
    float diffraction = (horizontalRay + verticalRay) * vRay * 0.48;
    float alpha = (core + halo + diffraction) * vAlpha;
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(vColor * (0.62 + core * 1.9 + diffraction), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class ParticleCosmos extends THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  constructor(quality: Quality) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uPulse: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, quality === 'high' ? 1.6 : 1.3) },
        uMobile: { value: quality === 'low' ? 1 : 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    });

    super(createGeometry(quality), material);
    this.name = 'Surface-born Stars';
    this.frustumCulled = false;
    this.renderOrder = 4;
  }

  update(time: number, progress: number, pointer: THREE.Vector2, pulse: number, mobile: boolean): void {
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uProgress!.value = progress;
    this.material.uniforms.uPulse!.value = pulse;
    this.material.uniforms.uMobile!.value = mobile ? 1 : 0;
    (this.material.uniforms.uPointer!.value as THREE.Vector2).copy(pointer);
  }

  setPixelRatio(value: number): void {
    this.material.uniforms.uPixelRatio!.value = value;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
