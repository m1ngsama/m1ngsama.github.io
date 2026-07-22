import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export class ParticleField extends THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  constructor(quality: Quality) {
    const count = quality === 'high' ? 360 : quality === 'medium' ? 220 : 110;
    const random = seededRandom(1989);
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      const radius = 3.2 + random() * 7.4;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[index * 3 + 1] = Math.cos(phi) * radius * 0.68;
      positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
      scales[index] = 0.25 + random() * 0.75;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.32 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.8) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uPixelRatio;
        attribute float aScale;
        varying float vAlpha;
        void main() {
          vec3 point = position;
          point.x += sin(point.y * 0.42 + uTime * 0.12) * 0.06;
          point.y += cos(point.x * 0.3 - uTime * 0.08) * 0.04;
          vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = clamp((1.3 + aScale * 2.2) * uPixelRatio * (7.0 / -viewPosition.z), 1.0, 5.0);
          vAlpha = 0.3 + aScale * 0.7;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
          float alpha = smoothstep(0.5, 0.06, distanceToCenter) * vAlpha * uOpacity;
          gl_FragColor = vec4(0.56, 0.67, 0.94, alpha);
        }
      `,
    });

    super(geometry, material);
    this.frustumCulled = false;
  }

  update(time: number, opacity: number): void {
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uOpacity!.value = opacity;
    this.rotation.y = -time * 0.008;
    this.rotation.z = Math.sin(time * 0.06) * 0.025;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
