import * as THREE from 'three';

export class Backdrop extends THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  constructor() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uPulse: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
        uAspect: { value: window.innerWidth / Math.max(window.innerHeight, 1) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 1.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uProgress;
        uniform float uPulse;
        uniform vec2 uPointer;
        uniform float uAspect;
        varying vec2 vUv;

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
            p = p * 2.04 + vec2(7.3, 3.1);
            amplitude *= 0.5;
          }
          return value;
        }

        float smoother(float a, float b, float value) {
          float x = clamp((value - a) / (b - a), 0.0, 1.0);
          return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
        }

        mat2 rotate2d(float angle) {
          float c = cos(angle);
          float s = sin(angle);
          return mat2(c, -s, s, c);
        }

        void main() {
          vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
          p -= uPointer * vec2(0.012, 0.008);
          float radius = length(p);
          float world = smoother(0.12, 0.3, uProgress) * (1.0 - smoother(0.42, 0.54, uProgress));
          float galaxy = smoother(0.54, 0.72, uProgress) * (1.0 - smoother(0.86, 0.98, uProgress));
          float horizon = smoother(0.85, 0.98, uProgress);

          vec2 warp = vec2(
            fbm(p * 2.15 + vec2(uTime * 0.009, -uTime * 0.006)),
            fbm(p * 2.15 + vec2(13.7, 4.2) - vec2(uTime * 0.006, uTime * 0.008))
          ) - 0.5;
          float field = fbm(p * 5.25 + warp * 1.35);
          float ridged = pow(1.0 - abs(field * 2.0 - 1.0), 8.5);
          float cosmicWeb = ridged * smoother(0.28, 0.56, uProgress) * (1.0 - horizon);

          vec2 galaxyP = rotate2d(-0.24) * p;
          float ellipse = length(galaxyP * vec2(0.52, 2.65));
          float galaxyHaze = exp(-ellipse * 2.4) * (0.4 + fbm(galaxyP * 5.0 + warp) * 0.6) * galaxy;
          float dustLane = exp(-abs(galaxyP.y + sin(galaxyP.x * 5.2) * 0.018) * 38.0) * galaxy;

          float halo = exp(-radius * mix(5.2, 3.8, world));
          float lensRadius = mix(0.17, 0.235, horizon);
          float photonRing = exp(-abs(radius - lensRadius) * mix(105.0, 175.0, horizon)) * horizon;
          float echoRing = exp(-abs(radius - lensRadius * 1.035) * 42.0) * horizon * 0.2;
          float horizonShadow = 1.0 - smoothstep(lensRadius * 0.72, lensRadius * 0.98, radius);
          float pulseRing = exp(-abs(radius - fract(uTime * 0.18) * 0.65) * 75.0) * uPulse;

          vec3 color = vec3(0.0007, 0.0009, 0.0022);
          color += vec3(0.009, 0.014, 0.038) * halo;
          color += vec3(0.011, 0.021, 0.062) * cosmicWeb * (0.24 + galaxy * 0.62);
          color += vec3(0.035, 0.06, 0.16) * galaxyHaze;
          color -= vec3(0.018, 0.022, 0.038) * dustLane * 0.7;
          color += vec3(0.24, 0.38, 0.95) * photonRing * 0.23;
          color += vec3(0.08, 0.12, 0.32) * echoRing;
          color += vec3(0.08, 0.18, 0.52) * pulseRing * 0.24;
          color *= 1.0 - horizonShadow * horizon;
          gl_FragColor = vec4(max(color, 0.0), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      depthWrite: false,
      depthTest: false,
      toneMapped: true,
    });

    super(new THREE.PlaneGeometry(2, 2), material);
    this.name = 'The Observable Dark';
    this.renderOrder = -100;
    this.frustumCulled = false;
  }

  update(time: number, progress: number, pointer: THREE.Vector2, pulse: number): void {
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uProgress!.value = progress;
    this.material.uniforms.uPulse!.value = pulse;
    this.material.uniforms.uAspect!.value = window.innerWidth / Math.max(window.innerHeight, 1);
    (this.material.uniforms.uPointer!.value as THREE.Vector2).copy(pointer);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
