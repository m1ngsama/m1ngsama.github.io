import * as THREE from 'three';

export class Backdrop extends THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  constructor() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uPointer: { value: new THREE.Vector2() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uProgress;
        uniform vec2 uPointer;
        varying vec2 vUv;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        void main() {
          vec2 p = (vUv - 0.5) * vec2(1.72, 1.0);
          p -= uPointer * 0.035;
          float distanceToCenter = length(p);
          float halo = exp(-distanceToCenter * mix(4.8, 3.5, uProgress));
          float horizon = smoothstep(0.75, 0.96, uProgress);
          float ringRadius = mix(0.28, 0.36, horizon);
          float ring = exp(-abs(distanceToCenter - ringRadius) * 90.0) * horizon;
          float wash = exp(-abs(p.y + 0.18 + sin(p.x * 3.0 + uTime * 0.05) * 0.025) * 12.0);
          float noise = hash21(gl_FragCoord.xy + floor(uTime * 6.0)) - 0.5;

          vec3 color = vec3(0.0018, 0.002, 0.004);
          color += vec3(0.011, 0.017, 0.042) * halo;
          color += vec3(0.045, 0.06, 0.14) * wash * 0.09;
          color += vec3(0.16, 0.22, 0.52) * ring * 0.12;
          color += noise * 0.0018;
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      depthWrite: false,
      depthTest: false,
      toneMapped: true,
    });

    super(new THREE.PlaneGeometry(22, 14), material);
    this.position.z = -5.5;
    this.renderOrder = -10;
    this.frustumCulled = false;
  }

  update(time: number, progress: number, pointer: THREE.Vector2): void {
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uProgress!.value = progress;
    (this.material.uniforms.uPointer!.value as THREE.Vector2).copy(pointer);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
