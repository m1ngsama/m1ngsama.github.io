import * as THREE from 'three';

interface CameraKeyframe {
  at: number;
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export interface SequenceFrame {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  veil: number;
  world: number;
  orbit: number;
  galaxy: number;
  horizon: number;
}

function smoother(value: number): number {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function enter(start: number, end: number, value: number): number {
  return smoother((value - start) / (end - start));
}

function windowed(enterStart: number, enterEnd: number, exitStart: number, exitEnd: number, value: number): number {
  return enter(enterStart, enterEnd, value) * (1 - enter(exitStart, exitEnd, value));
}

function sampleCamera(keys: CameraKeyframe[], progress: number): Pick<SequenceFrame, 'position' | 'target' | 'fov'> {
  const last = keys.at(-1)!;
  if (progress >= last.at) {
    return { position: last.position.clone(), target: last.target.clone(), fov: last.fov };
  }

  const nextIndex = keys.findIndex((key) => key.at >= progress);
  const upperIndex = Math.max(nextIndex, 1);
  const lower = keys[upperIndex - 1]!;
  const upper = keys[upperIndex]!;
  const local = smoother((progress - lower.at) / (upper.at - lower.at));

  return {
    position: lower.position.clone().lerp(upper.position, local),
    target: lower.target.clone().lerp(upper.target, local),
    fov: THREE.MathUtils.lerp(lower.fov, upper.fov, local),
  };
}

const desktopKeys: CameraKeyframe[] = [
  { at: 0, position: new THREE.Vector3(0.52, -0.06, 4.1), target: new THREE.Vector3(0.26, 0, -0.2), fov: 30 },
  { at: 0.26, position: new THREE.Vector3(0.14, 0.12, 7.55), target: new THREE.Vector3(0, 0, 0), fov: 32 },
  { at: 0.48, position: new THREE.Vector3(1.34, 0.72, 7.25), target: new THREE.Vector3(0, 0, 0), fov: 34 },
  { at: 0.69, position: new THREE.Vector3(-2.72, 1.05, 6.25), target: new THREE.Vector3(-0.18, 0.08, 0), fov: 38 },
  { at: 0.82, position: new THREE.Vector3(-1.05, 0.34, 7.9), target: new THREE.Vector3(0, 0, 0), fov: 35 },
  { at: 1, position: new THREE.Vector3(0, 0, 9.6), target: new THREE.Vector3(0, 0, 0), fov: 30 },
];

const mobileKeys: CameraKeyframe[] = [
  { at: 0, position: new THREE.Vector3(0.12, -0.04, 4.2), target: new THREE.Vector3(0.08, 0, -0.2), fov: 40 },
  { at: 0.26, position: new THREE.Vector3(0.05, 0.08, 8.45), target: new THREE.Vector3(0, 0, 0), fov: 39 },
  { at: 0.48, position: new THREE.Vector3(0.72, 0.48, 8.8), target: new THREE.Vector3(0, 0, 0), fov: 42 },
  { at: 0.69, position: new THREE.Vector3(-1.2, 0.65, 8.4), target: new THREE.Vector3(-0.08, 0.05, 0), fov: 43 },
  { at: 0.82, position: new THREE.Vector3(-0.42, 0.18, 8.85), target: new THREE.Vector3(0, 0, 0), fov: 40 },
  { at: 1, position: new THREE.Vector3(0, 0, 13.4), target: new THREE.Vector3(0, 0, 0), fov: 35 },
];

export function sampleSequence(progress: number, mobile: boolean): SequenceFrame {
  const value = THREE.MathUtils.clamp(progress, 0, 1);
  return {
    ...sampleCamera(mobile ? mobileKeys : desktopKeys, value),
    veil: 1 - enter(0.105, 0.295, value),
    world: windowed(0.105, 0.295, 0.39, 0.535, value),
    orbit: windowed(0.39, 0.535, 0.565, 0.745, value),
    galaxy: windowed(0.565, 0.745, 0.865, 0.98, value),
    horizon: enter(0.865, 0.98, value),
  };
}
