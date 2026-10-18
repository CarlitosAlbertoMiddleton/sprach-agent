import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectCommand } from '../shared/commands';
import { SentenceSplitter } from '../shared/sentences';
import { buildSystemPrompt } from '../shared/prompt';
import type { SessionOptions } from '../shared/types';

test('voice commands match whole utterances in several languages', () => {
  assert.equal(detectCommand('Ende.'), 'end');
  assert.equal(detectCommand('Fin de la session !'), 'end');
  assert.equal(detectCommand('Pausa'), 'pause');
  assert.equal(detectCommand('Weiter'), 'resume');
  assert.equal(detectCommand('Répète, s’il te plaît.'), 'repeat');
  assert.equal(detectCommand('Plus lentement'), 'slower');
  assert.equal(detectCommand('Más despacio.'), 'slower');
});

test('commands inside normal sentences do not trigger', () => {
  assert.equal(detectCommand('Je vais voir la fin du film.'), null);
  assert.equal(detectCommand('Am Ende des Tages bin ich müde'), null);
  assert.equal(detectCommand(''), null);
});

test('splitter emits sentences as they complete', () => {
  const s = new SentenceSplitter();
  assert.deepEqual(s.feed('Bonjour Carlos ! Com'), [{ text: 'Bonjour Carlos !', lang: 'target' }]);
  assert.deepEqual(s.feed('ment ça va ?'), []);
  assert.deepEqual(s.flush(), [{ text: 'Comment ça va ?', lang: 'target' }]);
});

test('splitter routes EN: lines to the English voice, even when split across deltas', () => {
  const s = new SentenceSplitter();
  const out = [
    ...s.feed('Super, tu es allé au marché.\nE'),
    ...s.feed('N: We say "je suis allé", not "j\'ai allé". It uses être.\nEt toi ?'),
    ...s.flush(),
  ];
  assert.deepEqual(out, [
    { text: 'Super, tu es allé au marché.', lang: 'target' },
    { text: 'We say "je suis allé", not "j\'ai allé".', lang: 'en' },
    { text: 'It uses être.', lang: 'en' },
    { text: 'Et toi ?', lang: 'target' },
  ]);
});

test('splitter strips markdown symbols', () => {
  const s = new SentenceSplitter();
  assert.deepEqual(s.flush(), []);
  assert.deepEqual([...s.feed('**Très** bien. '), ...s.flush()], [{ text: 'Très bien.', lang: 'target' }]);
});

const base: SessionOptions = {
  language: 'fr-FR', level: 'beginner', expressionCorrection: 'normal', accentCorrection: 'normal',
  audio: 'headphones', mode: 'free', topic: '',
};

test('system prompt reflects the session options', () => {
  const p = buildSystemPrompt(base);
  assert.match(p, /practise French \(fr-FR\)/);
  assert.match(p, /beginner \(CEFR A1-A2\)/);
  assert.match(p, /"EN:"/);
  assert.match(p, /native language is Spanish/);
  const rp = buildSystemPrompt({ ...base, language: 'en-GB', level: 'advanced', mode: 'roleplay', topic: 'im Café bestellen', expressionCorrection: 'off' });
  assert.match(rp, /British English/);
  assert.match(rp, /C1-C2/);
  assert.match(rp, /im Café bestellen/);
  assert.match(rp, /Do not correct grammar/);
});
