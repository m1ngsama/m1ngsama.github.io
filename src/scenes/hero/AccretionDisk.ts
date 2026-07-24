import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function fragmentShader(quality: Quality): string {
  const octaves = quality === 'high' ? 5 : quality === 'medium' ? 4 : 3;
  return /* glsl */ `
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
    for (int i = 0; i < ${octaves}; i++) {
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
    float kepler = uTime * mix(0.18, 0.028, smoothstep(0.22, 0.92, radius));
    vec2 circular = vec2(cos(angle - kepler), sin(angle - kepler));
    vec2 tangent = vec2(-circular.y, circular.x);
    vec2 flow = circular * (4.1 + radius * 8.6)
      + tangent * (radius * 4.2)
      + vec2(log(max(radius, 0.03)) * 3.4, radius * 5.0);
    vec2 warp = vec2(
      fbm(flow * 0.54 + vec2(-uTime * 0.034, uTime * 0.012)),
      fbm(flow * 0.54 + vec2(8.7, 3.1) + vec2(uTime * 0.015, -uTime * 0.022))
    ) - 0.5;
    float turbulence = fbm(flow + warp * 3.4);
    float filaments = fbm(flow * 2.08 + circular * turbulence * 3.0 - vec2(uTime * 0.065, 0.0));
    float inner = smoothstep(0.33, 0.405, radius);
    float outer = 1.0 - smoothstep(0.88, 1.0, radius);
    float innerHeat = exp(-abs(radius - 0.43) * 12.5);
    float density = smoothstep(0.31, 0.79, turbulence * 0.68 + filaments * 0.46);
    float radialWave = sin(radius * 108.0 + turbulence * 11.0 + warp.x * 5.0);
    float antialiasWidth = max(fwidth(radius) * 108.0, 0.065);
    float lanes = smoothstep(-antialiasWidth, antialiasWidth, radialWave) * 0.44 + 0.56;
    float losVelocity = p.x / max(radius, 0.001);
    float approaching = smoothstep(-0.72, 0.92, losVelocity);
    float doppler = mix(0.2, 1.0, approaching * approaching);
    float gravitationalRedshift = smoothstep(0.31, 0.68, radius);
    float pulseBand = exp(-pow((radius - fract(uTime * 0.28) * 0.62 - 0.34) / 0.035, 2.0)) * uPulse;
    float brokenArc = smoothstep(0.27, 0.74, fbm(flow * 0.72 + warp * 2.0));
    float alpha = inner * outer * density * brokenArc
      * (0.055 + lanes * 0.17 + innerHeat * 0.12)
      * uPresence;
    alpha *= 0.54 + doppler * 0.62;
    alpha += pulseBand * inner * outer * brokenArc * uPresence * 0.055;

    vec3 redshifted = vec3(0.34, 0.16, 0.09);
    vec3 neutral = vec3(0.46, 0.42, 0.38);
    vec3 blueshifted = vec3(0.23, 0.38, 0.78);
    vec3 color = mix(redshifted, neutral, gravitationalRedshift);
    color = mix(color, blueshifted, approaching * approaching * 0.72);
    color *= (0.12 + filaments * 0.54 + innerHeat * 0.42 + pulseBand * 0.28) * doppler;
    if (alpha < 0.006) discard;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
}

export class AccretionDisk extends THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  constructor(quality: Quality) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPresence: { value: 0 },
        uPulse: { value: 0 },
      },
      vertexShader,
      fragmentShader: fragmentShader(quality),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    });

    super(new THREE.PlaneGeometry(8.9, 8.9), material);
    material.forceSinglePass = true;
    this.name = 'Accretion Memory';
    this.position.z = -0.3;
    this.rotation.x = 1.36;
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
