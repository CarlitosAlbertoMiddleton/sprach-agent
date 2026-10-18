export type VoiceCommand =
  | 'end' | 'pause' | 'resume' | 'repeat' | 'slower' | 'faster'
  | 'easier' | 'harder' | 'moreCorrections' | 'fewerCorrections';

// Spoken commands work in German, Spanish, English and every target language.
// They only trigger when the whole utterance is the command, so a sentence
// like "Je vais à la fin du film" never ends the session.
const COMMANDS: Record<VoiceCommand, string[]> = {
  end: [
    'ende', 'stopp', 'stop', 'beenden', 'sitzung beenden', 'schluss',
    'fin', 'fin de la session', 'terminé', 'on arrête', 'arrête',
    'end', 'end session', 'that is all', "that's all",
    'fine', 'basta', 'finito', 'termina',
    'terminar', 'se acabó', 'adiós sesión',
  ],
  pause: ['pause', 'pausa', 'pause bitte', 'warte', 'attends', 'wait', 'aspetta', 'espera'],
  resume: ['weiter', 'weiter bitte', 'continue', 'continuer', 'on continue', 'continua', 'continuiamo', 'sigue', 'seguimos', 'go on'],
  repeat: [
    'wiederhol das', 'wiederholen', 'nochmal', 'noch mal',
    'répète', 'répète s’il te plaît', "répète s'il te plaît", 'tu peux répéter',
    'repeat', 'repeat that', 'say that again',
    'ripeti', 'puoi ripetere', 'repite', 'otra vez',
  ],
  slower: ['langsamer', 'plus lentement', 'moins vite', 'slower', 'more slowly', 'più lentamente', 'più piano', 'más despacio', 'más lento'],
  faster: ['schneller', 'plus vite', 'faster', 'più veloce', 'más rápido'],
  easier: [
    'einfacher', 'leichter', 'einfacher bitte', 'plus simple', 'plus facile', 'easier', 'simpler',
    'più facile', 'più semplice', 'más fácil', 'más sencillo',
  ],
  harder: [
    'schwieriger', 'schwerer', 'plus difficile', 'harder', 'more difficult', 'più difficile', 'más difícil',
  ],
  moreCorrections: [
    'mehr korrigieren', 'mehr korrekturen', 'korrigier mehr', 'corrige-moi plus', 'plus de corrections',
    'more corrections', 'correct me more', 'correggimi di più', 'più correzioni', 'corrígeme más', 'más correcciones',
  ],
  fewerCorrections: [
    'weniger korrigieren', 'weniger korrekturen', 'korrigier weniger', 'corrige-moi moins', 'moins de corrections',
    'fewer corrections', 'less corrections', 'correct me less', 'correggimi di meno', 'meno correzioni',
    'corrígeme menos', 'menos correcciones',
  ],
};

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/-/g, ' ')
    .replace(/[.,!?¡¿;:"«»()…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const LOOKUP = new Map<string, VoiceCommand>();
for (const [command, phrases] of Object.entries(COMMANDS) as [VoiceCommand, string[]][]) {
  for (const phrase of phrases) LOOKUP.set(normalize(phrase), command);
}

export function detectCommand(utterance: string): VoiceCommand | null {
  return LOOKUP.get(normalize(utterance)) ?? null;
}
