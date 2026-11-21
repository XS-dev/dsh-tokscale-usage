// Cache, graph-slicing, and progressive per-client refresh orchestration.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  runView, buildArgs, ALL_CLIENTS, HEAVY_CLIENTS, FAST_CLIENT_HINTS,
  clientsForBin, resolveTokscaleBin, extractPerformance,
} from './tokscale.mjs';
import { collectTaskUsage } from './tasks.mjs';

export const SERVER_VERSION = '1.0.0';

export const DEFAULT_SCOPE_CLIENTS = [
  'dsh', 'codex', 'antigravity', 'claude', 'gemini',
];

/** Map raw tokscale Antigravity variants onto one unified `antigravity` harness. */
export function canonicalClient(name) {
  const s = String(name || '').trim();
  if (s === 'antigravity' || s === 'antigravity-extension' || s === 'antigravity-cli') return 'antigravity';
  return s;
}

/** Expand unified canonical client identifiers into non-overlapping tokscale CLI `-c` targets. */
export function expandTokscaleClients(clients) {
  const out = new Set();
  const list = Array.isArray(clients) ? clients : String(clients || '').split(',');
  for (const raw of list) {
    const c = String(raw || '').trim();
    if (!c) continue;
    if (c === 'antigravity' || c === 'antigravity-extension' || c === 'antigravity-cli') {
      out.add('antigravity-cli');
      out.add('antigravity-extension');
    } else {
      out.add(c);
    }
  }
  return [...out];
}

export function cacheDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  return path.join(home, 'tokscale-usage');
}

const num = v => (Number.isFinite(v) ? v : 0);

function linkSignals(...sigs) {
  const list = sigs.filter(Boolean);
  if (list.length === 0) return undefined;
  if (list.length === 1) return list[0];
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(list);
  const c = new AbortController();
  for (const s of list) {
    if (s.aborted) { c.abort(); break; }
    s.addEventListener('abort', () => c.abort(), { once: true });
  }
  return c.signal;
}

export function todayDateLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDateLocal(dateStr, deltaDays) {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + deltaDays);
  return todayDateLocal(d);
}

/** Resolve preset/custom range into local inclusive YYYY-MM-DD bounds. */
export function resolveDateWindow(range = 'month', since, until, now = new Date()) {
  if (since || until) return { sinceDate: since || null, untilDate: until || null };
  const today = todayDateLocal(now);
  if (range === 'today') return { sinceDate: today, untilDate: today };
  if (range === 'yesterday') {
    const yest = shiftDateLocal(today, -1);
    return { sinceDate: yest, untilDate: yest };
  }
  if (range === 'days3') return { sinceDate: shiftDateLocal(today, -2), untilDate: today };
  if (range === 'week') return { sinceDate: shiftDateLocal(today, -6), untilDate: today };
  if (range === 'month') return { sinceDate: `${today.slice(0, 8)}01`, untilDate: today };
  if (range === 'year') return { sinceDate: `${today.slice(0, 4)}-01-01`, untilDate: today };
  return { sinceDate: null, untilDate: null };
}

/** Aggregate normalized report buckets, including per-entry reasoning. */
export function metrics(report) {
  if (!report || typeof report !== 'object') return null;
  const value = v => Number.isFinite(v) ? v : null;
  const input = value(report.totalInput);
  const output = value(report.totalOutput);
  const cacheRead = value(report.totalCacheRead);
  const cacheWrite = value(report.totalCacheWrite);
  const reasoning = Array.isArray(report.entries) && report.entries.every(entry => Number.isFinite(entry?.reasoning))
    ? report.entries.reduce((sum, entry) => sum + entry.reasoning, 0) : null;
  const promptSide = [input, cacheRead, cacheWrite].every(v => v !== null) ? input + cacheRead + cacheWrite : null;
  return {
    input, output, cacheRead, cacheWrite, reasoning,
    totalTokens: [input, output, cacheRead, cacheWrite, reasoning].every(v => v !== null)
      ? input + output + cacheRead + cacheWrite + reasoning : null,
    messages: value(report.totalMessages),
    cost: value(report.totalCost),
    cacheHitRate: promptSide === null ? null : promptSide > 0 ? cacheRead / promptSide : 0,
    entries: Array.isArray(report.entries) ? report.entries : [],
    processingTimeMs: value(report.processingTimeMs),
  };
}

const rowTotal = r => num(r.input) + num(r.output) + num(r.cacheRead) + num(r.cacheWrite) + num(r.reasoning);

function reportForModel(entries, model) {
  const filtered = entries.filter(entry => entry.model === model);
  const sum = key => filtered.every(entry => Number.isFinite(entry[key]))
    ? filtered.reduce((total, entry) => total + entry[key], 0) : null;
  return {
    entries: filtered, totalInput: sum('input'), totalOutput: sum('output'),
    totalCacheRead: sum('cacheRead'), totalCacheWrite: sum('cacheWrite'),
    totalMessages: sum('messageCount'), totalCost: sum('cost'),
  };
}

