import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';
import type { SequenceFrame } from './sequence';

const TAU = Math.PI * 2;

interface OrbitDefinition {
  radius: number;
  eccentricity: number;
  inclination: number;
  ascendingNode: number;
  periapsis: number;
  phase: number;
}

const orbitDefinitions: OrbitDefinition[] = [
  { radius: 2.34, eccentricity: 0.12, inclination: 0.18, ascendingNode: -0.48, periapsis: 0.34, phase: 0.06 },
  { radius: 2.58, eccentricity: 0.23, inclination: -0.31, ascendingNode: 0.36, periapsis: -0.72, phase: 0.29 },
  { radius: 2.84, eccentricity: 0.08, inclination: 0.52, ascendingNode: 0.92, periapsis: 0.18, phase: 0.51 },
  { radius: 3.12, eccentricity: 0.3, inclination: -0.57, ascendingNode: -0.88, periapsis: 0.93, phase: 0.73 },
  { radius: 3.42, eccentricity: 0.17, inclination: 0.71, ascendingNode: 0.14, periapsis: -0.4, phase: 0.91 },
];

function createGeometry(quality: Quality): THREE.BufferGeometry {
  const orbitCount = quality === 'low' ? 3 : 5;
  const segments = quality === 'high' ? 256 : quality === 'medium' ? 192 : 128;
  const vertexCount = orbitCount * segments * 2;
  const positions = new Float32Array(vertexCount * 3);
  const phases = new Float32Array(vertexCount);
  const orbitIndices = new Float32Array(vertexCount);
  const point = new THREE.Vector3();
  const rotation = new THREE.Euler();
  let vertex = 0;

  const writePoint = (definition: OrbitDefinition, orbitIndex: number, t: number): void => {
    const eccentricity = definition.eccentricity;
    const semiMinor = definition.radius * Math.sqrt(1 - eccentricity * eccentricity);
    const anomaly = t * TAU + definition.phase * TAU;
    point.set(
      definition.radius * (Math.cos(anomaly) - eccentricity),
      semiMinor * Math.sin(anomaly),
      Math.sin(anomaly * 3 + definition.phase * TAU) * 0.018,
    );
    point.applyAxisAngle(new THREE.Vector3(0, 0, 1), definition.periapsis);
    rotation.set(definition.inclination, definition.ascendingNode, 0, 'XYZ');
    point.applyEuler(rotation);

    const positionOffset = vertex * 3;
    positions[positionOffset] = point.x;
    positions[positionOffset + 1] = point.y;
    positions[positionOffset + 2] = point.z;
    phases[vertex] = t;
    orbitIndices[vertex] = orbitCount > 1 ? orbitIndex / (orbitCount - 1) : 0;
    vertex += 1;
  };

  for (let orbitIndex = 0; orbitIndex < orbitCount; orbitIndex += 1) {
    const definition = orbitDefinitions[orbitIndex]!;
    for (let segment = 0; segment < segments; segment += 1) {
      writePoint(definition, orbitIndex, segment / segments);
      writePoint(definition, orbitIndex, (segment + 1) / segments);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aOrbit', new THREE.BufferAttribute(orbitIndices, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4.2);
  return geometry;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPresence;
  uniform float uWorld;
  uniform float uOrbitStage;
  uniform vec2 uPointer;
  attribute float aPhase;
  attribute float aOrbit;
  varying float vAlpha;
  varying float vPhase;
  varying float vOrbit;

  const float TAU = 6.283185307179586;

  void main() {
    vec3 transformed = position;
    float breathing = sin(aPhase * TAU * 3.0 + uTime * 0.22 + aOrbit * 5.7);
    transformed += normalize(position + vec3(0.001)) * breathing * (0.003 + uOrbitStage * 0.009);
    transformed.xy += uPointer * (0.008 + aOrbit * 0.006) * uPresence;

    vPhase = aPhase;
    vOrbit = aOrbit;
    float hierarchy = mix(0.72, 1.0, 1.0 - aOrbit * 0.5);
    vAlpha = uPresence * hierarchy * (0.72 + uWorld * 0.18);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uWorld;
  uniform float uOrbitStage;
  varying float vAlpha;
  varying float vPhase;
  varying float vOrbit;

  float circularDistance(float a, float b) {
    return abs(fract(a - b + 0.5) - 0.5);
  }

  void main() {
    float traveller = fract(uTime * mix(0.018, 0.034, vOrbit) + vOrbit * 0.217);
    float signal = exp(-pow(circularDistance(vPhase, traveller) / 0.024, 2.0));
    float counterSignal = exp(-pow(circularDistance(vPhase, fract(1.0 - traveller * 0.62)) / 0.014, 2.0));
    float cadence = 0.74 + 0.26 * sin(vPhase * 56.0 + vOrbit * 9.0 + uTime * 0.12);
    vec3 cold = mix(vec3(0.14, 0.28, 0.76), vec3(0.44, 0.62, 1.24), 1.0 - vOrbit);
    vec3 warm = vec3(1.05, 0.58, 0.3);
    vec3 color = mix(cold, warm, signal * (0.08 + uOrbitStage * 0.12));
    color *= 0.3 + signal * 1.28 + counterSignal * 0.52 + uWorld * 0.06;
    float alpha = vAlpha * cadence * (0.15 + signal * 0.62 + counterSignal * 0.2);
    if (alpha < 0.006) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class OrbitalSystem extends THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial> {
  constructor(quality: Quality) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPresence: { value: 0 },
        uWorld: { value: 0 },
        uOrbitStage: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    });

    super(createGeometry(quality), material);
    this.name = 'Shared Gravitational Orbits';
    this.renderOrder = 3;
    this.frustumCulled = false;
    this.visible = false;
  }

  update(time: number, frame: SequenceFrame, pointer: THREE.Vector2): void {
    const arrival = THREE.MathUtils.clamp(frame.world * 0.58 + frame.orbit, 0, 1);
    const departure = 1 - THREE.MathUtils.clamp(frame.galaxy * 0.92 + frame.horizon, 0, 1);
    const presence = arrival * departure;
    this.visible = presence > 0.004;
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uPresence!.value = presence;
    this.material.uniforms.uWorld!.value = frame.world;
    this.material.uniforms.uOrbitStage!.value = frame.orbit;
    (this.material.uniforms.uPointer!.value as THREE.Vector2).copy(pointer);

    this.rotation.x = -0.08 + frame.orbit * 0.14 + pointer.y * 0.012;
    this.rotation.y = time * 0.008 + frame.orbit * 0.12 + pointer.x * 0.018;
    this.rotation.z = -0.025 - time * 0.0035;
    this.scale.setScalar(0.94 + frame.world * 0.025 + frame.orbit * 0.045);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
