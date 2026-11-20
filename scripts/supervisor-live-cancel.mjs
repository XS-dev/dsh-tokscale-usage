// Supervisor-owned, explicit live acceptance: one short-date Codex query only.
// Does not change configuration, simulate an engine, or kill processes itself.
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';

const [origin, pidText] = process.argv.slice(2);
const hostPid = Number(pidText);
assert.ok(Number.isSafeInteger(hostPid) && hostPid > 0, 'Supply the current Desktop Host PID');
const base = new URL(origin);
assert.equal(base.hostname, '127.0.0.1');
const ps = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
function children() {
  const command = `@(Get-CimInstance Win32_Process -Filter "Name='tokscale.exe' AND ParentProcessId=${hostPid}" | Select-Object ProcessId,ParentProcessId) | ConvertTo-Json -Compress`;
  const out = execFileSync(ps, ['-NoProfile', '-Command', command], {encoding:'utf8', windowsHide:true, timeout:10000}).trim();
  if (!out) return [];
  const value = JSON.parse(out);
  return Array.isArray(value) ? value : [value];
}
assert.equal(children().length, 0, 'Existing scan: do not interfere or create another request');
const id = randomBytes(16).toString('hex');
const url = new URL('/tokscale-usage/report', base);
url.search = new URLSearchParams({client:'codex', range:'today', refresh:'true', requestId:id});
let cancelSent = false;
try {
  const pending = fetch(url, {signal:AbortSignal.timeout(30000)}).then(response => ({response}), error => ({error}));
  await new Promise(resolve => setTimeout(resolve, 750));
  const before = children();
  assert.equal(before.length, 1, 'Could not observe exactly one owned real engine before cancellation');
  const started = Date.now();
  const cancel = await fetch(new URL('/tokscale-usage/cancel?id=' + id, base), {method:'POST', signal:AbortSignal.timeout(5000)});
  cancelSent = true;
  assert.equal(cancel.status, 202);
  const result = await pending;
  if (result.error) throw result.error;
  assert.equal(result.response.status, 499, 'The query completed normally: cancellation is not established');
  const after = children();
  assert.equal(after.length, 0, 'The cancelled Host scan is still running');
  console.log(JSON.stringify({passed:true,route:'real Desktop Host HTTP',client:'codex',range:'today',before,queryHTTP:499,cancelHTTP:202,remainingOwnedScans:0,cancelElapsedMs:Date.now()-started,guiClickNotVerified:true}));
} finally {
  if (!cancelSent) await fetch(new URL('/tokscale-usage/cancel?id=' + id, base), {method:'POST', signal:AbortSignal.timeout(5000)}).catch(() => {});
}
