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

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float rim = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDirection)), 2.7);
    vec3 lightDirection = normalize(vec3(-0.72 + uPointer.x * 0.12, 0.34, 0.62));
    float lightSide = smoothstep(-0.18, 0.52, dot(normalize(vWorldNormal), lightDirection));
    float turbulence = hash31(normalize(vWorldPosition) * 72.0 + floor(uTime * 2.0)) - 0.5;
    float wave = sin(atan(vWorldPosition.y, vWorldPosition.x) * 9.0 - uTime * 0.45) * uPulse;
    float alpha = rim * (0.11 + lightSide * 0.42) * uPresence;
    alpha += max(wave, 0.0) * rim * 0.08;
    vec3 color = mix(vec3(0.12, 0.2, 0.52), vec3(0.58, 0.72, 1.25), lightSide);
    color *= 0.76 + turbulence * 0.08;
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
    const size = frame.world * 0.96 + frame.orbit * 0.36 + frame.galaxy * 0.045 + frame.horizon * 0.92;
    this.core.visible = size > 0.015;
    this.core.scale.setScalar(Math.max(size, 0.001));
    this.core.rotation.y = time * 0.018;
    const atmospherePresence = frame.world;
    this.atmosphere.visible = atmospherePresence > 0.005;
    const atmosphereScale = frame.world;
    this.atmosphere.scale.setScalar(Math.max(atmosphereScale, 0.001) * (1.04 + Math.sin(time * 0.24) * 0.004 + pulse * 0.012));
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
