import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initMotion(reducedMotion: boolean): () => void {
  const header = document.querySelector<HTMLElement>('#site-header');
  const progress = document.querySelector<HTMLElement>('#scroll-progress');
  const cleanups: Array<() => void> = [];

  const updatePageState = () => {
    const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const value = Math.min(Math.max(window.scrollY / max, 0), 1);
    progress?.style.setProperty('transform', `scaleX(${value})`);
    header?.classList.toggle('site-header--scrolled', window.scrollY > 24);
  };

  updatePageState();
  window.addEventListener('scroll', updatePageState, { passive: true });
  window.addEventListener('resize', updatePageState, { passive: true });
  cleanups.push(() => {
    window.removeEventListener('scroll', updatePageState);
    window.removeEventListener('resize', updatePageState);
  });

  if (reducedMotion) {
    document.querySelectorAll<HTMLElement>('[data-reveal], [data-intro]').forEach((element) => {
      element.style.opacity = '1';
      element.style.transform = 'none';
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }

  const lenis = new Lenis({
    duration: 1.05,
    smoothWheel: true,
    syncTouch: false,
    wheelMultiplier: 0.9,
  });

  const lenisFrame = (time: number) => lenis.raf(time * 1000);
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(lenisFrame);
  gsap.ticker.lagSmoothing(0);

  const intro = gsap.from('[data-intro]', {
    y: 18,
    autoAlpha: 0,
    duration: 0.95,
    stagger: 0.1,
    delay: 0.12,
    ease: 'power3.out',
    clearProps: 'transform,opacity,visibility',
  });

  const reveals = gsap.utils.toArray<HTMLElement>('[data-reveal]').map((element) =>
    gsap.from(element, {
      y: 28,
      autoAlpha: 0,
      duration: 1,
      ease: 'power3.out',
      clearProps: 'transform,opacity,visibility',
      scrollTrigger: {
        trigger: element,
        start: 'top 88%',
        once: true,
      },
    }),
  );

  const heroFade = gsap.to('.hero__content', {
    yPercent: -8,
    opacity: 0.22,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom 38%',
      scrub: true,
    },
  });

  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
    const onClick = (event: MouseEvent) => {
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector<HTMLElement>(id);
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, { offset: id === '#top' ? 0 : -56, duration: 1.05 });
      history.replaceState(null, '', id);
    };
    anchor.addEventListener('click', onClick);
    cleanups.push(() => anchor.removeEventListener('click', onClick));
  });

  ScrollTrigger.refresh();

  return () => {
    intro.kill();
    heroFade.kill();
    reveals.forEach((animation) => animation.kill());
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    gsap.ticker.remove(lenisFrame);
    lenis.destroy();
    cleanups.forEach((cleanup) => cleanup());
  };
}
