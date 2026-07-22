import { Application } from './engine/Application';
import { HeroScene } from './scenes/hero/HeroScene';
import Lenis from 'lenis';

const lenis = new Lenis({ smoothWheel: true });
function scrollFrame(time: number) {
  lenis.raf(time);
  requestAnimationFrame(scrollFrame);
}
requestAnimationFrame(scrollFrame);

const app = new Application({
  container: document.body,
});

const hero = new HeroScene();
app.add(hero);
app.start();
