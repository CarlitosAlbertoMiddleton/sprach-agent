import type { KeyStatus, SecretName, TestResult } from '../shared/types.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const anthropicStatus = $<HTMLParagraphElement>('anthropicStatus');
const azureStatus = $<HTMLParagraphElement>('azureStatus');
const region = $<HTMLInputElement>('azureRegion');
const hotkey = $<HTMLInputElement>('hotkey');
const saved = $<HTMLSpanElement>('saved');

function show(el: HTMLElement, text: string, kind: 'ok' | 'err' | '' = ''): void {
  el.textContent = text;
  el.className = `status ${kind}`;
}

function showKeys(keys: KeyStatus): void {
  show(anthropicStatus, keys.anthropicKey ? 'Schlüssel gespeichert.' : 'Noch kein Schlüssel gespeichert.');
  show(azureStatus, keys.azureSpeechKey ? 'Schlüssel gespeichert.' : 'Noch kein Schlüssel gespeichert.');
}

function showResult(el: HTMLElement, result: TestResult): void {
  show(el, result.message, result.ok ? 'ok' : 'err');
}

async function saveKey(name: SecretName, status: HTMLElement): Promise<void> {
  const input = $<HTMLInputElement>(name);
  try {
    const keys = await window.sprach.saveSecret(name, input.value);
    input.value = '';
    showKeys(keys);
  } catch (err) {
    show(status, (err as Error).message, 'err');
  }
}

async function savePrefs(): Promise<void> {
  await window.sprach.savePreferences({ azureRegion: region.value.trim().toLowerCase(), hotkey: hotkey.value.trim() });
  saved.textContent = 'Gespeichert.';
  setTimeout(() => (saved.textContent = ''), 1500);
}

async function init(): Promise<void> {
  const prefs = await window.sprach.getPreferences();
  region.value = prefs.azureRegion;
  hotkey.value = prefs.hotkey;
  showKeys(await window.sprach.getKeyStatus());
}

$('saveAnthropic').addEventListener('click', () => saveKey('anthropicKey', anthropicStatus));
$('saveAzure').addEventListener('click', () => saveKey('azureSpeechKey', azureStatus));
$('testAnthropic').addEventListener('click', async () => {
  show(anthropicStatus, 'Teste…');
  showResult(anthropicStatus, await window.sprach.testAnthropic());
});
$('testAzure').addEventListener('click', async () => {
  await savePrefs();
  show(azureStatus, 'Teste…');
  showResult(azureStatus, await window.sprach.testAzure());
});
region.addEventListener('change', savePrefs);
hotkey.addEventListener('change', savePrefs);
$('close').addEventListener('click', async () => {
  await savePrefs();
  window.sprach.closeWindow();
});

init();
