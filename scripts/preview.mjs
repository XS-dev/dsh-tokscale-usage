// Build a STATIC, self-contained dashboard preview filled with the real cached
// tokscale snapshot, so it can be opened directly in a browser without the DSH
// host running. Usage: node scripts/preview.mjs [outFile]
import fs from 'node:fs';
import path from 'node:path';
import { Store } from '../lib/store.mjs';
import { renderDashboard } from '../lib/views.mjs';

const out = process.argv[2] || path.join(process.cwd(), 'preview.html');
const store = new Store({ client: 'dsh' }, console); // loads ~/.dsh/tokscale-usage/cache.json
const snap = store.snapshot();
if (!snap.meta.updatedAt) {
  console.error('No cached data yet. Run: node scripts/smoke.mjs today  (or serve-smoke.mjs) first.');
  process.exit(1);
}
const inject = `window.__PREVIEW__=${JSON.stringify(snap)};
const __origFetch=window.fetch.bind(window);
window.fetch=(url,opts)=>{const u=String(url);
  if(u==='data'||u.endsWith('/data'))return Promise.resolve({ok:true,json:()=>Promise.resolve(window.__PREVIEW__)});
  if(u==='refresh'||u.endsWith('/refresh'))return Promise.resolve({ok:true,text:()=>Promise.resolve('{"ok":true,"refreshing":false}')});
  return __origFetch(url,opts);};`;
let html = renderDashboard();
const marker = '<script>\nconst $=';
if (!html.includes(marker)) { console.error('dashboard marker not found'); process.exit(1); }
html = html.replace(marker, '<script>\n' + inject + '\nconst $=');
html = html.replace('<span class="badge">engine · tokscale</span>', '<span class="badge">engine · tokscale</span><span class="badge" style="color:#ffcf6b">static preview</span>');
fs.writeFileSync(out, html);
console.log('preview written:', out, '| bytes:', html.length);
console.log('snapshot: today total', snap.today.totalTokens, '| month total', snap.month.totalTokens, '| daily', snap.daily.length, '| updated', new Date(snap.meta.updatedAt).toLocaleString());