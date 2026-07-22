import * as THREE from 'three';

export function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.08, 40);
  camera.position.set(0.45, 0.12, 3.1);
  return camera;
}
