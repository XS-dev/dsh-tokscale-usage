// Read-only local task & session telemetry collector with stat/mtime caching.
// Reads bounded metadata from DSH's context overview cache and recent Codex
// session logs to supply per-task token/cost attribution and DSH throughput
// metrics (tok/s, TTFT) without running expensive full-history LLM reports.
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const n = v => (Number.isFinite(v) ? v : 0);

function dateFromEpochMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inDateRange(dateStr, sinceDate, untilDate) {
  if (!dateStr) return !sinceDate && !untilDate;
  if (sinceDate && dateStr < sinceDate) return false;
  if (untilDate && dateStr > untilDate) return false;
  return true;
}

function enumerateRecentDates(sinceDate, untilDate, maxDays = 35) {
  const end = untilDate ? new Date(untilDate + 'T00:00:00') : new Date();
  // Include 1 extra lookback day when sinceDate is set so overnight sessions stay visible
  const rawStart = sinceDate
    ? new Date(new Date(sinceDate + 'T00:00:00').getTime() - 86400000)
    : new Date(end.getTime() - (maxDays - 1) * 86400000);
  if (Number.isNaN(end.getTime()) || Number.isNaN(rawStart.getTime())) return [];
  const floor = new Date(end.getTime() - (maxDays - 1) * 86400000);
  const cursor = rawStart > floor ? rawStart : floor;
  const dates = [];
  for (let t = cursor.getTime(); t <= end.getTime() && dates.length < maxDays; t += 86400000) {
    const d = new Date(t);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return dates.reverse(); // newest first
}

function normalizeWorkspace(cwd) {
  if (!cwd || typeof cwd !== 'string') return { workspaceKey: '', workspaceLabel: '' };
  const cleaned = cwd.replace(/\\/g, '/').replace(/\/+$/, '').replace(/^[a-z]:(?=\/|$)/, m => m.toUpperCase());
  const parts = cleaned.split('/').filter(Boolean);
  const label = parts[parts.length - 1] || cleaned;
  return { workspaceKey: cleaned, workspaceLabel: label };
}

// --- Mtime-keyed file caches to eliminate repeated disk I/O on filter clicks ---
const dshOverviewCache = new Map();   // filePath -> { sig, parsed }
const codexIndexCache = new Map();    // filePath -> { sig, titles }
const codexRolloutCache = new Map();  // filePath -> { sig, parsed }
const agySummaryDbCache = new Map();  // dbPath -> { sig, byId }
const taskQueryMemo = new Map();      // queryKey -> { at, promise }

async function readDshOverviewCached(filePath) {
  const st = await fs.stat(filePath);
  const sig = `${st.size}:${st.mtimeMs}`;
  const hit = dshOverviewCache.get(filePath);
  if (hit && hit.sig === sig) return hit.parsed;
  const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
  dshOverviewCache.set(filePath, { sig, parsed });
  if (dshOverviewCache.size > 8) dshOverviewCache.delete(dshOverviewCache.keys().next().value);
  return parsed;
}

async function readCodexIndexCached(filePath) {
  const st = await fs.stat(filePath);
  const sig = `${st.size}:${st.mtimeMs}`;
  const hit = codexIndexCache.get(filePath);
  if (hit && hit.sig === sig) return hit.titles;
  const titles = new Map();
  const idxRaw = await fs.readFile(filePath, 'utf8');
  for (const line of idxRaw.split(/\r?\n/)) {
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj?.id) titles.set(obj.id, { title: obj.thread_name || obj.id, updatedAt: Date.parse(obj.updated_at || '') || 0 });
    } catch { /* skip malformed line */ }
  }
  codexIndexCache.set(filePath, { sig, titles });
  if (codexIndexCache.size > 8) codexIndexCache.delete(codexIndexCache.keys().next().value);
  return titles;
}

