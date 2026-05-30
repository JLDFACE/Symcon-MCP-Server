# START HIER – FACE Symcon MCP Server

Gehärteter FACE-Stand. Basiert auf **symcon-mcp-server** von beeXperts-Niko (GPL-3.0,
siehe `LICENSE`). Was geändert wurde: `FACE-CHANGES.md`.

## 1. Ordner in VSCode öffnen
VSCode → *Datei → Ordner öffnen…* → diesen Ordner wählen.

## 2. Server vorbereiten
Terminal öffnen (`Strg+ö`), dann:
```
cd libs/mcp-server
npm install
```

## 3. Konfiguration
- `config.env.example` kopieren zu **`config.env`** (Rechtsklick → Kopieren, dann umbenennen).
- In `config.env` eintragen:
  - `SYMCON_API_URL=http://<SYMBOX-IP>:3777/api/`  (IP der Dev-SymBox)
  - `MCP_AUTH_TOKEN=` langer Zufallsstring (denselben brauchst du gleich am Mac)
  - `MCP_DEV_TOOLS=1`  (Dev-Tools an – nur auf Dev-/Test-SymBox)

## 4. Starten & testen
```
node dist/index.js
```
Erfolg = Zeilen `listening on … 0.0.0.0:4096` und `Dev-Tools … AKTIV`.
Fenster offen lassen. (Alternativ unter Windows: `start.cmd` doppelklicken.)

> Hinweis: `npm run build` (tsc) meldet 7 Typfehler – die liegen in unfertigen
> Upstream-Tools der Sprachsteuerung, nicht in unserem Code. Das mitgelieferte `dist/`
> läuft. Erst anfassen, wenn wir diese Tools wirklich brauchen.

## 5. In euer privates GitHub bringen
1. Unten links **Accounts** → „Sign in with GitHub" → im Browser bestätigen.
2. Links **Source Control** → Commit-Nachricht z. B. `FACE: Initial gehaerteter Stand` →
   **Commit** (alles stagen, wenn gefragt).
3. `Strg+Umschalt+P` → **„Publish to GitHub"** → **private repository** → Name
   `symcon-mcp-server`, Org **JLDFACE**. Fertig.

## 6. Später: eigenständige .exe
Bun installieren (bun.sh), dann in `libs/mcp-server`:
```
npm run build:exe
```
→ erzeugt `symcon-mcp-server.exe` (läuft ohne Node). Cross-Compile geht auch vom Mac.

---

## Danach am Mac (Claude Desktop anbinden)
Datei `~/Library/Application Support/Claude/claude_desktop_config.json` anlegen/ergänzen:
```json
{
  "mcpServers": {
    "symcon": {
      "command": "npx",
      "args": ["-y", "@pyroprompts/mcp-stdio-to-streamable-http-adapter"],
      "env": {
        "URI": "http://<WINDOWS-PC-IP>:4096",
        "MCP_NAME": "symcon",
        "BEARER_TOKEN": "<derselbe Token wie in config.env>"
      }
    }
  }
}
```
Claude Desktop komplett beenden (Cmd+Q) und neu öffnen. Am Windows-PC vorher Port 4096
in der Firewall freigeben. Dann im Chat: „mach einen symcon_ping".
