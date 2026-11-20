// dsh-tokscale-usage — local DSH usage analytics powered by the tokscale CLI.
// Registers the `tokscale_usage` agent tool, `/tokscale` slash command, and JSON
// API routes backing the native sidebar Usage Insights studio (`client.js`).
import { Store, canonicalClient } from './lib/store.mjs';
import { formatSummary } from './lib/views.mjs';
import { resolveTokscaleBin, clientsForBin } from './lib/tokscale.mjs';
import { probeSources } from './lib/sources.mjs';

export const name = 'dsh-tokscale-usage';
export const inject = ['tools', 'webServer', 'commands'];

const DEFAULTS = {
  client: 'all',
  scanTimeoutMs: 180000,
  enabled: true,
};

function sameOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const log = ctx.logger?.(name) ?? console;
  if (cfg.enabled === false) { log.info?.('dsh-tokscale-usage disabled by config'); return; }

  const store = new Store(cfg, log);
  const bin = resolveTokscaleBin(cfg);
  log.info?.(`dsh-tokscale-usage starting; tokscale bin=${bin.kind}:${bin.path || bin.command} (${bin.source}); dir=${store.dir}`);

  const tools = ctx.get?.('tools') ?? ctx.tools;
  const webServer = ctx.get?.('webServer') ?? ctx.webServer;
  const commands = ctx.get?.('commands') ?? ctx.commands;
  const disposers = [];
  const requests = new Map();
  const cancelled = new Map();
  const validId = id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);
  function pruneCancelled() {
    const now = Date.now();
    for (const [id, expires] of cancelled) if (expires <= now) cancelled.delete(id);
    while (cancelled.size > 256) cancelled.delete(cancelled.keys().next().value);
  }

  // --- Agent tool -----------------------------------------------------------
  if (tools?.register) {
    disposers.push(tools.register({
      name: 'tokscale_usage',
      description: 'Report local AI agent token usage using tokscale. Filter by client, model and date; costs are estimates and missing records do not establish zero usage.',
      parameters: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['today', 'yesterday', 'days3', 'week', 'month', 'all', 'custom'], description: 'Date range, default month. days3 = last 3 days inclusive; all scans full history and may be slow; custom requires since and until.' },
          client: { type: 'string', description: 'Client identifier, or all (default).' },
          model: { type: 'string', description: 'Exact model identifier, or all (default).' },
          since: { type: 'string', description: 'Optional start date YYYY-MM-DD; overrides range.' },
          until: { type: 'string', description: 'Optional end date YYYY-MM-DD.' },
          refresh: { type: 'boolean', description: 'Force a fresh tokscale scan before reporting.' },
        },
        additionalProperties: false,
      },
      output: {
        schema: { type: 'object', properties: { content: { type: 'string' }, isError: { type: 'boolean' } }, required: ['content', 'isError'], additionalProperties: false },
        render: (_args, value) => [{ type: 'text', text: value.content }],
      },
      async execute(args = {}, exec = {}) {
        try {
          const result = await store.query({
            client: args.client || 'all', model: args.model || 'all', range: args.range || 'month',
            since: args.since, until: args.until, refresh: args.refresh === true, signal: exec.signal,
          });
          return { content: JSON.stringify(result), isError: false };
        } catch (e) {
          return { content: 'tokscale_usage error: ' + (e?.message || String(e)), isError: true };
        }
      },
    }));
  } else log.warn?.('tools service unavailable; tokscale_usage tool not registered');

  // --- Slash command --------------------------------------------------------
  if (commands?.register) {
    disposers.push(commands.register({
      name: 'tokscale',
      description: 'Show local agent token usage summary for this month',
      handler: async () => {
        try {
          const result = await store.query({ client: 'all', range: 'month', includeRich: true });
          const text = formatSummary({
            metrics: result.metrics,
            range: 'month',
            cached: Boolean(result.meta?.updatedAt),
            updatedAt: result.meta?.updatedAt,
            throughputSummary: result.throughputSummary,
            tasks: result.tasks,
          });
          return { kind: 'success', text: `${text}\n\n在左侧“用量洞察”面板查看图表与任务下钻。` };
        } catch (e) {
          return { kind: 'error', text: 'tokscale: ' + (e?.message || String(e)) };
        }
      },
    }));
  }

  // --- JSON API for Native Studio Panel -------------------------------------
  if (webServer?.register) {
    const readBodyJson = req => new Promise((resolve, reject) => {
      let raw = '';
      req.on?.('data', chunk => {
        raw += chunk;
        if (raw.length > 65536) reject(new Error('request body too large'));
      });
      req.on?.('end', () => {
        if (!raw.trim()) { resolve({}); return; }
        try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid JSON body')); }
      });
      req.on?.('error', reject);
      if (typeof req.on !== 'function') resolve(req.body && typeof req.body === 'object' ? req.body : {});
    });

    disposers.push(webServer.register({
      kind: 'exact', path: '/tokscale-usage/sources',
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'POST') { res.writeHead(405, { allow: 'GET, POST' }); res.end(); return; }
        if (!sameOrigin(req)) { sendJson(res, 403, { error: 'untrusted origin' }); return; }
        if (req.method === 'POST') {
          try {
            const body = await readBodyJson(req);
            const scope = store.setScope({
              mode: body?.mode || 'custom',
              enabledClients: body?.enabledClients,
            });
            let allClients = [];
            try { allClients = [...new Set(clientsForBin(bin).split(',').filter(Boolean).map(canonicalClient))]; } catch { /* ignore */ }
            sendJson(res, 200, {
              ok: true,
              scope,
              clients: store.scopedCatalogClients(allClients),
              allClients,
            });
          } catch (e) {
            sendJson(res, 400, { error: e?.message || String(e) });
          }
          return;
        }
        try {
          const result = await probeSources({ home: cfg.home });
          let allClients = [];
          try { allClients = [...new Set(clientsForBin(bin).split(',').filter(Boolean).map(canonicalClient))]; }
          catch (e) { allClients = [...new Set(result.candidates.map(c => canonicalClient(c.client)))]; result.catalogError = e.message; }
          result.allClients = allClients;
          result.scope = store.getScope();
          result.clients = store.scopedCatalogClients(allClients);
          sendJson(res, 200, result);
        }
        catch (e) { sendJson(res, 500, { error: e?.message || String(e) }); }
      },
    }));

    disposers.push(webServer.register({
      kind: 'exact', path: '/tokscale-usage/cancel',
      handler: (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return; }
        if (!sameOrigin(req)) { sendJson(res, 403, { error: 'untrusted origin' }); return; }
        const id = new URL(req.url, 'http://localhost').searchParams.get('id');
        if (!validId(id)) { sendJson(res, 400, { error: 'invalid request id' }); return; }
        pruneCancelled();
        cancelled.set(id, Date.now() + 60000);
        requests.get(id)?.abort();
        sendJson(res, 202, { ok: true });
      },
    }));

    const reportHandler = cacheOnly => async (req, res) => {
      if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return; }
      if (!sameOrigin(req)) { sendJson(res, 403, { error: 'untrusted origin' }); return; }
      const params = new URL(req.url, 'http://localhost').searchParams;
      const id = params.get('requestId');
      if (id && !validId(id)) { sendJson(res, 400, { error: 'invalid request id' }); return; }
      if (id && requests.has(id)) { sendJson(res, 409, { error: 'request id already active' }); return; }
      const controller = new AbortController();
      pruneCancelled();
      if (id) {
        requests.set(id, controller);
        if (cancelled.has(id)) controller.abort();
      }
      let disconnected = false;
      const onClose = () => { if (!res.writableEnded) { disconnected = true; controller.abort(); } };
      res.on?.('close', onClose);
      try {
        const options = {
          client: params.get('client') || 'all', model: params.get('model') || 'all',
          range: params.get('range') || 'month', since: params.get('since') || undefined,
          until: params.get('until') || undefined, refresh: !cacheOnly && params.get('refresh') === 'true',
          signal: controller.signal,
        };
        if (params.get('rich') === '1' || params.get('rich') === 'true') options.includeRich = true;
        if (cacheOnly) options.cacheOnly = true;
        const result = await store.query(options);
        if (!controller.signal.aborted) {
          if (cacheOnly && result === null) { res.writeHead(204, { 'cache-control': 'no-store' }); res.end(); }
          else sendJson(res, 200, result);
        }
      } catch (e) { if (!controller.signal.aborted) sendJson(res, 400, { error: e?.message || String(e) }); }
      finally {
        res.off?.('close', onClose);
        if (id && requests.get(id) === controller) requests.delete(id);
        if (controller.signal.aborted && !disconnected && !res.writableEnded && !res.destroyed) { res.writeHead(499); res.end(); }
      }
    };

    for (const endpoint of ['report', 'cached-report']) {
      disposers.push(webServer.register({
        kind: 'exact', path: `/tokscale-usage/${endpoint}`, handler: reportHandler(endpoint === 'cached-report'),
      }));
    }

    disposers.push(webServer.register({
      kind: 'exact', path: '/tokscale-usage/status',
      handler: (req, res) => {
        if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return; }
        if (!sameOrigin(req)) { sendJson(res, 403, { error: 'untrusted origin' }); return; }
        sendJson(res, 200, store.progressStatus());
      },
    }));

    disposers.push(webServer.register({
      kind: 'exact', path: '/tokscale-usage/progressive-refresh',
      handler: (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return; }
        if (!sameOrigin(req)) { sendJson(res, 403, { error: 'untrusted origin' }); return; }
        const params = new URL(req.url, 'http://localhost').searchParams;
        void store.startProgressiveRefresh({
          client: params.get('client') || 'all',
          range: params.get('range') || 'today',
          since: params.get('since') || undefined,
          until: params.get('until') || undefined,
          discoverAll: params.get('discoverAll') === '1' || params.get('discoverAll') === 'true',
        });
        sendJson(res, 202, { ok: true, progress: store.progressStatus() });
      },
    }));
  } else log.warn?.('webServer service unavailable; API routes not registered');

  const cleanup = () => {
    for (const d of disposers) { try { d?.(); } catch { /* ignore */ } }
    store.dispose();
  };
  if (typeof ctx.effect === 'function') ctx.effect(() => cleanup, 'dsh-tokscale-usage registrations');

  return { store };
}
