// Read-only local task & session telemetry collector.
// Reads bounded metadata from DSH's context overview cache and recent Codex
// session logs to supply per-task token/cost attribution and DSH throughput
// metrics (tok/s, TTFT) without running expensive full-history LLM reports.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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
  const start = sinceDate ? new Date(sinceDate + 'T00:00:00') : new Date(end.getTime() - (maxDays - 1) * 86400000);
  if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) return [];
  const floor = new Date(end.getTime() - (maxDays - 1) * 86400000);
  const cursor = start > floor ? start : floor;
  const dates = [];
  for (let t = cursor.getTime(); t <= end.getTime() && dates.length < maxDays; t += 86400000) {
    const d = new Date(t);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return dates.reverse(); // newest first
}

function normalizeWorkspace(cwd) {
  if (!cwd || typeof cwd !== 'string') return { workspaceKey: '', workspaceLabel: '' };
  const cleaned = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  const label = parts[parts.length - 1] || cleaned;
  return { workspaceKey: cleaned, workspaceLabel: label };
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
    raw = JSON.parse(await fs.readFile(file, 'utf8'));
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

    let tokens = 0;
    let allDaysTokens = 0;
    let input = 0;
    let output = 0;
    let cacheRead = 0;
    let cacheWrite = 0;
    let requests = 0;
    let turns = 0;
    let toolCalls = 0;
    let toolsMs = 0;
    let wallMs = 0;
    let matched = false;

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

    // Aggregate execution anatomy scaled to the active date window
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
    .sort((a, b) => (b.calls - a.calls) || (b.totalMs - a.totalMs))
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

async function readHeadAndTail(filePath, headBytes = 4096, tailBytes = 32768) {
  const fh = await fs.open(filePath, 'r');
  try {
    const st = await fh.stat();
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

/** Extract recent Codex thread usage from session_index + bounded date-dir JSONLs. */
export async function loadCodexTasks({ codexHome, sinceDate = null, untilDate = null, maxFiles = 80 } = {}) {
  if (!codexHome) return [];
  const titles = new Map();
  try {
    const idxRaw = await fs.readFile(path.join(codexHome, 'session_index.jsonl'), 'utf8');
    for (const line of idxRaw.split(/\r?\n/)) {
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (obj?.id) titles.set(obj.id, { title: obj.thread_name || obj.id, updatedAt: Date.parse(obj.updated_at || '') || 0 });
      } catch { /* skip malformed line */ }
    }
  } catch { /* no session_index */ }

  const dates = enumerateRecentDates(sinceDate, untilDate, 31);
  const files = [];
  for (const date of dates) {
    if (files.length >= maxFiles) break;
    const [y, m, d] = date.split('-');
    const dir = path.join(codexHome, 'sessions', y, m, d);
    let names;
    try { names = await fs.readdir(dir); } catch { continue; }
    for (const name of names) {
      if (!name.endsWith('.jsonl')) continue;
      files.push({ file: path.join(dir, name), date });
      if (files.length >= maxFiles) break;
    }
  }

  const tasks = [];
  await Promise.all(files.map(async ({ file }) => {
    try {
      const { headText, tailText, mtimeMs } = await readHeadAndTail(file);
      const firstLine = headText.split(/\r?\n/)[0];
      let sessionId = path.basename(file, '.jsonl');
      let cwd = '';
      let updatedAt = mtimeMs;
      let model = 'codex';
      try {
        const meta = JSON.parse(firstLine);
        const p = meta?.payload || {};
        sessionId = p.id || p.session_id || sessionId;
        cwd = p.cwd || '';
        if (p.model) model = p.model;
      } catch { /* ignore */ }

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
      if (!usage) return;

      const idxMeta = titles.get(sessionId);
      const input = n(usage.input_tokens);
      const cacheRead = n(usage.cached_input_tokens);
      const cacheWrite = n(usage.cache_write_input_tokens);
      const output = n(usage.output_tokens);
      const reasoning = n(usage.reasoning_output_tokens);
      const totalTokens = n(usage.total_tokens) || (input + cacheRead + cacheWrite + output + reasoning);
      if (totalTokens <= 0) return;

      const ws = normalizeWorkspace(cwd);
      tasks.push({
        id: sessionId,
        client: 'codex',
        title: idxMeta?.title || sessionId,
        cwd,
        workspaceKey: ws.workspaceKey,
        workspaceLabel: ws.workspaceLabel,
        origin: 'main',
        isSubagent: false,
        parentId: null,
        model,
        updatedAt: idxMeta?.updatedAt || updatedAt,
        totalTokens,
        input,
        output,
        cacheRead,
        cacheWrite,
        reasoning,
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

/** Collect merged per-task usage, workspaces, and DSH execution telemetry for the active filter window. */
export async function collectTaskUsage({ client = 'all', model = 'all', sinceDate = null, untilDate = null, allowedClients = null, home, env = process.env } = {}) {
  const defaultHome = process.platform === 'win32' && env.HOME && path.isAbsolute(env.HOME) ? env.HOME : os.homedir();
  const root = typeof home === 'string' && home.length > 0 ? home : defaultHome;
  const resolveDir = (envName, sub) => (!home && typeof env[envName] === 'string' && env[envName].trim()) ? env[envName] : path.join(root, sub);
  const dshHome = resolveDir('DSH_HOME', '.dsh');
  const codexHome = resolveDir('CODEX_HOME', '.codex');

  const wantDsh = client === 'all' ? (!allowedClients || allowedClients.has('dsh')) : client === 'dsh';
  const wantCodex = client === 'all' ? (!allowedClients || allowedClients.has('codex')) : client === 'codex';

  const [dshRes, codexTasks] = await Promise.all([
    wantDsh ? loadDshTasks({ dshHome, sinceDate, untilDate, model }) : Promise.resolve({ tasks: [], modelThroughput: new Map(), executionProfile: null }),
    wantCodex ? loadCodexTasks({ codexHome, sinceDate, untilDate }) : Promise.resolve([]),
  ]);

  let tasks = [...dshRes.tasks, ...codexTasks];
  if (model && model !== 'all') {
    tasks = tasks.filter(t => t.model === model);
  }
  tasks.sort((a, b) => (b.totalTokens - a.totalTokens) || (b.updatedAt - a.updatedAt));

  // Aggregate task-level workspace telemetry
  const wsMap = new Map();
  for (const tk of tasks) {
    if (!tk.workspaceKey) continue;
    const cur = wsMap.get(tk.workspaceKey) || { workspaceKey: tk.workspaceKey, label: tk.workspaceLabel || tk.workspaceKey, totalTokens: 0, cost: 0, taskCount: 0, clients: new Set() };
    cur.totalTokens += n(tk.totalTokens);
    cur.taskCount += 1;
    cur.clients.add(tk.client);
    wsMap.set(tk.workspaceKey, cur);
  }
  const taskWorkspaces = [...wsMap.values()]
    .map(w => ({ ...w, clients: [...w.clients] }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  return {
    tasks: tasks.slice(0, 120),
    totalTasks: tasks.length,
    taskWorkspaces,
    executionProfile: dshRes.executionProfile || null,
    modelThroughput: Object.fromEntries(dshRes.modelThroughput),
  };
}
