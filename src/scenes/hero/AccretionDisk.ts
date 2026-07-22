import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uPresence;
  uniform float uPulse;
  varying vec2 vUv;

  const float TAU = 6.283185307179586;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += noise2(p) * amplitude;
      p = p * 2.03 + vec2(7.1, 3.7);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float radius = length(p);
    float angle = atan(p.y, p.x);
    float rotation = uTime * mix(0.018, 0.11, smoothstep(0.2, 0.9, radius));
    vec2 circular = vec2(cos(angle - rotation), sin(angle - rotation));
    vec2 flow = circular * (3.2 + radius * 6.8) + vec2(radius * 8.0, -radius * 6.0);
    float turbulence = fbm(flow + vec2(-uTime * 0.055, uTime * 0.024));
    float filaments = fbm(flow * 2.15 + circular * turbulence * 3.2 - vec2(uTime * 0.08, 0.0));
    float inner = smoothstep(0.31, 0.43, radius);
    float outer = 1.0 - smoothstep(0.9, 1.0, radius);
    float density = smoothstep(0.28, 0.82, turbulence * 0.72 + filaments * 0.42);
    float lanes = 0.62 + 0.38 * sin(radius * 92.0 + turbulence * 8.0);
    float leading = smoothstep(-0.8, 0.9, p.x / max(radius, 0.001));
    float pulseBand = exp(-pow((radius - fract(uTime * 0.28) * 0.62 - 0.34) / 0.035, 2.0)) * uPulse;
    float alpha = inner * outer * density * (0.09 + lanes * 0.14) * uPresence;
    alpha += pulseBand * inner * outer * uPresence * 0.11;

    vec3 cold = mix(vec3(0.055, 0.085, 0.19), vec3(0.42, 0.57, 1.08), leading);
    vec3 warm = vec3(0.96, 0.72, 0.48);
    vec3 color = mix(cold, warm, leading * leading * 0.13);
    color *= 0.2 + filaments * 0.48 + pulseBand * 0.8;
    if (alpha < 0.006) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class AccretionDisk extends THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  constructor() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPresence: { value: 0 },
        uPulse: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    });

    super(new THREE.PlaneGeometry(8.9, 8.9), material);
    this.name = 'Accretion Memory';
    this.position.z = -0.3;
    this.rotation.x = 1.48;
    this.rotation.z = -0.24;
    this.renderOrder = 1;
    this.frustumCulled = false;
  }

  update(time: number, presence: number, pulse: number): void {
    this.visible = presence > 0.003;
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uPresence!.value = presence;
    this.material.uniforms.uPulse!.value = pulse;
    this.rotation.z = -0.24 - time * 0.006;
    this.scale.setScalar(0.92 + presence * 0.08 + Math.sin(time * 0.21) * 0.004);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
