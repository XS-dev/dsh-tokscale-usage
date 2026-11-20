// Verify the current multi-agent report API. This may start a tokscale scan if
// no matching cached report exists. It does not verify GUI rendering.
// node scripts/verify-live.mjs ORIGIN [client] [range] [model] [since] [until]
// Defaults: client=dsh, range=today, model=all. custom requires both dates.
// Exit: 0 valid non-stale report with records, 1 service/protocol error,
// 2 missing/stale/empty data or report errors.
import { pathToFileURL } from 'node:url';

export async function verifyReport({ origin, client = 'dsh', range = 'today', model = 'all', since, until, fetchImpl = fetch, log = console }) {
  if (!origin || (range === 'custom' && (!since || !until))) {
    log.error('FAIL (service): supply ORIGIN; custom range also requires since and until.');
    return 1;
  }
  let url;
  try {
    url = new URL('/tokscale-usage/report', origin);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
  } catch {
    log.error('FAIL (service): invalid origin');
    return 1;
  }
  for (const [key, value] of Object.entries({ client, model, range, since, until })) {
    if (value) url.searchParams.set(key, value);
  }
  let response;
  try { response = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(200000) }); }
  catch (e) { log.error('FAIL (service): ' + e.message); return 1; }
  if (!response.ok) { log.error('FAIL (service): HTTP ' + response.status); return 1; }
  let data;
  try { data = await response.json(); }
  catch { log.error('FAIL (service): invalid JSON'); return 1; }
  const meta = data?.meta;
  if (meta?.engine !== 'tokscale' || !data?.metrics || !Array.isArray(data.metrics.entries)) {
    log.error('FAIL (service): unexpected report schema or engine');
    return 1;
  }
  if (meta.client !== client || meta.model !== model || meta.range !== range ||
      (since && meta.since !== since) || (until && meta.until !== until)) {
    log.error('FAIL (service): report selection does not match request');
    return 1;
  }
  const errors = meta.errors && typeof meta.errors === 'object' ? Object.entries(meta.errors) : [];
  const rows = data.metrics.entries;
  const mismatched = rows.some(e => (client !== 'all' && e.client !== client) || (model !== 'all' && e.model !== model));
  if (mismatched) { log.error('FAIL (data): report contains entries outside requested filters'); return 2; }
  if (!meta.updatedAt || meta.stale || errors.length || rows.length === 0 || !(Number(data.metrics.totalTokens) > 0)) {
    log.error('FAIL (data): no non-stale, error-free report with recorded tokens' + (errors.length ? ' (' + errors.map(([k, v]) => `${k}: ${v}`).join('; ') + ')' : ''));
    return 2;
  }
  const sources = [...new Set(rows.map(e => e.client).filter(Boolean))].sort();
  log.log(`SERVICE OK: tokscale report API; client=${client}, model=${model}, range=${range}`);
  log.log(`DATA OK: ${data.metrics.totalTokens} tokens; ${rows.length} model rows; observed agents: ${sources.join(', ') || 'unknown'}`);
  log.log('GUI NOT VERIFIED: inspect the authenticated desktop settings page separately.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [origin, client, range, model, since, until] = process.argv.slice(2);
  try { process.exitCode = await verifyReport({ origin, client, range, model, since, until }); }
  catch (error) { console.error('FAIL (service): ' + error.message); process.exitCode = 1; }
}
