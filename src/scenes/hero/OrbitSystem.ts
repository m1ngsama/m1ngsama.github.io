import * as THREE from 'three';

export function createOrbitSystem() {
  const group = new THREE.Group();

  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.8 + i * 0.45, 0.006, 16, 256),
      new THREE.MeshBasicMaterial({
        color: 0x9bbcff,
        transparent: true,
        opacity: 0.25 - i * 0.05,
      })
    );
    ring.rotation.x = Math.PI / (2 + i);
    group.add(ring);
  }

  group.name = 'Neural_Orbit_System';
  return group;
}
