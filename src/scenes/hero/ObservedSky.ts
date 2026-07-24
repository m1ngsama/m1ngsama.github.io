import * as THREE from 'three';
import type { AstronomyAssets } from '../../engine/AstronomyAssets';
import type { Quality } from '../../engine/renderer';
import type { SequenceFrame } from './sequence';

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    mat4 rotationOnlyView = mat4(mat3(viewMatrix));
    vec4 clipPosition = projectionMatrix * rotationOnlyView * modelMatrix * vec4(position, 1.0);
    gl_Position = clipPosition.xyww;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uDeepStarMap;
  uniform sampler2D uWiseAllSky;
  uniform float uSkyReady;
  uniform float uDustReady;
  uniform float uPresence;
  uniform float uGalaxy;
  uniform float uHorizon;
  varying vec2 vUv;

  float observedLuminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  void main() {
    vec2 uv = vec2(fract(vUv.x + 0.047), clamp(vUv.y, 0.001, 0.999));
    vec3 observedStars = texture2D(uDeepStarMap, uv).rgb;
    vec3 observedDust = texture2D(uWiseAllSky, uv).rgb;

    float starSignal = max(observedLuminance(observedStars) - 0.004, 0.0);
    starSignal = pow(starSignal, 0.82);
    vec3 starColor = observedStars * mix(0.24, 0.5, smoothstep(0.03, 0.7, starSignal));
    starColor += vec3(starSignal) * 0.025;

    float infrared = smoothstep(0.055, 0.58, observedLuminance(observedDust));
    vec3 dustColor = mix(vec3(0.17, 0.1, 0.075), vec3(0.11, 0.17, 0.28), observedDust.b);
    dustColor *= infrared * (0.025 + uGalaxy * 0.035);

    float stageGain = mix(0.16, 0.28, uGalaxy);
    stageGain = mix(stageGain, 0.22, uHorizon);
    vec3 color = starColor * uSkyReady * stageGain;
    color += dustColor * uDustReady;
    color *= uPresence;

    float polarFade = smoothstep(0.0, 0.025, vUv.y)
      * (1.0 - smoothstep(0.975, 1.0, vUv.y));
    gl_FragColor = vec4(max(color, 0.0) * polarFade, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class ObservedSky extends THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  constructor(
    private readonly assets: AstronomyAssets,
    quality: Quality,
  ) {
    const widthSegments = quality === 'high' ? 64 : quality === 'medium' ? 48 : 32;
    const heightSegments = Math.floor(widthSegments / 2);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uDeepStarMap: { value: assets.deepStarMap },
        uWiseAllSky: { value: assets.wiseAllSky },
        uSkyReady: { value: 0 },
        uDustReady: { value: 0 },
        uPresence: { value: 0 },
        uGalaxy: { value: 0 },
        uHorizon: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      transparent: false,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NoBlending,
      toneMapped: true,
    });

    super(new THREE.SphereGeometry(40, widthSegments, heightSegments), material);
    this.name = 'NASA Observed Sky';
    this.renderOrder = -90;
    this.frustumCulled = false;
  }

  update(time: number, frame: SequenceFrame): void {
    this.rotation.y = 0.18 + time * 0.00065;
    this.rotation.z = -0.07;
    this.material.uniforms.uSkyReady!.value = this.assets.skyReady;
    this.material.uniforms.uDustReady!.value = this.assets.dustReady;
    this.material.uniforms.uPresence!.value = 0.72 + frame.world * 0.14 + frame.galaxy * 0.22;
    this.material.uniforms.uGalaxy!.value = frame.galaxy;
    this.material.uniforms.uHorizon!.value = frame.horizon;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
