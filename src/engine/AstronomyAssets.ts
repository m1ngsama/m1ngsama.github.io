import * as THREE from 'three';
import type { Quality } from './renderer';

const ASSET_URLS = {
  deepStarMap: new URL('../assets/astronomy/nasa-deep-star-map-2k.webp', import.meta.url).href,
  wiseAllSky: new URL('../assets/astronomy/nasa-wise-all-sky-2k.webp', import.meta.url).href,
  lunarColor: new URL('../assets/astronomy/nasa-lroc-color-2k.webp', import.meta.url).href,
  lunarHeight: new URL('../assets/astronomy/nasa-lola-height-1k.jpg', import.meta.url).href,
} as const;

type AssetKey = keyof typeof ASSET_URLS;

function fallbackTexture(
  value: number,
  colorSpace: THREE.ColorSpace,
  anisotropy: number,
): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = `rgb(${value}, ${value}, ${value})`;
    context.fillRect(0, 0, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  return texture;
}

export class AstronomyAssets {
  readonly deepStarMap: THREE.Texture;
  readonly wiseAllSky: THREE.Texture;
  readonly lunarColor: THREE.Texture;
  readonly lunarHeight: THREE.Texture;
  readonly settled: Promise<void>;
  readonly ready: Record<AssetKey, boolean> = {
    deepStarMap: false,
    wiseAllSky: false,
    lunarColor: false,
    lunarHeight: false,
  };

  private destroyed = false;

  constructor(renderer: THREE.WebGLRenderer, quality: Quality) {
    const maximum = renderer.capabilities.getMaxAnisotropy();
    const target = quality === 'high' ? 8 : quality === 'medium' ? 4 : 2;
    const anisotropy = Math.max(1, Math.min(maximum, target));

    this.deepStarMap = fallbackTexture(0, THREE.SRGBColorSpace, anisotropy);
    this.wiseAllSky = fallbackTexture(0, THREE.SRGBColorSpace, anisotropy);
    this.lunarColor = fallbackTexture(7, THREE.SRGBColorSpace, anisotropy);
    this.lunarHeight = fallbackTexture(128, THREE.NoColorSpace, anisotropy);

    const requests = (Object.keys(ASSET_URLS) as AssetKey[]).map((key) => this.load(key));
    this.settled = Promise.allSettled(requests).then(() => undefined);
  }

  get skyReady(): number {
    return this.ready.deepStarMap ? 1 : 0;
  }

  get dustReady(): number {
    return this.ready.wiseAllSky ? 1 : 0;
  }

  get lunarReady(): number {
    return this.ready.lunarColor && this.ready.lunarHeight ? 1 : 0;
  }

  private load(key: AssetKey): Promise<void> {
    const texture = this[key] as THREE.Texture;
    return new Promise((resolve, reject) => {
      new THREE.ImageLoader().load(
        ASSET_URLS[key],
        (image) => {
          if (this.destroyed) {
            resolve();
            return;
          }
          texture.dispose();
          texture.image = image;
          texture.needsUpdate = true;
          this.ready[key] = true;
          resolve();
        },
        undefined,
        (error) => reject(error),
      );
    });
  }

  dispose(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.deepStarMap.dispose();
    this.wiseAllSky.dispose();
    this.lunarColor.dispose();
    this.lunarHeight.dispose();
  }
}
