@echo off
REM FACE Symcon MCP Server starten (liest config.env aus diesem Ordner).
REM Doppelklick zum Starten. Fenster offen lassen = Server laeuft.
cd /d "%~dp0"
if not exist config.env (
  echo [Hinweis] Keine config.env gefunden. Kopiere config.env.example zu config.env und fuelle sie aus.
  copy config.env.example config.env >nul
  echo config.env wurde angelegt - bitte SYMCON_API_URL und MCP_AUTH_TOKEN eintragen, dann erneut starten.
  pause
  exit /b 1
)
node dist\index.js
pause
