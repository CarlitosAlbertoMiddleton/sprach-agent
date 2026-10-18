import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectCommand } from '../shared/commands';
import { parseCorrection, SentenceSplitter } from '../shared/sentences';
import { stepCorrection, stepLevel } from '../shared/options';
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
  assert.match(rp, /Never correct grammar/);
  assert.doesNotMatch(rp, /FIX: "/);
});

test('new voice commands change level and corrections', () => {
  assert.equal(detectCommand('Einfacher!'), 'easier');
  assert.equal(detectCommand('Plus difficile'), 'harder');
  assert.equal(detectCommand('Corrige-moi plus.'), 'moreCorrections');
  assert.equal(detectCommand('corrige moi plus'), 'moreCorrections');
  assert.equal(detectCommand('Weniger korrigieren'), 'fewerCorrections');
  assert.equal(detectCommand('Más fácil'), 'easier');
  assert.equal(detectCommand("C'est plus simple comme ça"), null);
});

test('level and correction steps stop at the ends', () => {
  assert.equal(stepLevel('beginner', -1), 'beginner');
  assert.equal(stepLevel('beginner', 1), 'intermediate');
  assert.equal(stepLevel('advanced', 1), 'advanced');
  assert.equal(stepCorrection('normal', 1), 'high');
  assert.equal(stepCorrection('off', -1), 'off');
});

test('correction lines are parsed', () => {
  assert.deepEqual(parseCorrection('"j\'ai allé" -> "je suis allé" | aller takes être'),
    { wrong: "j'ai allé", right: 'je suis allé', why: 'aller takes être' });
  assert.deepEqual(parseCorrection('je suis allé → je suis allée'), { wrong: 'je suis allé', right: 'je suis allée', why: '' });
  assert.equal(parseCorrection('no arrow here'), null);
});

test('splitter keeps a FIX line whole, even with sentence ends and split across deltas', () => {
  const s = new SentenceSplitter();
  const out = [
    ...s.feed('Ah, super ! Tu es allé au marché.\nFI'),
    ...s.feed('X: "j\'ai allé" -> "je suis allé" | Aller uses être. Not avoir.\nEt après ?'),
    ...s.flush(),
  ];
  assert.deepEqual(out, [
    { text: 'Ah, super !', lang: 'target' },
    { text: 'Tu es allé au marché.', lang: 'target' },
    {
      text: '"j\'ai allé" -> "je suis allé" | Aller uses être. Not avoir.', lang: 'fix',
      fix: { wrong: "j'ai allé", right: 'je suis allé', why: 'Aller uses être. Not avoir.' },
    },
    { text: 'Et après ?', lang: 'target' },
  ]);
});

test('splitter does not hold back a normal sentence that starts with F', () => {
  const s = new SentenceSplitter();
  assert.deepEqual(s.feed('F'), []);
  assert.deepEqual(s.feed('antastique ! Et toi'), [{ text: 'Fantastique !', lang: 'target' }]);
});

test('a malformed FIX line is still spoken as an English explanation', () => {
  const s = new SentenceSplitter();
  assert.deepEqual([...s.feed('FIX: say it with être\n'), ...s.flush()], [{ text: 'say it with être', lang: 'en' }]);
});

test('levels and corrections produce clearly different prompts', () => {
  const beginner = buildSystemPrompt(base);
  const advanced = buildSystemPrompt({ ...base, level: 'advanced', expressionCorrection: 'high' });
  assert.match(beginner, /at most 8 words/);
  assert.match(beginner, /at most one per reply/);
  assert.match(beginner, /FIX: "what the learner said" -> "better version"/);
  assert.match(advanced, /disagree sometimes/);
  assert.match(advanced, /more natural/);
});
