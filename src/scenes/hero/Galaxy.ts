import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';
import type { SequenceFrame } from './sequence';

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
  const random = seededRandom(0x6d316e67);

  for (let index = 0; index < count; index += 1) {
    const dataOffset = index * 4;
    const arm = index % 5;
    const coreParticle = random() < 0.155;
    const radius = coreParticle
      ? Math.pow(random(), 2.7) * 0.27
      : Math.pow(random(), 1.16);

    galaxyData[dataOffset] = radius;
    galaxyData[dataOffset + 1] = arm / 5;
    galaxyData[dataOffset + 2] = centeredRandom(random);
    galaxyData[dataOffset + 3] = centeredRandom(random);

    seeds[dataOffset] = random();
    seeds[dataOffset + 1] = random();
    seeds[dataOffset + 2] = random();
    seeds[dataOffset + 3] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aGalaxy', new THREE.BufferAttribute(galaxyData, 4));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
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

  vec3 galaxyPosition(out float theta, out float coreHeat) {
    float radiusParameter = aGalaxy.x;
    float armDefinition = smoother(0.045, 0.27, radiusParameter);
    float radius = 0.12 + pow(radiusParameter, 0.72) * 6.0;
    float crossArm = aGalaxy.z;
    float armAngle = aGalaxy.y * TAU;
    float winding = (0.08 + pow(radiusParameter, 0.76) * 1.73) * TAU;
    float angularScatter = crossArm * mix(0.66, 0.105, armDefinition);
    angularScatter += (aSeed.x - 0.5) * mix(0.42, 0.045, armDefinition);
    float differentialRotation = uTime * mix(0.022, 0.004, radiusParameter);
    theta = armAngle + winding + angularScatter + differentialRotation;

    radius += crossArm * mix(0.045, 0.245, radiusParameter);
    radius += sin(radius * 5.4 - uTime * 5.8 + aSeed.y * TAU)
      * uEnergy * mix(0.075, 0.025, radiusParameter);

    vec2 plane = vec2(cos(theta), sin(theta)) * radius;
    float thickness = mix(0.44, 0.038, smoother(0.02, 0.92, radiusParameter));
    float z = aGalaxy.w * thickness;
    z += sin(theta * 2.0 + radius * 1.7 + aSeed.z * TAU) * 0.018 * armDefinition;

    float pointerInfluence = mix(0.035, 0.095, radiusParameter) * (0.35 + uGalaxy * 0.65);
    plane += uPointer * pointerInfluence;
    coreHeat = 1.0 - smoother(0.055, 0.34, radiusParameter);
    return vec3(plane, z);
  }

  vec3 horizonPosition(out float theta) {
    theta = fract(aSeed.y + aGalaxy.y + aGalaxy.x * 0.381966) * TAU;
    float ringRadius = 3.055;
    ringRadius += aGalaxy.z * 0.041 + (aSeed.x - 0.5) * 0.024;
    ringRadius += sin(theta * 5.0 - uTime * 4.4 + aSeed.w * TAU) * uEnergy * 0.022;
    vec2 center = uPointer * 0.018;
    vec2 plane = center + vec2(cos(theta), sin(theta)) * ringRadius;
    return vec3(plane, aGalaxy.w * 0.014 + (aSeed.z - 0.5) * 0.009);
  }

  void main() {
    float galaxyTheta;
    float coreHeat;
    vec3 spiral = galaxyPosition(galaxyTheta, coreHeat);
    float horizonTheta;
    vec3 ring = horizonPosition(horizonTheta);
    float collapse = smoother(0.0, 1.0, uHorizon);
    vec3 transformed = mix(spiral, ring, collapse);

    float visibleGalaxy = uGalaxy * (1.0 - collapse);
    float stellarWeight = pow(aSeed.z, mix(2.6, 1.85, uQuality));
    float armWeight = mix(0.42, 1.0, smoother(0.07, 0.28, aGalaxy.x));
    float galaxyAlpha = visibleGalaxy
      * armWeight
      * mix(0.026, 0.31, stellarWeight)
      * mix(0.76, 1.0, uQuality);

    float ringSelection = smoother(mix(0.90, 0.855, uQuality), 0.995, aSeed.w);
    float ringAlpha = uHorizon
      * ringSelection
      * mix(0.09, 0.38, aSeed.x)
      * (0.82 + uEnergy * 0.42);
    vAlpha = galaxyAlpha + ringAlpha;

    vec3 cold = mix(vec3(0.16, 0.29, 0.76), vec3(0.56, 0.68, 1.04), aSeed.x);
    vec3 warm = mix(vec3(0.88, 0.58, 0.34), vec3(1.12, 0.86, 0.62), aSeed.y);
    vColor = mix(cold, warm, coreHeat * 0.88);
    vColor = mix(vColor, vec3(0.48, 0.61, 1.08), collapse * 0.72);
    vColor *= 0.78 + stellarWeight * 0.72 + uEnergy * 0.16;

    float finalTheta = mix(galaxyTheta, horizonTheta, collapse);
    vAngle = finalTheta + PI * 0.5;
    vStretch = 1.0 + collapse * mix(0.45, 1.65, aSeed.x) * mix(0.58, 1.0, uQuality);

    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float starSize = mix(0.5, 1.82, pow(aSeed.x, 5.0));
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
    this.name = 'Five Arm Galaxy';
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
    this.visible = Math.max(frame.galaxy, frame.horizon) > 0.002;
  }

  setPixelRatio(value: number): void {
    this.material.uniforms.uPixelRatio!.value = value;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
