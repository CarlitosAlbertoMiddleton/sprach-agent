# Sprach-Agent – Hinweise für Claude

- Nutzer: Carlos (Muttersprache Spanisch). Er schreibt Deutsch; UI-Texte auf Deutsch. Die App erklärt und korrigiert auf Englisch.
- Plan: Projektordner `/mnt/project-files/plan/plan-v0.1.md`. Entscheidungen: Electron + TypeScript, Azure Speech (STT, TTS, Pronunciation Assessment), Claude als Gesprächs-LLM (austauschbar halten), Korrektur sofort + Zusammenfassung, Kopfhörer- und Lautsprecher-Modus.
- Carlos programmiert nicht selbst. Er testet die Windows-Builds aus GitHub Actions (Artefakt `Sprach-Agent-Windows`), deshalb muss jede Phase dort grün bauen.
- Kein Bundler: `tsc` für Hauptprozess (CommonJS → `dist/`) und Fenster (ES-Module → `dist/web/`), HTML/CSS kopiert `scripts/copy-static.mjs`.
- API-Schlüssel nur im Hauptprozess, verschlüsselt mit `safeStorage`; nie an die Fenster geben.
- Lokal testen unter Linux: `npm run build` und Electron unter `xvfb-run` mit `--no-sandbox`.
