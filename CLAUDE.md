# Sprach-Agent – Hinweise für Claude

- Nutzer: Carlos (Muttersprache Spanisch). Er schreibt Deutsch; UI-Texte auf Deutsch. Die App erklärt und korrigiert auf Englisch.
- Plan: Projektordner `/mnt/project-files/plan/plan-v0.1.md`. Entscheidungen: Electron + TypeScript, Azure Speech (STT, TTS, Pronunciation Assessment), Claude als Gesprächs-LLM (austauschbar halten), Korrektur sofort + Zusammenfassung, Kopfhörer- und Lautsprecher-Modus.
- Carlos programmiert nicht selbst. Sein Laptop gehört dem Arbeitgeber und hat Smart App Control: unsignierte Exe-Dateien starten dort nicht. Deshalb ist die Browser-Version (`src/web/`, GitHub Pages aus `main`) der Hauptweg zum Testen. Der Windows-Build (Artefakt `Sprach-Agent-Windows`) muss trotzdem grün bleiben.
- Kein Bundler: `tsc` für Hauptprozess (CommonJS → `dist/`), Fenster (ES-Module → `dist/web/`) und Browser-Version (ES-Module → `dist/site/`), HTML/CSS kopiert `scripts/copy-static.mjs`. Imports in `src/shared/` mit `.js`-Endung, sonst laden sie im Browser nicht.
- Electron: API-Schlüssel nur im Hauptprozess, verschlüsselt mit `safeStorage`; nie an die Fenster geben. Browser-Version: Schlüssel nur im `localStorage` des Nutzers, Anfragen gehen direkt an Anthropic (`anthropic-dangerous-direct-browser-access`) und Azure; CSP in `src/web/index.html` begrenzt die Ziele.
- Lokal testen unter Linux: `npm run build` und Electron unter `xvfb-run` mit `--no-sandbox`.
- Gespräch: `claude-opus-5-5` (Einstellung `model` in preferences.json), effort `low`, `fallbacks: "default"`. Claude schreibt englische Erklärungen auf eigene Zeilen mit `EN:`; `SentenceSplitter` gibt diese an die Erklär-Stimme.
- Spracherkennung läuft im Sitzungsfenster mit dem Azure Speech SDK (Browser-Bundle nach `dist/web/renderer/vendor/`), nur mit Kurzzeit-Token aus dem Hauptprozess. Sprachausgabe per REST im Hauptprozess.
- Ein Claude-Artifact taugt nicht als Browser-Version: Mikrofon und Netz sind dort gesperrt.
- `npm test` vor jedem Push.
