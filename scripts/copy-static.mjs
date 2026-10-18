// Copies what tsc does not handle: HTML and CSS, the browser build of the Azure
// Speech SDK, and the icon. dist/web/renderer is the Electron app's windows,
// dist/site the browser version.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SDK = 'node_modules/microsoft-cognitiveservices-speech-sdk/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js';

function copyStatic(from, to) {
  for (const file of readdirSync(from)) {
    if (file.endsWith('.html') || file.endsWith('.css')) cpSync(join(from, file), join(to, file));
  }
}

const renderer = 'dist/web/renderer';
mkdirSync(join(renderer, 'vendor'), { recursive: true });
copyStatic('src/renderer', renderer);
cpSync(SDK, join(renderer, 'vendor', 'speech-sdk.js'));

const site = 'dist/site';
mkdirSync(join(site, 'vendor'), { recursive: true });
copyStatic('src/web', site);
cpSync('src/renderer/style.css', join(site, 'style.css'));
cpSync('src/renderer/session.css', join(site, 'session.css'));
cpSync(SDK, join(site, 'vendor', 'speech-sdk.js'));
cpSync('assets/icon.png', join(site, 'icon.png'));
