import * as THREE from 'three';

export type Quality = 'high' | 'medium' | 'low';

export function getQuality(): Quality {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const pixels = window.innerWidth * window.innerHeight;

  if (coarse || window.innerWidth < 720 || cores <= 4) return 'low';
  if (window.innerWidth < 1240 || cores <= 8 || pixels > 5_500_000) return 'medium';
  return 'high';
}

export function targetPixelRatio(quality: Quality, width = window.innerWidth, height = window.innerHeight): number {
  const tierLimit = quality === 'high' ? 1.65 : quality === 'medium' ? 1.4 : 1.2;
  const pixelBudget = quality === 'high' ? 5_000_000 : quality === 'medium' ? 3_000_000 : 1_500_000;
  const budgetLimit = Math.sqrt(pixelBudget / Math.max(width * height, 1));
  return Math.max(0.75, Math.min(window.devicePixelRatio, tierLimit, budgetLimit));
}

export function createRenderer(canvas: HTMLCanvasElement, quality: Quality): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: quality === 'high',
    depth: true,
    stencil: false,
    powerPreference: quality === 'high' ? 'high-performance' : 'default',
  });

  renderer.setClearColor(0x020204, 1);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setPixelRatio(targetPixelRatio(quality));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;

  return renderer;
}
