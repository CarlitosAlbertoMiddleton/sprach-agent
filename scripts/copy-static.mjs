// Copies HTML and CSS from src/renderer to dist/web/renderer (tsc only handles .ts),
// plus the browser build of the Azure Speech SDK for the session window.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const from = 'src/renderer';
const to = 'dist/web/renderer';
mkdirSync(join(to, 'vendor'), { recursive: true });
for (const file of readdirSync(from)) {
  if (file.endsWith('.html') || file.endsWith('.css')) cpSync(join(from, file), join(to, file));
}
cpSync(
  'node_modules/microsoft-cognitiveservices-speech-sdk/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js',
  join(to, 'vendor', 'speech-sdk.js'),
);
