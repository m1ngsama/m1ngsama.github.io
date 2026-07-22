import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';

function createGeometry(quality: Quality): THREE.BufferGeometry {
  const uSegments = quality === 'high' ? 320 : quality === 'medium' ? 240 : 160;
  const vSegments = quality === 'high' ? 64 : quality === 'medium' ? 48 : 28;
  const vertexCount = (uSegments + 1) * (vSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const parameters = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  for (let y = 0; y <= vSegments; y += 1) {
    for (let x = 0; x <= uSegments; x += 1) {
      const vertex = y * (uSegments + 1) + x;
      parameters[vertex * 2] = x / uSegments;
      parameters[vertex * 2 + 1] = (y / vSegments) * 2 - 1;
    }
  }

  for (let y = 0; y < vSegments; y += 1) {
    for (let x = 0; x < uSegments; x += 1) {
      const a = y * (uSegments + 1) + x;
      const b = a + 1;
      const c = a + uSegments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aParam', new THREE.BufferAttribute(parameters, 2));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6);
  return geometry;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPulse;
  uniform float uMobile;
  attribute vec2 aParam;
  varying vec3 vWorldPosition;
  varying vec2 vParam;
  varying float vSurfaceNoise;

  const float PI = 3.141592653589793;
  const float TAU = 6.283185307179586;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x),
          mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x),
          mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += noise3(p) * amplitude;
      p = p * 2.03 + 7.13;
      amplitude *= 0.5;
    }
    return value;
  }

  float smoother(float a, float b, float value) {
    float x = clamp((value - a) / (b - a), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
  }

  vec3 surface(vec2 parameter) {
    float fold = smoother(0.055, 0.48, uProgress);
    float horizon = smoother(0.72, 0.94, uProgress);
    float theta = parameter.x * TAU;
    float width = parameter.y * 0.78 * mix(1.0, 0.025, horizon);
    float radius = mix(2.08, 2.18, horizon);

    vec3 mobius = vec3(
      (radius + width * cos(theta * 0.5)) * cos(theta),
      (radius + width * cos(theta * 0.5)) * sin(theta),
      width * sin(theta * 0.5)
    );

    vec3 veil = vec3(
      (parameter.x - 0.5) * mix(8.6, 7.2, uMobile),
      parameter.y * mix(2.75, 3.35, uMobile),
      -1.18 + cos((parameter.x - 0.5) * PI) * 0.54
    );
    veil.z += sin(parameter.x * PI * 3.0) * 0.11 + parameter.y * parameter.y * 0.08;

    return mix(veil, mobius, fold);
  }

  vec3 surfaceNormal(vec2 parameter) {
    vec2 du = vec2(0.0026, 0.0);
    vec2 dv = vec2(0.0, 0.009);
    vec3 tangentU = surface(clamp(parameter + du, vec2(0.0, -1.0), vec2(1.0)))
      - surface(clamp(parameter - du, vec2(0.0, -1.0), vec2(1.0)));
    vec3 tangentV = surface(clamp(parameter + dv, vec2(0.0, -1.0), vec2(1.0)))
      - surface(clamp(parameter - dv, vec2(0.0, -1.0), vec2(1.0)));
    return normalize(cross(tangentU, tangentV));
  }

  void main() {
    vec3 base = surface(aParam);
    vec3 normal = surfaceNormal(aParam);
    float calm = 1.0 - smoother(0.46, 0.94, uProgress);
    float field = fbm(vec3(aParam.x * 4.2, aParam.y * 1.35, uTime * 0.045));
    float folds = sin(aParam.x * 38.0 + uTime * 0.18) * cos(aParam.y * 4.4 - uTime * 0.09);
    float pulseWave = sin(aParam.x * 82.0 - uTime * 5.2) * exp(-abs(aParam.y) * 1.7) * uPulse;
    float displacement = ((field - 0.5) * 0.19 + folds * 0.026) * calm + pulseWave * 0.055;
    vec3 transformed = base + normal * displacement;

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPosition = worldPosition.xyz;
    vParam = aParam;
    vSurfaceNoise = field;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPulse;
  uniform vec2 uPointer;
  varying vec3 vWorldPosition;
  varying vec2 vParam;
  varying float vSurfaceNoise;

  float circularDistance(float a, float b) {
    return abs(fract(a - b + 0.5) - 0.5);
  }

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 normal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
    if (dot(normal, viewDirection) < 0.0) normal *= -1.0;

    vec3 keyDirection = normalize(vec3(-0.42 + uPointer.x * 0.28, 0.72 - uPointer.y * 0.2, 0.68));
    vec3 rimDirection = normalize(vec3(0.72, -0.28, 0.58));
    vec3 fillDirection = normalize(vec3(-0.18, -0.8, 0.42));

    vec3 halfKey = normalize(keyDirection + viewDirection);
    vec3 halfRim = normalize(rimDirection + viewDirection);
    float key = pow(max(dot(normal, halfKey), 0.0), mix(72.0, 108.0, vSurfaceNoise));
    float keyWide = pow(max(dot(normal, halfKey), 0.0), 13.0);
    float rimSpec = pow(max(dot(normal, halfRim), 0.0), 54.0);
    float fill = pow(max(dot(normal, normalize(fillDirection + viewDirection)), 0.0), 22.0);
    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.15);

    float spectralPhase = fresnel * 8.0 + vSurfaceNoise * 1.8 + uProgress * 2.4;
    vec3 spectral = 0.52 + 0.48 * cos(spectralPhase + vec3(0.2, 2.15, 4.25));
    spectral = mix(vec3(0.07, 0.105, 0.23), spectral * 0.22, 0.22);

    float signalWindow = smoothstep(0.47, 0.56, uProgress) * (1.0 - smoothstep(0.79, 0.87, uProgress));
    float signalPosition = fract((uProgress - 0.47) / 0.34 + uTime * 0.018);
    float signalDistance = circularDistance(vParam.x, signalPosition);
    float signal = exp(-signalDistance * signalDistance * 3100.0) * exp(-abs(vParam.y) * 0.85) * signalWindow;

    float veilPresence = 1.0 - smoothstep(0.17, 0.5, uProgress);
    float veilBandA = exp(-pow((vParam.y - sin(vParam.x * 7.2 + uTime * 0.06) * 0.34) / 0.3, 2.0));
    float veilBandB = exp(-pow((vParam.y + 0.58 - cos(vParam.x * 5.1) * 0.16) / 0.16, 2.0));
    float veilLine = exp(-pow((vParam.y - sin(vParam.x * 6.4 + 0.7) * 0.28) / 0.052, 2.0));
    float diffuse = max(dot(normal, keyDirection) * 0.5 + 0.5, 0.0);
    float micro = 0.88 + vSurfaceNoise * 0.14;
    vec3 color = vec3(0.0035, 0.0045, 0.008);
    color += vec3(0.012, 0.016, 0.03) * diffuse;
    color += vec3(0.095, 0.115, 0.18) * (veilBandA * 0.72 + veilBandB * 0.3) * veilPresence * micro;
    color += vec3(0.28, 0.32, 0.5) * veilLine * veilPresence * (0.65 + vSurfaceNoise * 0.35);
    color += vec3(0.058, 0.07, 0.115) * keyWide * micro;
    color += vec3(0.88, 0.93, 1.0) * key * (0.72 + vSurfaceNoise * 0.28);
    color += vec3(0.2, 0.29, 0.56) * rimSpec * 0.72;
    color += vec3(0.065, 0.075, 0.12) * fill;
    color += spectral * fresnel * (0.1 + 0.08 * smoothstep(0.18, 0.78, uProgress));
    color += vec3(0.42, 0.58, 1.18) * signal * 1.45;
    color += vec3(0.16, 0.24, 0.54) * fresnel * uPulse * 0.32;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Fold extends THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
  constructor(quality: Quality) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uPulse: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
        uMobile: { value: quality === 'low' ? 1 : 0 },
      },
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true,
      toneMapped: true,
    });

    super(createGeometry(quality), material);
    this.name = 'The Fold';
    this.frustumCulled = false;
  }

  update(time: number, progress: number, pointer: THREE.Vector2, pulse: number): void {
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uProgress!.value = progress;
    this.material.uniforms.uPulse!.value = pulse;
    (this.material.uniforms.uPointer!.value as THREE.Vector2).copy(pointer);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
