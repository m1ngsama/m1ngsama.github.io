import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';

interface CompiledShader {
  uniforms: Record<string, THREE.IUniform>;
}

export class SignalCore extends THREE.Group {
  private readonly geometry: THREE.IcosahedronGeometry;
  private readonly material: THREE.MeshPhysicalMaterial;
  private readonly shellMaterial: THREE.ShaderMaterial;
  private readonly wireMaterial: THREE.MeshBasicMaterial;
  private compiledShader?: CompiledShader;

  constructor(quality: Quality) {
    super();
    this.geometry = new THREE.IcosahedronGeometry(1.18, quality === 'high' ? 5 : quality === 'medium' ? 4 : 3);
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x0b0d13,
      metalness: 0.82,
      roughness: 0.23,
      clearcoat: 0.82,
      clearcoatRoughness: 0.18,
      iridescence: 0.16,
      iridescenceIOR: 1.15,
      transparent: true,
      opacity: 0.96,
    });

    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uSignal = { value: 1 };
      shader.vertexShader = `
        uniform float uTime;
        uniform float uSignal;
      ${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `
          vec3 transformed = vec3(position);
          float waveA = sin(position.y * 3.4 + uTime * 0.42);
          float waveB = sin(position.x * 4.1 - uTime * 0.28) * cos(position.z * 3.2 + uTime * 0.2);
          float displacement = (waveA * 0.018 + waveB * 0.012) * uSignal;
          transformed += normal * displacement;
        `,
      );
      this.compiledShader = shader;
    };
    this.material.customProgramCacheKey = () => 'signal-core-v2';

    const core = new THREE.Mesh(this.geometry, this.material);
    core.castShadow = false;
    this.add(core);

    this.shellMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0x8ea8ff) },
        uOpacity: { value: 0.13 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDirection;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDirection = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vViewDirection;
        void main() {
          float fresnel = pow(1.0 - abs(dot(vNormal, vViewDirection)), 2.8);
          gl_FragColor = vec4(uColor, fresnel * uOpacity);
        }
      `,
    });
    const shell = new THREE.Mesh(this.geometry, this.shellMaterial);
    shell.scale.setScalar(1.055);
    this.add(shell);

    this.wireMaterial = new THREE.MeshBasicMaterial({
      color: 0xaabaff,
      wireframe: true,
      transparent: true,
      opacity: 0.028,
      depthWrite: false,
    });
    const wire = new THREE.Mesh(this.geometry, this.wireMaterial);
    wire.scale.setScalar(1.012);
    this.add(wire);
  }

  update(time: number, complexity: number): void {
    if (this.compiledShader) {
      this.compiledShader.uniforms.uTime!.value = time;
      this.compiledShader.uniforms.uSignal!.value = complexity;
    }
    const breath = 1 + Math.sin(time * 0.82) * 0.012 * complexity;
    this.scale.setScalar(breath);
  }

  setOpacity(value: number): void {
    this.material.opacity = value;
    this.shellMaterial.uniforms.uOpacity!.value = value * 0.14;
    this.wireMaterial.opacity = value * 0.03;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.shellMaterial.dispose();
    this.wireMaterial.dispose();
  }
}