/** Extract DSH session tasks, per-model decode throughput, and deep execution profile from dsh-context cache. */
export async function loadDshTasks({ dshHome, sinceDate = null, untilDate = null, model = 'all' } = {}) {
  const emptyProfile = {
    timingBreakdown: { ttftMs: 0, reasoningMs: 0, textMs: 0, toolArgMs: 0, toolsMs: 0, wallMs: 0, calls: 0, toolCalls: 0 },
    outputBreakdown: { answerTokens: 0, reasoningTokens: 0, toolCallTokens: 0 },
    topTools: [],
    sessionOrigins: { mainCount: 0, subagentCount: 0, mainTokens: 0, subagentTokens: 0, avgContextRatio: null, peakContextRatio: null },
  };
  if (!dshHome) return { tasks: [], modelThroughput: new Map(), executionProfile: emptyProfile };
  const file = path.join(dshHome, 'storages', 'dsh-context', 'overview-cache.v1.json');
  let raw;
  try {
    raw = await readDshOverviewCached(file);
  } catch {
    return { tasks: [], modelThroughput: new Map(), executionProfile: emptyProfile };
  }
  const rows = Array.isArray(raw?.sessions) ? raw.sessions : [];
  const tasks = [];
  const modelAgg = new Map();
  const toolAgg = new Map();
  const tb = { ttftMs: 0, reasoningMs: 0, textMs: 0, toolArgMs: 0, toolsMs: 0, wallMs: 0, calls: 0, toolCalls: 0 };
  const ob = { answerTokens: 0, reasoningTokens: 0, toolCallTokens: 0 };
  let mainCount = 0, subagentCount = 0, mainTokens = 0, subagentTokens = 0;
  let ctxSum = 0, ctxN = 0, ctxPeak = 0;

  for (const item of rows) {
    const s = item?.session;
    if (!s || s.blank) continue;
    const tl = s.timeline || {};
    const timing = tl.timing || {};
    const daysObj = s.activity?.days;
    const matchedModels = new Set();
    if (tl.model) matchedModels.add(String(tl.model));

    let tokens = 0, allDaysTokens = 0, input = 0, output = 0, cacheRead = 0, cacheWrite = 0;
    let requests = 0, turns = 0, toolCalls = 0, toolsMs = 0, wallMs = 0, matched = false;

    if (daysObj && typeof daysObj === 'object' && Object.keys(daysObj).length > 0) {
      for (const [day, stats] of Object.entries(daysObj)) {
        const dayTok = n(stats?.tokens);
        allDaysTokens += dayTok;
        if (!inDateRange(day, sinceDate, untilDate)) continue;
        matched = true;
        tokens += dayTok;
        requests += n(stats?.requests);
        turns += n(stats?.turns);
        toolCalls += n(stats?.toolCalls);
        toolsMs += n(stats?.toolsMs);
        wallMs += n(stats?.wallMs);
        if (stats?.cost && typeof stats.cost === 'object') {
          for (const models of Object.values(stats.cost)) {
            if (!models || typeof models !== 'object') continue;
            for (const [modelName, tiers] of Object.entries(models)) {
              matchedModels.add(modelName);
              for (const bucket of Object.values(tiers || {})) {
                input += n(bucket?.uncached);
                cacheRead += n(bucket?.cacheRead);
                cacheWrite += n(bucket?.cacheWrite);
                output += n(bucket?.output);
              }
            }
          }
        }
      }
    } else {
      const updatedDay = dateFromEpochMs(s.updatedAt);
      if (inDateRange(updatedDay, sinceDate, untilDate)) {
        matched = true;
        tokens = n(tl.total);
        allDaysTokens = tokens;
        turns = n(tl.turns);
        requests = n(timing.calls);
        toolCalls = n(timing.toolCalls);
        toolsMs = n(timing.toolsMs);
        wallMs = n(timing.wallMs);
      }
    }

    if (!matched || (tokens <= 0 && requests <= 0)) continue;
    const modelLabel = tl.model || [...matchedModels][0] || '—';
    if (model && model !== 'all' && modelLabel !== model && !matchedModels.has(model)) continue;

    const totalTok = tokens || (input + output + cacheRead + cacheWrite);
    const ratio = allDaysTokens > 0 ? Math.min(1, Math.max(0.05, tokens / allDaysTokens)) : 1;

    const speedTokens = n(timing.speedTokens) || (n(tl.generatedAnswerTokens) + n(tl.generatedReasoning) + n(tl.generatedCallTokens));
    const speedMs = n(timing.speedMs) || n(timing.genMs);
    const ttftMs = n(timing.ttftMs);
    const calls = n(timing.calls) || requests;
    const outputTps = speedMs > 0 && speedTokens > 0 ? speedTokens / (speedMs / 1000) : null;
    const avgTtftMs = calls > 0 && ttftMs > 0 ? ttftMs / calls : null;

    if (tl.model && speedMs > 0 && speedTokens > 0) {
      const mKey = String(tl.model);
      const cur = modelAgg.get(mKey) || { model: mKey, client: 'dsh', speedTokens: 0, speedMs: 0, ttftMs: 0, calls: 0 };
      cur.speedTokens += speedTokens * ratio;
      cur.speedMs += speedMs * ratio;
      cur.ttftMs += ttftMs * ratio;
      cur.calls += calls * ratio;
      modelAgg.set(mKey, cur);
    }

    tb.ttftMs += n(timing.ttftMs) * ratio;
    tb.reasoningMs += n(timing.reasoningMs) * ratio;
    tb.textMs += n(timing.textMs) * ratio;
    tb.toolArgMs += n(timing.toolArgMs) * ratio;
    tb.toolsMs += (toolsMs || n(timing.toolsMs) * ratio);
    tb.wallMs += (wallMs || n(timing.wallMs) * ratio);
    tb.calls += requests || Math.round(n(timing.calls) * ratio);
    tb.toolCalls += toolCalls || Math.round(n(timing.toolCalls) * ratio);

    ob.answerTokens += Math.round(n(tl.generatedAnswerTokens) * ratio);
    ob.reasoningTokens += Math.round(n(tl.generatedReasoning) * ratio);
    ob.toolCallTokens += Math.round(n(tl.generatedCallTokens) * ratio);

    if (timing.tools && typeof timing.tools === 'object') {
      for (const [toolName, tStat] of Object.entries(timing.tools)) {
        const tc = Math.max(0, Math.round(n(tStat?.calls) * ratio));
        const tm = n(tStat?.ms) * ratio;
        if (tc <= 0 && tm <= 0) continue;
        const prev = toolAgg.get(toolName) || { name: toolName, calls: 0, totalMs: 0 };
        prev.calls += tc || 1;
        prev.totalMs += tm;
        toolAgg.set(toolName, prev);
      }
    }

    const isSubagent = Boolean(s.parentSession || (s.origin && s.origin !== 'main'));
    if (isSubagent) {
      subagentCount++;
      subagentTokens += totalTok;
    } else {
      mainCount++;
      mainTokens += totalTok;
    }

    const ctxWin = n(tl.contextWindow);
    const ctxCur = n(tl.current);
    const contextRatio = ctxWin > 0 && ctxCur > 0 ? Math.min(1, ctxCur / ctxWin) : null;
    if (contextRatio != null) {
      ctxSum += contextRatio;
      ctxN++;
      if (contextRatio > ctxPeak) ctxPeak = contextRatio;
    }

    const ws = normalizeWorkspace(s.cwd);
    tasks.push({
      id: String(s.id || ''),
      client: 'dsh',
      title: String(s.title || tl.lastUser || s.id || 'DSH Session'),
      cwd: s.cwd ? String(s.cwd) : '',
      workspaceKey: ws.workspaceKey,
      workspaceLabel: ws.workspaceLabel,
      origin: s.origin || 'main',
      isSubagent,
      parentId: s.parentSession || null,
      model: modelLabel,
      updatedAt: n(s.updatedAt),
      totalTokens: totalTok,
      input,
      output,
      cacheRead,
      cacheWrite,
      reasoning: Math.round(n(tl.generatedReasoning) * ratio),
      turns,
      steps: n(tl.steps),
      contextRatio,
      requests,
      toolCalls,
      wallMs,
      toolsMs,
      speedMs,
      speedTokens,
      outputTps,
      avgTtftMs,
    });
  }

  const modelThroughput = new Map();
  for (const [mKey, agg] of modelAgg) {
    modelThroughput.set(mKey, {
      client: 'dsh',
      model: mKey,
      tokensPerSec: agg.speedMs > 0 ? agg.speedTokens / (agg.speedMs / 1000) : null,
      msPer1KTokens: agg.speedTokens > 0 ? agg.speedMs / (agg.speedTokens / 1000) : null,
      avgTtftMs: agg.calls > 0 && agg.ttftMs > 0 ? agg.ttftMs / agg.calls : null,
      totalDurationMs: agg.speedMs,
      timedTokens: agg.speedTokens,
      sampleCount: Math.round(agg.calls),
      source: 'dsh-context',
    });
  }

  const topTools = [...toolAgg.values()]
    .map(t => ({ ...t, totalMs: Math.round(t.totalMs), avgMs: t.calls > 0 ? Math.round(t.totalMs / t.calls) : 0 }))
    .sort((a, b) => (b.totalMs - a.totalMs) || (b.calls - a.calls))
    .slice(0, 12);

  return {
    tasks,
    modelThroughput,
    executionProfile: {
      timingBreakdown: {
        ttftMs: Math.round(tb.ttftMs),
        reasoningMs: Math.round(tb.reasoningMs),
        textMs: Math.round(tb.textMs),
        toolArgMs: Math.round(tb.toolArgMs),
        toolsMs: Math.round(tb.toolsMs),
        wallMs: Math.round(tb.wallMs),
        calls: Math.round(tb.calls),
        toolCalls: Math.round(tb.toolCalls),
      },
      outputBreakdown: ob,
      topTools,
      sessionOrigins: {
        mainCount,
        subagentCount,
        mainTokens,
        subagentTokens,
        avgContextRatio: ctxN > 0 ? ctxSum / ctxN : null,
        peakContextRatio: ctxN > 0 ? ctxPeak : null,
      },
    },
  };
}

