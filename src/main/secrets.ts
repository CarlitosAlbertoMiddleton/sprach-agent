import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { KeyStatus, SecretName } from '../shared/types';

// API keys are encrypted with Windows DPAPI via Electron safeStorage, so only
// this Windows user account can read them. They never leave the main process.

function dir(): string {
  return join(app.getPath('userData'), 'secrets');
}

function path(name: SecretName): string {
  return join(dir(), `${name}.bin`);
}

export function saveSecret(name: SecretName, value: string): void {
  const trimmed = value.trim();
  if (!trimmed) {
    rmSync(path(name), { force: true });
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Verschlüsselung ist auf diesem System nicht verfügbar.');
  }
  mkdirSync(dir(), { recursive: true });
  writeFileSync(path(name), safeStorage.encryptString(trimmed));
}

export function readSecret(name: SecretName): string | null {
  if (!existsSync(path(name))) return null;
  try {
    return safeStorage.decryptString(readFileSync(path(name)));
  } catch {
    return null;
  }
}

export function keyStatus(): KeyStatus {
  return {
    anthropicKey: readSecret('anthropicKey') !== null,
    azureSpeechKey: readSecret('azureSpeechKey') !== null,
  };
}
