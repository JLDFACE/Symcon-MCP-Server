# FACE-Anpassungen am Symcon MCP Server

Basiert auf dem Projekt **symcon-mcp-server** von beeXperts-Niko (Niko Sinthern),
Lizenz **GPL-3.0** (siehe `LICENSE`). Diese Datei dokumentiert die FACE-internen Änderungen.

## Härtung (libs/mcp-server)

1. **Token-Pflicht im Netz.** Startet der Server netzwerkweit erreichbar (`MCP_BIND=0.0.0.0`)
   ohne `MCP_AUTH_TOKEN`, bricht er mit Fehlermeldung ab. Nur rein lokal (`MCP_BIND=127.0.0.1`)
   ist ein Start ohne Token erlaubt. Verhindert einen offenen Endpunkt mit PHP-Ausführung.

2. **config.env.** Der Server liest beim Start `config.env` (oder `local-config.env`) aus dem
   Arbeitsverzeichnis (`KEY=VALUE`, `#`-Kommentare). Bereits gesetzte Umgebungsvariablen haben
   Vorrang. Macht die spätere `.exe` zu „hinlegen, config ausfüllen, starten".

3. **Dev-Tools (nur bei `MCP_DEV_TOOLS=1`).** Zwei zusätzliche Tools für die Entwicklung,
   standardmäßig AUS (auf Kundenanlagen aus lassen):
   - `symcon_get_script_content` – bestehenden Skript-Inhalt lesen (IPS_GetScriptContent),
     zum Refactoren.
   - `symcon_run_script_text_wait` – PHP ausführen und Ausgabe zurückbekommen
     (IPS_RunScriptTextWait). Schließt den Schreiben-Testen-Korrigieren-Loop.

## Komfort
- `start.cmd` – Windows-Startskript (legt bei Bedarf config.env aus der Vorlage an).
- `config.env.example` – Konfigurationsvorlage.
- npm-Skript `build:exe` – baut mit **Bun** eine eigenständige Windows-`.exe`
  (Cross-Compile auch vom Mac möglich): `npm run build:exe`.

## Bekannt / offen (Upstream)
- Die „Convention/Control-Rule"-Tools der Knowledge-Base (`symcon_knowledge_set_convention`
  u. a.) sind im Upstream **unfertig** (fehlende Methoden in `KnowledgeStore`) und werfen
  Typfehler beim `tsc`-Build. Sie sind für den Dev-/Szenen-Workflow nicht nötig und wurden
  bewusst nicht angefasst. Bei Bedarf später entweder fertigstellen oder entfernen.
- Der `.exe`-Build (Bun) kompiliert direkt aus `src/` und ist davon nicht betroffen.