// Read 64KB head so Codex 22KB+ session_meta lines (with system instructions) parse cleanly.
async function readHeadAndTail(filePath, st, headBytes = 65536, tailBytes = 32768) {
  const fh = await fs.open(filePath, 'r');
  try {
    const headLen = Math.min(headBytes, st.size);
    const headBuf = Buffer.alloc(headLen);
    if (headLen > 0) await fh.read(headBuf, 0, headLen, 0);
    let tailText = '';
    if (st.size > headLen) {
      const start = Math.max(headLen, st.size - tailBytes);
      const len = st.size - start;
      const tailBuf = Buffer.alloc(len);
      await fh.read(tailBuf, 0, len, start);
      tailText = tailBuf.toString('utf8');
    } else {
      tailText = headBuf.toString('utf8');
    }
    return { headText: headBuf.toString('utf8'), tailText, mtimeMs: st.mtimeMs };
  } finally {
    await fh.close();
  }
}

const ROLLOUT_RE = /^rollout-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-\d{2}-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function pickJsonStringField(rawText, key) {
  const m = rawText.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) return '';
  try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; }
}

function extractFirstUserPrompt(text) {
  const m = text.match(/"type"\s*:\s*"user_message"\s*,\s*"message"\s*:\s*"((?:[^"\\]|\\.){2,360})/);
  if (m) {
    try {
      const clean = JSON.parse(`"${m[1]}"`).replace(/\s+/g, ' ').trim();
      if (clean) return clean.length > 76 ? clean.slice(0, 75) + '…' : clean;
    } catch { /* ignore */ }
  }
  return '';
}

