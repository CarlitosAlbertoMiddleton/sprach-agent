import { net } from 'electron';
import type { SpeechToken } from '../shared/types';
import { readSecret } from './secrets';

let cached: { token: string; region: string; expires: number } | null = null;

/**
 * Short-lived Azure token for speech recognition in the session window, so
 * the key itself never leaves the main process. Tokens last 10 minutes.
 */
export async function speechToken(region: string): Promise<SpeechToken> {
  if (cached && cached.region === region && cached.expires > Date.now()) {
    return { token: cached.token, region };
  }
  const key = readSecret('azureSpeechKey');
  if (!key) throw new Error('Kein Azure-Speech-Schlüssel gespeichert. Bitte in den Einstellungen eintragen.');
  const res = await net.fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
  });
  if (!res.ok) throw new Error(`Azure lehnt den Schlüssel ab (Fehler ${res.status}). Region und Schlüssel prüfen.`);
  const token = await res.text();
  cached = { token, region, expires: Date.now() + 8 * 60 * 1000 };
  return { token, region };
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/**
 * Text to MP3 through the Azure TTS REST endpoint.
 * `rate` is a relative speed: 1 = normal, 0.8 = 20 % slower.
 */
export async function synthesize(region: string, text: string, voice: string, rate: number): Promise<Uint8Array> {
  const key = readSecret('azureSpeechKey');
  if (!key) throw new Error('Kein Azure-Speech-Schlüssel gespeichert.');
  const lang = voice.split('-').slice(0, 2).join('-');
  const percent = Math.round((rate - 1) * 100);
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
    `<voice name="${voice}"><prosody rate="${percent >= 0 ? '+' : ''}${percent}%">${escapeXml(text)}</prosody></voice></speak>`;
  const res = await net.fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'sprach-agent',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Sprachausgabe fehlgeschlagen (Azure-Fehler ${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}
