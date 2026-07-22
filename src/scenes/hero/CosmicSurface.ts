import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';

function createGeometry(quality: Quality): THREE.BufferGeometry {
  const uSegments = quality === 'high' ? 320 : quality === 'medium' ? 220 : 144;
  const vSegments = quality === 'high' ? 80 : quality === 'medium' ? 56 : 32;
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
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 7);
  return geometry;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPulse;
  uniform float uMobile;
  attribute vec2 aParam;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying vec3 vSmoothNormal;
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

  vec3 veilSurface(vec2 parameter) {
    float x = (parameter.x - 0.5) * mix(8.8, 7.4, uMobile);
    float y = parameter.y * mix(2.85, 3.35, uMobile);
    float radius = length(vec2(x * 0.56, y));
    float gravity = exp(-radius * 1.28);
    float z = -1.05 + cos((parameter.x - 0.5) * PI) * 0.48;
    z -= gravity * (0.16 + smoother(0.05, 0.22, uProgress) * 0.7);
    z += sin(parameter.x * PI * 4.0 + parameter.y * 1.7) * 0.075;
    return vec3(x, y, z);
  }

  vec3 planetSurface(vec2 parameter) {
    float longitude = parameter.x * TAU + 0.42;
    float latitude = parameter.y * PI * 0.5;
    float radius = 2.05;
    float latitudeRadius = cos(latitude);
    return radius * vec3(
      latitudeRadius * cos(longitude),
      sin(latitude),
      latitudeRadius * sin(longitude)
    );
  }

  vec3 mobiusSurface(vec2 parameter) {
    float theta = parameter.x * TAU;
    float width = parameter.y * 0.54;
    float radius = 2.14;
    return vec3(
      (radius + width * cos(theta)) * cos(theta),
      (radius + width * cos(theta)) * sin(theta),
      width * sin(theta)
    );
  }

  vec3 galaxySurface(vec2 parameter) {
    float theta = (parameter.x * 3.2 + 0.035) * TAU;
    float radius = 0.2 + pow(parameter.x, 0.68) * 3.05;
    float taper = mix(0.21, 0.026, pow(parameter.x, 0.58));
    float ribbon = parameter.y * taper;
    float r = radius + ribbon;
    float z = parameter.y * mix(0.16, 0.035, parameter.x);
    z += sin(theta * 0.52 + uTime * 0.06) * 0.045 * (1.0 - parameter.x);
    return vec3(cos(theta) * r, sin(theta) * r, z);
  }

  vec3 horizonSurface(vec2 parameter) {
    float theta = parameter.x * TAU;
    float width = parameter.y * 0.028;
    float radius = 2.16;
    return vec3(
      (radius + width * cos(theta)) * cos(theta),
      (radius + width * cos(theta)) * sin(theta),
      width * sin(theta)
    );
  }

  vec3 surface(vec2 parameter) {
    float planet = smoother(0.105, 0.295, uProgress);
    float orbit = smoother(0.39, 0.535, uProgress);
    float galaxy = smoother(0.565, 0.745, uProgress);
    float horizon = smoother(0.865, 0.98, uProgress);
    vec3 shape = mix(veilSurface(parameter), planetSurface(parameter), planet);
    shape = mix(shape, mobiusSurface(parameter), orbit);
    shape = mix(shape, galaxySurface(parameter), galaxy);
    return mix(shape, horizonSurface(parameter), horizon);
  }

  void main() {
    vec3 base = surface(aParam);
    float planet = smoother(0.105, 0.295, uProgress) * (1.0 - smoother(0.39, 0.535, uProgress));
    float orbit = smoother(0.39, 0.535, uProgress) * (1.0 - smoother(0.565, 0.745, uProgress));
    float galaxy = smoother(0.565, 0.745, uProgress) * (1.0 - smoother(0.865, 0.98, uProgress));
    float horizon = smoother(0.865, 0.98, uProgress);
    float field = fbm(base * mix(0.64, 1.65, planet) + vec3(0.0, 0.0, uTime * 0.018));
    float veilWave = sin(aParam.x * 44.0 + uTime * 0.16) * cos(aParam.y * 5.2 - uTime * 0.08);
    float planetRelief = (field - 0.52) * 0.105 * planet;
    float filament = sin(aParam.x * 118.0 - uTime * 0.52) * exp(-abs(aParam.y) * 3.4) * galaxy;
    float pulseWave = sin(length(base.xy) * 13.0 - uTime * 6.0) * uPulse;
    float displacement = (field - 0.5) * 0.16 * (1.0 - planet - galaxy - horizon);
    displacement += veilWave * 0.024 * (1.0 - planet);
    displacement += planetRelief + filament * 0.018 + pulseWave * 0.045;
    float radialShape = clamp(planet + orbit + galaxy + horizon, 0.0, 1.0);
    vec3 displacementDirection = normalize(mix(vec3(0.0, 0.0, 1.0), base + vec3(0.001), radialShape));
    vec3 transformed = base + displacementDirection * displacement;

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPosition = worldPosition.xyz;
    vLocalPosition = transformed;
    vec3 smoothNormal = normalize(mix(vec3(0.0, 0.0, 1.0), normalize(base + vec3(0.001)), planet));
    smoothNormal = normalize(mix(smoothNormal, vec3(0.0, 0.0, 1.0), clamp(galaxy + horizon, 0.0, 1.0)));
    vSmoothNormal = normalize(mat3(modelMatrix) * smoothNormal);
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
  varying vec3 vLocalPosition;
  varying vec3 vSmoothNormal;
  varying vec2 vParam;
  varying float vSurfaceNoise;

  float smoother(float a, float b, float value) {
    float x = clamp((value - a) / (b - a), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
  }

  float circularDistance(float a, float b) {
    return abs(fract(a - b + 0.5) - 0.5);
  }

  void main() {
    float veil = 1.0 - smoother(0.105, 0.295, uProgress);
    float planet = smoother(0.105, 0.295, uProgress) * (1.0 - smoother(0.39, 0.535, uProgress));
    float orbit = smoother(0.39, 0.535, uProgress) * (1.0 - smoother(0.565, 0.745, uProgress));
    float galaxy = smoother(0.565, 0.745, uProgress) * (1.0 - smoother(0.865, 0.98, uProgress));
    float horizon = smoother(0.865, 0.98, uProgress);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 faceNormal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
    float smoothness = mix(0.86, 0.34, clamp(orbit + galaxy + horizon, 0.0, 1.0));
    vec3 normal = normalize(mix(faceNormal, vSmoothNormal, smoothness));
    if (dot(normal, viewDirection) < 0.0) normal *= -1.0;

    vec3 keyDirection = normalize(vec3(-0.62 + uPointer.x * 0.22, 0.58 - uPointer.y * 0.16, 0.72));
    vec3 rimDirection = normalize(vec3(0.76, -0.18, 0.52));
    vec3 halfKey = normalize(keyDirection + viewDirection);
    vec3 halfRim = normalize(rimDirection + viewDirection);
    float diffuse = max(dot(normal, keyDirection), 0.0);
    float key = pow(max(dot(normal, halfKey), 0.0), mix(62.0, 128.0, vSurfaceNoise));
    float keyWide = pow(max(dot(normal, halfKey), 0.0), 11.0);
    float rimSpec = pow(max(dot(normal, halfRim), 0.0), 42.0);
    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), mix(2.3, 4.2, planet));

    float strata = smoothstep(0.46, 0.54, abs(fract(vSurfaceNoise * 7.0 + vLocalPosition.y * 0.14) - 0.5));
    float continent = smoothstep(0.47, 0.64, vSurfaceNoise);
    float terminator = smoothstep(0.08, 0.6, dot(normal, keyDirection));
    vec3 planetColor = mix(vec3(0.004, 0.005, 0.008), vec3(0.042, 0.05, 0.071), continent);
    planetColor *= 0.055 + terminator * 0.945;
    planetColor += vec3(0.12, 0.16, 0.25) * strata * continent * terminator * 0.18;
    planetColor += vec3(0.2, 0.31, 0.72) * fresnel * (0.12 + terminator * 0.24);

    float veilBand = exp(-pow((vParam.y - sin(vParam.x * 7.4 + uTime * 0.055) * 0.31) / 0.22, 2.0));
    float veilLine = exp(-pow((vParam.y + 0.43 - cos(vParam.x * 5.3) * 0.17) / 0.045, 2.0));
    float veilContour = pow(1.0 - abs(fract(vSurfaceNoise * 6.0 + vParam.y * 0.72) - 0.5) * 2.0, 10.0);
    vec3 metalColor = vec3(0.003, 0.004, 0.008);
    metalColor += vec3(0.01, 0.014, 0.029) * veil * (0.42 + diffuse * 0.58);
    metalColor += vec3(0.014, 0.024, 0.07) * veilContour * veil * (0.16 + veilBand * 0.84);
    metalColor += vec3(0.025, 0.032, 0.058) * diffuse;
    metalColor += vec3(0.045, 0.058, 0.11) * keyWide;
    metalColor += vec3(0.22, 0.27, 0.4) * key;
    metalColor += vec3(0.07, 0.11, 0.27) * rimSpec;
    metalColor += vec3(0.016, 0.026, 0.07) * veilBand * (1.0 - planet - galaxy - horizon);
    metalColor += vec3(0.2, 0.29, 0.68) * veilLine * (1.0 - planet - galaxy - horizon);
    metalColor += vec3(0.022, 0.04, 0.11) * keyWide * veil;
    metalColor += vec3(0.11, 0.2, 0.58) * key * orbit;
    metalColor += vec3(0.014, 0.022, 0.065) * orbit * (0.38 + diffuse * 0.62);
    metalColor += vec3(0.065, 0.12, 0.34) * fresnel * orbit;
    float orbitFilament = exp(-abs(vParam.y) * 9.0) + exp(-abs(abs(vParam.y) - 0.72) * 24.0) * 0.35;
    metalColor += vec3(0.08, 0.17, 0.55) * orbitFilament * orbit * (0.22 + vSurfaceNoise * 0.32);

    float spiralFilament = pow(max(0.0, 1.0 - abs(vParam.y)), 8.0);
    float galaxyGrain = smoothstep(0.48, 0.86, vSurfaceNoise);
    vec3 galaxyColor = vec3(0.002, 0.003, 0.008);
    galaxyColor += vec3(0.028, 0.045, 0.11) * (0.4 + galaxyGrain * 0.6);
    galaxyColor += vec3(0.18, 0.28, 0.62) * spiralFilament * (0.15 + galaxyGrain * 0.46);
    galaxyColor += vec3(0.72, 0.62, 0.54) * key * 0.18;

    float signalPosition = fract(uProgress * 1.72 + uTime * 0.022);
    float signalDistance = circularDistance(vParam.x, signalPosition);
    float signal = exp(-signalDistance * signalDistance * 4300.0) * exp(-abs(vParam.y) * 1.5);
    vec3 signalColor = vec3(0.38, 0.58, 1.3) * signal * (0.28 + orbit * 1.2 + galaxy * 0.65 + horizon * 1.4);

    vec3 color = mix(metalColor, planetColor, planet);
    color = mix(color, metalColor * 1.08, orbit);
    color = mix(color, galaxyColor, galaxy);
    color = mix(color, vec3(0.002, 0.003, 0.008) + fresnel * vec3(0.42, 0.56, 1.1), horizon);
    color += fresnel * mix(vec3(0.025, 0.035, 0.075), vec3(0.12, 0.18, 0.38), orbit + horizon);
    color += signalColor;
    color += vec3(0.11, 0.2, 0.55) * fresnel * uPulse * 0.34;

    float veilLuminance = clamp(dot(color, vec3(0.2126, 0.7152, 0.0722)), 0.0, 0.34);
    vec3 veilGrade = vec3(0.0012, 0.0021, 0.0055);
    veilGrade += vec3(0.048, 0.071, 0.15) * (veilLuminance / 0.34);
    veilGrade += vec3(0.035, 0.075, 0.32) * signal;
    color = mix(color, veilGrade, veil * 0.96);

    gl_FragColor = vec4(max(color, 0.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class CosmicSurface extends THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
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
    this.name = 'One Surface Cosmology';
    this.frustumCulled = false;
  }

  update(time: number, progress: number, pointer: THREE.Vector2, pulse: number, mobile: boolean): void {
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uProgress!.value = progress;
    this.material.uniforms.uPulse!.value = pulse;
    this.material.uniforms.uMobile!.value = mobile ? 1 : 0;
    (this.material.uniforms.uPointer!.value as THREE.Vector2).copy(pointer);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