async function parseCodexRolloutCached(file) {
  const st = await fs.stat(file);
  const sig = `${st.size}:${st.mtimeMs}`;
  const hit = codexRolloutCache.get(file);
  if (hit && hit.sig === sig) return hit.parsed;

  const { headText, tailText, mtimeMs } = await readHeadAndTail(file, st);
  const baseName = path.basename(file, '.jsonl');
  const fm = baseName.match(ROLLOUT_RE);
  let sessionId = fm ? fm[6] : baseName;
  let cwd = '';
  let updatedAt = mtimeMs;
  let model = 'codex';
  let isSubagent = false;
  let subRole = '';

  const firstLine = headText.split(/\r?\n/)[0] || '';
  try {
    const meta = JSON.parse(firstLine);
    const p = meta?.payload || {};
    sessionId = p.id || p.session_id || sessionId;
    cwd = p.cwd || '';
    if (p.model) model = p.model;
    if (p.source && typeof p.source === 'object' && p.source.subagent) {
      isSubagent = true;
      const sp = p.source.subagent.thread_spawn || p.source.subagent;
      subRole = sp?.agent_nickname || sp?.agent_role || (typeof sp?.other === 'string' ? sp.other : '');
    }
  } catch {
    // Fallback regex extraction if instructions exceeded 64KB
    const idMatch = firstLine.match(/"id"\s*:\s*"([0-9a-f-]{36})"/i);
    if (idMatch) sessionId = idMatch[1];
    cwd = pickJsonStringField(firstLine, 'cwd');
    isSubagent = /"subagent"\s*:/.test(firstLine);
  }

  let usage = null;
  const tailLines = tailText.split(/\r?\n/);
  for (let i = tailLines.length - 1; i >= 0; i--) {
    const line = tailLines[i];
    if (!line) continue;
    if (model === 'codex' && line.includes('"model"')) {
      try {
        const parsed = JSON.parse(line);
        const m = parsed?.payload?.model;
        if (typeof m === 'string' && m) model = m;
      } catch { /* ignore */ }
    }
    if (!usage && line.includes('"token_count"')) {
      try {
        const parsed = JSON.parse(line);
        const info = parsed?.payload?.info?.total_token_usage;
        if (info && typeof info === 'object') {
          usage = info;
          if (parsed.timestamp) updatedAt = Date.parse(parsed.timestamp) || updatedAt;
        }
      } catch { /* ignore */ }
    }
    if (usage && model !== 'codex') break;
  }

  let parsed = null;
  if (usage) {
    const rawIn = n(usage.input_tokens);
    const cacheRead = n(usage.cached_input_tokens);
    const cacheWrite = n(usage.cache_write_input_tokens);
    const rawOut = n(usage.output_tokens);
    const reasoning = n(usage.reasoning_output_tokens);
    const totalTokens = n(usage.total_tokens) || (rawIn + cacheRead + cacheWrite + rawOut + reasoning);
    if (totalTokens > 0) {
      // Real Codex reports input_tokens inclusive of cached_input_tokens, and output_tokens inclusive of reasoning_output_tokens
      const inclusiveAccounting = Math.abs((rawIn + rawOut + cacheWrite) - totalTokens) <= 4;
      const input = inclusiveAccounting && rawIn >= cacheRead ? Math.max(0, rawIn - cacheRead) : rawIn;
      const output = inclusiveAccounting && rawOut >= reasoning ? Math.max(0, rawOut - reasoning) : rawOut;
      const firstPrompt = extractFirstUserPrompt(headText) || extractFirstUserPrompt(tailText);
      const hhmm = fm ? `${fm[4]}:${fm[5]}` : '';
      parsed = {
        sessionId,
        cwd,
        isSubagent,
        subRole,
        firstPrompt,
        hhmm,
        model,
        updatedAt,
        totalTokens,
        input,
        output,
        cacheRead,
        cacheWrite,
        reasoning,
      };
    }
  }

  codexRolloutCache.set(file, { sig, parsed });
  if (codexRolloutCache.size > 1500) codexRolloutCache.delete(codexRolloutCache.keys().next().value);
  return parsed;
}

