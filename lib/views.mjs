// Presentation layer: agent-facing text summary for /tokscale and tokscale_usage.

export function fmtInt(n) {
  n = Number(n) || 0;
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

export function fmtCost(n) {
  n = Number(n) || 0;
  return n > 0 ? '$' + n.toFixed(4) : '$0 (no pricing)';
}

export function fmtPct(x) {
  return ((Number(x) || 0) * 100).toFixed(1) + '%';
}

function modelLine(e) {
  const name = e.model || '(unknown)';
  const client = e.client ? `${e.client} / ` : '';
  const prov = e.provider ? ` [${e.provider}]` : '';
  const cost = Number(e.cost) > 0 ? ` · ${fmtCost(e.cost)}` : '';
  const tps = Number.isFinite(e?.throughput?.tokensPerSec) ? ` · ${e.throughput.tokensPerSec.toFixed(1)} tok/s` : '';
  return `  • ${client}${name}${prov}: in ${fmtInt(e.input)} / out ${fmtInt(e.output)}${Number(e.reasoning) > 0 ? ` / reas ${fmtInt(e.reasoning)}` : ''} / cacheRead ${fmtInt(e.cacheRead)} · ${e.messageCount || 0} msgs${tps}${cost}`;
}

// Text summary returned by the tokscale_usage tool and /tokscale command.
export function formatSummary({ report, metrics: precomputed, range, cached, updatedAt, throughputSummary, tasks }, m) {
  const metrics = m || precomputed || (report ? {
    input: report.totalInput || 0, output: report.totalOutput || 0,
    cacheRead: report.totalCacheRead || 0, cacheWrite: report.totalCacheWrite || 0,
    reasoning: Array.isArray(report.entries) ? report.entries.reduce((s, e) => s + (Number(e?.reasoning) || 0), 0) : 0,
    totalTokens: (report.totalInput || 0) + (report.totalOutput || 0) + (report.totalCacheRead || 0) + (report.totalCacheWrite || 0),
    messages: report.totalMessages || 0, cost: report.totalCost || 0,
    cacheHitRate: (report.totalInput + report.totalCacheRead + report.totalCacheWrite) > 0
      ? report.totalCacheRead / (report.totalInput + report.totalCacheRead + report.totalCacheWrite) : 0,
    entries: report.entries || [],
  } : null);
  if (!metrics) return 'No usage data available yet.';
  const total = metrics.totalTokens != null ? metrics.totalTokens : (metrics.input + metrics.output + metrics.cacheRead + metrics.cacheWrite);
  const reasStr = Number(metrics.reasoning) > 0 ? ` · reasoning ${fmtInt(metrics.reasoning)}` : '';
  const tpStr = Number.isFinite(throughputSummary?.avgTokensPerSec) ? ` · avg speed ${throughputSummary.avgTokensPerSec.toFixed(1)} tok/s` : '';
  const lines = [
    `DSH token usage — ${range}  (engine: tokscale)`,
    `Total ${fmtInt(total)} tokens · input ${fmtInt(metrics.input)} · output ${fmtInt(metrics.output)}${reasStr} · cacheRead ${fmtInt(metrics.cacheRead)} · cacheWrite ${fmtInt(metrics.cacheWrite)}`,
    `Cache hit rate ${fmtPct(metrics.cacheHitRate)} · ${metrics.messages || 0} messages · est. cost ${fmtCost(metrics.cost)}${tpStr}`,
  ];
  const entries = [...(metrics.entries || [])].sort((a, b) => (b.input + b.cacheRead + b.output) - (a.input + a.cacheRead + a.output));
  if (entries.length) {
    lines.push('Per model:');
    for (const e of entries.slice(0, 12)) lines.push(modelLine(e));
    if (entries.length > 12) lines.push(`  … +${entries.length - 12} more`);
  }
  if (Array.isArray(tasks) && tasks.length) {
    lines.push('Top tasks:');
    for (const task of tasks.slice(0, 5)) {
      const tps = Number.isFinite(task.outputTps) ? ` · ${task.outputTps.toFixed(1)} tok/s` : '';
      lines.push(`  • [${task.client}] ${task.title}: ${fmtInt(task.totalTokens)} tokens (${task.model})${tps}`);
    }
  }
  if (updatedAt) lines.push(`Updated ${new Date(updatedAt).toLocaleString()}${cached ? ' (cached)' : ' (fresh)'}`);
  lines.push('Note: est. cost is tokscale\'s pricing estimate, not your actual bill; cost is 0 when tokscale has no pricing for the active models (token counts stay accurate).');
  return lines.join('\n');
}
