const VERSION='1.3',WORKER='https://isa-proxy.ignitecontentlab.workers.dev/';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
const POINTS=[1000,860,730,670,610,583,555,528,500,488,475,462,450,438,425,413,400,395,390,385,380,375,370,365,360,355,350,345,340,335,330,325,320,315,310,305,300,295,290,285,280,275,270,265,260,255,250,245,240,235,230,225,220,215,210,205,200,195,190,185,180,175,170,165,160,158,156,154,152,150,148,146,144,142,140,138,136,134,132,130,128,126,124,122,120,118,116,114,112,110];
const pts=p=>Number.isInteger(p)&&p>0?POINTS[p-1]??null:null;
let roster=[],seeds=[],rounds={M:[],W:[]},drawAt={},err={},live=null,liveAt=0,tab='teams',sort='projected',gender='M',draftOnly=false,cacheMode=false,lastDraw='',liveSig='',running=false,nextDraw=0;
let trim=0;try{trim=+(localStorage.getItem('isasurf-clock-trim')||0)}catch(e){}
function store(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function restore(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}}
function seedOf(s){const n=norm(s.name),a=seeds.filter(x=>x.gender===s.gender&&x.country===s.country);return a.find(x=>norm(x.name)===n)?.seed??9999}
function match(s,list){return list.find(x=>x.gender===s.gender&&norm(x.name)===norm(s.name))||null}
/* Draw-derived places are estimates, NOT an official placing feed. This only assigns estimates
 after all preceding repechage brackets have completed, and ignores future empty heat slots. */
function analyse(rs,g){const map=new Map();for(const r of rs)for(const h of r.heats)for(const s of h.rows){if(!map.has(norm(s.name)))map.set(norm(s.name),{name:s.name,country:s.country,gender:g,status:'active',round:'',history:[]});map.get(norm(s.name)).history.push({r,h,s})}
 let removed=0,canInfer=true;const inferred=new Map();
 for(const r of rs.filter(r=>r.type==='repechage').sort((a,b)=>a.number-b.number)){
  const hs=r.heats.filter(h=>h.rows.length),complete=hs.length&&hs.every(h=>h.status==='completed'&&h.rows.every(x=>x.place));
  if(!complete){canInfer=false;continue}if(!canInfer)continue;
  const third=hs.filter(h=>h.rows.length>=3).length,fourth=hs.filter(h=>h.rows.length>=4).length;removed+=third+fourth;
  inferred.set(r.name,{3:map.size-removed+1,4:map.size-removed+1+third})}
 return [...map.values()].map(s=>{
 const completed=s.history.filter(x=>x.h.status==='completed'&&x.s.place);
 const lost=completed.filter(x=>x.r.type==='repechage'&&x.s.place>2).at(-1);
 const final=completed.find(x=>x.r.type==='final');
 const participated=s.history.filter(x=>x.h.status==='running'||x.h.status==='completed').at(-1)||s.history[0];s.round=participated.r.label;
 if(final){s.status=final.s.place===1?'champion':'finished';s.place=final.s.place;s.basis='final-heat result'}
 else if(lost){s.status='eliminated';s.round=lost.r.label;s.place=inferred.get(lost.r.name)?.[lost.s.place]??null;s.basis='draw-derived estimate'}
 else if(participated.r.type==='repechage'||(participated.r.type==='main'&&participated.h.status==='completed'&&participated.s.place>2))s.status='repechage';
 s.points=pts(s.place);delete s.history;return s})}
