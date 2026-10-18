import { LANGUAGES } from '../shared/languages.js';
import type { SessionOptions } from '../shared/types.js';

type Field = Exclude<keyof SessionOptions, 'topic'>;

const OPTIONS: Record<Field, [string, string][]> = {
  language: LANGUAGES.map((l) => [l.code, l.name]),
  level: [
    ['beginner', 'Anfänger'],
    ['intermediate', 'Mittel'],
    ['advanced', 'Fortgeschritten'],
  ],
  expressionCorrection: [
    ['off', 'Aus'],
    ['low', 'Wenig'],
    ['normal', 'Normal'],
    ['high', 'Viel'],
  ],
  accentCorrection: [
    ['off', 'Aus'],
    ['low', 'Wenig'],
    ['normal', 'Normal'],
    ['high', 'Viel'],
  ],
  audio: [
    ['headphones', 'Kopfhörer'],
    ['speakers', 'Lautsprecher'],
  ],
  mode: [
    ['free', 'Freies Gespräch'],
    ['roleplay', 'Rollenspiel'],
    ['topic', 'Thema'],
  ],
};

const form = document.getElementById('form') as HTMLFormElement;
const topic = document.getElementById('topic') as HTMLInputElement;
const topicRow = document.getElementById('topicRow') as HTMLDivElement;

function renderChoices(field: Field, selected: string): void {
  const container = document.getElementById(field)!;
  for (const [value, label] of OPTIONS[field]) {
    const el = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = field;
    input.value = value;
    input.checked = value === selected;
    el.append(input, label);
    container.append(el);
  }
}

function selected(field: Field): string {
  return (form.querySelector(`input[name="${field}"]:checked`) as HTMLInputElement).value;
}

function updateTopicRow(): void {
  topicRow.hidden = selected('mode') === 'free';
}

async function init(): Promise<void> {
  const prefs = await window.sprach.getPreferences();
  for (const field of Object.keys(OPTIONS) as Field[]) renderChoices(field, prefs.lastSession[field]);
  topic.value = prefs.lastSession.topic;
  updateTopicRow();
  form.addEventListener('change', updateTopicRow);

  const keys = await window.sprach.getKeyStatus();
  document.getElementById('keyWarning')!.hidden = keys.anthropicKey && keys.azureSpeechKey;

  (form.querySelector('input:checked') as HTMLInputElement | null)?.focus();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const options = {
    language: selected('language'),
    level: selected('level'),
    expressionCorrection: selected('expressionCorrection'),
    accentCorrection: selected('accentCorrection'),
    audio: selected('audio'),
    mode: selected('mode'),
    topic: selected('mode') === 'free' ? '' : topic.value.trim(),
  } as SessionOptions;
  window.sprach.startSession(options);
});

document.getElementById('settings')!.addEventListener('click', () => window.sprach.openSettings());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.sprach.closeWindow();
});

init();
