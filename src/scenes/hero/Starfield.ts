import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';
import type { SequenceFrame } from './sequence';

const TAU = Math.PI * 2;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createGeometry(quality: Quality): THREE.BufferGeometry {
  const count = quality === 'high' ? 4200 : quality === 'medium' ? 2400 : 900;
  const positions = new Float32Array(count * 3);
  const data = new Float32Array(count * 4);
  const seeds = new Float32Array(count * 2);
  const random = seededRandom(0x7f4a7c15);

  for (let index = 0; index < count; index += 1) {
    const depth = Math.pow(random(), 0.76);
    const kindRoll = random();
    const temperature = random();
    const brightness = Math.pow(random(), 4.2);
    const z = -3.1 - depth * 16.8;
    const visibleRadius = 3.4 + depth * 11.2;
    let x = 0;
    let y = 0;
    let kind = 0;

    if (kindRoll < 0.7) {
      // Nested, imperfect Einstein arcs. Each stream shares the same focus but
      // carries a different eccentricity and precession, so the field reads as
      // one gravitational system rather than an even random distribution.
      const stream = Math.floor(random() * 11);
      const angle = random() * TAU + stream * 0.571;
      const radius = 1.72
        + Math.pow(random(), 0.68) * visibleRadius
        + Math.sin(angle * (2 + stream % 4) + stream * 1.71) * (0.08 + depth * 0.2)
        + (random() - 0.5) * 0.13;
      const twist = Math.log2(radius + 1) * (0.085 + (stream % 3) * 0.025) + depth * 0.16;
      x = Math.cos(angle + twist) * radius * (1.04 + (stream % 2) * 0.08);
      y = Math.sin(angle) * radius * (0.66 + (stream % 4) * 0.035);
      kind = 0;
    } else if (kindRoll < 0.93) {
      // Sparse logarithmic filaments cross the annular arcs and make the
      // surrounding dark volume feel connected to the lensing centre.
      const arm = Math.floor(random() * 5);
      const travel = random();
      const angle = arm * TAU / 5 + travel * TAU * 1.38 + depth * 0.34;
      const radius = 1.36 + Math.pow(travel, 0.72) * visibleRadius;
      const scatter = (random() + random() - 1) * (0.08 + radius * 0.018);
      x = Math.cos(angle) * (radius + scatter) * 1.12;
      y = Math.sin(angle) * (radius + scatter) * 0.7;
      kind = 1;
    } else {
      // A small population of outliers keeps the depth from becoming a set of
      // perfectly legible rings while still preserving the central void.
      const angle = random() * TAU;
      const radius = 2.15 + Math.sqrt(random()) * visibleRadius;
      x = Math.cos(angle) * radius * 1.16;
      y = Math.sin(angle) * radius * 0.73;
      kind = 2;
    }

    const positionOffset = index * 3;
    positions[positionOffset] = x;
    positions[positionOffset + 1] = y;
    positions[positionOffset + 2] = z;

    const dataOffset = index * 4;
    data[dataOffset] = depth;
    data[dataOffset + 1] = temperature;
    data[dataOffset + 2] = brightness;
    data[dataOffset + 3] = kind;

    const seedOffset = index * 2;
    seeds[seedOffset] = random();
    seeds[seedOffset + 1] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aData', new THREE.BufferAttribute(data, 4));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -10.5), 25);
  return geometry;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uWorld;
  uniform float uOrbit;
  uniform float uGalaxy;
  uniform float uHorizon;
  uniform float uEnergy;
  uniform float uPixelRatio;
  uniform vec2 uPointer;
  attribute vec4 aData;
  attribute vec2 aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vArc;
  varying float vAngle;
  varying float vFlare;

  const float TAU = 6.283185307179586;

  mat2 rotate2d(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    float depth = aData.x;
    float temperature = aData.y;
    float brightness = aData.z;
    float kind = aData.w;
    vec3 transformed = position;

    float stage = clamp(0.14 + uWorld * 0.28 + uOrbit * 0.42 + uGalaxy * 0.72 + uHorizon * 0.86, 0.0, 1.0);
    float lensStage = clamp(uOrbit * 0.2 + uGalaxy * 0.58 + uHorizon, 0.0, 1.0);
    float slowRotation = uTime * mix(0.0007, 0.0026, 1.0 - depth) * mix(1.0, -0.72, step(0.5, aSeed.x));
    transformed.xy = rotate2d(slowRotation) * transformed.xy;

    float radius = length(transformed.xy);
    vec2 radial = transformed.xy / max(radius, 0.001);
    vec2 tangent = vec2(-radial.y, radial.x);
    float lensRadius = mix(2.02 + depth * 0.58, 2.34 + depth * 0.72, uHorizon);
    float lensWidth = mix(0.78, 0.34, uHorizon);
    float lensBand = exp(-pow((radius - lensRadius) / lensWidth, 2.0));
    float filament = 1.0 - step(1.5, kind);
    float deflection = lensBand * lensStage * (0.12 + filament * 0.19 + aSeed.y * 0.08);
    transformed.xy += tangent * deflection * mix(-1.0, 1.0, step(0.5, aSeed.x));
    transformed.xy *= 1.0 + lensStage * 0.055 / max(radius * radius, 0.8);

    float parallax = mix(0.2, 0.025, depth);
    transformed.xy += uPointer * parallax * (0.28 + stage * 0.72);
    transformed.z += sin(uTime * 0.045 + aSeed.x * TAU) * (0.015 + (1.0 - depth) * 0.025);

    float coldBias = smoothstep(0.38, 0.92, temperature);
    float warmBias = 1.0 - smoothstep(0.08, 0.48, temperature);
    vec3 neutral = vec3(0.58, 0.68, 0.96);
    vec3 cold = vec3(0.34, 0.53, 1.2);
    vec3 warm = vec3(1.16, 0.68, 0.38);
    vColor = mix(neutral, cold, coldBias * 0.74);
    vColor = mix(vColor, warm, warmBias * (0.28 + brightness * 0.24));

    float shimmer = 0.84 + 0.16 * sin(uTime * (0.42 + aSeed.y * 1.8) + aSeed.x * TAU);
    float centralVoid = mix(1.0, smoothstep(1.64, 2.42, radius), uHorizon * 0.95);
    float fieldPresence = mix(0.24, 1.0, stage) * mix(0.72, 1.0, uProgress);
    vAlpha = (0.14 + brightness * 0.72) * shimmer * fieldPresence * centralVoid;
    vAlpha *= mix(1.0, 0.78, depth);
    vAlpha += lensBand * lensStage * (0.035 + brightness * 0.18);
    vAlpha *= 1.0 + uEnergy * (0.08 + brightness * 0.18);
    vArc = lensBand * lensStage * (0.35 + filament * 0.65);
    vAngle = atan(tangent.y, tangent.x);
    vFlare = smoothstep(0.86, 0.995, brightness) * (0.35 + stage * 0.65);

    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float perspective = clamp(12.0 / max(-viewPosition.z, 1.0), 0.46, 1.65);
    float pointSize = mix(0.68, 2.75, brightness * brightness) * uPixelRatio * perspective;
    pointSize *= 1.0 + vArc * 1.15 + uEnergy * brightness * 0.22;
    gl_PointSize = clamp(pointSize, 0.72, 7.8 * uPixelRatio);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vArc;
  varying float vAngle;
  varying float vFlare;

  mat2 rotate2d(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    vec2 p = rotate2d(-vAngle) * (gl_PointCoord - 0.5);
    float radius = length(p);
    float core = 1.0 - smoothstep(0.015, 0.19, radius);
    float halo = (1.0 - smoothstep(0.06, 0.5, radius)) * 0.22;
    float arcDistance = length(vec2(p.x * mix(1.0, 0.34, vArc), p.y * mix(1.0, 1.85, vArc)));
    float arc = (1.0 - smoothstep(0.04, 0.46, arcDistance)) * vArc * 0.48;
    float rayX = exp(-abs(p.y) * 62.0) * (1.0 - smoothstep(0.08, 0.49, abs(p.x)));
    float rayY = exp(-abs(p.x) * 62.0) * (1.0 - smoothstep(0.08, 0.49, abs(p.y)));
    float flare = (rayX + rayY) * vFlare * 0.42;
    float alpha = (core + halo + arc + flare) * vAlpha;
    if (alpha < 0.008) discard;
    vec3 color = vColor * (0.38 + core * 1.72 + arc * 0.7 + flare * 1.3);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Starfield extends THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  constructor(quality: Quality) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uWorld: { value: 0 },
        uOrbit: { value: 0 },
        uGalaxy: { value: 0 },
        uHorizon: { value: 0 },
        uEnergy: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, quality === 'high' ? 1.65 : quality === 'medium' ? 1.4 : 1.2) },
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
    this.name = 'Lensed Deep Field';
    this.renderOrder = -20;
    this.frustumCulled = false;
  }

  update(
    time: number,
    progress: number,
    frame: SequenceFrame,
    pointer: THREE.Vector2,
    energy: number,
  ): void {
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uProgress!.value = progress;
    this.material.uniforms.uWorld!.value = frame.world;
    this.material.uniforms.uOrbit!.value = frame.orbit;
    this.material.uniforms.uGalaxy!.value = frame.galaxy;
    this.material.uniforms.uHorizon!.value = frame.horizon;
    this.material.uniforms.uEnergy!.value = energy;
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
