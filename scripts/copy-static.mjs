// Copies HTML and CSS files from src/renderer to dist/renderer (tsc only handles .ts).
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const from = 'src/renderer';
const to = 'dist/web/renderer';
mkdirSync(to, { recursive: true });
for (const file of readdirSync(from)) {
  if (file.endsWith('.html') || file.endsWith('.css')) cpSync(join(from, file), join(to, file));
}
