// tokscale engine adapter: locate the native binary, run it, parse JSON.
// The plugin talks to the real junhoyeo/tokscale CLI (Rust engine). It never
// re-implements session parsing; tokscale owns collection, fork/subagent
// deduplication, compaction handling and token definitions.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXE_NAME = process.platform === 'win32' ? 'tokscale.exe' : 'tokscale';
const MAX_STDOUT = 64 * 1024 * 1024; // 64 MiB guard; reports are far smaller.

function safeRealpath(p) {
  try { return fs.realpathSync(p); } catch { return p; }
}

// Bounded depth-first search for the platform native binary under a package
// root. tokscale ships it inside @tokscale/cli-<platform>/bin/.
function searchExe(dir, depth) {
  if (depth > 6) return null;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    if (e.isFile() && e.name === EXE_NAME) return path.join(dir, e.name);
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('cli-') || e.name === '@tokscale' || e.name === 'node_modules' || e.name === 'bin') {
      const hit = searchExe(path.join(dir, e.name), depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function nativeExeFromShim(realShim) {
  const dir = path.dirname(realShim);
  const roots = [
    path.join(dir, 'node_modules', 'tokscale'),
    path.join(dir, '..', 'tokscale'),
    path.join(dir, 'node_modules', '@tokscale'),
    path.join(dir, '..', '@tokscale'),
  ];
  for (const root of roots) {
    const hit = searchExe(root, 0);
    if (hit) return hit;
  }
  return null;
}

function resolveBundledTokscaleExe(baseUrl = import.meta.url) {
  try {
    const req = createRequire(baseUrl);
    for (const pkg of ['@tokscale/cli/package.json', 'tokscale/package.json']) {
      try {
        const pkgJson = safeRealpath(req.resolve(pkg));
        const pkgDir = path.dirname(pkgJson);
        const candidates = [
          pkgDir,
          path.resolve(pkgDir, '..'),
          path.resolve(pkgDir, '..', '..'),
          path.resolve(pkgDir, 'node_modules', '@tokscale'),
        ];
        for (const root of candidates) {
          const hit = searchExe(root, 0);
          if (hit) return hit;
        }
      } catch { /* try next */ }
    }
    const selfRoot = path.resolve(path.dirname(fileURLToPath(baseUrl)), '..', 'node_modules');
    const localHit = searchExe(selfRoot, 0);
    if (localHit) return localHit;
  } catch { /* ignore */ }
  return null;
}

// Resolve how to invoke tokscale. Preference: explicit config / env override,
// bundled @tokscale/cli dependency (zero-install for DSH users), PATH shim, then shell fallback.
export function resolveTokscaleBin(config = {}) {
  const explicit = config.tokscaleBin || process.env.TOKSCALE_BIN;
  if (explicit) return { kind: 'file', path: explicit, source: 'config' };

  const bundled = resolveBundledTokscaleExe();
  if (bundled) return { kind: 'file', path: bundled, source: 'bundled-dep' };

  const locator = process.platform === 'win32' ? 'where' : 'which';
  let candidates = [];
  try {
    candidates = execFileSync(locator, ['tokscale'], { encoding: 'utf8', timeout: 8000, windowsHide: true })
      .split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } catch { /* not on PATH */ }

  for (const cand of candidates) {
    const real = safeRealpath(cand);
    if (real.toLowerCase().endsWith('.exe')) return { kind: 'file', path: real, source: 'path-exe' };
    const exe = nativeExeFromShim(real);
    if (exe) return { kind: 'file', path: exe, source: 'path-native' };
  }
  // Last resort: let the shell resolve the shim (tokscale.cmd on Windows).
  if (candidates.length) return { kind: 'shell', command: 'tokscale', source: 'path-shell' };
  return { kind: 'shell', command: 'tokscale', source: 'fallback-shell' };
}

// Explicit list avoids tokscale's persistent defaultClients silently narrowing an
// unfiltered query. Keep in sync with the supported CLI's --help client values.
export const ALL_CLIENTS = 'opencode,claude,codex,cursor,gemini,amp,droid,openclaw,pi,kimi,qwen,roocode,kilocode,mux,kilo,crush,hermes,copilot,goose,codebuff,antigravity,zed,kiro,trae,warp,cline,9router,gjc,grok,jcode,commandcode,micode,antigravity-cli,junie,zcode,opencodereview,codebuddy,workbuddy,devin-cli,devin-desktop,senpi,augment,kimchi,reasonix,prime-agent,freebuff,cherrystudio,dsh,mcode,fx,omp,lmstudio,unsloth,hindsight,micode-desktop,muse,antigravity-extension,synthetic';

// Clients whose local stores commonly scan in ~20s+ vs sub-second core clients.
export const HEAVY_CLIENTS = new Set(['codex', 'antigravity-extension', 'openclaw']);
export const FAST_CLIENT_HINTS = ['dsh', 'antigravity-cli', 'opencode', 'claude', 'antigravity', 'zcode', 'cline'];

/** Normalize engine performance block into output-generation throughput metrics. */
export function extractPerformance(entry) {
  const perf = entry?.performance;
  if (!perf || typeof perf !== 'object') return null;
  const totalDurationMs = Number.isFinite(perf.totalDurationMs) ? perf.totalDurationMs : 0;
  let timedTokens = Number.isFinite(perf.timedTokens) ? perf.timedTokens : 0;
  let msPer1KTokens = Number.isFinite(perf.msPer1KTokens) && perf.msPer1KTokens > 0 ? perf.msPer1KTokens : null;

  // tokscale's native `timedTokens` sums ALL tokens (input + cacheRead + cacheWrite + output + reasoning),
  // inflating high-cache harnesses like Codex (98%+ cacheRead) to 5,000–35,000+ tok/s.
  // Rescale `timedTokens` to generated tokens (`output + reasoning`) whenever real token buckets are present.
  if (!perf.outputNormalized) {
    const promptTok = (Number(entry?.input) || 0) + (Number(entry?.cacheRead) || 0) + (Number(entry?.cacheWrite) || 0);
    const genTok = (Number(entry?.output) || 0) + (Number(entry?.reasoning) || 0);
    const allTok = promptTok + genTok;
    if (promptTok > 0 && allTok > 0 && timedTokens > 0 && timedTokens <= allTok * 1.02 && timedTokens > genTok * 1.05) {
      if (genTok <= 0) return null;
      const cov = Number.isFinite(perf.tokenCoverage) && perf.tokenCoverage > 0 && perf.tokenCoverage <= 1
        ? perf.tokenCoverage
        : Math.min(1, timedTokens / allTok);
      timedTokens = Math.round(genTok * cov);
      msPer1KTokens = totalDurationMs > 0 && timedTokens > 0 ? totalDurationMs / (timedTokens / 1000) : null;
    }
  }

  const tokensPerSec = totalDurationMs > 0 && timedTokens > 0
    ? timedTokens / (totalDurationMs / 1000)
    : msPer1KTokens ? 1000 / (msPer1KTokens / 1000) : null;
  if (tokensPerSec === null && msPer1KTokens === null) return null;
  return {
    msPer1KTokens,
    tokensPerSec,
    totalDurationMs,
    timedTokens,
    outputNormalized: true,
    sampleCount: Number.isFinite(perf.sampleCount) ? perf.sampleCount : 0,
    tokenCoverage: Number.isFinite(perf.tokenCoverage) ? perf.tokenCoverage : null,
    source: 'tokscale',
  };
}

// Build argv for a report view. `sub` is '' (default report), 'monthly', 'hourly', 'graph', or 'time-metrics'.
export function buildArgs({ sub = '', client = 'dsh', range = 'month', since, until, home, groupBy = 'client,provider,model' } = {}) {
  const args = [];
  if (sub) args.push(sub);
  const selected = client === 'all' ? ALL_CLIENTS : client;
  if (typeof selected !== 'string' || !selected.split(',').every(c => /^[a-z0-9][a-z0-9-]*$/.test(c))) throw new Error('invalid tokscale client');
  for (const date of [since, until]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('invalid tokscale date');
  }
  if (since && until && since > until) throw new Error('invalid tokscale date range');
  if (!['today', 'yesterday', 'days3', 'week', 'month', 'year', 'all'].includes(range)) throw new Error('invalid tokscale range');
  if (!['', 'hourly', 'monthly', 'graph', 'time-metrics'].includes(sub)) throw new Error('invalid tokscale subcommand');
  if (!['client,provider,model', 'workspace,model', 'client,model', 'client,session,model'].includes(groupBy)) throw new Error('invalid tokscale groupBy');
  args.push('-c', selected);
  // `tokscale graph` always emits JSON and does not accept `--json`.
  if (sub !== 'graph') args.push('--json');
  args.push('--no-spinner');
  if (!sub) {
    args.push('--group-by', groupBy);
    if (groupBy === 'workspace,model') args.push('--merge-worktrees');
  }
  if (since) args.push('--since', since);
  if (until) args.push('--until', until);
  if (!since && !until) {
    if (range === 'today') args.push('--today');
    else if (range === 'yesterday') args.push('--yesterday');
    else if (range === 'days3') {
      const fmtLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
      args.push('--since', fmtLocal(start), '--until', fmtLocal(now));
    }
    else if (range === 'week') args.push('--week');
    else if (range === 'month') args.push('--month');
    else if (range === 'year') args.push('--year', String(new Date().getFullYear()));
    // range === 'all' => no date filter (full scan; slow).
  }
  if (home) args.push('--home', home);
  return args;
}

// Run tokscale and parse its JSON stdout. Rejects on non-zero exit, timeout,
// abort, oversized output or invalid JSON. stderr is captured for diagnostics.
export function runTokscaleJson(bin, args, { signal, timeoutMs = 180000, env } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    const opts = { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, ...(env ? { env } : {}) };
    // A shell fallback must not interpret user-supplied paths as commands.
    if (bin.kind !== 'file' && args.some(a => /[\s"'&|<>^%!?`$()\r\n]/.test(String(a)))) {
      reject(new Error('unsafe argument for tokscale shell fallback; configure a native binary'));
      return;
    }
    try {
      child = bin.kind === 'file'
        ? spawn(bin.path, args, opts)
        : spawn(bin.command, args, { ...opts, shell: true });
    } catch (e) {
      reject(new Error('tokscale spawn failed: ' + e.message));
      return;
    }
    let stdout = '', stderr = '', settled = false, terminationError = null;
    const finish = (err, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (err) reject(err); else resolve(val);
    };
    const kill = () => { try { if (child.pid) child.kill('SIGKILL'); } catch { /* already gone */ } };
    // Attach immediately after finish/kill are defined: an 'error' event with no
    // listener is re-raised as uncaughtException (e.g. ENOENT landing after an
    // abort already settled). finish() is idempotent, so late events are safe.
    child.on('error', e => { finish(new Error('tokscale spawn failed: ' + e.message)); });
    const stop = error => { if (!terminationError) terminationError = error; kill(); };
    const timer = setTimeout(() => stop(new Error(`tokscale timed out after ${timeoutMs}ms`)), timeoutMs);
    const onAbort = () => stop(new Error('tokscale run aborted'));
    if (signal) {
      if (signal.aborted) onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }
    child.stdout.on('data', d => {
      stdout += d;
      if (stdout.length > MAX_STDOUT) stop(new Error('tokscale stdout exceeded 64 MiB'));
    });
    child.stderr.on('data', d => { if (stderr.length < 8192) stderr += d; });
    child.on('exit', () => { /* drain late events */ });
    child.on('close', code => {
      if (terminationError) { finish(terminationError); return; }
      if (code !== 0) {
        finish(new Error(`tokscale exited ${code}: ${stderr.trim().slice(0, 500) || '(no stderr)'}`));
        return;
      }
      try { finish(null, JSON.parse(stdout)); }
      catch (e) { finish(new Error(`tokscale returned invalid JSON: ${e.message}; head=${stdout.slice(0, 200)}`)); }
    });
  });
}

const supportedClients = new Map();
export function clientsForBin(bin) {
  if (bin.kind !== 'file') throw new Error('all-client queries require a native tokscale binary to discover supported clients');
  let fingerprint;
  try { const stat = fs.statSync(bin.path); fingerprint = `${bin.path}:${stat.size}:${stat.mtimeMs}`; }
  catch (e) { throw new Error('cannot inspect tokscale binary: ' + e.message); }
  if (supportedClients.has(fingerprint)) return supportedClients.get(fingerprint);
  let help;
  try { help = execFileSync(bin.path, ['--help'], { encoding: 'utf8', timeout: 8000, windowsHide: true }); }
  catch (e) { throw new Error('cannot discover tokscale clients: ' + e.message); }
  const match = help.match(/--client\s+<[^>]+>[\s\S]*?\[possible values:\s*([^\]]+)\]/);
  const clients = match?.[1].split(',').map(s => s.trim());
  if (!clients?.length || !clients.every(c => /^[a-z0-9][a-z0-9-]*$/.test(c))) throw new Error('cannot discover supported tokscale clients from --help');
  const result = clients.join(',');
  supportedClients.set(fingerprint, result);
  return result;
}

/**
 * Build a read-only same-volume hardlink window for bounded `codex` scans when
 * `~/.codex/archived_sessions` holds hundreds/thousands of historical `.zst` archives.
 * Cuts incremental `tokscale -c codex` scan time from ~95s down to ~1–3s without
 * modifying any original Codex files.
 */
function prepareCodexWindowEnv(viewOpts) {
  if (!viewOpts || viewOpts.range === 'all') return undefined;
  const clientSpec = String(viewOpts.client || '');
  const includesCodex = clientSpec === 'all' || clientSpec.split(',').map(s => s.trim()).includes('codex');
  if (!includesCodex) return undefined;
  const fmtLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  let sinceStr = viewOpts.since || null;
  let untilStr = viewOpts.until || null;
  if (!sinceStr && !untilStr) {
    if (viewOpts.range === 'today') { sinceStr = fmtLocal(now); untilStr = sinceStr; }
    else if (viewOpts.range === 'yesterday') { const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1); sinceStr = fmtLocal(y); untilStr = sinceStr; }
    else if (viewOpts.range === 'days3') { sinceStr = fmtLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2)); untilStr = fmtLocal(now); }
    else if (viewOpts.range === 'week') { sinceStr = fmtLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); untilStr = fmtLocal(now); }
    else if (viewOpts.range === 'month') { sinceStr = `${fmtLocal(now).slice(0, 8)}01`; untilStr = fmtLocal(now); }
    else return undefined;
  }
  if (!sinceStr || !untilStr) return undefined;

  try {
    const defaultHome = process.platform === 'win32' && process.env.HOME && path.isAbsolute(process.env.HOME) ? process.env.HOME : os.homedir();
    const codexHome = (!viewOpts.home && process.env.CODEX_HOME) ? process.env.CODEX_HOME : path.join(viewOpts.home || defaultHome, '.codex');
    const archDir = path.join(codexHome, 'archived_sessions');
    let archCount = 0;
    try { archCount = fs.readdirSync(archDir).length; } catch { archCount = 0; }
    if (archCount <= 25) return undefined;

    const realSessions = fs.realpathSync(path.join(codexHome, 'sessions'));
    const startMs = Date.parse(sinceStr + 'T00:00:00') - 7 * 86400000; // 7-day lookback for multi-day threads
    const endMs = Date.parse(untilStr + 'T00:00:00');
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || (endMs - startMs) > 75 * 86400000) return undefined;

    const stageRoot = path.join(path.dirname(realSessions), '.tokscale-codex-window');
    const stageSessions = path.join(stageRoot, 'sessions');
    fs.rmSync(stageSessions, { recursive: true, force: true });
    fs.mkdirSync(stageSessions, { recursive: true });

    for (let t = startMs; t <= endMs; t += 86400000) {
      const ds = fmtLocal(new Date(t));
      const [y, m, d] = ds.split('-');
      const srcDay = path.join(realSessions, y, m, d);
      let names;
      try { names = fs.readdirSync(srcDay); } catch { continue; }
      const jsonls = names.filter(fn => fn.endsWith('.jsonl'));
      if (!jsonls.length) continue;
      const dstDay = path.join(stageSessions, y, m, d);
      fs.mkdirSync(dstDay, { recursive: true });
      for (const fn of jsonls) {
        const srcFile = path.join(srcDay, fn);
        const dstFile = path.join(dstDay, fn);
        try { fs.linkSync(srcFile, dstFile); } catch { fs.copyFileSync(srcFile, dstFile); }
      }
    }
    return { ...process.env, CODEX_HOME: stageRoot };
  } catch {
    return undefined;
  }
}

// Convenience: resolve once, then run a view. Returns { data, bin, args, ms }.
export async function runView(viewOpts, { config = {}, signal, timeoutMs } = {}) {
  const bin = resolveTokscaleBin(config);
  const args = buildArgs(viewOpts);
  if (viewOpts.client === 'all') args[args.indexOf('-c') + 1] = clientsForBin(bin);
  const env = viewOpts.home ? undefined : prepareCodexWindowEnv(viewOpts);
  const started = Date.now();
  const data = await runTokscaleJson(bin, args, { signal, timeoutMs, env });
  return { data, bin, args, ms: Date.now() - started };
}