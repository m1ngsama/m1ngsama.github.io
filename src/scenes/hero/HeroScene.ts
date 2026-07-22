import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';
import { Backdrop } from './Backdrop';
import { Fold } from './Fold';

function smoothStep(edge0: number, edge1: number, value: number): number {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

export class HeroScene extends THREE.Group {
  private readonly fold: Fold;
  private readonly backdrop = new Backdrop();
  private readonly object = new THREE.Group();
  private readonly eventRings = new THREE.Group();
  private readonly ringGeometries: THREE.TorusGeometry[] = [];
  private readonly ringMaterials: THREE.MeshBasicMaterial[] = [];

  constructor(
    private readonly quality: Quality,
  ) {
    super();
    this.name = 'The Fold Experiment';

    this.fold = new Fold(quality);
    this.object.add(this.fold);

    const ringCount = quality === 'low' ? 1 : 3;
    for (let index = 0; index < ringCount; index += 1) {
      const geometry = new THREE.TorusGeometry(2.18 + index * 0.085, 0.0045, 5, quality === 'high' ? 240 : 140);
      const material = new THREE.MeshBasicMaterial({
        color: index === 0 ? 0x9eb2ff : 0x6e82c8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: true,
      });
      material.userData.index = index;
      const ring = new THREE.Mesh(geometry, material);
      ring.position.z = -0.05 - index * 0.035;
      this.eventRings.add(ring);
      this.ringGeometries.push(geometry);
      this.ringMaterials.push(material);
    }
    this.object.add(this.eventRings);
    this.add(this.backdrop, this.object);
  }

  update(
    time: number,
    delta: number,
    pointer: THREE.Vector2,
    progress: number,
    mobile: boolean,
    pulse: number,
  ): void {
    const reveal = smoothStep(0.08, 0.49, progress);
    const horizon = smoothStep(0.76, 0.98, progress);
    const damping = delta === 0 ? 1 : 1 - Math.exp(-delta * 3.1);
    const mobileScale = mobile ? 0.69 : 1;
    const targetScale = THREE.MathUtils.lerp(1, mobileScale, reveal);

    this.object.scale.setScalar(THREE.MathUtils.lerp(this.object.scale.x, targetScale, damping));
    this.object.rotation.x = THREE.MathUtils.lerp(
      this.object.rotation.x,
      reveal * 0.5 - horizon * 0.34 + pointer.y * 0.035,
      damping,
    );
    this.object.rotation.y = THREE.MathUtils.lerp(
      this.object.rotation.y,
      -reveal * 0.22 + smoothStep(0.48, 0.74, progress) * 0.38 - horizon * 0.16 + pointer.x * 0.05,
      damping,
    );
    this.object.rotation.z = THREE.MathUtils.lerp(
      this.object.rotation.z,
      0.055 + reveal * (progress * 0.36 + time * 0.018) - horizon * 0.28,
      damping,
    );

    this.fold.update(time, progress, pointer, pulse);
    this.backdrop.update(time, progress, pointer);

    this.ringMaterials.forEach((material, index) => {
      const delay = index * 0.035;
      const presence = smoothStep(0.8 + delay, 0.96 + delay * 0.45, progress);
      material.opacity = presence * (index === 0 ? 0.2 : 0.075);
    });
    this.eventRings.rotation.z = -time * 0.008;
    this.eventRings.scale.setScalar(1 + Math.sin(time * 0.38) * 0.0035 * horizon);
  }

  dispose(): void {
    this.fold.dispose();
    this.backdrop.dispose();
    this.ringGeometries.forEach((geometry) => geometry.dispose());
    this.ringMaterials.forEach((material) => material.dispose());
  }
}