/** Extract recent Codex thread usage from session_index + bounded date-dir JSONLs. */
export async function loadCodexTasks({ codexHome, sinceDate = null, untilDate = null, maxFiles = 80 } = {}) {
  if (!codexHome) return [];
  let titles = new Map();
  try {
    titles = await readCodexIndexCached(path.join(codexHome, 'session_index.jsonl'));
  } catch { /* no session_index */ }

  const dates = enumerateRecentDates(sinceDate, untilDate, 32);
  const files = [];
  for (const date of dates) {
    if (files.length >= maxFiles) break;
    const [y, m, d] = date.split('-');
    const dir = path.join(codexHome, 'sessions', y, m, d);
    let names;
    try { names = await fs.readdir(dir); } catch { continue; }
    for (const name of names) {
      if (!name.endsWith('.jsonl')) continue;
      files.push({ file: path.join(dir, name), dirDate: date });
      if (files.length >= maxFiles) break;
    }
  }

  const tasks = [];
  await Promise.all(files.map(async ({ file, dirDate }) => {
    try {
      const rec = await parseCodexRolloutCached(file);
      if (!rec) return;
      const idxMeta = titles.get(rec.sessionId);
      const finalUpdatedAt = idxMeta?.updatedAt || rec.updatedAt;
      const activeDay = dateFromEpochMs(finalUpdatedAt) || dirDate;
      if (!inDateRange(activeDay, sinceDate, untilDate) && !inDateRange(dirDate, sinceDate, untilDate)) return;

      const ws = normalizeWorkspace(rec.cwd);
      const fallbackParts = [
        rec.isSubagent ? (rec.subRole ? `Subagent (${rec.subRole})` : 'Subagent') : 'Codex',
        ws.workspaceLabel || null,
        rec.hhmm || null,
        rec.sessionId.slice(0, 8),
      ].filter(Boolean);
      const title = idxMeta?.title || rec.firstPrompt || fallbackParts.join(' · ');

      tasks.push({
        id: rec.sessionId,
        client: 'codex',
        title,
        cwd: rec.cwd,
        workspaceKey: ws.workspaceKey,
        workspaceLabel: ws.workspaceLabel,
        origin: rec.isSubagent ? 'subagent' : 'main',
        isSubagent: rec.isSubagent,
        parentId: null,
        model: rec.model,
        updatedAt: finalUpdatedAt,
        totalTokens: rec.totalTokens,
        input: rec.input,
        output: rec.output,
        cacheRead: rec.cacheRead,
        cacheWrite: rec.cacheWrite,
        reasoning: rec.reasoning,
        turns: 0,
        steps: 0,
        contextRatio: null,
        requests: 0,
        toolCalls: 0,
        wallMs: 0,
        toolsMs: 0,
        speedMs: 0,
        speedTokens: 0,
        outputTps: null,
        avgTtftMs: null,
      });
    } catch { /* unreadable session file */ }
  }));

  return tasks;
}

