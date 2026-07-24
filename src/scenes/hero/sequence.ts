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
  const local = THREE.MathUtils.clamp((progress - lower.at) / (upper.at - lower.at), 0, 1);
  const before = keys[Math.max(upperIndex - 2, 0)]!;
  const after = keys[Math.min(upperIndex + 1, keys.length - 1)]!;

  const interpolateNumber = (p0: number, p1: number, p2: number, p3: number): number => {
    const t2 = local * local;
    const t3 = t2 * local;
    const tangentStart = (p2 - p0) * 0.5;
    const tangentEnd = (p3 - p1) * 0.5;
    return (2 * t3 - 3 * t2 + 1) * p1
      + (-2 * t3 + 3 * t2) * p2
      + (t3 - 2 * t2 + local) * tangentStart
      + (t3 - t2) * tangentEnd;
  };

  const interpolateVector = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): THREE.Vector3 => new THREE.Vector3(
    interpolateNumber(p0.x, p1.x, p2.x, p3.x),
    interpolateNumber(p0.y, p1.y, p2.y, p3.y),
    interpolateNumber(p0.z, p1.z, p2.z, p3.z),
  );

  return {
    position: interpolateVector(before.position, lower.position, upper.position, after.position),
    target: interpolateVector(before.target, lower.target, upper.target, after.target),
    fov: interpolateNumber(before.fov, lower.fov, upper.fov, after.fov),
  };
}

const desktopKeys: CameraKeyframe[] = [
  { at: 0, position: new THREE.Vector3(0.78, -0.16, 3.72), target: new THREE.Vector3(0.24, 0.02, -0.34), fov: 31 },
  { at: 0.26, position: new THREE.Vector3(-0.42, 0.28, 10.9), target: new THREE.Vector3(-0.34, 0.05, 0), fov: 33 },
  { at: 0.48, position: new THREE.Vector3(1.58, 0.92, 6.62), target: new THREE.Vector3(-0.12, 0.04, 0), fov: 34 },
  { at: 0.69, position: new THREE.Vector3(-2.86, 1.12, 6.08), target: new THREE.Vector3(-0.3, 0.09, 0), fov: 35 },
  { at: 0.82, position: new THREE.Vector3(-1.08, 0.4, 7.76), target: new THREE.Vector3(-0.08, 0.02, 0), fov: 34 },
  { at: 1, position: new THREE.Vector3(0.12, -0.04, 9.72), target: new THREE.Vector3(0.03, 0, 0), fov: 32 },
];

const mobileKeys: CameraKeyframe[] = [
  { at: 0, position: new THREE.Vector3(0.2, -0.08, 4.08), target: new THREE.Vector3(0.06, 0, -0.26), fov: 39 },
  { at: 0.26, position: new THREE.Vector3(-0.22, 0.16, 11.5), target: new THREE.Vector3(-0.24, 0.04, 0), fov: 39 },
  { at: 0.48, position: new THREE.Vector3(0.92, 0.58, 8.32), target: new THREE.Vector3(-0.08, 0.03, 0), fov: 40 },
  { at: 0.69, position: new THREE.Vector3(-1.42, 0.72, 8.08), target: new THREE.Vector3(-0.16, 0.05, 0), fov: 41 },
  { at: 0.82, position: new THREE.Vector3(-0.5, 0.22, 8.72), target: new THREE.Vector3(-0.04, 0.02, 0), fov: 39 },
  { at: 1, position: new THREE.Vector3(0.04, 0, 13.18), target: new THREE.Vector3(0.02, 0, 0), fov: 36 },
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
