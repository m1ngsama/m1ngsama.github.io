import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';
import type { SequenceFrame } from './sequence';
import { GalaxyVolume } from './GalaxyVolume';

const PARTICLE_COUNTS: Record<Quality, number> = {
  high: 72_000,
  medium: 32_000,
  low: 14_000,
};

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function centeredRandom(random: () => number): number {
  return THREE.MathUtils.clamp(
    (random() + random() + random() + random() - 2) * 0.5,
    -1,
    1,
  );
}

function createGeometry(quality: Quality): THREE.BufferGeometry {
  const count = PARTICLE_COUNTS[quality];
  const positions = new Float32Array(count * 3);
  const galaxyData = new Float32Array(count * 4);
  const seeds = new Float32Array(count * 4);
  const populations = new Float32Array(count);
  const random = seededRandom(0x6d316e67);

  for (let index = 0; index < count; index += 1) {
    const dataOffset = index * 4;
    const roll = random();
    const population = roll < 0.15 ? 0 : roll < 0.55 ? 1 : roll < 0.8 ? 2 : roll < 0.95 ? 3 : 4;
    const arm = Math.floor(random() * 2);
    let radius = Math.pow(random(), 1.05);
    if (population === 0) radius = Math.pow(random(), 2.7) * 0.32;
    else if (population === 1 || population === 4) radius = 0.035 + Math.pow(random(), 0.92) * 0.965;
    else if (population === 2) radius = Math.sqrt(random());
    else radius = Math.pow(random(), 0.48) * 1.12;

    galaxyData[dataOffset] = radius;
    galaxyData[dataOffset + 1] = arm / 2;
    galaxyData[dataOffset + 2] = centeredRandom(random);
    galaxyData[dataOffset + 3] = centeredRandom(random);
    populations[index] = population;

    seeds[dataOffset] = random();
    seeds[dataOffset + 1] = random();
    seeds[dataOffset + 2] = random();
    seeds[dataOffset + 3] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aGalaxy', new THREE.BufferAttribute(galaxyData, 4));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geometry.setAttribute('aPopulation', new THREE.BufferAttribute(populations, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 7.25);
  return geometry;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uGalaxy;
  uniform float uHorizon;
  uniform float uEnergy;
  uniform float uPixelRatio;
  uniform float uQuality;
  uniform vec2 uPointer;
  attribute vec4 aGalaxy;
  attribute vec4 aSeed;
  attribute float aPopulation;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;
  varying float vStretch;

  const float PI = 3.141592653589793;
  const float TAU = 6.283185307179586;

  float smoother(float edge0, float edge1, float value) {
    float x = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
  }

  float populationMask(float value) {
    return 1.0 - step(0.42, abs(aPopulation - value));
  }

  vec3 galaxyPosition(out float theta, out float coreHeat, out float radialParameter) {
    float radiusParameter = aGalaxy.x;
    radialParameter = radiusParameter;
    float isCore = populationMask(0.0);
    float isArm = populationMask(1.0);
    float isDisk = populationMask(2.0);
    float isHalo = populationMask(3.0);
    float isCluster = populationMask(4.0);
    float armDefinition = smoother(0.035, 0.22, radiusParameter);
    float radius = 0.12 + pow(radiusParameter, 0.76) * 6.0;
    float crossArm = aGalaxy.z;
    float armAngle = aGalaxy.y * TAU;
    float winding = (0.08 + pow(radiusParameter, 0.74) * 1.24) * TAU;
    float branch = step(0.68, aSeed.w)
      * sin(radiusParameter * 17.0 + aSeed.y * TAU)
      * smoother(0.28, 0.82, radiusParameter)
      * 0.22;
    float angularScatter = crossArm * mix(0.46, 0.62, armDefinition);
    angularScatter += (aSeed.x - 0.5) * mix(0.34, 0.2, armDefinition);
    float differentialRotation = uTime * mix(0.022, 0.004, radiusParameter);
    theta = armAngle + winding + angularScatter + branch + differentialRotation;

    radius += crossArm * mix(0.035, 0.36, radiusParameter);
    radius += sin(radius * 5.4 - uTime * 5.8 + aSeed.y * TAU)
      * uEnergy * mix(0.075, 0.025, radiusParameter);

    vec2 armPlane = vec2(cos(theta), sin(theta)) * radius;
    float armThickness = mix(0.38, 0.055, smoother(0.02, 0.92, radiusParameter));
    float armZ = aGalaxy.w * armThickness;
    armZ += sin(theta * 2.0 + radius * 1.7 + aSeed.z * TAU) * 0.016 * armDefinition;

    float freeTheta = aSeed.x * TAU + uTime * mix(0.013, 0.0025, radiusParameter);
    float diskRadius = 0.1 + pow(radiusParameter, 0.72) * 6.1;
    vec3 diskPosition = vec3(
      vec2(cos(freeTheta), sin(freeTheta)) * diskRadius,
      aGalaxy.w * mix(0.24, 0.075, radiusParameter)
    );

    float coreTheta = aSeed.y * TAU + uTime * 0.024;
    float corePhi = acos(clamp(aGalaxy.w, -1.0, 1.0));
    float coreRadius = 0.04 + pow(radiusParameter, 0.86) * 1.7;
    vec3 corePosition = coreRadius * vec3(
      sin(corePhi) * cos(coreTheta),
      sin(corePhi) * sin(coreTheta),
      cos(corePhi) * 0.54
    );

    float haloTheta = aSeed.x * TAU;
    float haloPhi = acos(clamp(aGalaxy.z, -1.0, 1.0));
    float haloRadius = 1.3 + pow(radiusParameter, 0.66) * 5.5;
    vec3 haloPosition = haloRadius * vec3(
      sin(haloPhi) * cos(haloTheta),
      sin(haloPhi) * sin(haloTheta),
      cos(haloPhi) * 0.42
    );

    vec3 transformed = vec3(armPlane, armZ) * (isArm + isCluster);
    transformed += diskPosition * isDisk;
    transformed += corePosition * isCore;
    transformed += haloPosition * isHalo;

    float pointerInfluence = mix(0.035, 0.095, radiusParameter) * (0.35 + uGalaxy * 0.65);
    transformed.xy += uPointer * pointerInfluence;
    coreHeat = max(isCore, (1.0 - smoother(0.055, 0.3, radiusParameter)) * (isArm + isCluster));
    return transformed;
  }

  vec3 collapsePosition(vec3 spiral, float spiralTheta, float collapse, out float theta, out float ringWeight, out float escapeWeight) {
    float impact = aSeed.w;
    ringWeight = smoother(0.972, 0.998, impact);
    escapeWeight = smoother(0.84, 0.91, impact) * (1.0 - smoother(0.95, 0.985, impact));
    theta = spiralTheta + collapse * (2.1 + (1.0 - aGalaxy.x) * 3.8) + (aSeed.x - 0.5) * 0.08;
    float initialRadius = length(spiral.xy);
    float infallRadius = mix(initialRadius, 0.18 + aSeed.z * 0.34, collapse);
    vec3 infall = vec3(vec2(cos(theta), sin(theta)) * infallRadius, spiral.z * (1.0 - collapse));

    float arcRadius = 3.34 + aGalaxy.z * 0.14 + (aSeed.y - 0.5) * 0.06;
    vec3 arc = vec3(vec2(cos(theta), sin(theta)) * arcRadius, aGalaxy.w * 0.045);
    float ringRadius = 3.055 + aGalaxy.z * 0.032 + (aSeed.x - 0.5) * 0.018;
    ringRadius += sin(theta * 5.0 - uTime * 3.2 + aSeed.y * TAU) * uEnergy * 0.012;
    vec3 ring = vec3(vec2(cos(theta), sin(theta)) * ringRadius, aGalaxy.w * 0.012);
    vec3 target = mix(infall, arc, escapeWeight);
    return mix(target, ring, ringWeight);
  }

  void main() {
    float galaxyTheta;
    float coreHeat;
    float radialParameter;
    vec3 spiral = galaxyPosition(galaxyTheta, coreHeat, radialParameter);
    float horizonTheta;
    float ringWeight;
    float escapeWeight;
    float collapse = smoother(
      radialParameter * 0.24,
      0.62 + radialParameter * 0.28,
      uHorizon
    );
    vec3 collapseTarget = collapsePosition(
      spiral,
      galaxyTheta,
      collapse,
      horizonTheta,
      ringWeight,
      escapeWeight
    );
    vec3 transformed = mix(spiral, collapseTarget, collapse);

    float visibleGalaxy = uGalaxy * (1.0 - collapse);
    float stellarWeight = pow(aSeed.z, mix(2.6, 1.85, uQuality));
    float isCore = populationMask(0.0);
    float isArm = populationMask(1.0);
    float isDisk = populationMask(2.0);
    float isHalo = populationMask(3.0);
    float isCluster = populationMask(4.0);
    float populationWeight = isCore * 0.52
      + isArm * 0.72
      + isDisk * 0.22
      + isHalo * 0.075
      + isCluster * 1.0;
    float dustTransmission = 1.0 - isArm
      * exp(-abs(aGalaxy.z + 0.16) * 6.8)
      * smoother(0.18, 0.78, aGalaxy.x)
      * 0.68;
    float galaxyAlpha = visibleGalaxy
      * populationWeight
      * dustTransmission
      * mix(0.014, 0.25, stellarWeight)
      * mix(0.76, 1.0, uQuality);

    float doppler = mix(0.16, 1.0, smoothstep(-0.85, 0.9, cos(horizonTheta - 0.42)));
    float ringAlpha = uHorizon
      * ringWeight
      * mix(0.08, 0.32, aSeed.x)
      * doppler
      * (0.88 + uEnergy * 0.26);
    float arcAlpha = uHorizon * escapeWeight * (1.0 - ringWeight)
      * mix(0.025, 0.13, stellarWeight)
      * (0.38 + doppler * 0.62);
    vAlpha = galaxyAlpha + ringAlpha + arcAlpha;

    vec3 cold = mix(vec3(0.22, 0.31, 0.58), vec3(0.56, 0.65, 0.88), aSeed.x);
    vec3 warm = mix(vec3(0.56, 0.42, 0.3), vec3(0.88, 0.71, 0.54), aSeed.y);
    vColor = mix(cold, warm, coreHeat * 0.78);
    vColor = mix(vColor, vec3(0.4, 0.5, 0.84), collapse * 0.56);
    vColor *= 0.72 + stellarWeight * 0.68 + uEnergy * 0.1;

    float finalTheta = mix(galaxyTheta, horizonTheta, collapse);
    vAngle = finalTheta + PI * 0.5;
    vStretch = 1.0 + collapse
      * (ringWeight + escapeWeight * 0.45)
      * mix(0.5, 1.7, aSeed.x)
      * mix(0.58, 1.0, uQuality);

    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float starSize = mix(0.45, 1.68, pow(aSeed.x, 6.0));
    starSize *= mix(0.92, 1.42, isCluster);
    starSize *= mix(1.0, 0.76, isHalo);
    starSize *= mix(0.78, 1.0, uQuality);
    starSize *= mix(0.94, 1.12, coreHeat);
    starSize *= 1.0 + uEnergy * 0.18;
    starSize *= vStretch;
    float perspectiveSize = 11.5 / max(-viewPosition.z, 0.9);
    float maximumSize = mix(3.2, 5.4, uQuality) * uPixelRatio;
    gl_PointSize = clamp(starSize * perspectiveSize * uPixelRatio, 0.62, maximumSize);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uQuality;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vAngle;
  varying float vStretch;

  void main() {
    if (vAlpha < 0.002) discard;
    vec2 point = gl_PointCoord - 0.5;
    float cosine = cos(vAngle);
    float sine = sin(vAngle);
    point = mat2(cosine, -sine, sine, cosine) * point;
    point.y *= vStretch;
    float radiusSquared = dot(point, point);
    if (radiusSquared > 0.25) discard;

    float core = 1.0 - smoothstep(0.018, 0.16, radiusSquared);
    float halo = (1.0 - smoothstep(0.035, 0.25, radiusSquared)) * mix(0.045, 0.16, uQuality);
    float alpha = (core + halo) * vAlpha;
    if (alpha < 0.004) discard;

    vec3 color = vColor * (0.52 + core * 1.46 + halo * 0.38);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Galaxy extends THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  private readonly volume: GalaxyVolume;

  constructor(quality: Quality) {
    const qualityValue = quality === 'high' ? 1 : quality === 'medium' ? 0.52 : 0;
    const pixelRatioLimit = quality === 'high' ? 1.6 : quality === 'medium' ? 1.35 : 1.1;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGalaxy: { value: 0 },
        uHorizon: { value: 0 },
        uEnergy: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, pixelRatioLimit) },
        uQuality: { value: qualityValue },
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
    this.volume = new GalaxyVolume(quality);
    this.add(this.volume);
    this.name = 'Layered Spiral Galaxy';
    this.visible = false;
    this.frustumCulled = false;
    this.renderOrder = 0;
  }

  update(time: number, frame: SequenceFrame, pointer: THREE.Vector2, energy: number): void {
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uGalaxy!.value = frame.galaxy;
    this.material.uniforms.uHorizon!.value = frame.horizon;
    this.material.uniforms.uEnergy!.value = energy;
    (this.material.uniforms.uPointer!.value as THREE.Vector2).copy(pointer);
    this.volume.update(time, frame.galaxy * (1 - frame.horizon), energy);
    this.visible = Math.max(frame.galaxy, frame.horizon) > 0.002;
  }

  setPixelRatio(value: number): void {
    this.material.uniforms.uPixelRatio!.value = value;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.volume.dispose();
  }
}
