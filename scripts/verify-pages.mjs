import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const differences = [];

async function compareDirectory(sourceDirectory, relative = '') {
  const entries = await readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const nextRelative = path.join(relative, entry.name);
    const source = path.join(sourceDirectory, entry.name);
    const published = path.join(root, nextRelative);

    if (entry.isDirectory()) {
      await compareDirectory(source, nextRelative);
      continue;
    }

    try {
      const [sourceContent, publishedContent] = await Promise.all([readFile(source), readFile(published)]);
      if (!sourceContent.equals(publishedContent)) differences.push(nextRelative);
    } catch {
      differences.push(nextRelative);
    }
  }
}

await compareDirectory(dist);

if (differences.length > 0) {
  console.error(`Published Pages artifacts are stale or missing:\n${differences.map((file) => `- ${file}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Published Pages artifacts match the production build.');
}
