import * as THREE from 'three';

export type Quality = 'high' | 'medium' | 'low';

export function getQuality(): Quality {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;

  if (coarse || window.innerWidth < 720 || cores <= 4) return 'low';
  if (window.innerWidth < 1280 || cores <= 8) return 'medium';
  return 'high';
}

export function maxPixelRatio(quality: Quality): number {
  if (quality === 'high') return 1.8;
  if (quality === 'medium') return 1.45;
  return 1.15;
}

export function createRenderer(canvas: HTMLCanvasElement, quality: Quality): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: quality !== 'low',
    powerPreference: quality === 'high' ? 'high-performance' : 'default',
  });

  renderer.setClearColor(0x050505, 0);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio(quality)));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  return renderer;
}