/** Convert `tokscale hourly --json` entries into per-day buckets. */
export function deriveDaily(hourlyReport) {
  const out = new Map();
  const entries = hourlyReport?.entries;
  if (!Array.isArray(entries)) return [];
  for (const e of entries) {
    const hour = String(e.hour || '');
    const date = hour.slice(0, 10);
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) continue;
    const cur = out.get(date) || { date, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, messages: 0, cost: 0, totalTokens: 0 };
    cur.input += num(e.input); cur.output += num(e.output);
    cur.cacheRead += num(e.cacheRead); cur.cacheWrite += num(e.cacheWrite); cur.reasoning = num(cur.reasoning) + num(e.reasoning);
    cur.messages += num(e.messageCount); cur.cost += num(e.cost);
    cur.totalTokens = rowTotal(cur);
    out.set(date, cur);
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Filter `tokscale hourly --json` entries to one date (or aggregate across a window by HH:00). */
export function deriveTodayHourly(hourlyReport, todayDate) {
  const entries = hourlyReport?.entries;
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(e => String(e.hour || '').slice(0, 10) === todayDate)
    .map(e => ({
      hour: String(e.hour).slice(11, 16),
      input: num(e.input), output: num(e.output),
      cacheRead: num(e.cacheRead), cacheWrite: num(e.cacheWrite), reasoning: num(e.reasoning),
      messages: num(e.messageCount), turns: num(e.turnCount), cost: num(e.cost),
      totalTokens: rowTotal(e),
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

export function mergeHourlySupplement(hourlyReport, supplementEntries = []) {
  const baseEntries = Array.isArray(hourlyReport?.entries) ? hourlyReport.entries : [];
  if (!Array.isArray(supplementEntries) || supplementEntries.length === 0) return hourlyReport;
  // Track which (date, canonicalClient) pairs tokscale hourly already supplied so we never double-count
  const covered = new Set();
  for (const e of baseEntries) {
    const date = String(e?.hour || '').slice(0, 10);
    if (!date) continue;
    for (const rc of (Array.isArray(e?.clients) ? e.clients : [])) {
      covered.add(`${date}\0${canonicalClient(rc)}`);
    }
  }
  const extra = supplementEntries.filter(se => {
    const date = String(se?.hour || '').slice(0, 10);
    const sc = canonicalClient((se?.clients && se.clients[0]) || '');
    return date && sc && !covered.has(`${date}\0${sc}`);
  });
  if (!extra.length) return hourlyReport;
  return { ...(hourlyReport || {}), entries: [...baseEntries, ...extra] };
}

export function deriveHourlyWindow(hourlyReport, { sinceDate = null, untilDate = null, client = 'all', model = 'all', allowedClients = null, pad24 = false } = {}) {
  const entries = hourlyReport?.entries;
  if (!Array.isArray(entries)) return [];
  const buckets = new Map();
  const targetClient = client === 'all' ? 'all' : canonicalClient(client);
  for (const e of entries) {
    const hourStr = String(e.hour || '');
    const date = hourStr.slice(0, 10);
    const hhmm = hourStr.slice(11, 16);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(hhmm)) continue;
    if (sinceDate && date < sinceDate) continue;
    if (untilDate && date > untilDate) continue;
    const rowClients = Array.isArray(e.clients) ? e.clients.map(canonicalClient) : null;
    if (targetClient !== 'all' && rowClients && !rowClients.includes(targetClient)) continue;
    if (targetClient === 'all' && allowedClients && rowClients && rowClients.length > 0 && !rowClients.some(c => allowedClients.has(c))) continue;
    if (model !== 'all' && Array.isArray(e.models) && !e.models.includes(model)) continue;
    const cur = buckets.get(hhmm) || { hour: hhmm, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, messages: 0, turns: 0, cost: 0, totalTokens: 0 };
    cur.input += num(e.input);
    cur.output += num(e.output);
    cur.cacheRead += num(e.cacheRead);
    cur.cacheWrite += num(e.cacheWrite);
    cur.reasoning += num(e.reasoning);
    cur.messages += num(e.messageCount);
    cur.turns += num(e.turnCount);
    cur.cost += num(e.cost);
    cur.totalTokens = rowTotal(cur);
    buckets.set(hhmm, cur);
  }
  if (pad24 && buckets.size > 0) {
    for (let h = 0; h < 24; h++) {
      const hhmm = `${String(h).padStart(2, '0')}:00`;
      if (!buckets.has(hhmm)) {
        buckets.set(hhmm, { hour: hhmm, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, messages: 0, turns: 0, cost: 0, totalTokens: 0 });
      }
    }
  }
  return [...buckets.values()].sort((a, b) => a.hour.localeCompare(b.hour));
}

/** Slice `tokscale graph` contributions by date window, client, and model (preserving reasoning!). */
export function sliceGraphReport(graphData, { sinceDate = null, untilDate = null, client = 'all', model = 'all', allowedClients = null, perfMap = null } = {}) {
  const contributions = Array.isArray(graphData?.contributions) ? graphData.contributions : [];
  const entryMap = new Map();
  const daily = [];
  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheWrite = 0, totalMessages = 0, totalCost = 0;

  const targetClient = client === 'all' ? 'all' : canonicalClient(client);
  for (const day of contributions) {
    const date = String(day?.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (sinceDate && date < sinceDate) continue;
    if (untilDate && date > untilDate) continue;

    let dInput = 0, dOutput = 0, dCacheRead = 0, dCacheWrite = 0, dReasoning = 0, dMessages = 0, dCost = 0;
    const byClient = {};
    const rows = Array.isArray(day?.clients) ? day.clients : [];
    const hasAgyExt = rows.some(r => r?.client === 'antigravity-extension');

    for (const row of rows) {
      const rawClient = String(row?.client || '');
      // Skip legacy RPC cache `antigravity` if direct `antigravity-extension` is present on the same day
      if (rawClient === 'antigravity' && hasAgyExt) continue;
      const rClient = canonicalClient(rawClient);
      const rModel = String(row?.modelId || row?.model || '');
      const rProvider = String(row?.providerId || row?.provider || '');
      if (targetClient !== 'all' && rClient !== targetClient) continue;
      if (targetClient === 'all' && allowedClients && !allowedClients.has(rClient)) continue;
      if (model !== 'all' && rModel !== model) continue;

      const tk = row?.tokens || {};
      const input = num(tk.input);
      const output = num(tk.output);
      const cacheRead = num(tk.cacheRead);
      const cacheWrite = num(tk.cacheWrite);
      const reasoning = num(tk.reasoning);
      const msgs = num(row?.messages);
      const cost = num(row?.cost);
      const rTotal = input + output + cacheRead + cacheWrite + reasoning;

      dInput += input; dOutput += output; dCacheRead += cacheRead; dCacheWrite += cacheWrite; dReasoning += reasoning;
      dMessages += msgs; dCost += cost;
      if (rClient && rTotal > 0) byClient[rClient] = (byClient[rClient] || 0) + rTotal;

      const key = `${rClient}\0${rProvider}\0${rModel}`;
      const existing = entryMap.get(key) || {
        client: rClient,
        provider: rProvider,
        model: rModel,
        input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0,
        messageCount: 0, cost: 0,
        performance: perfMap?.get?.(`${rClient}\0${rModel}`) || perfMap?.get?.(rModel) || null,
      };
      existing.input += input;
      existing.output += output;
      existing.cacheRead += cacheRead;
      existing.cacheWrite += cacheWrite;
      existing.reasoning += reasoning;
      existing.messageCount += msgs;
      existing.cost += cost;
      entryMap.set(key, existing);
    }

    // Fallback when day has day-level tokenBreakdown without per-client rows for unfiltered queries
    if (rows.length === 0 && client === 'all' && !allowedClients && model === 'all' && day?.tokenBreakdown) {
      const tb = day.tokenBreakdown;
      dInput = num(tb.input); dOutput = num(tb.output); dCacheRead = num(tb.cacheRead);
      dCacheWrite = num(tb.cacheWrite); dReasoning = num(tb.reasoning);
      dMessages = num(day?.totals?.messages); dCost = num(day?.totals?.cost);
    }

    const dayTotal = dInput + dOutput + dCacheRead + dCacheWrite + dReasoning;
    if (dayTotal > 0 || dMessages > 0 || dCost > 0) {
      daily.push({
        date,
        input: dInput, output: dOutput, cacheRead: dCacheRead, cacheWrite: dCacheWrite, reasoning: dReasoning,
        totalTokens: dayTotal,
        messages: dMessages,
        cost: dCost,
        intensity: num(day?.intensity),
        byClient,
      });
    }

    totalInput += dInput;
    totalOutput += dOutput;
    totalCacheRead += dCacheRead;
    totalCacheWrite += dCacheWrite;
    totalMessages += dMessages;
    totalCost += dCost;
  }

  daily.sort((a, b) => a.date.localeCompare(b.date));
  const entries = [...entryMap.values()].sort((a, b) => rowTotal(b) - rowTotal(a));
  return {
    report: {
      entries,
      totalInput, totalOutput, totalCacheRead, totalCacheWrite,
      totalMessages, totalCost,
    },
    daily,
  };
}

/** Build a fixed rolling N-week heatmap grid ending at todayDateLocal(), optionally filtered by client/model. */
export function buildHeatmap(graphData, weeks = 8, now = new Date(), { client = 'all', model = 'all', allowedClients = null } = {}) {
  const totalDays = weeks * 7;
  const today = todayDateLocal(now);
  const byDate = new Map();
  const targetClient = client === 'all' ? 'all' : canonicalClient(client);
  const filtered = targetClient !== 'all' || model !== 'all' || Boolean(allowedClients);
  for (const day of (Array.isArray(graphData?.contributions) ? graphData.contributions : [])) {
    if (!day?.date) continue;
    let tokens = 0, cost = 0, messages = 0, intensity = 0;
    if (filtered && Array.isArray(day.clients) && day.clients.length > 0) {
      const hasAgyExt = day.clients.some(r => r?.client === 'antigravity-extension');
      for (const r of day.clients) {
        const rawClient = String(r?.client || '');
        if (rawClient === 'antigravity' && hasAgyExt) continue;
        const rc = canonicalClient(rawClient);
        const rm = String(r?.modelId || r?.model || '');
        if (targetClient !== 'all' && rc !== targetClient) continue;
        if (targetClient === 'all' && allowedClients && !allowedClients.has(rc)) continue;
        if (model !== 'all' && rm !== model) continue;
        const tk = r?.tokens || {};
        tokens += num(tk.input) + num(tk.output) + num(tk.cacheRead) + num(tk.cacheWrite) + num(tk.reasoning);
        cost += num(r?.cost);
        messages += num(r?.messages);
      }
    } else if (!filtered) {
      const tb = day.tokenBreakdown || {};
      tokens = num(day?.totals?.tokens) || (num(tb.input) + num(tb.output) + num(tb.cacheRead) + num(tb.cacheWrite) + num(tb.reasoning));
      cost = num(day?.totals?.cost);
      messages = num(day?.totals?.messages);
      intensity = num(day?.intensity);
    }
    byDate.set(day.date, { date: day.date, tokens, cost, messages, intensity });
  }
  const cells = [];
  for (let offset = totalDays - 1; offset >= 0; offset--) {
    const date = shiftDateLocal(today, -offset);
    cells.push(byDate.get(date) || { date, tokens: 0, cost: 0, messages: 0, intensity: 0 });
  }
  const maxTokens = cells.reduce((m, c) => Math.max(m, c.tokens), 0);
  if (maxTokens > 0) {
    for (const c of cells) {
      if (c.tokens > 0 && (filtered || c.intensity === 0)) {
        const ratio = c.tokens / maxTokens;
        c.intensity = ratio > 0.75 ? 4 : ratio > 0.45 ? 3 : ratio > 0.18 ? 2 : 1;
      }
    }
  }
  return cells;
}

/** Compute period-over-period delta for bounded windows (1..62 days) from graphData. */
export function computePeriodDelta(graphData, { sinceDate, untilDate, client = 'all', model = 'all', allowedClients = null, curTokens = 0, curCost = 0, curMessages = 0 } = {}) {
  if (!sinceDate || !untilDate || sinceDate > untilDate) return null;
  const d0 = Date.parse(sinceDate + 'T00:00:00Z');
  const d1 = Date.parse(untilDate + 'T00:00:00Z');
  if (Number.isNaN(d0) || Number.isNaN(d1)) return null;
  const spanDays = Math.round((d1 - d0) / 86400000) + 1;
  if (spanDays < 1 || spanDays > 62) return null;
  const prevUntil = shiftDateLocal(sinceDate, -1);
  const prevSince = shiftDateLocal(prevUntil, -(spanDays - 1));
  const prev = sliceGraphReport(graphData, { sinceDate: prevSince, untilDate: prevUntil, client, model, allowedClients });
  const pm = metrics(prev.report);
  const prevTokens = num(pm?.totalTokens);
  const prevCost = num(pm?.cost);
  const prevMessages = num(pm?.messages);
  return {
    spanDays,
    prevSince,
    prevUntil,
    prevTokens,
    prevCost,
    prevMessages,
    prevDaily: prev.daily,
    tokenDeltaPct: prevTokens > 0 ? (curTokens - prevTokens) / prevTokens : null,
    costDeltaPct: prevCost > 0 ? (curCost - prevCost) / prevCost : null,
  };
}

/** Compute current-month MTD totals and linear end-of-month projection from graphData. */
export function computeMonthlyProjection(graphData, { now = new Date(), client = 'all', model = 'all', allowedClients = null } = {}) {
  const today = todayDateLocal(now);
  const monthStart = `${today.slice(0, 8)}01`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(1, now.getDate());
  const mtd = sliceGraphReport(graphData, { sinceDate: monthStart, untilDate: today, client, model, allowedClients });
  const mm = metrics(mtd.report);
  const mtdCost = num(mm?.cost);
  const mtdTokens = num(mm?.totalTokens);
  return {
    month: today.slice(0, 7),
    monthStart,
    today,
    daysElapsed,
    daysInMonth,
    activeDays: mtd.daily.length,
    mtdCost,
    mtdTokens,
    projectedCost: mtdCost > 0 ? (mtdCost / daysElapsed) * daysInMonth : 0,
    projectedTokens: mtdTokens > 0 ? Math.round((mtdTokens / daysElapsed) * daysInMonth) : 0,
  };
}

/** Aggregate Monday(0)..Sunday(6) rhythm from daily or heatmap buckets. */
export function computeWeekdayProfile(items) {
  const buckets = Array.from({ length: 7 }, (_, i) => ({ dayIndex: i, totalTokens: 0, cost: 0, activeDays: 0, sampleDays: 0, avgTokens: 0 }));
  for (const it of (Array.isArray(items) ? items : [])) {
    if (!it?.date) continue;
    const d = new Date(it.date + 'T00:00:00');
    if (Number.isNaN(d.getTime())) continue;
    const idx = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
    const tok = num(it.totalTokens ?? it.tokens);
    buckets[idx].sampleDays += 1;
    buckets[idx].totalTokens += tok;
    buckets[idx].cost += num(it.cost);
    if (tok > 0) buckets[idx].activeDays += 1;
  }
  for (const b of buckets) {
    b.avgTokens = b.activeDays > 0 ? b.totalTokens / b.activeDays : 0;
  }
  return buckets;
}

/** Enrich metrics entries with tokscale performance, dsh-context decode throughput, or Antigravity transcript timing. */
export function attachThroughput(summary, modelThroughput = {}) {
  if (!summary || !Array.isArray(summary.entries)) return { summary, throughputSummary: null };
  let engTokens = 0, engMs = 0;
  let dshTokens = 0, dshMs = 0, ttftSum = 0, ttftCalls = 0;
  const sourcesUsed = new Set();

  const enriched = summary.entries.map(entry => {
    let tp = entry.throughput || extractPerformance(entry);
    const cKey = canonicalClient(entry.client || '');
    if (!tp || !(tp.tokensPerSec > 0)) {
      const byClientModel = modelThroughput[`${cKey}\0${entry.model}`];
      const byModelOnly = (cKey === 'dsh' || cKey === 'antigravity') ? modelThroughput[entry.model] : null;
      if (byClientModel) tp = byClientModel;
      else if (byModelOnly && (!byModelOnly.client || byModelOnly.client === cKey)) tp = byModelOnly;
    }
    if (tp && Number.isFinite(tp.tokensPerSec)) {
      sourcesUsed.add(tp.source);
      if (tp.source === 'dsh-context') {
        if (tp.totalDurationMs > 0 && tp.timedTokens > 0) {
          dshTokens += tp.timedTokens;
          dshMs += tp.totalDurationMs;
        }
        if (Number.isFinite(tp.avgTtftMs) && tp.sampleCount > 0) {
          ttftSum += tp.avgTtftMs * tp.sampleCount;
          ttftCalls += tp.sampleCount;
        }
      } else if (tp.totalDurationMs > 0 && tp.timedTokens > 0) {
        engTokens += tp.timedTokens;
        engMs += tp.totalDurationMs;
      }
    }
    return tp ? { ...entry, throughput: tp } : entry;
  });

  const decodeTokensPerSec = dshMs > 0 ? dshTokens / (dshMs / 1000) : null;
  const engineTokensPerSec = engMs > 0 ? engTokens / (engMs / 1000) : null;
  const avgTokensPerSec = decodeTokensPerSec ?? engineTokensPerSec;
  const avgTtftMs = ttftCalls > 0 ? ttftSum / ttftCalls : null;
  return {
    summary: { ...summary, entries: enriched },
    throughputSummary: (avgTokensPerSec !== null || avgTtftMs !== null)
      ? {
          avgTokensPerSec,
          decodeTokensPerSec,
          engineTokensPerSec,
          avgMsPer1KTokens: avgTokensPerSec ? 1000 / avgTokensPerSec * 1000 : null,
          avgTtftMs,
          timedTokens: dshTokens + engTokens,
          totalDurationMs: dshMs + engMs,
          sources: [...sourcesUsed],
        }
      : null,
  };
}

export class Store {
  constructor(config = {}, log = console, deps = {}) {
    this.config = config;
    this.log = log;
    this.dir = cacheDir();
    this.client = config.client || 'all';
    this._queries = new Map();
    this._runView = deps.runView || runView;
    this._base = {
      graph60d: null,        // rolling multi-history graph JSON across discovered clients
      graph60dAt: 0,
      graphCoversAll: false,
      hourlyToday: null,
      hourlyTodayDate: '',
      timeMetrics: null,
      workspaceEntries: [],  // monthly workspace,model entries across fast clients
      agySessions: null,     // { todayDate, todayAt, todayEntries, monthAt, monthEntries }
      perClientModels: {},   // client -> { entries, updatedAt, error, durationMs }
      clientScan: {},        // canonicalClient -> { okAt, through, error, errorAt, durationMs }
      observedClients: [],   // clients observed with non-empty data
    };
    this._progress = {
      active: false,
      completed: 0,
      total: 0,
      currentClients: [],
      doneClients: [],
      errors: {},
      revision: 0,
      startedAt: 0,
    };
    this._progressivePromise = null;
    this._lanes = { fg: Promise.resolve(), bg: Promise.resolve() };
    this._inflight = new Map();
    this._graphIndex = null;
    this._richCache = new Map();
    this._persistTimer = null;
    this._baseFileMtime = 0;
    this._abort = new AbortController();
    this._disposed = false;
    this.scopeFile = path.join(this.dir, 'scope.json');
    this._scope = { mode: 'default', enabledClients: [...DEFAULT_SCOPE_CLIENTS] };
    this._load();
  }

  _load() {
    try {
      const basePath = path.join(this.dir, 'base-v3.json');
      const st = fs.statSync(basePath);
      const baseRaw = JSON.parse(fs.readFileSync(basePath, 'utf8'));
      if (baseRaw && typeof baseRaw === 'object') {
        this._base = { ...this._base, ...baseRaw };
        this._baseFileMtime = st.mtimeMs;
      }
    } catch { /* no base cache yet */ }
    try {
      const scopeRaw = JSON.parse(fs.readFileSync(this.scopeFile, 'utf8'));
      if (scopeRaw && typeof scopeRaw === 'object') {
        const mode = ['default', 'custom', 'all'].includes(scopeRaw.mode) ? scopeRaw.mode : 'default';
        const valid = Array.isArray(scopeRaw.enabledClients)
          ? [...new Set(scopeRaw.enabledClients.filter(c => typeof c === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(c)).map(canonicalClient))]
          : [];
        this._scope = {
          mode,
          enabledClients: valid.length > 0 ? valid : [...DEFAULT_SCOPE_CLIENTS],
        };
      }
    } catch { /* default scope */ }
  }

  getScope() {
    return {
      mode: this._scope.mode,
      enabledClients: [...this._scope.enabledClients],
      defaultClients: [...DEFAULT_SCOPE_CLIENTS],
      observedClients: [...new Set((this._base.observedClients || []).map(canonicalClient))],
    };
  }

  setScope({ mode = 'custom', enabledClients } = {}) {
    if (!['default', 'custom', 'all'].includes(mode)) throw new Error('invalid scope mode');
    let nextEnabled = [...this._scope.enabledClients];
    if (mode === 'custom') {
      if (!Array.isArray(enabledClients)) throw new Error('enabledClients must be an array');
      const cleaned = [...new Set(enabledClients.map(c => String(c || '').trim()).filter(Boolean))];
      if (cleaned.length === 0 || !cleaned.every(c => /^[a-z0-9][a-z0-9-]*$/.test(c))) {
        throw new Error('Select at least one valid harness identifier');
      }
      nextEnabled = [...new Set(cleaned.map(canonicalClient))];
    } else if (mode === 'default') {
      nextEnabled = [...DEFAULT_SCOPE_CLIENTS];
    }
    this._scope = { mode, enabledClients: nextEnabled };
    this._queries.clear();
    this._richCache.clear();
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const tmp = this.scopeFile + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ mode: this._scope.mode, enabledClients: this._scope.enabledClients }));
      fs.renameSync(tmp, this.scopeFile);
    } catch (e) {
      this.log.warn?.('tokscale-usage scope persist failed: ' + e.message);
    }
    return this.getScope();
  }

  _allowedSetForAll() {
    return this._scope.mode === 'custom' ? new Set(this._scope.enabledClients.map(canonicalClient)) : null;
  }

  scopedCatalogClients(allSupported = []) {
    const sup = [...new Set((Array.isArray(allSupported) ? allSupported.filter(Boolean) : []).map(canonicalClient))];
    const obsCanon = (this._base.observedClients || []).map(canonicalClient);
    if (this._scope.mode === 'custom') return [...this._scope.enabledClients];
    if (this._scope.mode === 'all') return sup.length ? [...sup] : [...new Set([...DEFAULT_SCOPE_CLIENTS, ...obsCanon])];
    const focus = new Set([...DEFAULT_SCOPE_CLIENTS, ...obsCanon]);
    return sup.length ? sup.filter(c => focus.has(c)) : [...focus];
  }

  _filterSourceNames(supported = [], observed = new Set()) {
    const supCanon = [...new Set(supported.map(canonicalClient))];
    const obsCanon = new Set([...observed].map(canonicalClient));
    const baseObsCanon = (this._base.observedClients || []).map(canonicalClient);
    if (this._scope.mode === 'custom') {
      return [...new Set([...this._scope.enabledClients])].sort();
    }
    if (this._scope.mode === 'all') {
      return [...new Set([...supCanon, ...obsCanon])].sort();
    }
    const focus = new Set([...DEFAULT_SCOPE_CLIENTS, ...baseObsCanon, ...obsCanon]);
    return [...new Set([...supCanon.filter(c => focus.has(c)), ...obsCanon])].sort();
  }

  _persistBase() {
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const target = path.join(this.dir, 'base-v3.json');
      const tmp = target + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this._base));
      fs.renameSync(tmp, target);
      try { this._baseFileMtime = fs.statSync(target).mtimeMs; } catch { /* ignore */ }
    } catch (e) { this.log.warn?.('tokscale-usage base cache persist failed: ' + e.message); }
  }

  _syncBaseFromDiskIfNewer() {
    try {
      const basePath = path.join(this.dir, 'base-v3.json');
      const st = fs.statSync(basePath);
      if (st.mtimeMs <= (this._baseFileMtime || 0)) return;
      const diskBase = JSON.parse(fs.readFileSync(basePath, 'utf8'));
      if (diskBase && typeof diskBase === 'object') {
        if ((diskBase.graph60dAt || 0) >= (this._base.graph60dAt || 0)) {
          this._base = { ...this._base, ...diskBase };
        } else if (diskBase.agySessions && (!this._base.agySessions || (diskBase.agySessions.todayAt || 0) > (this._base.agySessions.todayAt || 0))) {
          this._base.agySessions = diskBase.agySessions;
        }
        this._baseFileMtime = st.mtimeMs;
        this._progress.revision++;
      }
    } catch { /* ignore */ }
  }

  _persistBaseSoon() {
    if (this._disposed) return;
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(async () => {
      this._persistTimer = null;
      if (this._disposed) return;
      const target = path.join(this.dir, 'base-v3.json');
      const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
      try {
        await fs.promises.mkdir(this.dir, { recursive: true });
        await fs.promises.writeFile(tmp, JSON.stringify(this._base));
        await fs.promises.rename(tmp, target);
      } catch (e) { this.log.warn?.('tokscale-usage async base persist failed: ' + e.message); }
    }, 600);
    this._persistTimer.unref?.();
  }

  _graphWindow(sinceDate, untilDate) {
    const raw = this._base.graph60d;
    if (!raw || !Array.isArray(raw.contributions)) return raw;
    if (!sinceDate && !untilDate) return raw;
    if (!this._graphIndex || this._graphIndex.at !== this._base.graph60dAt) {
      const days = raw.contributions
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d?.date))
        .sort((a, b) => a.date.localeCompare(b.date));
      this._graphIndex = { at: this._base.graph60dAt, days, dates: days.map(d => d.date) };
    }
    const { days, dates } = this._graphIndex;
    const lowerBound = target => {
      let lo = 0, hi = dates.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (dates[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
    const lo = sinceDate ? lowerBound(sinceDate) : 0;
    const hi = untilDate ? lowerBound(untilDate + '\uffff') : dates.length;
    return { meta: raw.meta, contributions: days.slice(lo, hi) };
  }

  _pruneQueryCacheFiles(maxFiles = 8) {
    try {
      const names = fs.readdirSync(this.dir);
      const queryFiles = [];
      for (const name of names) {
        if (/^cache(?:-[a-f0-9]+)?\.json$/.test(name)) {
          try { fs.unlinkSync(path.join(this.dir, name)); } catch { /* ignore */ }
          continue;
        }
        if (/^query-[a-f0-9]+\.json$/.test(name)) {
          const full = path.join(this.dir, name);
          try {
            const st = fs.statSync(full);
            queryFiles.push({ full, mtimeMs: st.mtimeMs });
          } catch { /* ignore */ }
        }
      }
      if (queryFiles.length > maxFiles) {
        queryFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
        for (const old of queryFiles.slice(maxFiles)) {
          try { fs.unlinkSync(old.full); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }

  _runGated(viewOpts, { signal, timeoutMs, lane = 'fg' } = {}) {
    if (this._disposed) return Promise.reject(new Error('tokscale-usage store disposed'));
    const key = `${lane}:${JSON.stringify(buildArgs(viewOpts))}`;
    if (!signal && this._inflight.has(key)) return this._inflight.get(key);
    const linked = linkSignals(this._abort.signal, signal);
    const run = () => {
      if (linked?.aborted) throw new Error('tokscale run aborted');
      return this._runView(viewOpts, {
        config: { tokscaleBin: this.config.tokscaleBin },
        signal: linked,
        timeoutMs: timeoutMs || this.config.scanTimeoutMs || 180000,
      });
    };
    const targetLane = lane === 'bg' ? 'bg' : 'fg';
    const task = this._lanes[targetLane].then(run, run);
    this._lanes[targetLane] = task.catch(() => {});
    const tracked = task.then(
      v => { if (!signal) this._inflight.delete(key); return v; },
      e => { if (!signal) this._inflight.delete(key); throw e; },
    );
    if (!signal) this._inflight.set(key, tracked);
    return tracked;
  }

  /** Known fast + previously-observed active clients, avoiding pointless 25s empty scans. */
  activeClientCandidates(discoverAll = false) {
    if (discoverAll || this._scope.mode === 'all') {
      let rawList;
      try {
        const bin = resolveTokscaleBin(this.config);
        rawList = clientsForBin(bin).split(',').filter(Boolean);
      } catch {
        rawList = ALL_CLIENTS.split(',');
      }
      // Exclude legacy RPC `antigravity` when `antigravity-extension` is available
      return rawList.includes('antigravity-extension') ? rawList.filter(c => c !== 'antigravity') : rawList;
    }
    if (this._scope.mode === 'custom') {
      return expandTokscaleClients(this._scope.enabledClients);
    }
    const base = new Set(expandTokscaleClients([
      ...DEFAULT_SCOPE_CLIENTS,
      ...FAST_CLIENT_HINTS,
      ...(this._base.observedClients || []),
      'codex',
      'antigravity',
    ]));
    return [...base];
  }

  progressStatus() {
    return {
      ...this._progress,
      currentClients: [...new Set((this._progress.currentClients || []).map(canonicalClient))],
      doneClients: [...new Set((this._progress.doneClients || []).map(canonicalClient))],
      observedClients: [...new Set((this._base.observedClients || []).map(canonicalClient))],
    };
  }

  /**
   * Progressive multi-client refresh:
   * 1. Runs fast clients (`dsh`, `antigravity-cli`, `opencode`, `claude`, ...) first (<1.5s)
   *    updating graph/hourly/time-metrics/models immediately.
   * 2. Continues through heavy clients (`codex`, `antigravity-extension`, ...) one by one
   *    so partial live data is visible instantly while slow stores finish cleanly.
   */
  startProgressiveRefresh({ range = 'today', since, until, client = 'all', discoverAll = false } = {}) {
    if (this._disposed) return Promise.resolve(this.progressStatus());
    if (this._progressivePromise) return this._progressivePromise;

    // Pick up any newer disk base-v3.json before merging incremental scans
    try {
      const diskBase = JSON.parse(fs.readFileSync(path.join(this.dir, 'base-v3.json'), 'utf8'));
      if (diskBase?.graph60dAt > (this._base.graph60dAt || 0)) {
        this._base = { ...this._base, ...diskBase };
      }
    } catch { /* ignore */ }

    const today = todayDateLocal();
    const { sinceDate, untilDate } = resolveDateWindow(range, since, until);
    const list = client === 'all' ? this.activeClientCandidates(discoverAll) : expandTokscaleClients([client]);
    const fast = list.filter(c => !HEAVY_CLIENTS.has(c));
    // Run sub-second incremental `antigravity-extension` ahead of 25s+ `codex`
    const heavy = list.filter(c => HEAVY_CLIENTS.has(c)).sort((a, b) => (a === 'codex') - (b === 'codex'));
    const ordered = [...fast, ...heavy];

    this._progress = {
      active: true,
      completed: 0,
      total: ordered.length + (fast.length ? 1 : 0),
      currentClients: [],
      doneClients: [],
      errors: {},
      revision: this._progress.revision + 1,
      startedAt: Date.now(),
    };

    const mergeGraphContributions = incoming => {
      if (!Array.isArray(incoming?.contributions)) return;
      const existingMap = new Map();
      for (const day of (this._base.graph60d?.contributions || [])) {
        if (day?.date) existingMap.set(day.date, { ...day, clients: [...(day.clients || [])] });
      }
      for (const day of incoming.contributions) {
        if (!day?.date) continue;
        const cur = existingMap.get(day.date) || { date: day.date, totals: { tokens: 0, cost: 0, messages: 0 }, intensity: 0, tokenBreakdown: {}, clients: [] };
        const incomingClients = new Set((day.clients || []).map(x => x.client));
        const kept = (cur.clients || []).filter(x => !incomingClients.has(x.client));
        const mergedClients = [...kept, ...(day.clients || [])];
        let inp = 0, out = 0, cr = 0, cw = 0, reas = 0, cost = 0, msgs = 0;
        for (const r of mergedClients) {
          const tk = r.tokens || {};
          inp += num(tk.input); out += num(tk.output); cr += num(tk.cacheRead); cw += num(tk.cacheWrite); reas += num(tk.reasoning);
          cost += num(r.cost); msgs += num(r.messageCount ?? r.messages);
        }
        const totalTk = inp + out + cr + cw + reas;
        existingMap.set(day.date, {
          date: day.date,
          totals: { tokens: totalTk, cost, messages: msgs },
          intensity: day.intensity || cur.intensity || 0,
          tokenBreakdown: { input: inp, output: out, cacheRead: cr, cacheWrite: cw, reasoning: reas },
          clients: mergedClients,
        });
      }
      this._base.graph60d = {
        meta: incoming.meta || this._base.graph60d?.meta || {},
        contributions: [...existingMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      };
      this._base.graph60dAt = Date.now();
      if (isFullGraphScan) this._base.graphCoversAll = true;
    };

    const hasWarmHistory = Boolean(
      this._base.graphCoversAll &&
      Array.isArray(this._base.graph60d?.contributions) &&
      this._base.graph60d.contributions.length > 0 &&
      range !== 'all' &&
      !discoverAll
    );
    const isFullGraphScan = !hasWarmHistory;
    const explicitFullHistory = range === 'all' || Boolean(discoverAll);
    const sixtyDaysAgo = shiftDateLocal(today, -59);
    const incrementalSince = (() => {
      const twoWeeksAgo = shiftDateLocal(today, -13);
      if (sinceDate && sinceDate < twoWeeksAgo) return sinceDate;
      return twoWeeksAgo;
    })();
    const graphOptsFor = (clientSpec, isHeavyClient = false) => {
      if (isHeavyClient && !explicitFullHistory) {
        const heavySince = hasWarmHistory ? incrementalSince : (sinceDate && sinceDate < sixtyDaysAgo ? sinceDate : sixtyDaysAgo);
        return { sub: 'graph', client: clientSpec, since: heavySince, until: untilDate || today, home: this.config.home };
      }
      return isFullGraphScan
        ? { sub: 'graph', client: clientSpec, range: 'all', home: this.config.home }
        : { sub: 'graph', client: clientSpec, since: incrementalSince, until: untilDate || today, home: this.config.home };
    };

    this._base.clientScan ??= {};

    const runOne = async () => {
      try {
        // Batch 1: fast clients together in ~1s for immediate graph + hourly + time-metrics!
        if (fast.length) {
          const fastCsv = fast.join(',');
          this._progress.currentClients = [...fast];
          const tFast = Date.now();
          try {
            const { data: fg } = await this._runGated(graphOptsFor(fastCsv, false), { timeoutMs: 60000, lane: 'bg' });
            mergeGraphContributions(fg);
            delete this._progress.errors.fastGraph;
            for (const c of fast) {
              this._base.clientScan[canonicalClient(c)] = { okAt: Date.now(), through: untilDate || today, error: null, durationMs: Date.now() - tFast };
            }
            for (const c of fg?.summary?.clients || []) {
              if (!this._base.observedClients.includes(c)) this._base.observedClients.push(c);
            }
            this._persistBaseSoon();
          } catch (e) {
            this._progress.errors.fastGraph = e.message;
          }
          this._progress.completed++;
          this._progress.revision++;

          const fastAuxFresh = Boolean(
            this._base.fastAuxAt &&
            (Date.now() - this._base.fastAuxAt < 600000) &&
            this._base.hourlyTodayDate === today &&
            !explicitFullHistory
          );
          if (fastAuxFresh) {
            for (const c of fast) {
              this._progress.doneClients.push(c);
              this._progress.completed++;
            }
            this._progress.revision++;
          } else {
            try {
              const [{ data: fm }, { data: fw }, { data: fh }, { data: ft }] = await Promise.all([
                this._runGated({ client: fastCsv, range: 'month', home: this.config.home }, { timeoutMs: 45000, lane: 'bg' }),
                this._runGated({ client: fastCsv, range: 'month', groupBy: 'workspace,model', home: this.config.home }, { timeoutMs: 45000, lane: 'bg' }).catch(() => ({ data: null })),
                this._runGated({ sub: 'hourly', client: fastCsv, since: shiftDateLocal(today, -29), until: today, home: this.config.home }, { timeoutMs: 45000, lane: 'bg' }),
                this._runGated({ sub: 'time-metrics', client: fastCsv, range: 'month', home: this.config.home }, { timeoutMs: 30000, lane: 'bg' }),
              ]);
              delete this._progress.errors.fastModels;
              for (const e of fm?.entries || []) {
                if (e?.client && !this._base.observedClients.includes(e.client)) this._base.observedClients.push(e.client);
              }
              if (Array.isArray(fw?.entries)) this._base.workspaceEntries = fw.entries;
              this._base.hourlyToday = fh;
              this._base.hourlyTodayDate = today;
              this._base.timeMetrics = ft?.metrics || null;
              this._base.fastAuxAt = Date.now();
              for (const c of fast) {
                const rows = (fm?.entries || []).filter(e => e.client === c);
                this._base.perClientModels[c] = { entries: rows, updatedAt: Date.now(), error: null };
                this._progress.doneClients.push(c);
                this._progress.completed++;
              }
              this._persistBaseSoon();
              this._progress.revision++;
            } catch (e) {
              this._progress.errors.fastModels = e.message;
              this._progress.completed += fast.length + 1;
            }
          }
        }

        // Batch 2: heavy clients sequentially with bounded window + automatic today-only fallback on timeout
        for (const hc of heavy) {
          if (this._disposed || this._abort.signal.aborted) break;
          this._progress.currentClients = [hc];
          const canonHc = canonicalClient(hc);
          const t0 = Date.now();
          const heavyTimeout = explicitFullHistory ? 240000 : 95000;
          try {
            let hg;
            try {
              ({ data: hg } = await this._runGated(graphOptsFor(hc, true), { timeoutMs: heavyTimeout, lane: 'bg' }));
            } catch (firstErr) {
              if (!explicitFullHistory && /timed out/i.test(String(firstErr?.message || '')) && !this._disposed && !this._abort.signal.aborted) {
                // Retry today-only so live intraday usage is still rescued immediately
                ({ data: hg } = await this._runGated({ sub: 'graph', client: hc, since: today, until: today, home: this.config.home }, { timeoutMs: 45000, lane: 'bg' }));
              } else {
                throw firstErr;
              }
            }
            mergeGraphContributions(hg);
            delete this._progress.errors[hc];
            delete this._progress.errors[canonHc];
            this._base.clientScan[canonHc] = { okAt: Date.now(), through: untilDate || today, error: null, durationMs: Date.now() - t0 };
            for (const c of hg?.summary?.clients || []) {
              if (!this._base.observedClients.includes(c)) this._base.observedClients.push(c);
            }
            this._persistBaseSoon();
            this._progress.revision++;

            if (hc === 'antigravity-extension') {
              this._base.agySessions ??= { todayDate: '', todayAt: 0, todayEntries: [], monthAt: 0, monthEntries: [] };
              const agySpec = list.includes('antigravity-cli') ? 'antigravity-extension,antigravity-cli' : 'antigravity-extension';
              try {
                const { data: sToday } = await this._runGated(
                  { client: agySpec, range: 'today', groupBy: 'client,session,model', home: this.config.home },
                  { timeoutMs: 35000, lane: 'bg' },
                );
                this._base.agySessions.todayDate = today;
                this._base.agySessions.todayAt = Date.now();
                this._base.agySessions.todayEntries = Array.isArray(sToday?.entries) ? sToday.entries : [];
                this._persistBaseSoon();
                this._progress.revision++;
              } catch { /* optional task enrichment */ }
            }

            const modelFresh = this._base.perClientModels?.[hc]?.updatedAt
              && (Date.now() - this._base.perClientModels[hc].updatedAt < 900000)
              && (hc !== 'antigravity-extension' || Boolean(this._base.agySessions?.monthAt));
            if (!modelFresh) {
              try {
                const useSessionGroup = hc === 'antigravity-extension';
                const hmSpec = useSessionGroup && list.includes('antigravity-cli') ? 'antigravity-extension,antigravity-cli' : hc;
                const { data: hm } = await this._runGated(
                  useSessionGroup
                    ? { client: hmSpec, since: shiftDateLocal(today, -35), until: today, groupBy: 'client,session,model', home: this.config.home }
                    : { client: hmSpec, range: 'month', home: this.config.home },
                  { timeoutMs: 65000, lane: 'bg' },
                );
                const rows = Array.isArray(hm?.entries) ? hm.entries : [];
                if (useSessionGroup) {
                  this._base.agySessions ??= { todayDate: '', todayAt: 0, todayEntries: [], monthAt: 0, monthEntries: [] };
                  this._base.agySessions.monthAt = Date.now();
                  this._base.agySessions.monthEntries = rows;
                }
                if (rows.length > 0 && !this._base.observedClients.includes(hc)) this._base.observedClients.push(hc);
                let modelEntries = rows;
                if (useSessionGroup) {
                  const mAgg = new Map();
                  for (const r of rows) {
                    if (r?.client !== hc || !r?.model) continue;
                    const cur = mAgg.get(r.model) || { client: hc, model: r.model, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, messageCount: 0, cost: 0, _durMs: 0, _timedTok: 0, _samples: 0 };
                    cur.input += num(r.input); cur.output += num(r.output);
                    cur.cacheRead += num(r.cacheRead); cur.cacheWrite += num(r.cacheWrite); cur.reasoning += num(r.reasoning);
                    cur.messageCount += num(r.messageCount); cur.cost += num(r.cost);
                    const rp = extractPerformance(r);
                    if (rp && rp.totalDurationMs > 0 && rp.timedTokens > 0) {
                      cur._durMs += rp.totalDurationMs;
                      cur._timedTok += rp.timedTokens;
                      cur._samples += rp.sampleCount || 1;
                    }
                    mAgg.set(r.model, cur);
                  }
                  modelEntries = [...mAgg.values()].map(({ _durMs, _timedTok, _samples, ...rest }) => ({
                    ...rest,
                    ...(_durMs > 0 && _timedTok > 0 ? { performance: { msPer1KTokens: _durMs / (_timedTok / 1000), totalDurationMs: _durMs, timedTokens: _timedTok, sampleCount: _samples, outputNormalized: true } } : {}),
                  }));
                }
                this._base.perClientModels[hc] = { entries: modelEntries, updatedAt: Date.now(), error: null };
                this._persistBaseSoon();
              } catch { /* graph data already persisted; perf enrichment is optional */ }
            }
          } catch (e) {
            this._progress.errors[hc] = e.message;
            const prev = this._base.clientScan[canonHc] || {};
            this._base.clientScan[canonHc] = {
              ...prev,
              error: /timed out/i.test(String(e?.message || '')) ? 'timeout' : String(e?.message || e),
              errorAt: Date.now(),
            };
            this.log.warn?.(`tokscale-usage progressive client ${hc} failed: ${e.message}`);
          }
          this._progress.doneClients.push(hc);
          this._progress.completed++;
          this._progress.revision++;
        }
      } finally {
        this._persistBase();
        this._progress.active = false;
        this._progress.currentClients = [];
        this._progressivePromise = null;
      }
      return this.progressStatus();
    };

    this._progressivePromise = runOne();
    return this._progressivePromise;
  }

  /** Assemble rich dashboard payload by slicing persisted 60d graph + perf + tasks + hourly + time-metrics. */
  async buildRichDashboardPayload({ client = 'all', model = 'all', range = 'today', since, until } = {}) {
    this._syncBaseFromDiskIfNewer();
    const graphData = this._base.graph60d;
    if (!graphData || !Array.isArray(graphData.contributions) || graphData.contributions.length === 0) return null;

    const today = todayDateLocal();
    const targetClient = client === 'all' ? 'all' : canonicalClient(client);
    const scopeKey = `${this._scope.mode}:${this._scope.enabledClients.join(',')}`;
    const errSig = JSON.stringify(this._progress.errors || {});
    const richKey = `${targetClient}|${model}|${range}|${since || ''}|${until || ''}|${today}|${this._base.graph60dAt}|${this._progress.revision}|${this._progress.active ? 1 : 0}|${scopeKey}|${errSig}`;
    const cachedRich = this._richCache.get(richKey);
    if (cachedRich && Date.now() - cachedRich.at < 1200) return cachedRich.payload;

    const { sinceDate, untilDate } = resolveDateWindow(range, since, until);
    const allowedClients = targetClient === 'all' ? this._allowedSetForAll() : null;
    // Build performance lookup from perClientModels (mapped by canonical client name)
    const perfMap = new Map();
    for (const [rawName, info] of Object.entries(this._base.perClientModels || {})) {
      const cName = canonicalClient(rawName);
      if (allowedClients && !allowedClients.has(cName)) continue;
      for (const e of (info?.entries || [])) {
        const p = extractPerformance(e);
        if (p && e.model) {
          const normPerf = {
            msPer1KTokens: p.msPer1KTokens,
            totalDurationMs: p.totalDurationMs,
            timedTokens: p.timedTokens,
            sampleCount: p.sampleCount,
            tokenCoverage: p.tokenCoverage,
            outputNormalized: true,
          };
          if (!perfMap.has(`${cName}\0${e.model}`) || rawName === 'antigravity-extension') {
            perfMap.set(`${cName}\0${e.model}`, normPerf);
          }
          if (!perfMap.has(e.model)) perfMap.set(e.model, normPerf);
        }
      }
    }

    const windowedGraph = this._graphWindow(sinceDate, untilDate);
    const { report, daily } = sliceGraphReport(windowedGraph, { sinceDate, untilDate, client: targetClient, model, allowedClients, perfMap });
    const rawMetrics = metrics(report);
    const taskRes = await collectTaskUsage({
      client: targetClient, model, sinceDate, untilDate, allowedClients, agySessions: this._base.agySessions, home: this.config.home,
    }).catch(() => ({ tasks: [], totalTasks: 0, modelThroughput: {} }));

    const { summary, throughputSummary } = attachThroughput(rawMetrics, taskRes.modelThroughput);
    const mergedHourlyReport = mergeHourlySupplement(this._base.hourlyToday, taskRes.intradayHourly);
    const hourly = deriveHourlyWindow(mergedHourlyReport, { sinceDate, untilDate, client: targetClient, model, allowedClients, pad24: true });
    const heatmapWindow = this._graphWindow(shiftDateLocal(today, -60), today);
    const heatmap = buildHeatmap(heatmapWindow, 8, new Date(), { client: targetClient, model, allowedClients });

    const observed = new Set((summary?.entries || []).map(e => canonicalClient(e.client)).filter(Boolean));
    const baseObsCanon = [...new Set((this._base.observedClients || []).map(canonicalClient))];
    const errMap = {};
    for (const [k, v] of Object.entries(this._progress.errors || {})) {
      errMap[canonicalClient(k)] = v;
    }

    // Determine scan completeness so incomplete/timed-out engines never cause a fake -100% delta!
    const scopeClients = targetClient !== 'all'
      ? [targetClient]
      : [...(allowedClients || new Set([...DEFAULT_SCOPE_CLIENTS, ...baseObsCanon]))];
    const missingClients = scopeClients.filter(c => {
      if (observed.has(c)) return false;
      if (errMap[c]) return true;
      const sc = this._base.clientScan?.[c];
      return Boolean(sc?.error && !(sc.through && sc.through >= (untilDate || today)));
    });
    const completeness = {
      complete: missingClients.length === 0,
      missingClients,
      reasons: Object.fromEntries(missingClients.map(c => [c, errMap[c] || this._base.clientScan?.[c]?.error || 'incomplete'])),
    };

    let periodDelta = null;
    const comparableSet = new Set(scopeClients.filter(c => !missingClients.includes(c)));
    if (missingClients.length > 0 && (comparableSet.size === 0 || (targetClient !== 'all' && missingClients.includes(targetClient)))) {
      periodDelta = { unavailable: 'scan-incomplete', missingClients };
    } else if (sinceDate && untilDate && sinceDate <= untilDate) {
      const spanDays = Math.round((Date.parse(untilDate + 'T00:00:00Z') - Date.parse(sinceDate + 'T00:00:00Z')) / 86400000) + 1;
      const prevSinceFloor = spanDays >= 1 && spanDays <= 62 ? shiftDateLocal(sinceDate, -spanDays - 1) : sinceDate;
      const deltaGraph = this._graphWindow(prevSinceFloor, untilDate);
      if (missingClients.length > 0) {
        const curComp = metrics(sliceGraphReport(windowedGraph, { sinceDate, untilDate, client: 'all', model, allowedClients: comparableSet }).report);
        periodDelta = computePeriodDelta(deltaGraph, {
          sinceDate, untilDate, client: 'all', model, allowedClients: comparableSet,
          curTokens: curComp?.totalTokens || 0,
          curCost: curComp?.cost || 0,
          curMessages: curComp?.messages || 0,
        });
        if (periodDelta) Object.assign(periodDelta, { partial: true, excludedClients: missingClients });
      } else {
        periodDelta = computePeriodDelta(deltaGraph, {
          sinceDate, untilDate, client: targetClient, model, allowedClients,
          curTokens: summary?.totalTokens || 0,
          curCost: summary?.cost || 0,
          curMessages: summary?.messages || 0,
        });
      }
      if (periodDelta && sinceDate === today && untilDate === today) {
        periodDelta.intraday = true;
      }
    }

    // Build session-log fallback summary when tokscale missed/timed out on an engine that has live tasks
    let fallback = null;
    if (Array.isArray(taskRes.tasks) && taskRes.tasks.length > 0) {
      const fbTasks = taskRes.tasks.filter(tk => {
        const c = canonicalClient(tk.client);
        return missingClients.includes(c) || (!observed.has(c) && (summary?.totalTokens || 0) === 0);
      });
      if (fbTasks.length > 0) {
        const fbMap = new Map();
        let fbTotalTokens = 0;
        const fbClients = new Set();
        for (const tk of fbTasks) {
          const c = canonicalClient(tk.client);
          fbClients.add(c);
          fbTotalTokens += num(tk.totalTokens);
          const k = `${c}\0${tk.model || c}`;
          const cur = fbMap.get(k) || {
            client: c, model: tk.model || c, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0,
            totalTokens: 0, sessions: 0, source: 'session-log',
          };
          cur.input += num(tk.input);
          cur.output += num(tk.output);
          cur.cacheRead += num(tk.cacheRead);
          cur.cacheWrite += num(tk.cacheWrite);
          cur.reasoning += num(tk.reasoning);
          cur.totalTokens += num(tk.totalTokens);
          cur.sessions += 1;
          fbMap.set(k, cur);
        }
        fallback = {
          basis: 'session-cumulative',
          totalTokens: fbTotalTokens,
          sessionCount: fbTasks.length,
          clients: [...fbClients],
          entries: [...fbMap.values()].sort((a, b) => b.totalTokens - a.totalTokens),
        };
      }
    }

    const mtdWindow = this._graphWindow(`${today.slice(0, 8)}01`, today);
    const monthlyProjection = computeMonthlyProjection(mtdWindow, { now: new Date(), client: targetClient, model, allowedClients });
    const weekdayProfile = computeWeekdayProfile(daily.length >= 7 ? daily : heatmap);

    // Build merged workspace attribution (exact task workspaces + monthly tokscale workspace entries when applicable)
    const wsMap = new Map();
    const wsFold = k => (process.platform === 'win32' ? String(k).toLowerCase() : String(k));
    for (const tw of (taskRes.taskWorkspaces || [])) {
      wsMap.set(wsFold(tw.workspaceKey), {
        workspaceKey: tw.workspaceKey,
        label: tw.label,
        totalTokens: tw.totalTokens,
        cost: num(tw.cost),
        messages: 0,
        taskCount: tw.taskCount,
        clients: new Set((tw.clients || []).map(canonicalClient)),
        byClient: { ...(tw.byClient || {}) },
        tokensByType: tw.tokensByType ? { ...tw.tokensByType } : { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
      });
    }
    if ((range === 'month' || range === 'all') && Array.isArray(this._base.workspaceEntries)) {
      const hasWsAgyExt = this._base.workspaceEntries.some(x => x?.client === 'antigravity-extension');
      for (const we of this._base.workspaceEntries) {
        const wKey = String(we?.workspaceKey || '').replace(/\\/g, '/').replace(/\/+$/, '').replace(/^[a-z]:(?=\/|$)/, m => m.toUpperCase());
        if (!wKey) continue;
        const rawWClient = String(we?.client || '');
        if (rawWClient === 'antigravity' && hasWsAgyExt) continue;
        const wClient = canonicalClient(rawWClient);
        const wModel = String(we?.model || '');
        if (targetClient !== 'all' && wClient !== targetClient) continue;
        if (targetClient === 'all' && allowedClients && !allowedClients.has(wClient)) continue;
        if (model !== 'all' && wModel !== model) continue;
        const wTok = rowTotal(we);
        if (wTok <= 0) continue;
        const mk = wsFold(wKey);
        const cur = wsMap.get(mk) || {
          workspaceKey: wKey,
          label: we.workspaceLabel || wKey.split('/').pop() || wKey,
          totalTokens: 0,
          cost: 0,
          messages: 0,
          taskCount: 0,
          clients: new Set(),
          byClient: {},
          tokensByType: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
        };
        // Avoid double-counting DSH tokens if taskWorkspaces already summed them; take max between engine workspace & task sum
        cur.cost = Math.max(cur.cost, num(we.cost));
        cur.messages += num(we.messageCount);
        if (wClient) {
          cur.clients.add(wClient);
          cur.engineByClient = cur.engineByClient || {};
          cur.engineByClient[wClient] = (cur.engineByClient[wClient] || 0) + wTok;
        }
        cur.engineTokens = (cur.engineTokens || 0) + wTok;
        if (cur.taskCount === 0) {
          cur.tokensByType.input += num(we.input);
          cur.tokensByType.output += num(we.output);
          cur.tokensByType.cacheRead += num(we.cacheRead);
          cur.tokensByType.cacheWrite += num(we.cacheWrite);
          cur.tokensByType.reasoning += num(we.reasoning);
        }
        wsMap.set(mk, cur);
      }
      for (const cur of wsMap.values()) {
        if (cur.engineTokens && cur.engineTokens > cur.totalTokens) {
          cur.totalTokens = cur.engineTokens;
          if (cur.engineByClient) {
            for (const [ck, cv] of Object.entries(cur.engineByClient)) {
              if (cv > (cur.byClient[ck] || 0)) cur.byClient[ck] = cv;
            }
          }
        }
        delete cur.engineTokens;
        delete cur.engineByClient;
      }
    }
    const workspaces = [...wsMap.values()]
      .map(w => ({ ...w, clients: [...w.clients] }))
      .filter(w => w.totalTokens > 0)
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 16);

    const models = [...new Set((summary?.entries || []).map(e => e.model).filter(Boolean))].sort();
    const allKnown = allowedClients
      ? [...allowedClients].sort()
      : (this._scope.mode === 'all'
          ? [...new Set([...baseObsCanon, ...observed])].sort()
          : [...new Set([...DEFAULT_SCOPE_CLIENTS, ...baseObsCanon, ...observed])].sort());
    const sources = allKnown.map(name => {
      const updatedCand = name === 'antigravity'
        ? Math.max(
            this._base.perClientModels?.['antigravity-extension']?.updatedAt || 0,
            this._base.perClientModels?.['antigravity-cli']?.updatedAt || 0,
            this._base.perClientModels?.antigravity?.updatedAt || 0,
            this._base.graph60dAt || 0,
          )
        : (this._base.perClientModels?.[name]?.updatedAt || this._base.graph60dAt || 0);
      return {
        name,
        observed: observed.has(name) || (!allowedClients && baseObsCanon.includes(name) && targetClient === 'all' && range === 'all'),
        status: errMap[name] ? 'error' : observed.has(name) ? 'observed' : 'idle',
        updatedAt: updatedCand,
        error: errMap[name] || null,
      };
    });

    const updatedAt = this._base.graph60dAt || 0;
    const payload = {
      metrics: summary,
      daily,
      hourly,
      heatmap,
      periodDelta,
      monthlyProjection,
      weekdayProfile,
      workspaces,
      executionProfile: taskRes.executionProfile || null,
      fallback,
      tasks: taskRes.tasks,
      totalTasks: taskRes.totalTasks,
      timeMetrics: (targetClient === 'all' && model === 'all') ? this._base.timeMetrics : null,
      throughputSummary,
      sources,
      models,
      meta: {
        client: targetClient, model, range, since: since || null, until: until || null,
        sinceDate, untilDate, today,
        updatedAt,
        attemptedAt: this._progress.startedAt || updatedAt,
        refreshing: this._progress.active,
        progress: this.progressStatus(),
        scope: this.getScope(),
        completeness,
        stale: !updatedAt || (Date.now() - updatedAt > 600000),
        errors: allowedClients
          ? Object.fromEntries(Object.entries(errMap).filter(([k]) => k === 'fastGraph' || k === 'fastModels' || allowedClients.has(k)))
          : errMap,
        trendsAvailable: daily.length > 0,
        hourlyAvailable: hourly.length > 0,
        trendScope: range === 'all' ? (this._base.graphCoversAll ? 'all' : 'last60d') : range,
        derivedFromBase: true,
        sourceCoverage: allowedClients ? 'custom-scope' : 'active-clients',
        engine: 'tokscale',
        serverVersion: SERVER_VERSION,
      },
    };
    this._richCache.set(richKey, { at: Date.now(), payload });
    if (this._richCache.size > 20) this._richCache.delete(this._richCache.keys().next().value);
    return payload;
  }

  /**
   * Standard scoped query preserved for agent tool & isolated test compatibility,
   * enriched with tasks/throughput/heatmap when available.
   */
  async query({ client = 'all', model = 'all', range = 'month', since, until, refresh = false, cacheOnly = false, includeRich = false, signal } = {}) {
    if (this._disposed) throw new Error('tokscale-usage store disposed');
    if (signal?.aborted) throw new Error('tokscale run aborted');
    if (typeof model !== 'string' || !model || model.length > 512) throw new Error('invalid model');
    if (range === 'custom') {
      if (!since || !until || since > until) throw new Error('invalid custom date range');
    }

    // Check rich graph base slice first when explicitly requested or on cacheOnly fallback
    if (includeRich && !refresh) {
      const sliced = await this.buildRichDashboardPayload({ client, model, range, since, until });
      if (sliced && (range !== 'all' || this._base.graphCoversAll || this._progressivePromise)) return sliced;
    }

    const allowedClients = client === 'all' ? this._allowedSetForAll() : null;
    const enrichWithGraphTrends = payload => {
      if (!payload || !includeRich) return payload;
      const withScope = payload.meta?.scope ? payload : { ...payload, meta: { ...(payload.meta || {}), scope: this.getScope() } };
      if (Array.isArray(withScope.daily) && withScope.daily.length > 0) return withScope;
      if (!this._base.graph60d?.contributions?.length) return withScope;
      const win = resolveDateWindow(range, since, until);
      const { daily: gDaily } = sliceGraphReport(this._base.graph60d, { ...win, client, model, allowedClients });
      if (!gDaily.length) return withScope;
      return {
        ...withScope,
        daily: gDaily,
        heatmap: Array.isArray(withScope.heatmap) && withScope.heatmap.length ? withScope.heatmap : buildHeatmap(this._base.graph60d, 8, new Date(), { client, model, allowedClients }),
        meta: {
          ...(withScope.meta || {}),
          trendsAvailable: true,
          trendScope: this._base.graphCoversAll ? 'all' : 'last60d',
        },
      };
    };

    const actualRange = range === 'custom' ? 'month' : range;
    const scanClient = client === 'all' && this._scope.mode === 'custom'
      ? expandTokscaleClients(this._scope.enabledClients).join(',')
      : (canonicalClient(client) === 'antigravity' ? expandTokscaleClients(['antigravity']).join(',') : client);
    const opts = { client: scanClient, home: this.config.home, range: actualRange, since, until };
    buildArgs(opts);
    const period = ['today', 'yesterday', 'days3', 'week', 'month', 'year'].includes(range) ? todayDateLocal() : '';
    const environment = [
      process.env.TOKSCALE_BIN, process.env.TOKSCALE_CONFIG_DIR, process.env.CODEX_HOME,
      process.env.DSH_HOME, process.env.USERPROFILE, process.env.HOME,
      process.env.APPDATA, process.env.XDG_CONFIG_HOME,
    ].map(value => value || '');
    environment.push(crypto.createHash('sha256').update(process.env.PATH || '').digest('hex'));
    const configRoot = process.env.TOKSCALE_CONFIG_DIR || (process.platform === 'win32'
      ? path.join(process.env.APPDATA || '', 'tokscale')
      : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'tokscale'));
    try { const stat = fs.statSync(path.join(configRoot, 'settings.json')); environment.push(`${stat.size}:${stat.mtimeMs}`); }
    catch { environment.push('no-settings'); }

    const scopeSig = client === 'all' && this._scope.mode === 'custom' ? this._scope.enabledClients.join(',') : (this._scope.mode === 'all' ? 'all-58' : '');
    const makeKey = selectedModel => JSON.stringify([
      'normalized-reasoning-v4', client, selectedModel, range, since || '', until || '',
      period, this.config.home || '', this.config.tokscaleBin || '', environment, ...(scopeSig ? [scopeSig] : []),
    ]);
    const sanitizeCachedSources = value => {
      if (!value || !Array.isArray(value.sources) || this._scope.mode === 'all') return value;
      const obs = new Set(value.sources.filter(s => s?.observed).map(s => s.name));
      const allowedNames = new Set(this._filterSourceNames(value.sources.map(s => s.name), obs));
      if (value.sources.every(s => allowedNames.has(s.name))) return value;
      return { ...value, sources: value.sources.filter(s => allowedNames.has(s.name)) };
    };
    const withAge = value => {
      const cleaned = sanitizeCachedSources(value);
      return {
        ...cleaned,
        meta: { ...cleaned.meta, stale: Boolean(cleaned.meta.stale || !cleaned.meta.updatedAt || Date.now() - cleaned.meta.updatedAt > 600000) },
      };
    };
    const cacheFile = cacheKey => path.join(this.dir, 'query-' + crypto.createHash('sha256').update(cacheKey).digest('hex') + '.json');
    const readCached = cacheKey => {
      let value = this._queries.get(cacheKey);
      if (!value) {
        try {
          const data = JSON.parse(fs.readFileSync(cacheFile(cacheKey), 'utf8'));
          if (data.key === cacheKey && data.value?.meta) value = data.value;
        } catch { /* no cache */ }
        if (value) this._queries.set(cacheKey, value);
      }
      return value;
    };

    const key = makeKey(model);
    if (model !== 'all' && (!refresh || cacheOnly)) {
      const base = readCached(makeKey('all'));
      if (base && Array.isArray(base.metrics?.entries)) {
        const slicedReport = metrics(reportForModel(base.metrics.entries, model));
        const slicedDaily = this._base.graph60d && includeRich
          ? sliceGraphReport(this._base.graph60d, { ...resolveDateWindow(range, since, until), client, model }).daily
          : [];
        return withAge({
          ...base,
          metrics: slicedReport,
          daily: slicedDaily,
          meta: { ...base.meta, model, trendsAvailable: slicedDaily.length > 0 },
        });
      }
    }
    const saved = readCached(key);
    if (saved && (!refresh || cacheOnly)) return enrichWithGraphTrends(withAge(saved));
    if (cacheOnly) {
      return this.buildRichDashboardPayload({ client, model, range, since, until });
    }

    const file = cacheFile(key);
    const attemptedAt = Date.now();
    try {
      const { data, args = buildArgs(opts) } = await this._runGated(opts, { signal });
      const rawEntries = Array.isArray(data?.entries) ? data.entries : [];
      const hasRawAgyExt = rawEntries.some(e => e?.client === 'antigravity-extension');
      const entries = (() => {
        const merged = [];
        const agyIdx = new Map();
        for (const e of rawEntries) {
          if (e?.client === 'antigravity' && hasRawAgyExt) continue;
          const cc = canonicalClient(e?.client);
          if (cc !== 'antigravity') {
            merged.push(e);
            continue;
          }
          const mk = `${e?.provider || ''}\0${e?.model || ''}`;
          if (!agyIdx.has(mk)) {
            agyIdx.set(mk, merged.length);
            merged.push({ ...e, client: 'antigravity' });
          } else {
            const cur = merged[agyIdx.get(mk)];
            for (const f of ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'messageCount', 'cost']) {
              if (Number.isFinite(cur[f]) && Number.isFinite(e[f])) cur[f] += e[f];
            }
          }
        }
        return merged;
      })();
      const supported = (args[args.indexOf('-c') + 1] || '').split(',').filter(Boolean);
      const observed = new Set(entries.map(e => e.client).filter(Boolean));
      const sources = this._filterSourceNames(supported, observed).map(name => ({ name, status: 'unknown', observed: observed.has(name) }));
      const models = [...new Set(entries.map(e => e.model).filter(Boolean))].sort();
      let report = hasRawAgyExt ? reportForModel(entries, model === 'all' ? null : model) : { ...data, entries };
      if (hasRawAgyExt && model === 'all') {
        const sum = k => entries.every(e => Number.isFinite(e[k])) ? entries.reduce((s, e) => s + e[k], 0) : null;
        report = {
          ...data,
          entries,
          totalInput: sum('input'),
          totalOutput: sum('output'),
          totalCacheRead: sum('cacheRead'),
          totalCacheWrite: sum('cacheWrite'),
          totalMessages: sum('messageCount'),
          totalCost: sum('cost'),
        };
      } else if (model !== 'all') {
        report = reportForModel(entries, model);
      }
      let summary = metrics(report);
      let daily = [], trendError = null;

      if (model === 'all' && summary?.reasoning === 0 && Number.isFinite(summary.totalTokens)) {
        try {
          const { data: hourly } = await this._runGated({ ...opts, sub: 'hourly' }, { signal });
          const buckets = deriveDaily(hourly);
          const fields = ['input', 'output', 'cacheRead', 'cacheWrite'];
          const reconciles = Array.isArray(hourly?.entries) && hourly.entries.every(entry =>
            entry && fields.every(field => Number.isFinite(entry[field]))) &&
            fields.every(field => buckets.reduce((sum, row) => sum + row[field], 0) === summary[field]) &&
            buckets.reduce((sum, row) => sum + row.totalTokens, 0) === summary.totalTokens;
          if (reconciles) daily = buckets;
          else trendError = 'Hourly buckets do not reconcile with the report totals.';
        } catch (e) { if (signal?.aborted || this._disposed) throw e; trendError = e.message; }
      }

      const { sinceDate, untilDate } = resolveDateWindow(range, since, until);
      const taskRes = await collectTaskUsage({ client, model, sinceDate, untilDate, allowedClients, agySessions: this._base.agySessions, home: this.config.home })
        .catch(() => ({ tasks: [], totalTasks: 0, modelThroughput: {} }));
      const enriched = attachThroughput(summary, taskRes.modelThroughput);
      summary = enriched.summary;

      if (period && period !== todayDateLocal()) throw new Error('The date changed during this query. Apply the range again.');
      const now = Date.now();
      const heatmapArr = this._base.graph60d ? buildHeatmap(this._graphWindow(shiftDateLocal(todayDateLocal(), -60), todayDateLocal()), 8, new Date(), { client, model, allowedClients }) : [];
      const periodDelta = this._base.graph60d ? computePeriodDelta(this._base.graph60d, {
        sinceDate, untilDate, client, model, allowedClients,
        curTokens: summary?.totalTokens || 0, curCost: summary?.cost || 0, curMessages: summary?.messages || 0,
      }) : null;
      const mergedHourlyQuery = mergeHourlySupplement(this._base.hourlyToday, taskRes.intradayHourly);
      const value = {
        metrics: summary,
        daily,
        hourly: mergedHourlyQuery ? deriveHourlyWindow(mergedHourlyQuery, { sinceDate, untilDate, client, model, allowedClients, pad24: true }) : [],
        heatmap: heatmapArr,
        periodDelta,
        monthlyProjection: this._base.graph60d ? computeMonthlyProjection(this._base.graph60d, { now: new Date(), client, model, allowedClients }) : null,
        weekdayProfile: computeWeekdayProfile(daily.length >= 7 ? daily : heatmapArr),
        workspaces: Array.isArray(taskRes.taskWorkspaces) ? taskRes.taskWorkspaces.slice(0, 16) : [],
        executionProfile: taskRes.executionProfile || null,
        tasks: taskRes.tasks,
        totalTasks: taskRes.totalTasks,
        timeMetrics: (canonicalClient(client) === 'all' && model === 'all') ? this._base.timeMetrics : null,
        throughputSummary: enriched.throughputSummary,
        sources,
        models,
        meta: {
          client, model, range, since: since || null, until: until || null,
          updatedAt: now, attemptedAt, refreshing: false,
          stale: false, errors: trendError ? { hourly: trendError } : {},
          trendsAvailable: daily.length > 0,
          sourceCoverage: 'known-clients', engine: 'tokscale',
          serverVersion: SERVER_VERSION,
        },
      };
      this._queries.set(key, value);
      try {
        fs.mkdirSync(this.dir, { recursive: true });
        const tmp = file + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify({ key, value }));
        fs.renameSync(tmp, file);
        this._pruneQueryCacheFiles(8);
      } catch (e) { this.log.warn?.('tokscale-usage query cache persist failed: ' + e.message); }
      return enrichWithGraphTrends(value);
    } catch (e) {
      if (signal?.aborted || this._disposed || !saved) throw e;
      const stale = { ...saved, meta: { ...saved.meta, attemptedAt, stale: true, refreshing: false, errors: { report: e.message } } };
      this._queries.set(key, stale);
      try {
        fs.mkdirSync(this.dir, { recursive: true });
        const tmp = file + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify({ key, value: stale }));
        fs.renameSync(tmp, file);
      } catch (persistError) { this.log.warn?.('tokscale-usage stale cache persist failed: ' + persistError.message); }
      return enrichWithGraphTrends(stale);
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    try { this._abort.abort(); } catch { /* ignore */ }
  }
}
