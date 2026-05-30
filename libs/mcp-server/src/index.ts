/**
 * Symcon MCP Server – Streamable HTTP/HTTPS entry point.
 * Reads MCP_PORT, SYMCON_API_URL, MCP_AUTH_TOKEN from environment (set by Symcon module).
 * Optional HTTPS: MCP_HTTPS=1, MCP_TLS_CERT und MCP_TLS_KEY (Pfade zu PEM-Dateien).
 */

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SymconClient } from './symcon/SymconClient.js';
import { createToolHandlers } from './tools/index.js';

/**
 * Lädt config.env / local-config.env (KEY=VALUE, # Kommentare) aus dem Arbeitsverzeichnis,
 * damit eine kompilierte .exe einfach "hinlegen, config ausfüllen, starten" funktioniert.
 * Bereits explizit gesetzte Umgebungsvariablen haben Vorrang.
 */
function loadConfigEnv(): void {
  for (const file of [join(process.cwd(), 'config.env'), join(process.cwd(), 'local-config.env')]) {
    if (!existsSync(file)) continue;
    for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined || process.env[key] === '') process.env[key] = val;
    }
  }
}
loadConfigEnv();

const PORT = parseInt(process.env.MCP_PORT ?? '4096', 10);
const SYMCON_API_URL = process.env.SYMCON_API_URL ?? 'http://127.0.0.1:3777/api/';
/** Optional (für Remote-Zugriff auf http://<SymBox-IP>:3777/api/): Basic-Auth */
const SYMCON_API_USER = process.env.SYMCON_API_USER ?? '';
const SYMCON_API_PASSWORD = process.env.SYMCON_API_PASSWORD ?? '';
/** Optional: if set, requests must send Authorization: Bearer <token> or X-MCP-API-Key: <token> */
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN ?? '';
/** Bind on all interfaces (0.0.0.0) so the server is reachable at http(s)://<SymBox-IP>:PORT from your Mac/PC. */
const HOST = process.env.MCP_BIND ?? '0.0.0.0';
/** Optional HTTPS: MCP_HTTPS=1 und MCP_TLS_CERT / MCP_TLS_KEY (Pfade zu PEM), oder Zertifikate in ./certs/server.crt und ./certs/server.key */
const USE_HTTPS = process.env.MCP_HTTPS === '1' || process.env.MCP_HTTPS === 'true';
const TLS_CERT_PATH = process.env.MCP_TLS_CERT ?? join(process.cwd(), 'certs', 'server.crt');
const TLS_KEY_PATH = process.env.MCP_TLS_KEY ?? join(process.cwd(), 'certs', 'server.key');

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  if (bufA.length === 0) return true;
  return timingSafeEqual(bufA, bufB);
}

function isAuthorized(req: IncomingMessage): boolean {
  if (!MCP_AUTH_TOKEN) return true;
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-mcp-api-key'];
  const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const key = typeof apiKeyHeader === 'string' ? apiKeyHeader.trim() : '';
  return constantTimeEqual(bearer, MCP_AUTH_TOKEN) || constantTimeEqual(key, MCP_AUTH_TOKEN);
}

function readBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', reject);
  });
}

async function main(): Promise<void> {
  // Sicherheit: kein Token + im Netzwerk erreichbar = offener Endpunkt mit PHP-Ausführung. Start abbrechen.
  const isLoopback = HOST === '127.0.0.1' || HOST === 'localhost' || HOST === '::1';
  if (!MCP_AUTH_TOKEN && !isLoopback) {
    process.stderr.write(
      `FEHLER: Kein MCP_AUTH_TOKEN gesetzt, aber der Server ist im Netz erreichbar (MCP_BIND=${HOST}).\n` +
      `Start aus Sicherheitsgründen abgebrochen – ein offener Endpunkt kann PHP auf der SymBox ausführen.\n` +
      `Lösung: MCP_AUTH_TOKEN in config.env setzen, ODER nur lokal binden mit MCP_BIND=127.0.0.1.\n`
    );
    process.exit(1);
  }
  const DEV_TOOLS = process.env.MCP_DEV_TOOLS === '1' || process.env.MCP_DEV_TOOLS === 'true';

  const symconAuth =
    SYMCON_API_USER && SYMCON_API_PASSWORD
      ? { type: 'basic' as const, username: SYMCON_API_USER, password: SYMCON_API_PASSWORD }
      : undefined;
  const client = new SymconClient(SYMCON_API_URL, 10000, symconAuth);
  const mcp = new McpServer(
    {
      name: 'symcon-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  const handlers = createToolHandlers(client);
  if (!DEV_TOOLS) {
    delete handlers['symcon_get_script_content'];
    delete handlers['symcon_run_script_text_wait'];
  }
  for (const [name, { description, inputSchema, handler }] of Object.entries(handlers)) {
    mcp.registerTool(
      name,
      {
        description,
        inputSchema,
      },
      handler as (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>
    );
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await mcp.connect(transport);

  const requestHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method === 'POST' && !isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', message: 'Missing or invalid API key' }));
      return;
    }
    const allowedOrigins = [
      `http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`,
      `https://127.0.0.1:${PORT}`, `https://localhost:${PORT}`,
    ];
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin) && HOST === '127.0.0.1') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Origin not allowed' }));
      return;
    }
    const body = req.method === 'POST' ? await readBody(req) : undefined;
    await transport.handleRequest(req, res, body);
  };

  let server: import('node:http').Server | import('node:https').Server;
  if (USE_HTTPS) {
    if (!existsSync(TLS_CERT_PATH) || !existsSync(TLS_KEY_PATH)) {
      process.stderr.write(
        `HTTPS requested (MCP_HTTPS=1) but cert/key not found. Set MCP_TLS_CERT and MCP_TLS_KEY, or place server.crt and server.key in ./certs/\n` +
        `  Example (self-signed): openssl req -x509 -newkey rsa:2048 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj /CN=localhost\n`
      );
      process.exit(1);
    }
    server = createHttpsServer(
      {
        cert: readFileSync(TLS_CERT_PATH),
        key: readFileSync(TLS_KEY_PATH),
      },
      requestHandler
    );
  } else {
    server = createHttpServer(requestHandler);
  }

  const scheme = USE_HTTPS ? 'https' : 'http';
  server.listen(PORT, HOST, () => {
    process.stderr.write(
      `Symcon MCP Server listening on ${scheme}://${HOST === '0.0.0.0' ? '0.0.0.0' : HOST}:${PORT} (${HOST === '0.0.0.0' ? 'use ' + scheme + '://<SymBox-IP>:' + PORT : ''})\n`
    );
    process.stderr.write(`Symcon API: ${SYMCON_API_URL}\n`);
    if (MCP_AUTH_TOKEN) process.stderr.write('Auth: API key required (Authorization: Bearer or X-MCP-API-Key)\n');
    process.stderr.write(`Dev-Tools (Skript lesen / PHP mit Ausgabe): ${DEV_TOOLS ? 'AKTIV' : 'aus (MCP_DEV_TOOLS=1 zum Aktivieren)'}\n`);
  });
}

main().catch((err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
