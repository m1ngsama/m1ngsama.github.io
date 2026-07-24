import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';
import type { SequenceFrame } from './sequence';

const atmosphereVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const atmosphereFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uPresence;
  uniform float uPulse;
  uniform vec2 uPointer;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 cell = floor(p);
    vec3 local = fract(p);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(mix(hash31(cell), hash31(cell + vec3(1, 0, 0)), local.x),
          mix(hash31(cell + vec3(0, 1, 0)), hash31(cell + vec3(1, 1, 0)), local.x), local.y),
      mix(mix(hash31(cell + vec3(0, 0, 1)), hash31(cell + vec3(1, 0, 1)), local.x),
          mix(hash31(cell + vec3(0, 1, 1)), hash31(cell + vec3(1, 1, 1)), local.x), local.y),
      local.z
    );
  }

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 normal = normalize(vWorldNormal);
    float viewCosine = abs(dot(normal, viewDirection));
    float opticalDepth = pow(1.0 - viewCosine, 4.1);
    float innerRim = pow(1.0 - viewCosine, 10.0);
    vec3 lightDirection = normalize(vec3(-0.72 + uPointer.x * 0.12, 0.34, 0.62));
    float lightDot = dot(normal, lightDirection);
    float lightSide = smoothstep(-0.12, 0.58, lightDot);
    float terminator = exp(-abs(lightDot + 0.04) * 7.5);
    float turbulence = noise3(normal * 18.0 + vec3(0.0, 0.0, uTime * 0.025)) - 0.5;
    float wave = sin(atan(vWorldPosition.y, vWorldPosition.x) * 9.0 - uTime * 0.45) * uPulse;
    float alpha = opticalDepth * (0.025 + lightSide * 0.23) * uPresence;
    alpha += innerRim * terminator * 0.19 * uPresence;
    alpha += max(wave, 0.0) * opticalDepth * 0.035;
    vec3 color = mix(vec3(0.055, 0.09, 0.22), vec3(0.31, 0.43, 0.82), lightSide);
    color *= 0.72 + turbulence * 0.055;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class WorldCore extends THREE.Group {
  private readonly coreGeometry: THREE.SphereGeometry;
  private readonly coreMaterial: THREE.MeshBasicMaterial;
  private readonly core: THREE.Mesh;
  private readonly atmosphereGeometry: THREE.SphereGeometry;
  private readonly atmosphereMaterial: THREE.ShaderMaterial;
  private readonly atmosphere: THREE.Mesh;

  constructor(quality: Quality) {
    super();
    this.name = 'The Unseen Core';
    const widthSegments = quality === 'high' ? 96 : quality === 'medium' ? 72 : 48;
    const heightSegments = quality === 'high' ? 64 : quality === 'medium' ? 48 : 32;

    this.coreGeometry = new THREE.SphereGeometry(1.82, widthSegments, heightSegments);
    this.coreMaterial = new THREE.MeshBasicMaterial({ color: 0x000001, toneMapped: false });
    this.core = new THREE.Mesh(this.coreGeometry, this.coreMaterial);
    this.core.renderOrder = 2;

    this.atmosphereGeometry = new THREE.SphereGeometry(2.15, widthSegments, heightSegments);
    this.atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPresence: { value: 0 },
        uPulse: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
      },
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    });
    this.atmosphere = new THREE.Mesh(this.atmosphereGeometry, this.atmosphereMaterial);
    this.atmosphere.renderOrder = 3;
    this.add(this.core, this.atmosphere);
  }

  update(time: number, frame: SequenceFrame, pointer: THREE.Vector2, pulse: number): void {
    const size = frame.world * 0.96 + frame.horizon * 0.72;
    this.core.visible = size > 0.015;
    this.core.scale.setScalar(Math.max(size, 0.001));
    this.core.rotation.y = time * 0.018;
    const atmospherePresence = frame.world;
    this.atmosphere.visible = atmospherePresence > 0.005;
    const atmosphereScale = frame.world;
    this.atmosphere.scale.setScalar(Math.max(atmosphereScale, 0.001) * (1.035 + pulse * 0.004));
    this.atmosphereMaterial.uniforms.uTime!.value = time;
    this.atmosphereMaterial.uniforms.uPresence!.value = atmospherePresence;
    this.atmosphereMaterial.uniforms.uPulse!.value = pulse;
    (this.atmosphereMaterial.uniforms.uPointer!.value as THREE.Vector2).copy(pointer);
  }

  dispose(): void {
    this.coreGeometry.dispose();
    this.coreMaterial.dispose();
    this.atmosphereGeometry.dispose();
    this.atmosphereMaterial.dispose();
  }
}
