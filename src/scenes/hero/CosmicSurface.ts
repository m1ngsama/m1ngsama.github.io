import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';
import { cosmicFieldGLSL } from './cosmicField';

function createGeometry(quality: Quality): THREE.BufferGeometry {
  const uSegments = quality === 'high' ? 320 : quality === 'medium' ? 220 : 144;
  const vSegments = quality === 'high' ? 80 : quality === 'medium' ? 56 : 32;
  const faceVertexCount = (uSegments + 1) * (vSegments + 1);
  const edgeVertexCount = (uSegments + 1) * 4;
  const vertexCount = faceVertexCount * 2 + edgeVertexCount;
  const positions = new Float32Array(vertexCount * 3);
  const parameters = new Float32Array(vertexCount * 2);
  const layers = new Float32Array(vertexCount);
  const edges = new Float32Array(vertexCount);
  const indices: number[] = [];

  for (let layerIndex = 0; layerIndex < 2; layerIndex += 1) {
    const layer = layerIndex === 0 ? 1 : -1;
    const layerOffset = layerIndex * faceVertexCount;
    for (let y = 0; y <= vSegments; y += 1) {
      for (let x = 0; x <= uSegments; x += 1) {
        const vertex = layerOffset + y * (uSegments + 1) + x;
        parameters[vertex * 2] = x / uSegments;
        parameters[vertex * 2 + 1] = (y / vSegments) * 2 - 1;
        layers[vertex] = layer;
      }
    }
  }

  for (let layerIndex = 0; layerIndex < 2; layerIndex += 1) {
    const layerOffset = layerIndex * faceVertexCount;
    for (let y = 0; y < vSegments; y += 1) {
      for (let x = 0; x < uSegments; x += 1) {
        const a = layerOffset + y * (uSegments + 1) + x;
        const b = a + 1;
        const c = a + uSegments + 1;
        const d = c + 1;
        if (layerIndex === 0) indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
    }
  }

  let edgeOffset = faceVertexCount * 2;
  for (const edge of [-1, 1]) {
    const stripOffset = edgeOffset;
    for (let x = 0; x <= uSegments; x += 1) {
      for (let layerIndex = 0; layerIndex < 2; layerIndex += 1) {
        const vertex = edgeOffset++;
        parameters[vertex * 2] = x / uSegments;
        parameters[vertex * 2 + 1] = edge;
        layers[vertex] = layerIndex === 0 ? 1 : -1;
        edges[vertex] = edge;
      }
    }
    for (let x = 0; x < uSegments; x += 1) {
      const a = stripOffset + x * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (edge < 0) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aParam', new THREE.BufferAttribute(parameters, 2));
  geometry.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1));
  geometry.setAttribute('aEdge', new THREE.BufferAttribute(edges, 1));
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
  attribute float aLayer;
  attribute float aEdge;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying vec3 vSmoothNormal;
  varying vec3 vTangent;
  varying vec2 vParam;
  varying vec4 vPhase;
  varying float vHorizon;
  varying float vMaterialField;
  varying float vMaterialRidges;
  varying float vCrater;
  varying float vLayer;
  varying float vEdge;

  ${cosmicFieldGLSL}

  void main() {
    float veil;
    float planet;
    float orbit;
    float galaxy;
    float horizon;
    cosmicPhases(aParam, veil, planet, orbit, galaxy, horizon);
    vec3 center = cosmicSurfacePoint(aParam);
    vec3 surfaceNormal = cosmicSurfaceNormal(aParam);
    vec3 nextU = cosmicSurfacePoint(cosmicDerivativeParameter(aParam, vec2(0.0022, 0.0), orbit));
    vec3 tangent = normalize(nextU - center);
    float thickness = veil * 0.009
      + orbit * 0.02
      + galaxy * 0.005
      + horizon * 0.0035;
    float seamDistance = min(aParam.x, 1.0 - aParam.x);
    thickness *= mix(1.0, smoothstep(0.0, 0.024, seamDistance), orbit);
    vec3 transformed = center + surfaceNormal * aLayer * thickness;

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldPosition = worldPosition.xyz;
    vLocalPosition = transformed;
    vSmoothNormal = normalize(mat3(modelMatrix) * surfaceNormal * aLayer);
    vTangent = normalize(mat3(modelMatrix) * tangent);
    vParam = aParam;
    vPhase = vec4(veil, planet, orbit, galaxy);
    vHorizon = horizon;
    vMaterialField = cosmicMaterialField(aParam);
    vMaterialRidges = cosmicMaterialRidges(aParam);
    vCrater = cosmicCraterMetric(aParam);
    vLayer = aLayer;
    vEdge = aEdge;
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
  varying vec3 vTangent;
  varying vec2 vParam;
  varying vec4 vPhase;
  varying float vHorizon;
  varying float vMaterialField;
  varying float vMaterialRidges;
  varying float vCrater;
  varying float vLayer;
  varying float vEdge;

  float circularDistance(float a, float b) {
    return abs(fract(a - b + 0.5) - 0.5);
  }

  vec3 fresnelSchlick(float cosine, vec3 f0) {
    return f0 + (1.0 - f0) * pow(1.0 - cosine, 5.0);
  }

  float distributionGGX(vec3 normal, vec3 halfway, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float nDotH = max(dot(normal, halfway), 0.0);
    float denominator = nDotH * nDotH * (a2 - 1.0) + 1.0;
    return a2 / max(3.141592653589793 * denominator * denominator, 0.0001);
  }

  float geometrySchlickGGX(float nDotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    return nDotV / max(nDotV * (1.0 - k) + k, 0.0001);
  }

  void main() {
    float veil = vPhase.x;
    float planet = vPhase.y;
    float orbit = vPhase.z;
    float galaxy = vPhase.w;
    float horizon = vHorizon;
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 faceNormal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
    float smoothness = mix(0.56, 0.78, planet);
    smoothness = mix(smoothness, 0.42, orbit + galaxy + horizon);
    vec3 normal = normalize(mix(faceNormal, vSmoothNormal, smoothness));
    if (dot(normal, viewDirection) < 0.0) normal *= -1.0;

    vec3 tangent = normalize(vTangent - normal * dot(vTangent, normal));
    vec3 bitangent = normalize(cross(normal, tangent));
    vec3 keyDirection = normalize(vec3(-0.66 + uPointer.x * 0.11, 0.52 - uPointer.y * 0.08, 0.68));
    vec3 fillDirection = normalize(vec3(0.72, -0.22, 0.46));
    vec3 halfKey = normalize(keyDirection + viewDirection);
    float nDotV = max(dot(normal, viewDirection), 0.001);
    float nDotL = max(dot(normal, keyDirection), 0.0);
    float roughness = mix(0.28, 0.52, vMaterialField);
    roughness = mix(roughness, mix(0.17, 0.34, vMaterialRidges), orbit);
    roughness = mix(roughness, mix(0.3, 0.62, vMaterialRidges), planet);
    roughness = clamp(roughness, 0.12, 0.68);
    float distribution = distributionGGX(normal, halfKey, roughness);
    float geometry = geometrySchlickGGX(nDotV, roughness) * geometrySchlickGGX(nDotL, roughness);
    vec3 f0 = mix(vec3(0.055, 0.065, 0.082), vec3(0.14, 0.16, 0.19), orbit);
    vec3 fresnel = fresnelSchlick(max(dot(halfKey, viewDirection), 0.0), f0);
    float anisotropy = pow(1.0 - abs(dot(halfKey, tangent)), mix(5.0, 14.0, orbit));
    vec3 specular = distribution * geometry * fresnel / max(4.0 * nDotV * max(nDotL, 0.001), 0.001);
    specular *= mix(0.72, 1.48, anisotropy * orbit);

    float craterBowl = 1.0 - smoothstep(0.045, 0.175, vCrater);
    float craterRim = exp(-pow((vCrater - 0.18) / 0.038, 2.0));
    float fracture = pow(clamp(vMaterialRidges, 0.0, 1.0), 5.5);
    float terminator = smoothstep(-0.08, 0.56, dot(normal, keyDirection));
    vec3 baseColor = mix(vec3(0.0015, 0.0018, 0.0024), vec3(0.008, 0.0095, 0.013), vMaterialField);
    baseColor = mix(baseColor, vec3(0.002, 0.0024, 0.0035), craterBowl * planet);
    baseColor += vec3(0.003, 0.0045, 0.008) * craterRim * planet;
    baseColor += vec3(0.007, 0.009, 0.014) * fracture * planet;

    float brush = pow(
      1.0 - abs(sin(vParam.x * 920.0 + vParam.y * 27.0 + vMaterialField * 4.0)),
      22.0
    );
    float stressDistance = abs(vParam.y - sin(vParam.x * 7.1 + 0.4) * 0.3);
    float stressWidth = max(fwidth(stressDistance) * 1.45, 0.001);
    float stressLine = 1.0 - smoothstep(stressWidth, stressWidth * 2.4, stressDistance);
    float edgeDistance = 1.0 - abs(vParam.y);
    float edgeWidth = max(fwidth(vParam.y) * 2.4, 0.004);
    float edgeHighlight = 1.0 - smoothstep(0.0, edgeWidth, edgeDistance);
    edgeHighlight = max(edgeHighlight, step(0.5, abs(vEdge)));

    float defectDistance = circularDistance(
      fract(vParam.x * 2.0 + vParam.y * 0.17),
      fract(0.14 + uTime * 0.006)
    );
    float defectWidth = max(fwidth(defectDistance) * 1.65, 0.0018);
    float defect = 1.0 - smoothstep(defectWidth, defectWidth * 2.6, defectDistance);

    vec3 color = baseColor * (0.025 + terminator * 0.975);
    color += specular * nDotL * mix(0.5, 1.15, orbit + galaxy) * mix(1.0, 0.42, planet);
    color += vec3(0.014, 0.018, 0.027) * max(dot(normal, fillDirection), 0.0);
    color += vec3(0.018, 0.024, 0.043) * brush * (veil + orbit * 0.5);
    color += vec3(0.038, 0.047, 0.071) * stressLine * veil * (0.1 + terminator * 0.3);
    color += vec3(0.075, 0.09, 0.12) * edgeHighlight * orbit * (0.1 + nDotL * 0.5);
    color += vec3(0.03, 0.065, 0.2) * defect * (orbit * 0.72 + galaxy * 0.36);
    color += vec3(0.012, 0.02, 0.055) * pow(1.0 - nDotV, 4.5)
      * (planet * terminator * 0.58 + orbit * 0.6);

    float spiralSpine = pow(max(0.0, 1.0 - abs(vParam.y)), 10.0);
    color = mix(color, vec3(0.0015, 0.002, 0.0045) + color * 0.32, galaxy * 0.76);
    color += vec3(0.035, 0.06, 0.14) * spiralSpine * galaxy * (0.16 + vMaterialRidges * 0.34);
    color = mix(color, vec3(0.0005, 0.0007, 0.0014), horizon * 0.9);
    float doppler = smoothstep(-0.85, 0.72, dot(normalize(vLocalPosition.xy + vec2(0.001)), vec2(0.88, 0.48)));
    color += vec3(0.11, 0.16, 0.32) * edgeHighlight * horizon * mix(0.12, 0.72, doppler);

    float signalPosition = fract(uProgress * 1.72 + uTime * 0.022);
    float signalDistance = circularDistance(vParam.x, signalPosition);
    float signal = exp(-signalDistance * signalDistance * 4300.0) * exp(-abs(vParam.y) * 1.5);
    color += vec3(0.22, 0.37, 0.92) * signal
      * (0.08 + orbit * 0.62 + galaxy * 0.28 + horizon * 0.74);
    color += vec3(0.045, 0.085, 0.26) * pow(1.0 - nDotV, 5.0) * uPulse * 0.2;

    float veilLuminance = clamp(dot(color, vec3(0.2126, 0.7152, 0.0722)), 0.0, 0.34);
    vec3 veilGrade = vec3(0.0007, 0.001, 0.002);
    veilGrade += vec3(0.036, 0.045, 0.07) * (veilLuminance / 0.34);
    veilGrade += vec3(0.011, 0.0135, 0.019) * (0.2 + nDotL * 0.55 + anisotropy * 0.18);
    veilGrade += vec3(0.02, 0.045, 0.19) * signal;
    color = mix(color, veilGrade, veil * 0.72);

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
