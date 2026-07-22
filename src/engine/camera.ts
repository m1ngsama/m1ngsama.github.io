import * as THREE from 'three';

export function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.08, 40);
  camera.position.set(0.52, -0.06, 2.72);
  return camera;
}