function compute(){const field=[...analyse(rounds.M,'M'),...analyse(rounds.W,'W')];const R=roster.map(r=>({...r,...(match(r,field)||{status:'unknown'}),owner:r.owner}));
 // Projection ranks the complete surviving draw by workbook seed; it does not invent missing entrants.
 for(const g of ['M','W']){const alive=field.filter(s=>s.gender===g&&!['eliminated','finished','champion'].includes(s.status)).sort((a,b)=>seedOf(a)-seedOf(b)||a.name.localeCompare(b.name));
 for(const r of R.filter(r=>r.gender===g)){if(r.place){r.projected=r.points;r.projectedPlace=r.place}else{const i=alive.findIndex(s=>norm(s.name)===norm(r.name));r.projectedPlace=i>=0?i+1:null;r.projected=pts(r.projectedPlace)}}}
 const teams=[...new Set(roster.map(r=>r.owner))].map(owner=>{const a=R.filter(r=>r.owner===owner);return {owner,rows:a,out:a.filter(r=>r.status==='eliminated').length,known:a.filter(r=>r.status!=='unknown').length,settled:a.filter(r=>r.points!=null).length,score:a.reduce((s,r)=>s+(r.points??0),0),projected:a.reduce((s,r)=>s+(r.projected??0),0),projectionComplete:a.every(r=>r.projected!=null)}});
 return {field,rows:R,teams}}
