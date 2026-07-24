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

    float smoother(float edge0, float edge1, float value) {
      float x = clamp((value - edge0) / max(edge1 - edge0, 0.0001), 0.0, 1.0);
      return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      float screenRadius = length(p);
      float screenAngle = atan(p.y, p.x);

      // A thin projected disk. Inner material rotates faster than the outer
      // edge, while two decorrelated fields break the flow into hot filaments.
      vec2 diskPoint = vec2(p.x, p.y / 0.205);
      float diskRadius = length(diskPoint);
      float diskAngle = atan(diskPoint.y, diskPoint.x);
      float kepler = uTime * mix(0.34, 0.035, smoother(0.36, 0.96, diskRadius));
      vec2 flow = vec2(
        diskAngle * 1.75 - kepler,
        log(max(diskRadius, 0.025)) * 9.4 + uTime * 0.018
      );
      vec2 warp = vec2(
        fbm(flow * 0.72 + vec2(-uTime * 0.027, 3.7)),
        fbm(flow * 0.72 + vec2(8.9, uTime * 0.019))
      ) - 0.5;
      float turbulence = fbm(flow * 1.18 + warp * 2.7);
      float fineFlow = fbm(flow * 2.52 - warp * 3.1);
      float diskWindow = smoother(0.43, 0.485, diskRadius)
        * (1.0 - smoother(0.91, 1.0, diskRadius));
      float brokenFlow = smoother(0.29, 0.76, turbulence * 0.7 + fineFlow * 0.43);
      float radialFilaments = 0.57 + 0.43 * sin(diskRadius * 142.0 + turbulence * 13.0);
      float diskDensity = diskWindow * brokenFlow * mix(0.58, 1.0, radialFilaments);

      // The back side of the disk is bent above and below the shadow. These
      // arcs occupy only the polar zones instead of becoming a decorative
      // full circle.
      float photonRadius = 0.438;
      float polarWeight = smoother(0.08, 0.78, abs(p.y) / max(screenRadius, 0.001));
      float rearPrimary = exp(-abs(screenRadius - 0.505) * 82.0) * polarWeight;
      float rearSecondary = exp(-abs(screenRadius - 0.468) * 155.0) * polarWeight * 0.42;
      float azimuthBreak = 0.54 + 0.46 * smoother(
        0.18,
        0.82,
        fbm(vec2(screenAngle * 3.1 - uTime * 0.026, screenRadius * 22.0))
      );
      float lensedRear = (rearPrimary + rearSecondary) * azimuthBreak;

      // The apparent photon ring is narrow, incomplete and relativistically
      // asymmetric. A second subring is intentionally near the resolution
      // limit rather than a broad neon outline.
      float approaching = smoother(-0.82, 0.96, p.x / max(screenRadius, 0.001));
      float beaming = mix(0.16, 1.0, approaching * approaching);
      float photonRing = exp(-abs(screenRadius - photonRadius) * 215.0);
      float photonSubring = exp(-abs(screenRadius - photonRadius * 1.032) * 390.0) * 0.28;
      float ringBreak = smoother(
        0.28,
        0.78,
        fbm(vec2(screenAngle * 4.2 - uTime * 0.018, 9.3))
      );
      float photons = (photonRing + photonSubring) * mix(0.38, 1.0, ringBreak) * beaming;

      float gravitationalRedshift = smoother(0.43, 0.82, diskRadius);
      float heat = exp(-abs(diskRadius - 0.49) * 7.8);
      vec3 redshifted = vec3(0.5, 0.16, 0.055);
      vec3 neutral = vec3(0.72, 0.56, 0.35);
      vec3 blueshifted = vec3(0.27, 0.46, 0.88);
      vec3 diskColor = mix(redshifted, neutral, gravitationalRedshift);
      diskColor = mix(diskColor, blueshifted, approaching * approaching * 0.68);
      diskColor *= 0.17 + fineFlow * 0.52 + heat * 0.42;

      vec3 lensColor = mix(vec3(0.5, 0.24, 0.1), vec3(0.34, 0.52, 0.96), approaching * 0.72);
      float pulseBand = exp(-abs(screenRadius - fract(uTime * 0.12) * 0.42 - 0.45) * 95.0)
        * uPulse;
      float alpha = diskDensity * (0.075 + heat * 0.19 + beaming * 0.15);
      alpha += lensedRear * (0.055 + beaming * 0.12);
      alpha += photons * 0.22;
      alpha += pulseBand * photons * 0.08;
      alpha *= uPresence;

      vec3 color = diskColor * diskDensity;
      color += lensColor * lensedRear * (0.18 + beaming * 0.28);
      color += lensColor * photons * (0.34 + beaming * 0.5);
      color += vec3(0.24, 0.36, 0.78) * pulseBand * photons * 0.14;
      if (alpha < 0.004) discard;

      gl_FragColor = vec4(max(color, 0.0), alpha);
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

    super(new THREE.PlaneGeometry(7.2, 7.2), material);
    material.forceSinglePass = true;
    this.name = 'Relativistic Accretion Flow';
    this.position.z = -0.24;
    this.renderOrder = 1;
    this.frustumCulled = false;
  }

  update(time: number, presence: number, pulse: number): void {
    this.visible = presence > 0.003;
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uPresence!.value = presence;
    this.material.uniforms.uPulse!.value = pulse;
    this.scale.setScalar(0.96 + presence * 0.04 + Math.sin(time * 0.17) * 0.002);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
