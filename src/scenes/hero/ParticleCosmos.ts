import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';

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
  uniform vec2 uPointer;
  attribute vec2 aParam;
  attribute vec3 aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRay;

  const float PI = 3.141592653589793;
  const float TAU = 6.283185307179586;

  float smoother(float a, float b, float value) {
    float x = clamp((value - a) / (b - a), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
  }

  vec3 planetSurface(vec2 parameter) {
    float longitude = parameter.x * TAU + 0.42;
    float latitude = parameter.y * PI * 0.5;
    float latitudeRadius = cos(latitude);
    vec3 direction = vec3(
      latitudeRadius * cos(longitude),
      sin(latitude),
      latitudeRadius * sin(longitude)
    );
    return direction * (2.1 + aSeed.x * 0.075);
  }

  vec3 mobiusSurface(vec2 parameter) {
    float theta = parameter.x * TAU;
    float width = parameter.y * 0.58;
    float radius = 2.14;
    return vec3(
      (radius + width * cos(theta)) * cos(theta),
      (radius + width * cos(theta)) * sin(theta),
      width * sin(theta)
    );
  }

  vec3 galaxySurface(vec2 parameter) {
    float armOffset = floor(aSeed.z * 3.0) * TAU / 3.0;
    float theta = (parameter.x * 3.2 + 0.035) * TAU + armOffset * 0.14;
    float radius = 0.2 + pow(parameter.x, 0.68) * 2.94;
    float taper = mix(0.52, 0.075, pow(parameter.x, 0.58));
    float ribbon = parameter.y * taper + (aSeed.x - 0.5) * taper * 0.38;
    float r = radius + ribbon;
    float z = (parameter.y + aSeed.y - 0.5) * mix(0.2, 0.04, parameter.x);
    return vec3(cos(theta) * r, sin(theta) * r, z);
  }

  vec3 horizonSurface(vec2 parameter) {
    float theta = parameter.x * TAU + (aSeed.x - 0.5) * 0.035;
    float radius = 2.16 + parameter.y * 0.042 + (aSeed.y - 0.5) * 0.025;
    return vec3(cos(theta) * radius, sin(theta) * radius, parameter.y * 0.018);
  }

  void main() {
    float orbit = smoother(0.39, 0.535, uProgress);
    float galaxy = smoother(0.565, 0.745, uProgress);
    float horizon = smoother(0.865, 0.98, uProgress);
    vec3 transformed = planetSurface(aParam);
    transformed = mix(transformed, mobiusSurface(aParam), orbit);
    transformed = mix(transformed, galaxySurface(aParam), galaxy);
    transformed = mix(transformed, horizonSurface(aParam), horizon);

    float ripple = sin(length(transformed.xy) * 9.0 - uTime * 7.0 + aSeed.z * TAU);
    transformed += normalize(transformed + vec3(0.001)) * ripple * uPulse * 0.075;
    transformed.xy += uPointer * 0.025 * (0.3 + aSeed.z);

    float planetPresence = smoother(0.22, 0.32, uProgress) * (1.0 - smoother(0.41, 0.5, uProgress));
    float galaxyPresence = smoother(0.53, 0.68, uProgress) * (1.0 - smoother(0.88, 0.98, uProgress));
    float horizonPresence = smoother(0.87, 0.96, uProgress);
    float selection = smoothstep(0.76, 0.99, aSeed.y + galaxyPresence * 0.48);
    float planetSelection = step(0.97, aSeed.y);
    vAlpha = (planetPresence * planetSelection * 0.36 + galaxyPresence * selection + horizonPresence * 0.52)
      * (0.32 + aSeed.x * 0.68);

    vec3 cold = mix(vec3(0.32, 0.48, 1.0), vec3(0.76, 0.86, 1.0), aSeed.x);
    vec3 warm = vec3(1.0, 0.76, 0.52);
    float coreHeat = (1.0 - smoothstep(0.0, 0.3, aParam.x)) * galaxyPresence;
    vColor = mix(cold, warm, coreHeat * (0.28 + aSeed.y * 0.42));
    vRay = step(0.89, aSeed.z);

    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float size = mix(0.72, 2.25, aSeed.x * aSeed.x) * uPixelRatio;
    size *= mix(0.85, 1.35, galaxyPresence);
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

  update(time: number, progress: number, pointer: THREE.Vector2, pulse: number): void {
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uProgress!.value = progress;
    this.material.uniforms.uPulse!.value = pulse;
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
