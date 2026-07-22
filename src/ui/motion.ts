export function initMotion(reducedMotion: boolean): () => void {
  const root = document.documentElement;
  const cleanups: Array<() => void> = [];
  let frame = 0;

  const update = () => {
    frame = 0;
    const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const value = Math.min(Math.max(window.scrollY / max, 0), 1);
    root.classList.toggle('has-scrolled', value > 0.018);
  };

  const scheduleUpdate = () => {
    if (frame) return;
    frame = requestAnimationFrame(update);
  };

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  cleanups.push(() => {
    window.removeEventListener('scroll', scheduleUpdate);
    window.removeEventListener('resize', scheduleUpdate);
    cancelAnimationFrame(frame);
  });

  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
    const onClick = (event: MouseEvent) => {
      const selector = anchor.getAttribute('href');
      if (!selector || selector === '#') return;
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', selector);
    };
    anchor.addEventListener('click', onClick);
    cleanups.push(() => anchor.removeEventListener('click', onClick));
  });

  if (window.matchMedia('(pointer: fine)').matches && !reducedMotion) {
    const movePointer = (event: PointerEvent) => {
      root.style.setProperty('--pointer-x', `${event.clientX}px`);
      root.style.setProperty('--pointer-y', `${event.clientY}px`);
      root.classList.add('pointer-visible');
    };
    const pressPointer = () => root.classList.add('pointer-active');
    const releasePointer = () => root.classList.remove('pointer-active');
    const hidePointer = () => root.classList.remove('pointer-visible', 'pointer-active');

    window.addEventListener('pointermove', movePointer, { passive: true });
    window.addEventListener('pointerdown', pressPointer, { passive: true });
    window.addEventListener('pointerup', releasePointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', hidePointer);
    cleanups.push(() => {
      window.removeEventListener('pointermove', movePointer);
      window.removeEventListener('pointerdown', pressPointer);
      window.removeEventListener('pointerup', releasePointer);
      document.documentElement.removeEventListener('pointerleave', hidePointer);
    });
  }

  update();
  requestAnimationFrame(() => root.classList.add('is-loaded'));

  return () => cleanups.forEach((cleanup) => cleanup());
}
