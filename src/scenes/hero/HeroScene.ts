import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';
import { AccretionDisk } from './AccretionDisk';
import { Backdrop } from './Backdrop';
import { CosmicSurface } from './CosmicSurface';
import { Galaxy } from './Galaxy';
import { ParticleCosmos } from './ParticleCosmos';
import { sampleSequence } from './sequence';
import { Starfield } from './Starfield';
import { WorldCore } from './WorldCore';

export class HeroScene extends THREE.Group {
  private readonly backdrop = new Backdrop();
  private readonly starfield: Starfield;
  private readonly galaxy: Galaxy;
  private readonly surface: CosmicSurface;
  private readonly particles: ParticleCosmos;
  private readonly world: WorldCore;
  private readonly accretion = new AccretionDisk();
  private readonly matter = new THREE.Group();

  constructor(private readonly quality: Quality) {
    super();
    this.name = 'One Surface Cosmology';

    this.starfield = new Starfield(quality);
    this.galaxy = new Galaxy(quality);
    this.surface = new CosmicSurface(quality);
    this.particles = new ParticleCosmos(quality);
    this.world = new WorldCore(quality);

    this.matter.name = 'The Only Matter';
    this.matter.add(this.surface, this.world, this.particles);
    this.galaxy.rotation.set(0.94, 0.12, -0.32);
    this.galaxy.position.z = -0.32;

    this.add(
      this.backdrop,
      this.starfield,
      this.galaxy,
      this.accretion,
      this.matter,
    );
  }

  update(
    time: number,
    delta: number,
    pointer: THREE.Vector2,
    progress: number,
    mobile: boolean,
    pulse: number,
    scrollVelocity = 0,
  ): void {
    const frame = sampleSequence(progress, mobile);
    const energy = THREE.MathUtils.clamp(pulse + Math.abs(scrollVelocity) * 0.045, 0, 1);
    const damping = delta === 0 ? 1 : 1 - Math.exp(-delta * 3.25);
    const velocityLean = THREE.MathUtils.clamp(scrollVelocity * 0.006, -0.08, 0.08);
    const mobileScale = mobile ? 0.82 : 1;
    const targetScale = THREE.MathUtils.lerp(1, mobileScale, 1 - frame.veil);

    this.matter.scale.setScalar(THREE.MathUtils.lerp(this.matter.scale.x, targetScale, damping));
    this.matter.rotation.x = THREE.MathUtils.lerp(
      this.matter.rotation.x,
      frame.orbit * 0.46 + frame.galaxy * 0.31 + frame.horizon * 0.035 + pointer.y * 0.026,
      damping,
    );
    this.matter.rotation.y = THREE.MathUtils.lerp(
      this.matter.rotation.y,
      frame.world * 0.16 + frame.orbit * 0.62 + frame.galaxy * 0.18 + frame.horizon * 0.025 + pointer.x * 0.04,
      damping,
    );
    this.matter.rotation.z = THREE.MathUtils.lerp(
      this.matter.rotation.z,
      0.045 + frame.orbit * 0.18 + frame.galaxy * (0.24 + time * 0.006) - frame.horizon * 0.2 + velocityLean,
      damping,
    );

    const galaxyScale = THREE.MathUtils.lerp(mobile ? 0.49 : 0.53, mobile ? 0.61 : 0.71, frame.horizon);
    this.galaxy.scale.setScalar(galaxyScale);
    this.galaxy.rotation.x = THREE.MathUtils.lerp(0.96, 0.035, frame.horizon);
    this.galaxy.rotation.y = THREE.MathUtils.lerp(0.12, 0.025, frame.horizon) + pointer.x * 0.018;
    this.galaxy.rotation.z = THREE.MathUtils.lerp(
      -0.32 - time * 0.0035,
      -0.155 - time * 0.006,
      frame.horizon,
    );

    this.surface.update(time, progress, pointer, energy, mobile);
    this.particles.update(time, progress, pointer, energy);
    this.world.update(time, frame, pointer, energy);
    this.starfield.update(time, progress, frame, pointer, energy);
    this.galaxy.update(time, frame, pointer, energy);
    this.accretion.update(time, frame.horizon, energy);
    this.backdrop.update(time, progress, pointer, energy);
  }

  setPixelRatio(value: number): void {
    this.starfield.setPixelRatio(value);
    this.galaxy.setPixelRatio(value);
    this.particles.setPixelRatio(value);
  }

  dispose(): void {
    this.surface.dispose();
    this.particles.dispose();
    this.world.dispose();
    this.starfield.dispose();
    this.galaxy.dispose();
    this.accretion.dispose();
    this.backdrop.dispose();
  }
}