const statusName=s=>({unknown:'No data',active:'In draw',eliminated:'Eliminated',repechage:'Repechage',finished:'Finished',champion:'Champion'})[s]||s;
const ownerTag=o=>o?`<span class="owner">${esc(o)}</span>`:'—';
const pointCell=r=>r.points==null?'—':`${r.points}${r.basis==='draw-derived estimate'?'*':''}`;
function rankTeams(a,k){const list=[...a].sort((x,y)=>y[k]-x[k]||x.owner.localeCompare(y.owner));let prev=null,rank=0;return list.map((t,i)=>{if(t[k]!==prev)rank=i+1;prev=t[k];return {...t,rank}})}
function table(headers,rows){return `<div class="scroll"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}">No confirmed records available.</td></tr>`}</tbody></table></div>`}
function nav(){const tabs=[['teams','Standings'],['live','Live'],['projected','Projected'],['eliminated','Eliminated'],['finish','Finish'],['roster','Teams'],['stats','Stats']];$('tabs').innerHTML=tabs.map(([k,l])=>`<button data-tab="${k}" class="${tab===k?'on':''}">${l}</button>`).join('');$('tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()})}
function drawTable(rows){return table(['Finish','Surfer','Owner','Status','Points'],rows.map(r=>`<tr><td class="finish">${r.place??'—'}${r.basis==='draw-derived estimate'?'*':''}</td><td class="name">${esc(r.name)}<small>${esc(r.country)} · ${r.gender==='M'?'Men':'Women'}</small></td><td>${ownerTag(r.owner)}</td><td><span class="state ${r.status}">${esc(statusName(r.status))}</span></td><td class="num">${pointCell(r)}</td></tr>`))}
function render(){nav();const B=compute(),v=$('view');let h='';
 const note=`<p class="note">* Draw-derived finishing estimates and placing points are provisional, not an official final-ranking feed. Heat scores are separate from ISA placing points. Team total = the sum of five surfers' placing points. Projections use workbook seed order, not win probabilities.</p>`;
 if(tab==='teams'||tab==='projected'){
 const projected=tab==='projected'||sort==='projected';const T=rankTeams(B.teams,projected?'projected':'score');
 h=`<div class="title"><h2>${tab==='projected'?'Unofficial projections':'Team standings'}</h2>${tab==='teams'?`<button id="sort">Sort: ${projected?'projected':'settled'}</button>`:''}</div>`;
 h+=T.map(t=>`<article class="team"><div class="rank">${projected&&!t.projectionComplete?'—':t.score||t.projected?t.rank:'—'}</div><div class="teamname">${ownerTag(t.owner)}<small>${t.out} out · ${t.known}/5 matched · ${t.settled}/5 settled</small></div><div class="number">${t.score}<small>settled*</small></div><div class="number cyan">${t.projectionComplete?t.projected:'—'}<small>projected</small></div><div class="chips">${t.rows.map(r=>`<span class="chip ${r.status}">${esc(r.name)} <b>${r.place??(r.projectedPlace?'~'+r.projectedPlace:'—')}</b> <i>${r.points??''}</i></span>`).join('')}</div></article>`).join('');
 if(tab==='projected')h+=`<p class="note">Surfers already placed keep their placing points. Remaining surfers in the full draw are ordered by pre-event seed. Missing seed ranks sort last alphabetically. A team projection is withheld if one of its five surfers cannot be projected.</p>`;
 else h+=`<div class="grid">${['M','W'].map(g=>{const r=B.rows.filter(r=>r.gender===g&&r.place).sort((a,b)=>a.place-b.place);return `<section><h2>${g==='M'?"Men's":"Women's"} best finishes</h2>${table(['Place*','Surfer','Owner'],r.map(s=>`<tr><td class="finish">${s.place}</td><td class="name">${esc(s.name)}</td><td>${ownerTag(s.owner)}</td></tr>`))}</section>`}).join('')}</div>`;
 h+=note;
 }else if(tab==='eliminated'||tab==='finish'){
 const F=B.field.map(s=>({...s,owner:match(s,roster)?.owner}));let a=tab==='eliminated'?F.filter(s=>s.status==='eliminated'):F.filter(s=>s.place);
 a=a.filter(s=>s.gender===gender&&(!draftOnly||s.owner)).sort((a,b)=>(a.place??999)-(b.place??999)||a.name.localeCompare(b.name));
 h=`<div class="title"><h2>${tab==='eliminated'?'Eliminated':'Finishing places'}</h2><select id="gender"><option value="M" ${gender==='M'?'selected':''}>Men</option><option value="W" ${gender==='W'?'selected':''}>Women</option></select><label><input type="checkbox" id="draft" ${draftOnly?'checked':''}> Drafted only</label></div>${drawTable(a)}${note}`;
 }else if(tab==='roster')h=`<div class="grid">${B.teams.map(t=>`<section><h2>${esc(t.owner)}</h2><p>${t.score} settled* · ${t.projectionComplete?t.projected:'—'} projected</p>${drawTable(t.rows)}</section>`).join('')}</div>${note}`;
 else if(tab==='stats')h=`<h2>Field & fantasy stats</h2><div class="metrics">${[['Drafted matched',B.rows.filter(r=>r.status!=='unknown').length+'/50'],['Drafted eliminated',B.rows.filter(r=>r.status==='eliminated').length],['Field surfers',B.field.length],['Places available',B.field.filter(r=>r.place).length]].map(([l,n])=>`<section><strong>${n}</strong><small>${l}</small></section>`).join('')}</div>${table(['Owner','Personal points → team total'],B.teams.map(t=>`<tr><td>${ownerTag(t.owner)}</td><td>${t.rows.map(r=>r.points??'—').join(' + ')} = <b>${t.score}</b></td></tr>`))}${note}`;
 else h=renderLive();v.innerHTML=h;
 if($('sort'))$('sort').onclick=()=>{sort=sort==='projected'?'settled':'projected';render()};if($('gender'))$('gender').onchange=e=>{gender=e.target.value;render()};if($('draft'))$('draft').onchange=e=>{draftOnly=e.target.checked;render()};
 for(const [id,change]of [['minus',-1],['plus',1],['reset',0]])if($(id))$(id).onclick=()=>{trim=change?trim+change:0;store('isasurf-clock-trim',trim);render()};
 $('status').textContent=Object.keys(err).length?'Source issue · details below':cacheMode?'Saved results · refreshing':drawAt.M&&drawAt.W?'Draws updated '+new Date(Math.min(drawAt.M,drawAt.W)).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'Connecting scoring…';
 $('status').className=Object.keys(err).length?'bad':'';$('errors').textContent=Object.entries(err).map(([k,v])=>k+': '+v).join(' | ');
 $('updated').textContent=['M','W'].map(g=>(g==='M'?'Men':'Women')+': '+(drawAt[g]?new Date(drawAt[g]).toLocaleTimeString():'not loaded')).join(' · ');
}
let clock={key:'',end:0,raw:null};
function parseLive(j){if(typeof j.standings!=='string')throw Error('Live schema not recognized');const d=new DOMParser().parseFromString(j.standings,'text/html');const txt=(e,s)=>e.querySelector(s)?.textContent.trim()||'';
 return {...j,surfers:[...d.querySelectorAll('div.surfer')].map(e=>({name:txt(e,'div.name'),country:txt(e,'div.info').slice(0,3),place:parseInt(txt(e,'div.place'))||99,total:txt(e,'div.score'),best:txt(e,'div.best'),priority:txt(e,'.priority,.prio'),needs:txt(e,'.needs,.need')}))}}
