# Sprach-Agent

Windows-App zum Sprachenlernen: einmal aktivieren, dann freihändig mit einem KI-Gesprächspartner sprechen. Claude führt das Gespräch, Azure Speech hört zu, spricht und bewertet die Aussprache.

Der vollständige Plan liegt im Projektordner unter `plan/plan-v0.1.md`.

## Stand

| Phase | Inhalt | Stand |
|---|---|---|
| 0 | Grundlage: Taskleisten-Symbol, Tastenkürzel, Schnellwahl, Einstellungen für API-Schlüssel | fertig zum Testen |
| 1 | Sprechschleife: freihändig sprechen, Claude antwortet mit Stimme, Unterbrechen, Sprachbefehle | fertig zum Testen |
| 2 | Sprachstufen und Korrektur Ausdruck | offen |
| 3 | Akzent-Bewertung | offen |
| 4 | Vier Sprachen, Zusammenfassung, Sprachbefehle | offen |
| 5 | Installer und Autostart | offen |

## Testen auf Windows (ohne Programmieren)

1. Auf GitHub im Repo oben auf **Actions** klicken.
2. Den neuesten grünen Lauf „Windows-Build“ öffnen.
3. Ganz unten bei **Artifacts** auf `Sprach-Agent-Windows` klicken. Es lädt eine ZIP-Datei herunter.
4. ZIP entpacken. Darin liegen zwei Dateien:
   - `Sprach-Agent-…-portable.exe`: startet direkt, ohne Installation (zum Testen empfohlen).
   - `Sprach-Agent Setup ….exe`: normale Installation.
5. Windows zeigt beim ersten Start eventuell „Der Computer wurde durch Windows geschützt“. Das liegt daran, dass die App nicht signiert ist. Auf **Weitere Informationen** und dann **Trotzdem ausführen** klicken.

## Bedienung

- Nach dem Start erscheint ein Sprechblasen-Symbol unten rechts in der Taskleiste (eventuell hinter dem Pfeil `^`).
- **Strg+Alt+S** oder Klick auf das Symbol öffnet „Sitzung starten“. **Los** oder Enter startet die Sitzung, das Symbol wird grün.
- Nochmal **Strg+Alt+S** oder Klick beendet die Sitzung.
- Rechtsklick auf das Symbol: Einstellungen und Beenden.
- In den Einstellungen API-Schlüssel eintragen, **Speichern** und **Testen**.
- Nach **Los** erscheint unten rechts das Sitzungsfenster. Der Partner begrüßt dich, danach sprichst du einfach. Eine kurze Sprechpause beendet deinen Satz.
- Du kannst ihn jederzeit unterbrechen, indem du weiterredest (mit Lautsprechern braucht es ein paar Wörter mehr).
- Sprachbefehle (nur als ganzer Satz): „Ende“, „Pause“, „Weiter“, „Wiederhol das“, „Langsamer“, „Schneller“, auch auf Französisch, Englisch, Italienisch und Spanisch.
- Erklärungen und Korrekturen kommen auf Englisch mit einer zweiten Stimme und stehen gestrichelt im Fenster.

## Entwicklung

```bash
npm install
npm start          # baut und startet die App
npm run typecheck  # Typprüfung
npm test           # Unit-Tests (Sprachbefehle, Satz-Zerlegung, Prompt)
npm run dist       # baut die Windows-Dateien nach release/
```

Aufbau:

- `src/main/` Hauptprozess: Taskleiste, Tastenkürzel, Fenster, verschlüsselte Schlüssel (`safeStorage`), Schlüsseltests
- `src/preload/` sichere Brücke zwischen Fenstern und Hauptprozess
- `src/main/conversation.ts` Gespräch mit Claude: Streaming, Satz für Satz, Sprachausgabe pro Satz
- `src/main/speech.ts` Azure-Token für die Spracherkennung, Sprachausgabe (REST)
- `src/renderer/` Fenster „Sitzung starten“, „Einstellungen“ und das Sitzungsfenster (Mikrofon, Spracherkennung, Wiedergabe)
- `src/shared/` gemeinsame Typen, Sprachliste, System-Prompt, Sprachbefehle, Satz-Zerlegung
