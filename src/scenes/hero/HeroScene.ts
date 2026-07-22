import * as THREE from 'three';

export class HeroScene {
  scene: THREE.Scene;
  core: THREE.Mesh;
  rings: THREE.Mesh[] = [];

  constructor() {
    this.scene = new THREE.Scene();

    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.25, 5),
      new THREE.MeshPhysicalMaterial({
        color: 0x111318,
        metalness: 0.35,
        roughness: 0.08,
        transmission: 0.85,
        thickness: 1.8,
        clearcoat: 1
      })
    );

    this.scene.add(this.core);

    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2 + i * .35, .008, 32, 256),
        new THREE.MeshBasicMaterial({
          color: 0x8ba9ff,
          transparent: true,
          opacity: .18 - i * .03
        })
      );
      ring.rotation.x = Math.PI / 2 + i * .2;
      this.rings.push(ring);
      this.scene.add(ring);
    }
  }

  update(time:number) {
    this.core.rotation.y = time * .00015;
    this.core.rotation.x = Math.sin(time * .0003) * .15;
    this.rings.forEach((r,i)=>{
      r.rotation.z = time * (.0001 + i*.00005);
    });
  }
}
