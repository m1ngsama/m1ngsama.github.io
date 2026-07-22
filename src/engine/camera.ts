import * as THREE from 'three';

export function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.set(0, 0, 8.2);
  return camera;
}
