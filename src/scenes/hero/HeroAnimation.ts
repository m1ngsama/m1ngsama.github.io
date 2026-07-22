import type * as THREE from 'three';

export function animateHero(core: THREE.Object3D, orbit: THREE.Object3D, time: number) {
  core.rotation.x = time * 0.0002;
  core.rotation.y = time * 0.00035;

  orbit.rotation.z = time * 0.00015;
  orbit.rotation.y = time * 0.0001;

  const scale = 1 + Math.sin(time * 0.002) * 0.03;
  core.scale.setScalar(scale);
}
