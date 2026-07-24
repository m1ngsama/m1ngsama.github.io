import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';
import type { SequenceFrame } from './sequence';

export class WorldCore extends THREE.Group {
  private readonly coreGeometry: THREE.SphereGeometry;
  private readonly coreMaterial: THREE.MeshBasicMaterial;
  private readonly core: THREE.Mesh;

  constructor(quality: Quality) {
    super();
    this.name = 'Event Horizon';
    const widthSegments = quality === 'high' ? 96 : quality === 'medium' ? 72 : 48;
    const heightSegments = quality === 'high' ? 64 : quality === 'medium' ? 48 : 32;

    this.coreGeometry = new THREE.SphereGeometry(1.82, widthSegments, heightSegments);
    this.coreMaterial = new THREE.MeshBasicMaterial({ color: 0x000001, toneMapped: false });
    this.core = new THREE.Mesh(this.coreGeometry, this.coreMaterial);
    this.core.renderOrder = 2;
    this.add(this.core);
  }

  update(
    time: number,
    frame: SequenceFrame,
    _pointer: THREE.Vector2,
    _pulse: number,
  ): void {
    const size = frame.horizon * 0.86;
    this.core.visible = size > 0.015;
    this.core.scale.setScalar(Math.max(size, 0.001));
    this.core.rotation.y = time * 0.018;
  }

  dispose(): void {
    this.coreGeometry.dispose();
    this.coreMaterial.dispose();
  }
}
