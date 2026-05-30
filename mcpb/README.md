# Symcon Smart Home – MCP Bundle (.mcpb)

Dieses Verzeichnis enthält die Quelldateien für eine **.mcpb-Datei**, die du in **Claude Desktop** reinziehen kannst (Einstellungen → Erweiterungen → „.mcpb hierher ziehen“).

## Inhalt

- **manifest.json** – Metadaten, user_config (Server-URL, optional Bearer Token), mcp_config
- **server/index.js** – Launcher: startet `npx @pyroprompts/mcp-stdio-to-streamable-http-adapter` mit den konfigurierten Umgebungsvariablen

Die .mcpb-Datei verbindet Claude (stdio) mit deinem **Symcon MCP-Server** (Streamable HTTP unter einer URL). Der Symcon-Server muss **separat laufen** (z. B. `./start-mcp-local.sh` oder auf der SymBox).

## .mcpb-Datei bauen

Voraussetzung: [MCPB CLI](https://github.com/modelcontextprotocol/mcpb) installiert:

```bash
npm install -g @anthropic-ai/mcpb
```

Dann im Verzeichnis `mcpb/`:

```bash
cd symcon-mcp-server/mcpb
mcpb pack
```

Es entsteht `mcpb.mcpb` im aktuellen Verzeichnis. Du kannst die Datei z. B. in `symcon-smart-home-1.0.0.mcpb` umbenennen und in Claude Desktop reinziehen.

## Nutzung

1. Symcon MCP-Server starten (z. B. `./start-mcp-local.sh` → http://127.0.0.1:4096).
2. .mcpb-Datei in Claude Desktop installieren (reinziehen oder Doppelklick).
3. Bei der Installation: **Symcon MCP-Server URL** angeben (Standard: `http://127.0.0.1:4096`). Optional: Bearer Token.
4. Claude Desktop neu starten.

Siehe auch: [docs/CLAUDE_EINBINDEN.md](../docs/CLAUDE_EINBINDEN.md).