function updateClock(j){const raw=(+j.minleft||0)*60+(+j.secleft||0),key=j.CatDescr+'|'+j.heatstatus;if(clock.key!==key||clock.raw!==raw){clock={key,raw,end:performance.now()+raw*1000}}}
function timeLeft(){if(!live)return '—';if(Date.now()-liveAt>15000)return 'STALE';if(live.heatstatus!=='RUNNING')return live.heatstatus||'Paused';const s=Math.max(0,Math.round((clock.end-performance.now())/1000)+trim);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function renderLive(){if(!live)return '<h2>Live heat</h2><p>Awaiting a valid live response. No sample scores are displayed.</p>';
 const g=/women/i.test(live.CatDescr||'')?'W':'M';return `<div class="title"><h2>${esc(live.CatDescr)}</h2><strong id="clock">${esc(timeLeft())}</strong></div>`+live.surfers.sort((a,b)=>a.place-b.place).map(s=>`<article class="surfer"><b>${s.place===99?'—':s.place}</b><div class="name">${esc(s.name)}<small>${esc(s.country)} · ${esc(match({...s,gender:g},roster)?.owner||'Not drafted')}</small><small>Best waves ${esc(s.best||'—')}${s.needs?' · '+esc(s.needs):''}</small></div>${s.priority?`<span class="priority">${esc(s.priority)}</span>`:''}<strong>${esc(s.total)}</strong></article>`).join('')+`<p class="note">Feed clock, extrapolated between changed time values; not guaranteed synchronized with judges. Trim: ${trim}s <button id="minus">−1</button> <button id="plus">+1</button> <button id="reset">Reset</button></p><p class="note">Live last received ${new Date(liveAt).toLocaleTimeString()}. Only source-supplied priority and needs values are displayed.</p>`}
async function get(k){const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);try{const r=await fetch(WORKER+'?src='+k,{signal:c.signal,cache:'no-store'});const j=await r.json();if(!r.ok||j.error)throw Error(j.error||'HTTP '+r.status);return j}finally{clearTimeout(timer)}}
async function poll(force=false){if(running||document.hidden&&!force)return;running=true;const jobs=[];
 if(force||Date.now()>=nextDraw){nextDraw=Date.now()+60000;for(const [k,g] of [['men','M'],['women','W']])jobs.push((async()=>{try{const j=await get(k);if(!Array.isArray(j.rounds))throw Error('Update the Cloudflare Worker to v1.3; this route must return parsed rounds JSON');rounds[g]=j.rounds;drawAt[g]=Date.now();delete err[k];cacheMode=false;store('isasurf-draw-'+g,{rounds:j.rounds,at:drawAt[g]})}catch(e){err[k]=e.message}})())}
 if(force||tab==='live')jobs.push((async()=>{try{const j=await get('live');live=parseLive(j);liveAt=Date.now();updateClock(live);delete err.live}catch(e){err.live=e.message}})());
 await Promise.allSettled(jobs);running=false;render()}
$('refresh').onclick=()=>poll(true);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll(true)});
(async()=>{try{const r=await fetch('data.json');if(!r.ok)throw Error('Missing data.json');const j=await r.json();roster=j.roster;seeds=j.seeds;for(const g of ['M','W']){const c=restore('isasurf-draw-'+g);if(c){rounds[g]=c.rounds;drawAt[g]=c.at;cacheMode=true}}render();poll(true);setInterval(()=>poll(),3000);setInterval(()=>{if($('clock'))$('clock').textContent=timeLeft()},250)}catch(e){$('errors').textContent=e.message}})();