function decodeWorkspaceUri(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('file://')) return '';
  try { return fileURLToPath(uri); } catch { return ''; }
}

function parseTimestampMs(val) {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val > 1e12 ? val : val * 1000;
  }
  if (typeof val === 'string' && val.trim()) {
    const asNum = Number(val);
    if (Number.isFinite(asNum) && asNum > 0) return asNum > 1e12 ? asNum : asNum * 1000;
    const parsed = Date.parse(val);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

async function readAntigravitySummariesCached(agyRoot) {
  const dbPath = path.join(agyRoot, 'conversation_summaries.db');
  let stMain;
  try { stMain = await fs.stat(dbPath); } catch { return new Map(); }
  let walMtime = 0;
  try { walMtime = (await fs.stat(`${dbPath}-wal`)).mtimeMs; } catch { /* ignore */ }
  const sig = `${stMain.size}:${stMain.mtimeMs}:${walMtime}`;
  const hit = agySummaryDbCache.get(dbPath);
  if (hit && hit.sig === sig) return hit.byId;

  const byId = new Map();
  let db = null;
  try {
    const { DatabaseSync } = await import('node:sqlite');
    db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare(
      'SELECT conversation_id, title, preview, step_count, last_modified_time, workspace_uris, parent_conversation_id, nesting_depth, agent_name FROM conversation_summaries',
    ).all();
    for (const r of rows) {
      const cid = String(r?.conversation_id || '');
      if (!cid) continue;
      let cwd = '';
      if (typeof r.workspace_uris === 'string' && r.workspace_uris.trim()) {
        try {
          const uris = JSON.parse(r.workspace_uris);
          if (Array.isArray(uris)) cwd = uris.map(decodeWorkspaceUri).find(Boolean) || '';
        } catch { /* ignore */ }
      }
      let title = String(r.title || '').trim();
      if (!title && r.preview) {
        const firstLine = String(r.preview).replace(/<[^>]+>/g, ' ').split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
        title = firstLine.length > 72 ? `${firstLine.slice(0, 71)}…` : firstLine;
      }
      const isSubagent = Boolean(r.parent_conversation_id) || Number(r.nesting_depth || 0) > 0;
      const agentName = String(r.agent_name || '').trim();
      byId.set(cid, {
        title,
        cwd,
        steps: n(r.step_count),
        updatedAt: parseTimestampMs(r.last_modified_time),
        isSubagent,
        parentId: r.parent_conversation_id ? String(r.parent_conversation_id) : null,
        agentName,
      });
    }
  } catch { /* node:sqlite unavailable or DB busy */ }
  finally {
    try { db?.close(); } catch { /* ignore */ }
  }

  agySummaryDbCache.set(dbPath, { sig, byId });
  if (agySummaryDbCache.size > 6) agySummaryDbCache.delete(agySummaryDbCache.keys().next().value);
  return byId;
}

/** Combine tokscale session-grouped Antigravity entries with local conversation_summaries.db metadata. */
export async function loadAntigravityTasks({ homeRoot, sinceDate = null, untilDate = null, model = 'all', agySessions = null } = {}) {
  if (!agySessions || typeof agySessions !== 'object') return [];
  const isExactToday = Boolean(sinceDate && sinceDate === untilDate && sinceDate === agySessions.todayDate && Array.isArray(agySessions.todayEntries));
  const rawRows = isExactToday
    ? agySessions.todayEntries
    : (Array.isArray(agySessions.monthEntries) ? agySessions.monthEntries : (Array.isArray(agySessions.todayEntries) ? agySessions.todayEntries : []));
  if (!rawRows.length) return [];

  const agyRoot = path.join(homeRoot, '.gemini', 'antigravity');
  const summaryById = await readAntigravitySummariesCached(agyRoot);

  // Deduplicate legacy `antigravity` if `antigravity-extension` is present
  const hasExt = rawRows.some(r => r?.client === 'antigravity-extension');
  const bySession = new Map();

  for (const r of rawRows) {
    if (!r || (r.client === 'antigravity' && hasExt)) continue;
    const sid = String(r.sessionId || '').trim();
    if (!sid) continue;
    const rModel = String(r.model || '');
    if (model && model !== 'all' && rModel !== model) continue;

    const input = n(r.input);
    const output = n(r.output);
    const cacheRead = n(r.cacheRead);
    const cacheWrite = n(r.cacheWrite);
    const reasoning = n(r.reasoning);
    const rowTok = input + output + cacheRead + cacheWrite + reasoning;
    if (rowTok <= 0) continue;

    const cur = bySession.get(sid) || {
      id: sid,
      input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0,
      cost: 0, messages: 0, bestModel: rModel, bestModelTok: 0, modelSet: new Set(),
    };
    cur.input += input;
    cur.output += output;
    cur.cacheRead += cacheRead;
    cur.cacheWrite += cacheWrite;
    cur.reasoning += reasoning;
    cur.totalTokens += rowTok;
    cur.cost += n(r.cost);
    cur.messages += n(r.messageCount);
    if (rModel) cur.modelSet.add(rModel);
    if (rowTok > cur.bestModelTok) {
      cur.bestModelTok = rowTok;
      cur.bestModel = rModel;
    }
    bySession.set(sid, cur);
  }

  const tasks = [];
  for (const agg of bySession.values()) {
    const meta = summaryById.get(agg.id);
    let updatedAt = meta?.updatedAt || 0;
    if (!updatedAt) {
      try {
        const logFile = path.join(agyRoot, 'brain', agg.id, '.system_generated', 'logs', 'transcript.jsonl');
        updatedAt = fsSync.statSync(logFile).mtimeMs;
      } catch { /* ignore */ }
    }
    if (!isExactToday && (sinceDate || untilDate)) {
      const dayStr = dateFromEpochMs(updatedAt);
      // When monthly session entries lack per-day timestamps, include sessions active within [sinceDate, untilDate]
      if (!dayStr || !inDateRange(dayStr, sinceDate, untilDate)) continue;
    }

    const cwd = meta?.cwd || '';
    const ws = normalizeWorkspace(cwd);
    const isSubagent = Boolean(meta?.isSubagent);
    const fallbackTitle = [
      isSubagent ? (meta?.agentName ? `Subagent (${meta.agentName})` : 'Subagent') : 'Antigravity',
      ws.workspaceLabel || null,
      agg.id.slice(0, 8),
    ].filter(Boolean).join(' · ');
    const modelDisplay = agg.modelSet.size > 1 ? `${agg.bestModel} +${agg.modelSet.size - 1}` : (agg.bestModel || 'antigravity');

    tasks.push({
      id: agg.id,
      client: 'antigravity',
      title: meta?.title || fallbackTitle,
      cwd,
      workspaceKey: ws.workspaceKey,
      workspaceLabel: ws.workspaceLabel,
      origin: isSubagent ? 'subagent' : 'main',
      isSubagent,
      parentId: meta?.parentId || null,
      model: modelDisplay,
      updatedAt,
      totalTokens: agg.totalTokens,
      cost: agg.cost,
      input: agg.input,
      output: agg.output,
      cacheRead: agg.cacheRead,
      cacheWrite: agg.cacheWrite,
      reasoning: agg.reasoning,
      turns: agg.messages,
      steps: meta?.steps || 0,
      contextRatio: null,
      requests: agg.messages,
      toolCalls: 0,
      wallMs: 0,
      toolsMs: 0,
      speedMs: 0,
      speedTokens: 0,
      outputTps: null,
      avgTtftMs: null,
    });
  }

  return tasks;
}

async function runCollectTaskUsage({ client = 'all', model = 'all', sinceDate = null, untilDate = null, allowedClients = null, agySessions = null, home, env = process.env } = {}) {
  const defaultHome = process.platform === 'win32' && env.HOME && path.isAbsolute(env.HOME) ? env.HOME : os.homedir();
  const root = typeof home === 'string' && home.length > 0 ? home : defaultHome;
  const resolveDir = (envName, sub) => (!home && typeof env[envName] === 'string' && env[envName].trim()) ? env[envName] : path.join(root, sub);
  const dshHome = resolveDir('DSH_HOME', '.dsh');
  const codexHome = resolveDir('CODEX_HOME', '.codex');

  const wantDsh = client === 'all' ? (!allowedClients || allowedClients.has('dsh')) : client === 'dsh';
  const wantCodex = client === 'all' ? (!allowedClients || allowedClients.has('codex')) : client === 'codex';
  const wantAgy = client === 'all' ? (!allowedClients || allowedClients.has('antigravity')) : client === 'antigravity';

  const [dshRes, codexTasks, agyTasks] = await Promise.all([
    wantDsh ? loadDshTasks({ dshHome, sinceDate, untilDate, model }) : Promise.resolve({ tasks: [], modelThroughput: new Map(), executionProfile: null }),
    wantCodex ? loadCodexTasks({ codexHome, sinceDate, untilDate }) : Promise.resolve([]),
    wantAgy ? loadAntigravityTasks({ homeRoot: root, sinceDate, untilDate, model, agySessions }) : Promise.resolve([]),
  ]);

  let tasks = [...dshRes.tasks, ...codexTasks, ...agyTasks];
  if (model && model !== 'all') {
    tasks = tasks.filter(t => t.model === model || String(t.model || '').startsWith(model + ' '));
  }
  tasks.sort((a, b) => (b.totalTokens - a.totalTokens) || (b.updatedAt - a.updatedAt));

  const wsMap = new Map();
  const wsFold = k => (process.platform === 'win32' ? String(k).toLowerCase() : String(k));
  for (const tk of tasks) {
    if (!tk.workspaceKey) continue;
    const mk = wsFold(tk.workspaceKey);
    const cur = wsMap.get(mk) || {
      workspaceKey: tk.workspaceKey,
      label: tk.workspaceLabel || tk.workspaceKey,
      totalTokens: 0,
      cost: 0,
      taskCount: 0,
      clients: new Set(),
      byClient: {},
      tokensByType: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
    };
    // Align task's workspaceKey onto the canonical merged key so client-side filtering matches all merged sessions
    tk.workspaceKey = cur.workspaceKey;
    const tTok = n(tk.totalTokens);
    cur.totalTokens += tTok;
    cur.cost += n(tk.cost);
    cur.taskCount += 1;
    if (tk.client) {
      cur.clients.add(tk.client);
      cur.byClient[tk.client] = (cur.byClient[tk.client] || 0) + tTok;
    }
    cur.tokensByType.input += n(tk.input);
    cur.tokensByType.output += n(tk.output);
    cur.tokensByType.cacheRead += n(tk.cacheRead);
    cur.tokensByType.cacheWrite += n(tk.cacheWrite);
    cur.tokensByType.reasoning += n(tk.reasoning);
    wsMap.set(mk, cur);
  }
  const taskWorkspaces = [...wsMap.values()]
    .map(w => ({ ...w, clients: [...w.clients] }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  return {
    tasks: tasks.slice(0, 48),
    totalTasks: tasks.length,
    taskWorkspaces,
    executionProfile: dshRes.executionProfile || null,
    modelThroughput: Object.fromEntries(dshRes.modelThroughput),
  };
}

/** Collect merged per-task usage with 1.5s in-flight/TTL deduplication. */
export async function collectTaskUsage(args = {}) {
  const useCustomEnv = args.env && args.env !== process.env;
  if (useCustomEnv) return runCollectTaskUsage(args);
  const agyStamp = args.agySessions ? `${args.agySessions.todayAt || 0}:${args.agySessions.monthAt || 0}` : '0';
  const key = JSON.stringify([
    args.client || 'all',
    args.model || 'all',
    args.sinceDate || '',
    args.untilDate || '',
    args.allowedClients ? [...args.allowedClients].sort() : null,
    args.home || process.env.DSH_HOME || '',
    process.env.CODEX_HOME || '',
    agyStamp,
  ]);
  const hit = taskQueryMemo.get(key);
  if (hit && Date.now() - hit.at < 1500) return hit.promise;
  const promise = runCollectTaskUsage(args);
  taskQueryMemo.set(key, { at: Date.now(), promise });
  if (taskQueryMemo.size > 32) taskQueryMemo.delete(taskQueryMemo.keys().next().value);
  promise.catch(() => taskQueryMemo.delete(key));
  return promise;
}
