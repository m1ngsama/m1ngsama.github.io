import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';
import { ParticleField } from './ParticleField';
import { SignalCore } from './SignalCore';

interface NeuralNetwork {
  group: THREE.Group;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

function createNeuralNetwork(quality: Quality): NeuralNetwork {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const nodeCount = quality === 'high' ? 22 : quality === 'medium' ? 16 : 10;
  const nodes: THREE.Vector3[] = [];

  for (let index = 0; index < nodeCount; index += 1) {
    const angle = (index / nodeCount) * Math.PI * 2;
    const radius = 2.15 + (index % 4) * 0.28;
    nodes.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle * 1.7) * 1.15, Math.sin(angle) * radius));
  }

  const nodeGeometry = new THREE.BufferGeometry().setFromPoints(nodes);
  const nodeMaterial = new THREE.PointsMaterial({
    color: 0xa9b9ed,
    size: quality === 'low' ? 0.026 : 0.032,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  group.add(new THREE.Points(nodeGeometry, nodeMaterial));
  geometries.push(nodeGeometry);
  materials.push(nodeMaterial);

  const linePoints: THREE.Vector3[] = [];
  nodes.forEach((node, index) => {
    linePoints.push(node, nodes[(index + 1) % nodes.length]!);
    if (index % 3 === 0) linePoints.push(node, nodes[(index + 5) % nodes.length]!);
  });
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x778dcc,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
  });
  group.add(new THREE.LineSegments(lineGeometry, lineMaterial));
  geometries.push(lineGeometry);
  materials.push(lineMaterial);

  return { group, geometries, materials };
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

export class HeroScene extends THREE.Group {
  private readonly core: SignalCore;
  private readonly particles: ParticleField;
  private readonly orbits = new THREE.Group();
  private readonly orbitMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly network: NeuralNetwork;

  constructor(private readonly quality: Quality) {
    super();
    this.name = 'The Signal';

    const hemisphere = new THREE.HemisphereLight(0xa8b8ea, 0x050506, 1.65);
    const key = new THREE.PointLight(0x9db2ff, 32, 18, 1.8);
    key.position.set(4.2, 2.8, 4.8);
    const rim = new THREE.PointLight(0x6b75a8, 18, 14, 2);
    rim.position.set(-3.2, -1.8, 2.4);
    this.add(hemisphere, key, rim);

    this.core = new SignalCore(quality);
    this.add(this.core);

    const orbitSettings = [
      { radius: 1.72, tube: 0.006, opacity: 0.2, tilt: [1.15, 0.2, 0.4] },
      { radius: 2.08, tube: 0.005, opacity: 0.12, tilt: [0.58, 0.8, -0.2] },
      { radius: 2.45, tube: 0.004, opacity: 0.07, tilt: [1.72, -0.35, 0.7] },
    ] as const;

    orbitSettings.forEach((setting, index) => {
      if (quality === 'low' && index === 2) return;
      const geometry = new THREE.TorusGeometry(setting.radius, setting.tube, 8, quality === 'high' ? 220 : 120);
      const material = new THREE.MeshBasicMaterial({
        color: index === 0 ? 0x8ea8ff : 0x7785b4,
        transparent: true,
        opacity: setting.opacity,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.set(setting.tilt[0], setting.tilt[1], setting.tilt[2]);
      material.userData.baseOpacity = setting.opacity;
      this.orbitMaterials.push(material);
      this.orbits.add(ring);
    });
    this.add(this.orbits);

    this.network = createNeuralNetwork(quality);
    this.add(this.network.group);

    this.particles = new ParticleField(quality);
    this.add(this.particles);
  }

  update(time: number, delta: number, pointer: THREE.Vector2, scroll: number, mobile: boolean): void {
    const topExit = smoothStep(0.08, 0.3, scroll);
    const returnPath = smoothStep(0.52, 0.9, scroll);
    const topX = mobile ? 0.68 : 2.2;
    const middleX = mobile ? -0.82 : -2.25;
    const endX = mobile ? 0.52 : 1.45;
    const pathX = THREE.MathUtils.lerp(THREE.MathUtils.lerp(topX, middleX, topExit), endX, returnPath);
    const pathY = THREE.MathUtils.lerp(mobile ? -0.2 : 0.25, -0.55, topExit) + returnPath * 0.88;
    const pathZ = -topExit * 1.45 + returnPath * 0.5;
    const damping = delta === 0 ? 1 : 1 - Math.exp(-delta * 2.6);

    this.position.x = THREE.MathUtils.lerp(this.position.x, pathX, damping);
    this.position.y = THREE.MathUtils.lerp(this.position.y, pathY, damping);
    this.position.z = THREE.MathUtils.lerp(this.position.z, pathZ, damping);
    const targetScale = (mobile ? 0.72 : 1) * (1 - topExit * 0.17 + returnPath * 0.08);
    this.scale.setScalar(THREE.MathUtils.lerp(this.scale.x, targetScale, damping));

    this.rotation.y = time * 0.032 + pointer.x * 0.1 + scroll * 0.85;
    this.rotation.x = Math.sin(time * 0.11) * 0.025 + pointer.y * 0.065 - scroll * 0.18;
    this.orbits.rotation.z = time * 0.025;
    this.orbits.rotation.y = -time * 0.012;
    this.network.group.rotation.y = time * 0.018;
    this.network.group.rotation.z = Math.sin(time * 0.09) * 0.06;

    const calmness = 1 - smoothStep(0.1, 0.72, scroll) * 0.62;
    const visualOpacity = 1 - topExit * 0.46 + returnPath * 0.18;
    this.core.update(time, calmness);
    this.core.setOpacity(visualOpacity);
    this.particles.update(time, 0.28 * visualOpacity);
    this.orbitMaterials.forEach((material) => {
      const baseOpacity = Number(material.userData.baseOpacity ?? material.opacity);
      material.opacity = baseOpacity * visualOpacity;
    });
  }

  dispose(): void {
    this.core.dispose();
    this.particles.dispose();
    this.orbits.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    this.orbitMaterials.forEach((material) => material.dispose());
    this.network.geometries.forEach((geometry) => geometry.dispose());
    this.network.materials.forEach((material) => material.dispose());
  }
}
