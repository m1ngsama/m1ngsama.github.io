import * as THREE from 'three';

export function createCoreObject() {
  const geometry = new THREE.IcosahedronGeometry(1.25, 6);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.15,
    roughness: 0.08,
    transmission: 1,
    thickness: 1.8,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });

  const core = new THREE.Mesh(geometry, material);
  core.name = 'AI_Core';
  return core;
}
