import * as THREE from 'three';
import type { Quality } from '../../engine/renderer';
import { AccretionDisk } from './AccretionDisk';
import { Backdrop } from './Backdrop';
import { CosmicSurface } from './CosmicSurface';
import { Galaxy } from './Galaxy';
import { OrbitalSystem } from './OrbitalSystem';
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
  private readonly orbits: OrbitalSystem;
  private readonly matter = new THREE.Group();
  private readonly eventRings = new THREE.Group();
  private readonly ringGeometries: THREE.TorusGeometry[] = [];
  private readonly ringMaterials: THREE.MeshBasicMaterial[] = [];

  constructor(private readonly quality: Quality) {
    super();
    this.name = 'One Surface Cosmology';

    this.starfield = new Starfield(quality);
    this.galaxy = new Galaxy(quality);
    this.surface = new CosmicSurface(quality);
    this.particles = new ParticleCosmos(quality);
    this.world = new WorldCore(quality);
    this.orbits = new OrbitalSystem(quality);

    this.matter.name = 'The Only Matter';
    this.matter.add(this.surface, this.world, this.particles, this.orbits);
    this.galaxy.rotation.set(0.94, 0.12, -0.32);
    this.galaxy.position.z = -0.32;

    const ringCount = quality === 'low' ? 1 : 2;
    for (let index = 0; index < ringCount; index += 1) {
      const geometry = new THREE.TorusGeometry(
        2.17 + index * 0.074,
        index === 0 ? 0.008 : 0.004,
        5,
        quality === 'high' ? 280 : 168,
      );
      const material = new THREE.MeshBasicMaterial({
        color: index === 0 ? 0xb9c8ff : 0xf0a06b,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: true,
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.position.z = -0.03 - index * 0.028;
      this.eventRings.add(ring);
      this.ringGeometries.push(geometry);
      this.ringMaterials.push(material);
    }

    this.eventRings.renderOrder = 5;
    this.add(
      this.backdrop,
      this.starfield,
      this.galaxy,
      this.accretion,
      this.matter,
      this.eventRings,
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
    this.galaxy.rotation.x = THREE.MathUtils.lerp(0.96, 0.11, frame.horizon);
    this.galaxy.rotation.y = THREE.MathUtils.lerp(0.12, -0.06, frame.horizon) + pointer.x * 0.018;
    this.galaxy.rotation.z = -0.32 - time * 0.0035 + frame.horizon * 0.24;

    this.surface.update(time, progress, pointer, energy, mobile);
    this.particles.update(time, progress, pointer, energy);
    this.world.update(time, frame, pointer, energy);
    this.starfield.update(time, progress, frame, pointer, energy);
    this.galaxy.update(time, frame, pointer, energy);
    this.orbits.update(time, frame, pointer);
    this.accretion.update(time, Math.min(1, frame.galaxy * 0.24 + frame.horizon), energy);
    this.backdrop.update(time, progress, pointer, energy);

    this.ringMaterials.forEach((material, index) => {
      material.opacity = frame.horizon * (index === 0 ? 0.34 : 0.105);
    });
    this.eventRings.rotation.x = frame.horizon * 0.06;
    this.eventRings.rotation.y = pointer.x * 0.018;
    this.eventRings.rotation.z = -time * 0.006;
    const eventScale = mobile ? 0.82 : 1;
    this.eventRings.scale.setScalar(
      eventScale * (1 + Math.sin(time * 0.42) * 0.004 * frame.horizon + energy * 0.012),
    );
  }

  dispose(): void {
    this.surface.dispose();
    this.particles.dispose();
    this.world.dispose();
    this.starfield.dispose();
    this.galaxy.dispose();
    this.orbits.dispose();
    this.accretion.dispose();
    this.backdrop.dispose();
    this.ringGeometries.forEach((geometry) => geometry.dispose());
    this.ringMaterials.forEach((material) => material.dispose());
  }
}
