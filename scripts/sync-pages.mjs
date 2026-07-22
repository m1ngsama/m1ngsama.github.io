import { copyFile, cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const generatedDirectory = path.join(root, 'assets');

await rm(generatedDirectory, { recursive: true, force: true });

for (const entry of await readdir(dist, { withFileTypes: true })) {
  const source = path.join(dist, entry.name);
  const destination = path.join(root, entry.name);

  if (entry.isDirectory()) {
    await mkdir(destination, { recursive: true });
    await cp(source, destination, { recursive: true });
  } else {
    await copyFile(source, destination);
  }
}

console.log('Synchronized dist/ with the main/root GitHub Pages publishing source.');
