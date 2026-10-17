import { net } from 'electron';
import type { TestResult } from '../shared/types';
import { readSecret } from './secrets';

/** Checks the Anthropic key by listing models (cheap, no tokens used). */
export async function testAnthropic(): Promise<TestResult> {
  const key = readSecret('anthropicKey');
  if (!key) return { ok: false, message: 'Kein Anthropic-Schlüssel gespeichert.' };
  try {
    const res = await net.fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    });
    if (res.ok) return { ok: true, message: 'Anthropic-Schlüssel funktioniert.' };
    if (res.status === 401) return { ok: false, message: 'Anthropic lehnt den Schlüssel ab (401).' };
    return { ok: false, message: `Anthropic antwortet mit Fehler ${res.status}.` };
  } catch (err) {
    return { ok: false, message: `Keine Verbindung zu Anthropic: ${(err as Error).message}` };
  }
}

/** Checks the Azure Speech key by requesting a short-lived access token. */
export async function testAzure(region: string): Promise<TestResult> {
  const key = readSecret('azureSpeechKey');
  if (!key) return { ok: false, message: 'Kein Azure-Speech-Schlüssel gespeichert.' };
  if (!/^[a-z0-9]+$/.test(region)) return { ok: false, message: 'Ungültige Azure-Region.' };
  try {
    const res = await net.fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
    });
    if (res.ok) return { ok: true, message: `Azure-Schlüssel funktioniert (Region ${region}).` };
    if (res.status === 401) return { ok: false, message: 'Azure lehnt den Schlüssel ab (401). Stimmt die Region?' };
    return { ok: false, message: `Azure antwortet mit Fehler ${res.status}.` };
  } catch (err) {
    return { ok: false, message: `Keine Verbindung zu Azure: ${(err as Error).message}` };
  }
}
