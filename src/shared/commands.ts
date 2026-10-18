export type VoiceCommand = 'end' | 'pause' | 'resume' | 'repeat' | 'slower' | 'faster';

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
};

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’]/g, "'")
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
