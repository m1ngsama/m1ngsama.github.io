import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class Composer {
  private readonly composer?: EffectComposer;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    enabled: boolean,
  ) {
    if (!enabled) return;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.15, 0.38, 0.88);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());
  }

  render(delta: number): void {
    if (this.composer) {
      this.composer.render(delta);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  setSize(width: number, height: number): void {
    this.composer?.setSize(width, height);
  }

  dispose(): void {
    this.composer?.dispose();
  }
}
