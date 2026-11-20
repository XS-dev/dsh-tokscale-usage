// Presentation layer: agent-facing text summary + self-contained web dashboard.

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
export function fmtPct(x) { return ((Number(x) || 0) * 100).toFixed(1) + '%'; }

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

// Static dashboard shell; all data is fetched client-side from ./data.
export function renderDashboard() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DSH · tokscale usage</title>
<style>
  :root{--bg:#0f1115;--panel:#171a21;--panel2:#1e222b;--line:#2a2f3a;--fg:#e6e8ec;--mut:#9aa3b2;--acc:#5b9dff;--acc2:#7ee0a3;--warn:#ffcf6b;--bad:#ff7b7b;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;}
  a{color:var(--acc)}
  .wrap{max-width:1080px;margin:0 auto;padding:24px 20px 64px;}
  header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px;}
  h1{font-size:20px;margin:0;font-weight:650;}
  .badge{font-size:11px;color:var(--acc2);border:1px solid var(--line);background:var(--panel);padding:2px 8px;border-radius:999px;}
  .spacer{flex:1}
  .mut{color:var(--mut)}
  button{background:var(--acc);color:#08111f;border:0;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer;}
  button.ghost{background:var(--panel2);color:var(--fg);border:1px solid var(--line);}
  button:disabled{opacity:.5;cursor:default}
  .tabs{display:flex;gap:8px;margin:6px 0 16px;}
  .tab{padding:6px 14px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--mut);cursor:pointer;}
  .tab.on{background:var(--acc);color:#08111f;border-color:var(--acc);font-weight:600;}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px;}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;}
  .card .k{font-size:12px;color:var(--mut);margin-bottom:6px;}
  .card .v{font-size:22px;font-weight:650;}
  .card .s{font-size:11px;color:var(--mut);margin-top:4px;}
  .panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:20px;}
  .panel h2{font-size:14px;margin:0 0 12px;font-weight:600;color:var(--fg);}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th,td{text-align:right;padding:7px 8px;border-bottom:1px solid var(--line);}
  th:first-child,td:first-child{text-align:left;}
  th{color:var(--mut);font-weight:500;}
  tr:last-child td{border-bottom:0}
  .bar{height:10px;border-radius:5px;background:var(--panel2);overflow:hidden;}
  .bar>i{display:block;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2));}
  svg{width:100%;height:180px;display:block;}
  .status{font-size:12px;color:var(--mut);margin-bottom:14px;}
  .err{color:var(--bad);}
  .foot{font-size:12px;color:var(--mut);margin-top:8px;}
  .spin{display:inline-block;width:10px;height:10px;border:2px solid var(--acc);border-top-color:transparent;border-radius:50%;animation:sp .8s linear infinite;vertical-align:-1px;margin-right:6px;}
  @keyframes sp{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>DSH token usage</h1>
    <span class="badge">engine · tokscale</span>
    <div class="spacer"></div>
    <span class="mut" id="updated"></span>
    <button class="ghost" id="refresh">Refresh</button>
  </header>
  <div class="status" id="status"></div>
  <div class="tabs">
    <div class="tab on" data-range="today">Today</div>
    <div class="tab" data-range="month">This month</div>
  </div>
  <div class="cards" id="cards"></div>
  <div class="panel">
    <h2>Daily trend · total tokens (this month)</h2>
    <svg id="daily" viewBox="0 0 1000 180" preserveAspectRatio="none"></svg>
  </div>
  <div class="panel">
    <h2>Today by hour · total tokens</h2>
    <svg id="hourly" viewBox="0 0 1000 180" preserveAspectRatio="none"></svg>
  </div>
  <div class="panel">
    <h2 id="modelTitle">Per model</h2>
    <table id="models"><thead><tr><th>Model</th><th>Input</th><th>Output</th><th>Cache read</th><th>Cache hit</th><th>Msgs</th><th>Cost</th></tr></thead><tbody></tbody></table>
  </div>
  <div class="foot" id="foot"></div>
</div>
<script>
const $=s=>document.querySelector(s);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtInt=n=>{n=Number(n)||0;const a=Math.abs(n);if(a>=1e9)return(n/1e9).toFixed(2)+'B';if(a>=1e6)return(n/1e6).toFixed(2)+'M';if(a>=1e3)return(n/1e3).toFixed(1)+'K';return String(Math.round(n));};
const fmtCost=n=>{n=Number(n)||0;return n>0?'$'+n.toFixed(4):'—';};
const fmtPct=x=>((Number(x)||0)*100).toFixed(1)+'%';
let SNAP=null, RANGE='today', polling=null;

function cards(m){
  if(!m)return '<div class="card"><div class="k">No data</div><div class="v">—</div><div class="s">waiting for first scan</div></div>';
  const total=m.totalTokens!=null?m.totalTokens:(m.input+m.output+m.cacheRead+m.cacheWrite);
  const c=[['Total tokens',fmtInt(total),'input+output+cache'],['Input',fmtInt(m.input),'uncached prompt'],['Output',fmtInt(m.output),'generated'],['Cache read',fmtInt(m.cacheRead),'reused prompt'],['Cache hit',fmtPct(m.cacheHitRate),'cacheRead / prompt side'],['Messages',fmtInt(m.messages),''],['Est. cost',fmtCost(m.cost),'tokscale estimate, not bill']];
  return c.map(([k,v,s])=>'<div class="card"><div class="k">'+k+'</div><div class="v">'+v+'</div><div class="s">'+s+'</div></div>').join('');
}
function bars(svg,items,val,label){
  const el=$(svg);if(!items.length){el.innerHTML='<text x="20" y="90" fill="#9aa3b2" font-size="14">no data</text>';return;}
  const W=1000,H=180,pad=24,max=Math.max(...items.map(val),1),n=items.length,gap=n>40?1:3;
  const bw=(W-pad*2)/n;let out='';
  items.forEach((it,i)=>{const h=Math.max(2,(val(it)/max)*(H-pad*2));const x=pad+i*bw,y=H-pad-h;
    out+='<rect x="'+(x+gap/2)+'" y="'+y+'" width="'+Math.max(1,bw-gap)+'" height="'+h+'" rx="2" fill="url(#g)"><title>'+esc(label(it))+': '+fmtInt(val(it))+'</title></rect>';});
  el.innerHTML='<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b9dff"/><stop offset="1" stop-color="#7ee0a3"/></linearGradient></defs>'+out;
}
function models(m){
  const tb=$('#models tbody');const es=(m&&m.entries||[]).slice().sort((a,b)=>(b.input+b.cacheRead)-(a.input+a.cacheRead));
  $('#modelTitle').textContent='Per model · '+(RANGE==='today'?'today':'this month');
  if(!es.length){tb.innerHTML='<tr><td colspan="7" class="mut">no data</td></tr>';return;}
  tb.innerHTML=es.map(e=>{const ps=e.input+e.cacheRead+e.cacheWrite;const hr=ps>0?e.cacheRead/ps:0;
    return '<tr><td>'+(esc(e.model||'?'))+(e.provider?' <span class="mut">['+esc(e.provider)+']</span>':'')+'</td><td>'+fmtInt(e.input)+'</td><td>'+fmtInt(e.output)+'</td><td>'+fmtInt(e.cacheRead)+'</td><td><div class="bar"><i style="width:'+(hr*100).toFixed(1)+'%"></i></div><span class="mut">'+fmtPct(hr)+'</span></td><td>'+fmtInt(e.messageCount)+'</td><td>'+fmtCost(e.cost)+'</td></tr>';}).join('');
}
function render(){
  if(!SNAP)return;const m=SNAP[RANGE];
  $('#cards').innerHTML=cards(m);models(m);
  bars('#daily',SNAP.daily||[],d=>d.totalTokens!=null?d.totalTokens:(d.input+d.output+d.cacheRead+d.cacheWrite),d=>d.date);
  bars('#hourly',SNAP.todayHourly||[],h=>h.totalTokens!=null?h.totalTokens:(h.input+h.output+h.cacheRead+h.cacheWrite),h=>h.hour);
  const u=SNAP.meta&&SNAP.meta.updatedAt;$('#updated').textContent=u?('updated '+new Date(u).toLocaleString()):'not scanned yet';
  const errs=SNAP.meta&&SNAP.meta.errors||{};const ek=Object.keys(errs);
  $('#foot').textContent='client: '+(SNAP.meta.client||'dsh')+' · cache: '+(SNAP.meta.cacheFile||'')+(ek.length?' · errors: '+ek.map(k=>k+': '+errs[k]).join('; '):'');
}
function status(){
  const s=$('#status');const meta=SNAP&&SNAP.meta||{};const ref=meta.refreshing;
  const errs=meta.errors||{};const ek=Object.keys(errs);
  let html;
  if(ref)html='<span class="spin"></span>tokscale scan running in background…';
  else if(!meta.updatedAt)html='waiting for first tokscale scan…';
  else if(meta.stale||ek.length)html='<span class="err">serving STALE cached report — last scan failed'+(ek.length?' ('+ek.map(esc).join(', ')+')':'')+'</span>';
  else html='serving cached report';
  s.innerHTML=html;
  $('#refresh').disabled=!!ref;
}
async function load(){try{const r=await fetch('data',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);SNAP=await r.json();render();status();}catch(e){$('#status').innerHTML='<span class="err">failed to load data: '+esc(e.message)+'</span>';}}
async function refresh(){
  $('#refresh').disabled=true;$('#status').innerHTML='<span class="spin"></span>requesting refresh…';
  try{const r=await fetch('refresh',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});if(!r.ok)throw new Error('HTTP '+r.status);}
  catch(e){$('#status').innerHTML='<span class="err">refresh request failed: '+esc(e.message)+'</span>';$('#refresh').disabled=false;return;}
  let n=0;clearInterval(polling);polling=setInterval(async()=>{await load();n++;if((SNAP&&!SNAP.meta.refreshing)||n>60){clearInterval(polling);polling=null;}},2000);
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));t.classList.add('on');RANGE=t.dataset.range;render();}));
$('#refresh').addEventListener('click',refresh);
load();setInterval(()=>{if(!polling)load();},30000);
</script>
</body>
</html>`;
}