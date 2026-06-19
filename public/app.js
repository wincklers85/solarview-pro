const $=s=>document.querySelector(s); const $$=s=>document.querySelectorAll(s);
const setText=(sel,val)=>{const el=document.querySelector(sel); if(el) el.textContent=val;};
const setHtml=(sel,val)=>{const el=document.querySelector(sel); if(el) el.innerHTML=val;};
const state={latest:null,thermal:null,history:[],daily:[],thermalHistory:[],thermalDaily:[],settings:{},forecast:null,range:30,productionRange:'month'};
const fmt=(v,d=1)=>Number(v||0).toFixed(d); const kw=v=>`${fmt(v,2)} kW`; const kwh=v=>`${fmt(v,1)} kWh`; const eur=v=>`€ ${fmt(v,2)}`; const temp=v=>`${fmt(v,1)} °C`;
$$('.nav').forEach(b=>b.onclick=()=>{const p=b.dataset.page; $$('.nav').forEach(x=>x.classList.remove('active')); b.classList.add('active'); $$('.page').forEach(x=>x.classList.remove('active')); $('#'+p).classList.add('active'); $('#title').textContent=b.textContent; requestAnimationFrame(drawAll)}); $('#refresh').onclick=()=>load(); $('#range').onchange=e=>{state.range=+e.target.value; drawAll(); renderTable()}; $('#productionRange')?.addEventListener('change',e=>{state.productionRange=e.target.value; renderProductionSummary();});
async function load(){const [l,h,f]=await Promise.all([fetch('/api/latest').then(r=>r.json()),fetch('/api/history?limit=672').then(r=>r.json()),fetch('/api/forecast').then(r=>r.json())]); Object.assign(state,{latest:l.latest,thermal:l.thermal,settings:l.settings,history:h.history,daily:h.daily,thermalHistory:h.thermalHistory,thermalDaily:h.thermalDaily,forecast:f}); render(); drawAll(); renderTable(); fillSettings();}
function render(){const p=state.latest,t=state.thermal,s=state.settings;if(!p)return; $('#siteName').textContent=s.siteName||'Casa'; $('#sideSite').textContent=s.siteName||'Casa'; $('#last').textContent=new Date(p.timestamp).toLocaleString('it-IT'); $('#status').textContent=p.status||'online'; $('#topPv').textContent=kw(p.pvPowerKw); $('#topLoad').textContent=kw(p.housePowerKw); $('#topSoc').textContent=Math.round(p.batterySoc)+'%'; $('#topHeat').textContent=t?kw(t.thermalPowerKw):'--'; $('#pvNow').textContent=kw(p.pvPowerKw); $('#pvSub').textContent=`${fmt(p.pvVoltage,0)} V · ${fmt(p.pvCurrent,1)} A`; $('#loadNow').textContent=kw(p.housePowerKw); $('#loadSub').textContent=`${fmt(p.houseVoltage,0)} V · ${fmt(p.houseHz,2)} Hz`; $('#battNow').textContent=`${Math.round(p.batterySoc)}%`; $('#battSub').textContent=`${fmt(p.batteryVoltage,1)} V · ${kw(p.batteryPowerKw)}`; $('#gridNow').textContent=kw(Math.abs(p.gridPowerKw)); $('#gridSub').textContent=`${fmt(p.gridVoltage,0)} V · ${fmt(p.gridHz,2)} Hz`; const d=state.daily.at(-1)||{}; $('#kpiPv').textContent=kwh(d.pvKwh); $('#kpiLoad').textContent=kwh(d.loadKwh); $('#kpiSelf').textContent=(d.selfConsumption||0)+'%'; $('#kpiAuto').textContent=(d.autarky||0)+'%'; $('#kpiSaving').textContent=eur(d.saving); if(t)renderThermal(t); if(state.forecast){$('#forecastKwh').textContent=fmt(state.forecast.estimatedKwh,1); $('#forecastPeak').textContent=kw(state.forecast.peakKw); $('#forecastConf').textContent=state.forecast.confidence+'%'} renderProductionSummary(); renderFlow();}
function renderThermal(t){
  if(!t) return;
  setText('#thermalMode',t.status==='heating'?'Riscaldamento':'Standby');
  setText('#boilerTemp',temp(t.boilerTemp));
  setText('#bufferTemp',temp(t.bufferTopTemp));
  setText('#roomTemp',temp(t.roomTemp));
  setText('#flowReturn',`${temp(t.flowTemp)} / ${temp(t.returnTemp)}`);
  setText('#dhwTemp',temp(t.dhwTemp));
  setText('#pressure',`${fmt(t.pressureBar,2)} bar`);
  setText('#pellet',`${Math.round(t.pelletLevelPct||0)}%`);
  setText('#thermalPower',kw(t.thermalPowerKw));
  setText('#pumpHeating',t.pumpHeating?'ON':'OFF');
  setText('#outdoorTemp',temp(t.outdoorTemp));
  const td=(state.thermalDaily||[]).at(-1)||{};
  setText('#heatHours',(td.heatingHours||0)+' h');
  const tank=document.querySelector('#tankFill');
  if(tank) tank.style.height=Math.max(8,Math.min(92,((Number(t.bufferTopTemp)||0)-30)/55*100))+'%';
  renderHeatPump(t);
}

function renderProductionSummary(){
  const days=state.daily||[]; const range=state.productionRange||$('#productionRange')?.value||'month';
  const now=new Date();
  const startOf=(kind)=>{const d=new Date(now); if(kind==='today')d.setHours(0,0,0,0); if(kind==='week'){const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day); d.setHours(0,0,0,0)} if(kind==='month'){d.setDate(1); d.setHours(0,0,0,0)} if(kind==='year'){d.setMonth(0,1); d.setHours(0,0,0,0)} return d};
  const filtered=range==='all'?days:days.filter(x=>new Date(x.date+'T12:00:00')>=startOf(range));
  const sum=(k)=>filtered.reduce((a,b)=>a+(Number(b[k])||0),0);
  $('#totalProduction') && ($('#totalProduction').textContent=kwh(sum('pvKwh')));
  $('#totalLoad') && ($('#totalLoad').textContent=kwh(sum('loadKwh')));
  $('#totalImport') && ($('#totalImport').textContent=kwh(sum('importKwh')));
  $('#totalSaving') && ($('#totalSaving').textContent=eur(sum('saving')));
}
function renderHeatPump(t){
  const p=state.latest||{}, s=state.settings||{};
  const hpKw=Number(t.heatPumpPowerKw||0), cop=Number(t.heatPumpCop||s.heatPumpCop||3.2), thermalKw=hpKw*cop;
  const loadShare=p.housePowerKw?Math.min(999,hpKw/p.housePowerKw*100):0;
  const solarShare=p.pvPowerKw?Math.min(999,hpKw/p.pvPowerKw*100):0;
  $('#hpStatus') && ($('#hpStatus').textContent=hpKw>0.05?'Attiva':'Standby');
  $('#hpPower') && ($('#hpPower').textContent=kw(hpKw));
  $('#hpCop') && ($('#hpCop').textContent=fmt(cop,1));
  $('#hpLoadShare') && ($('#hpLoadShare').textContent=fmt(loadShare,0)+'%');
  $('#hpSolarShare') && ($('#hpSolarShare').textContent=fmt(solarShare,0)+'%');
  const saved=(thermalKw/4.8).toFixed(2); // indicativo: kWh termici equivalenti a pellet, placeholder configurabile in futuro
  $('#hpPelletSaved') && ($('#hpPelletSaved').textContent=saved+' kg eq.');
}

function renderFlow(){const p=state.latest;if(!p)return; const battCharge=p.batteryPowerKw>0, gridImport=p.gridPowerKw>0.05; $('#mode').textContent=gridImport?'Prelievo rete':(p.gridPowerKw<-0.05?'Immissione':'Autoconsumo'); $('#flow').innerHTML=`<svg class="flow-svg" viewBox="0 0 920 560" preserveAspectRatio="xMidYMid meet"><path class="wire" d="M460 118 C460 160 460 185 460 225"/><path class="pulse solar" d="M460 118 C460 160 460 185 460 225"/><path class="wire" d="M355 322 C285 332 237 382 190 420"/><path class="pulse battery ${Math.abs(p.batteryPowerKw)>0.05?'':'off'}" style="animation-direction:${battCharge?'normal':'reverse'}" d="M355 322 C285 332 237 382 190 420"/><path class="wire" d="M460 330 C460 366 460 390 460 420"/><path class="pulse load" d="M460 330 C460 366 460 390 460 420"/><path class="wire" d="M565 322 C635 332 683 382 730 420"/><path class="pulse gridp ${Math.abs(p.gridPowerKw)>0.05?'':'off'}" style="animation-direction:${gridImport?'reverse':'normal'}" d="M565 322 C635 332 683 382 730 420"/>${solarNode(335,25,p)}${invNode(350,220,p)}${battNode(72,412,p)}${homeNode(350,412,p)}${gridNode(628,412,p)}</svg>`}
function wrap(x,y,w,h,inner){return `<g transform="translate(${x} ${y})"><rect class="node-bg" width="${w}" height="${h}" rx="24" fill="#fff"/>${inner}</g>`}
function solarNode(x,y,p){return wrap(x,y,250,92,`<g transform="translate(23 17)"><rect x="0" y="12" width="82" height="48" rx="5" fill="#dbeafe" stroke="#1f5eff" stroke-width="2"/><path d="M9 22h64M9 34h64M9 46h64M25 14v44M43 14v44M61 14v44" stroke="#1f5eff"/><circle cx="128" cy="36" r="18" fill="#fff7d6" stroke="#c88400" stroke-width="2"/></g><text x="192" y="31" class="node-title">FOTOVOLTAICO</text><text x="192" y="60" class="node-value" text-anchor="middle">${kw(p.pvPowerKw)}</text><text x="192" y="79" class="node-sub" text-anchor="middle">${fmt(p.pvVoltage,0)} V · ${fmt(p.pvCurrent,1)} A</text>`)}
function invNode(x,y,p){return wrap(x,y,220,112,`<rect x="78" y="16" width="64" height="72" rx="9" fill="#f8fafc" stroke="#667085" stroke-width="2"/><rect x="92" y="56" width="36" height="12" rx="3" fill="#172033"/><text x="110" y="42" text-anchor="middle" font-size="11" font-weight="800" fill="#667085">INV</text><text x="110" y="90" class="node-title" text-anchor="middle">INVERTER</text><text x="110" y="108" class="node-sub" text-anchor="middle">${fmt(p.inverterTemp,1)} °C</text>`)}
function battNode(x,y,p){return wrap(x,y,220,112,`<g transform="translate(22 22)"><rect x="0" y="16" width="54" height="45" rx="9" fill="#ecfdf3" stroke="#15915b" stroke-width="2"/><rect x="18" y="8" width="18" height="9" rx="2" fill="#15915b"/><path d="M31 21L17 42h13l-5 15 18-25H31z" fill="#c88400"/><path d="M72 11c19 0 31 9 32 27-20 1-33-8-32-27zM72 38c18 0 28 8 30 25-18 1-31-7-30-25z" fill="#20b26b"/></g><text x="152" y="34" class="node-title" text-anchor="middle">BATTERIA</text><text x="152" y="63" class="node-value" text-anchor="middle">${Math.round(p.batterySoc)}%</text><text x="152" y="86" class="node-sub" text-anchor="middle">${fmt(p.batteryVoltage,1)} V · ${kw(p.batteryPowerKw)}</text>`)}
function homeNode(x,y,p){return wrap(x,y,220,112,`<g transform="translate(28 21)"><path d="M8 38L58 4l50 34v48H20V38" fill="#fff8ed" stroke="#c88400" stroke-width="2"/><path d="M44 86V56h28v30M26 49h19v19H26M78 49h19v19H78" fill="#e0f2fe" stroke="#0e8fcf" stroke-width="2"/><path d="M8 38L58 4l50 34" stroke="#475467" stroke-width="6" fill="none" stroke-linecap="round"/></g><text x="155" y="38" class="node-title" text-anchor="middle">CASA</text><text x="155" y="66" class="node-value" text-anchor="middle">${kw(p.housePowerKw)}</text><text x="155" y="88" class="node-sub" text-anchor="middle">${fmt(p.houseVoltage,0)} V · ${fmt(p.houseHz,2)} Hz</text>`)}
function gridNode(x,y,p){return wrap(x,y,220,112,`<g transform="translate(30 22)"><path d="M48 0v64M13 64h70M21 27h54M28 14h40M24 64L48 0l24 64M0 36c17-10 31 10 48 0s31 10 48 0" class="icon-line"/></g><text x="154" y="36" class="node-title" text-anchor="middle">RETE</text><text x="154" y="64" class="node-value" text-anchor="middle">${kw(Math.abs(p.gridPowerKw))}</text><text x="154" y="86" class="node-sub" text-anchor="middle">${fmt(p.gridVoltage,0)} V · ${fmt(p.gridHz,2)} Hz</text>`)}
function chart(id,series,labels=[]){const c=$(id); if(!c)return; const ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1,w=Math.max(280,c.clientWidth),h=c.height;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const pad={l:42,r:14,t:16,b:32};const vals=series.flatMap(s=>s.data);let max=Math.max(1,...vals),min=Math.min(0,...vals);max*=1.15;if(min<0)min*=1.15;ctx.font='12px Inter';ctx.strokeStyle='#e6ebf2';ctx.fillStyle='#667085';for(let i=0;i<4;i++){let y=pad.t+(h-pad.t-pad.b)*i/3;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText((max-(max-min)*i/3).toFixed(1),6,y+4)}series.forEach(s=>{ctx.strokeStyle=s.color;ctx.lineWidth=2.5;ctx.beginPath();s.data.forEach((v,i)=>{let x=pad.l+(w-pad.l-pad.r)*i/Math.max(1,s.data.length-1),y=pad.t+(h-pad.t-pad.b)*(1-((v-min)/(max-min||1)));i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}); if(labels.length){const step=Math.max(1,Math.ceil(labels.length/5));labels.forEach((lab,i)=>{if(i%step===0){let x=pad.l+(w-pad.l-pad.r)*i/Math.max(1,labels.length-1);ctx.fillText(String(lab).slice(0,5),x-12,h-10)}})}}
function bars(id,rows,keys){const c=$(id);if(!c)return;const ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1,w=Math.max(280,c.clientWidth),h=c.height;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const pad={l:42,r:12,t:18,b:34};const max=Math.max(1,...rows.flatMap(r=>keys.map(k=>Number(r[k.key])||0)))*1.18;ctx.font='12px Inter';ctx.strokeStyle='#e6ebf2';ctx.fillStyle='#667085';for(let i=0;i<4;i++){let y=pad.t+(h-pad.t-pad.b)*i/3;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText((max*(1-i/3)).toFixed(0),8,y+4)}const bw=(w-pad.l-pad.r)/Math.max(1,rows.length);rows.forEach((r,i)=>{keys.forEach((k,j)=>{const val=Number(r[k.key])||0,inner=bw/(keys.length+0.8),x=pad.l+i*bw+j*inner+4,y=pad.t+(h-pad.t-pad.b)*(1-val/max),bh=h-pad.b-y;ctx.fillStyle=k.color;round(ctx,x,y,Math.max(3,inner-7),bh,4);ctx.fill()})});rows.forEach((r,i)=>{if(i%Math.max(1,Math.ceil(rows.length/6))===0){ctx.fillStyle='#667085';ctx.fillText((r.date||r.hour||'').slice(5),pad.l+i*bw,h-10)}})}
function round(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function drawAll(){const h=state.history.slice(-96),th=state.thermalHistory.slice(-96),d=state.daily.slice(-14),td=state.thermalDaily.slice(-14); chart('#liveChart',[{data:h.map(p=>p.pvPowerKw),color:'#c88400'},{data:h.map(p=>p.housePowerKw),color:'#1f5eff'},{data:h.map(p=>p.batteryPowerKw),color:'#15915b'},{data:h.map(p=>p.gridPowerKw),color:'#667085'}],h.map(p=>new Date(p.timestamp).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}))); chart('#thermalChart',[{data:th.map(p=>p.roomTemp),color:'#1f5eff'},{data:th.map(p=>p.bufferTopTemp),color:'#d44747'},{data:th.map(p=>p.flowTemp),color:'#c88400'}],th.map(p=>new Date(p.timestamp).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}))); bars('#dailyChart',d,[{key:'pvKwh',color:'#c88400'},{key:'loadKwh',color:'#1f5eff'}]); bars('#gridChart',d,[{key:'importKwh',color:'#667085'},{key:'exportKwh',color:'#15915b'}]); bars('#thermalDailyChart',td,[{key:'thermalKwh',label:'Termico',color:'#d44747'},{key:'heatPumpKwh',label:'Pompa calore',color:'#1f5eff'},{key:'heatingHours',label:'Ore risc.',color:'#c88400'}]); bars('#historyChart',state.daily.slice(-state.range),[{key:'pvKwh',color:'#c88400'},{key:'loadKwh',color:'#1f5eff'},{key:'saving',color:'#15915b'}]); if(state.forecast)chart('#forecastChart',[{data:state.forecast.hours.map(h=>h.kw),color:'#c88400'}],state.forecast.hours.map(h=>h.hour))}
function renderTable(){const td=Object.fromEntries(state.thermalDaily.map(x=>[x.date,x])); $('#rows').innerHTML=state.daily.slice(-18).reverse().map(d=>`<tr><td>${d.date}</td><td>${kwh(d.pvKwh)}</td><td>${kwh(d.loadKwh)}</td><td>${kwh(d.importKwh)}</td><td>${kwh(td[d.date]?.thermalKwh||0)}</td><td>${eur(d.saving)}</td></tr>`).join('')}
function fillSettings(){const f=$('#settingsForm'); if(f.dataset.loaded)return; for(const el of f.elements){if(el.name&&state.settings[el.name]!=null)el.value=state.settings[el.name]} f.dataset.loaded=1}
$('#settingsForm').onsubmit=async e=>{e.preventDefault();const data={};new FormData(e.target).forEach((v,k)=>data[k]=isNaN(v)||v===''?v:+v);await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});$('#settingsForm').dataset.loaded='';await load();alert('Impostazioni salvate')};
window.addEventListener('resize',()=>requestAnimationFrame(drawAll));

// SolarView Pro V10 - impostazioni avanzate
const calibrationFields=[
  ['pvPowerKw','FV potenza kW'],['pvVoltage','FV tensione V'],['housePowerKw','Casa potenza kW'],['houseVoltage','Casa tensione V'],['batteryVoltage','Batteria tensione V'],['batteryPowerKw','Batteria potenza kW'],['gridPowerKw','Rete potenza kW'],['gridVoltage','Rete tensione V'],['thermalPowerKw','Termico potenza kW'],['heatPumpPowerKw','PDC consumo kW'],['heatPumpCop','PDC COP'],['boilerTemp','Caldaia °C'],['bufferTopTemp','Puffer alto °C'],['roomTemp','Casa temperatura °C']
];
function buildCalibration(){const g=$('#calibrationGrid'); if(!g||g.dataset.ready)return; g.innerHTML=calibrationFields.map(([k,label])=>`<div class="cal-row"><b>${label}</b><label>Moltiplicatore<input name="calibration.${k}.multiplier" type="number" step="0.001"></label><label>Offset<input name="calibration.${k}.offset" type="number" step="0.001"></label></div>`).join(''); g.dataset.ready=1;}
function getPath(obj,path){return path.split('.').reduce((o,k)=>o&&o[k],obj)}
function setPath(obj,path,val){const parts=path.split('.'); let o=obj; while(parts.length>1){const k=parts.shift(); o[k]=o[k]||{}; o=o[k];} o[parts[0]]=val;}
$$('.settab').forEach(b=>b.onclick=()=>{$$('.settab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); $$('.set-panel').forEach(x=>x.classList.remove('active')); $('#set-'+b.dataset.tab).classList.add('active'); buildCalibration();});
const oldFillSettings=fillSettings;
fillSettings=function(){buildCalibration(); const f=$('#settingsForm'); if(f.dataset.loaded)return; for(const el of f.elements){if(!el.name)continue; const v=getPath(state.settings,el.name); if(v!=null) el.value=String(v);} f.dataset.loaded=1;};
$('#settingsForm').onsubmit=async e=>{e.preventDefault();const data={};new FormData(e.target).forEach((v,k)=>{let val=v; if(v==='true')val=true; else if(v==='false')val=false; else if(v!==''&&!isNaN(v))val=+v; setPath(data,k,val)});await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});$('#settingsForm').dataset.loaded='';await load();alert('Impostazioni salvate')};
$('#loadDeviceConfig')?.addEventListener('click',async()=>{const r=await fetch('/api/device-config'); const j=await r.json(); $('#deviceConfig').textContent=JSON.stringify(j,null,2);});

// SolarView Pro V11 - temi, grafici responsive, flow customization ed easter egg
state.liveRange='24h';
function isMobile(){return window.innerWidth<=620}
function isDecember(){return new Date().getMonth()===11}
function inChristmasWeek(){const d=new Date();return d.getMonth()===11 && d.getDate()>=22 && d.getDate()<=28}
function easterDate(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,day)}
function nearEaster(){const n=new Date(),e=easterDate(n.getFullYear());return Math.abs(n-e)/86400000<=3}
function currentTheme(){const s=state.settings||{};let t=s.theme||'auto';if(inChristmasWeek())return 'christmas';if(t==='auto')return 'light';if(t==='christmas'&&!isDecember())return 'light';return t}
function applyAppearance(){const s=state.settings||{};const theme=currentTheme();document.body.dataset.theme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='midnight'?'#0b1220':'#f6f8fb');const flow=document.querySelector('.flow');if(flow){flow.dataset.flowStyle=s.flowStyle||'balanced';flow.dataset.speed=s.flowSpeed||'normal';flow.dataset.technical=String(s.flowTechnical!==false)}renderSeasonalEggs();}
function renderSeasonalEggs(){const layer=$('#eggLayer');if(!layer)return;layer.innerHTML='';const enabled=(state.settings?.easterEggs!==false);if(!enabled)return;if(nearEaster()){const eggs=['🥚','🐣','🌷','🥚','🐰'];for(let i=0;i<12;i++){const el=document.createElement('span');el.className='egg';el.textContent=eggs[i%eggs.length];el.style.left=(Math.random()*92+2)+'vw';el.style.top=(Math.random()*86+6)+'vh';el.style.animationDelay=(Math.random()*4)+'s';layer.appendChild(el)}}if(document.body.dataset.theme==='christmas'&&inChristmasWeek()){for(let i=0;i<14;i++)setTimeout(makeSnow,i*250)}}
function makeSnow(){if(document.body.dataset.theme!=='christmas')return;const el=document.createElement('span');el.className='snowflake';el.textContent=['❄','✦','❅'][Math.floor(Math.random()*3)];el.style.left=Math.random()*100+'vw';el.style.fontSize=(10+Math.random()*12)+'px';el.style.animationDuration=(5+Math.random()*5)+'s';document.body.appendChild(el);setTimeout(()=>el.remove(),11000)}
setInterval(()=>{if(document.body.dataset.theme==='christmas'&&inChristmasWeek())makeSnow()},1400);

function chartHeight(c){const mode=state.settings?.chartMobileMode||'compact';if(!isMobile())return c.parentElement?.clientHeight||Number(c.getAttribute('height'))||240;if(mode==='detailed')return 220;if(mode==='normal')return 190;return 150}
function ensureLegend(c,series){
  let shell=c.closest('.chart-shell')||c.parentElement; if(!shell)return;
  let lg=shell.querySelector('.chart-legend'); if(!lg){lg=document.createElement('div');lg.className='chart-legend';shell.appendChild(lg)}
  lg.innerHTML=series.map(s=>`<span><i style="background:${s.color}"></i>${s.label||s.key||'Dato'}</span>`).join('');
  let tip=shell.querySelector('.chart-tooltip'); if(!tip){tip=document.createElement('div');tip.className='chart-tooltip';shell.appendChild(tip)}
}
function drawTooltip(c,e){
  const meta=c.__chartMeta; if(!meta)return; const rect=c.getBoundingClientRect();
  const x=((e.touches?e.touches[0].clientX:e.clientX)-rect.left)*(c.width/rect.width)/(window.devicePixelRatio||1);
  const {pad,w,h,series,labels,min,max}=meta; const n=Math.max(...series.map(s=>s.data.length));
  let idx=Math.round((x-pad.l)/(w-pad.l-pad.r)*Math.max(1,n-1)); idx=Math.max(0,Math.min(n-1,idx));
  const lab=labels[idx]||''; const rows=series.map(s=>`<div><span><i style="background:${s.color}"></i>${s.label||s.key}</span><b>${fmt(s.data[idx],2)}</b></div>`).join('');
  const tip=(c.closest('.chart-shell')||c.parentElement).querySelector('.chart-tooltip'); if(!tip)return;
  tip.innerHTML=`<strong>${lab}</strong>${rows}`; tip.style.display='block'; tip.style.left=Math.min(Math.max(8,(pad.l+(w-pad.l-pad.r)*idx/Math.max(1,n-1))-70),w-145)+'px'; tip.style.top='10px';
}
function bindChart(c){if(c.__bound)return; c.__bound=true; ['mousemove','touchstart','touchmove'].forEach(ev=>c.addEventListener(ev,e=>drawTooltip(c,e),{passive:true})); c.addEventListener('mouseleave',()=>{const t=(c.closest('.chart-shell')||c.parentElement)?.querySelector('.chart-tooltip'); if(t)t.style.display='none'});}
function chart(id,series,labels=[]){const c=$(id); if(!c)return; series=series.map((s,i)=>({label:['FV','Casa','Batteria','Rete','Ambiente','Puffer','Mandata','Previsione'][i]||s.key||'Dato',...s})); ensureLegend(c,series); bindChart(c); const ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1,w=Math.max(260,c.clientWidth||c.parentElement?.clientWidth||300),h=chartHeight(c);c.width=w*dpr;c.height=h*dpr;c.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const mobile=isMobile();const pad={l:mobile?32:46,r:mobile?10:18,t:mobile?18:22,b:mobile?28:36};const vals=series.flatMap(s=>s.data).filter(v=>isFinite(v));let max=Math.max(1,...vals),min=Math.min(0,...vals);max*=1.12;if(min<0)min*=1.12;ctx.font=(mobile?'10px ':'12px ')+'Inter,system-ui';ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--line')||'#e6ebf2';ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted')||'#667085';ctx.lineWidth=1;for(let i=0;i<(mobile?3:4);i++){let y=pad.t+(h-pad.t-pad.b)*i/((mobile?2:3));ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText((max-(max-min)*i/((mobile?2:3))).toFixed(max>10?0:1),4,y+4)}series.forEach(s=>{ctx.strokeStyle=s.color;ctx.lineWidth=mobile?2:2.5;ctx.beginPath();s.data.forEach((v,i)=>{let x=pad.l+(w-pad.l-pad.r)*i/Math.max(1,s.data.length-1),y=pad.t+(h-pad.t-pad.b)*(1-((v-min)/(max-min||1)));i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}); if(labels.length){const step=Math.max(1,Math.ceil(labels.length/(mobile?4:7)));labels.forEach((lab,i)=>{if(i%step===0){let x=pad.l+(w-pad.l-pad.r)*i/Math.max(1,labels.length-1);ctx.fillText(String(lab).slice(0,mobile?5:8),Math.max(0,x-12),h-8)}})} c.__chartMeta={pad,w,h,series,labels,min,max};}
function bars(id,rows,keys){const c=$(id);if(!c)return;keys=keys.map(k=>({label:k.label||({pvKwh:'FV',loadKwh:'Casa',importKwh:'Import',exportKwh:'Export',thermalKwh:'Termico',heatingHours:'Ore',saving:'Risparmio',heatPumpKwh:'PDC'}[k.key]||k.key),...k})); ensureLegend(c,keys); bindChart(c); const ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1,w=Math.max(260,c.clientWidth||c.parentElement?.clientWidth||300),h=chartHeight(c);c.width=w*dpr;c.height=h*dpr;c.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const mobile=isMobile();const pad={l:mobile?32:46,r:mobile?10:14,t:mobile?18:22,b:mobile?28:36};const max=Math.max(1,...rows.flatMap(r=>keys.map(k=>Number(r[k.key])||0)))*1.18;ctx.font=(mobile?'10px ':'12px ')+'Inter,system-ui';ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--line')||'#e6ebf2';ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted')||'#667085';for(let i=0;i<(mobile?3:4);i++){let y=pad.t+(h-pad.t-pad.b)*i/((mobile?2:3));ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText((max*(1-i/((mobile?2:3)))).toFixed(0),4,y+4)}const bw=(w-pad.l-pad.r)/Math.max(1,rows.length);rows.forEach((r,i)=>{keys.forEach((k,j)=>{const val=Number(r[k.key])||0,inner=bw/(keys.length+0.7),x=pad.l+i*bw+j*inner+3,y=pad.t+(h-pad.t-pad.b)*(1-val/max),bh=h-pad.b-y;ctx.fillStyle=k.color;round(ctx,x,y,Math.max(2,inner-6),Math.max(0,bh),4);ctx.fill()})});rows.forEach((r,i)=>{if(i%Math.max(1,Math.ceil(rows.length/(mobile?4:7)))===0){ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted')||'#667085';ctx.fillText((r.date||r.hour||'').slice(5),pad.l+i*bw,h-8)}}); c.__chartMeta={pad,w,h,series:keys.map(k=>({label:k.label,key:k.key,color:k.color,data:rows.map(r=>Number(r[k.key])||0)})),labels:rows.map(r=>r.date||r.hour||''),min:0,max};}
function shouldSkate(data){if(!data||data.length<18||state.settings?.easterEggs===false)return false;const now=Date.now();if(window.__lastSkate&&now-window.__lastSkate<180000)return false;const a=data.slice(-36);const third=Math.floor(a.length/3);const first=Math.max(...a.slice(0,third)),mid=Math.min(...a.slice(third,third*2)),last=Math.max(...a.slice(third*2));return first>2.0&&last>2.0&&mid<0.65&&first/mid>3&&last/mid>3}
function animateSkater(data){const sk=$('#skater'),c=$('#liveChart');if(!sk||!c||!shouldSkate(data))return;window.__lastSkate=Date.now();const rect=c.getBoundingClientRect();const vals=data.slice(-36);const max=Math.max(1,...vals)*1.15,min=0;let start=null;sk.classList.add('skater-on');function step(ts){start??=ts;const t=Math.min(1,(ts-start)/5500);const idx=Math.min(vals.length-1,Math.floor(t*(vals.length-1)));const v=vals[idx];const x=rect.left+30+(rect.width-42)*idx/(vals.length-1);const y=rect.top+12+(rect.height-40)*(1-((v-min)/(max-min)));sk.style.left=(x-10)+'px';sk.style.top=(y-32)+'px';sk.style.transform=`rotate(${Math.sin(t*Math.PI*4)*18}deg)`;if(t<1)requestAnimationFrame(step);else{sk.classList.remove('skater-on')}}requestAnimationFrame(step)}
function drawAll(){applyAppearance();const hist=state.history||[];const liveCount=state.liveRange==='30d'?Math.min(hist.length,2880):state.liveRange==='7d'?Math.min(hist.length,672):Math.min(hist.length,96);const h=hist.slice(-liveCount),th=(state.thermalHistory||[]).slice(-96),d=(state.daily||[]).slice(-14),td=(state.thermalDaily||[]).slice(-14);chart('#liveChart',[{data:h.map(p=>p.pvPowerKw),color:'#c88400'},{data:h.map(p=>p.housePowerKw),color:'#1f5eff'},{data:h.map(p=>p.batteryPowerKw),color:'#15915b'},{data:h.map(p=>p.gridPowerKw),color:'#667085'}],h.map(p=>new Date(p.timestamp).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})));animateSkater(h.map(p=>Number(p.housePowerKw)||0));chart('#thermalChart',[{data:th.map(p=>p.roomTemp),color:'#1f5eff'},{data:th.map(p=>p.bufferTopTemp),color:'#d44747'},{data:th.map(p=>p.flowTemp),color:'#c88400'}],th.map(p=>new Date(p.timestamp).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})));bars('#dailyChart',d,[{key:'pvKwh',color:'#c88400'},{key:'loadKwh',color:'#1f5eff'}]);bars('#gridChart',d,[{key:'importKwh',color:'#667085'},{key:'exportKwh',color:'#15915b'}]);bars('#thermalDailyChart',td,[{key:'thermalKwh',label:'Termico',color:'#d44747'},{key:'heatPumpKwh',label:'Pompa calore',color:'#1f5eff'},{key:'heatingHours',label:'Ore risc.',color:'#c88400'}]);bars('#historyChart',(state.daily||[]).slice(-state.range),[{key:'pvKwh',label:'Produzione FV',color:'#c88400'},{key:'loadKwh',label:'Consumo casa',color:'#1f5eff'},{key:'importKwh',label:'Da rete',color:'#667085'},{key:'saving',label:'Risparmio €',color:'#15915b'}]);if(state.forecast)chart('#forecastChart',[{data:state.forecast.hours.map(h=>h.kw),color:'#c88400'}],state.forecast.hours.map(h=>h.hour))}
$$('.chart-range').forEach(b=>b.addEventListener('click',()=>{$$('.chart-range').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.liveRange=b.dataset.chartRange;drawAll()}));
$$('.theme-chip').forEach(b=>b.addEventListener('click',()=>{const t=b.dataset.theme;if(t==='christmas'&&!isDecember()){alert('Il tema natalizio è sbloccato solo a dicembre. Nella settimana di Natale si attiva da solo.');return;}document.body.dataset.theme=t;}));
window.addEventListener('resize',()=>requestAnimationFrame(drawAll)); setTimeout(()=>{applyAppearance();drawAll()},500);

// --- SolarView Pro V13 refinements: flowchart energy view + dynamic TermoSystem ---
const _svRender = render;
render = function(){
  _svRender();
  const s=state.settings||{};
  const fsLabel={balanced:'Bilanciata',compact:'Compatta',detailed:'Dettagliata',minimal:'Minimal',flowchart:'Flowchart tecnico'}[s.flowStyle||'balanced']||'Grafica';
  const el=document.getElementById('flowSelected'); if(el) el.textContent='Vista: '+fsLabel;
  if(state.thermal) renderTermoSystemAdvanced(state.thermal);
};
const _svRenderFlow = renderFlow;
renderFlow = function(){
  const s=state.settings||{};
  if((s.flowStyle||'balanced')==='flowchart') return renderEnergyFlowchart();
  return _svRenderFlow();
};
function renderEnergyFlowchart(){
  const p=state.latest||{}; const batt=p.batteryPowerKw>0?'carica':(p.batteryPowerKw<0?'scarica':'standby'); const grid=p.gridPowerKw>0.05?'prelievo':(p.gridPowerKw<-0.05?'immissione':'standby');
  const box=(cls,title,val,sub)=>`<div class="fc-node ${cls}"><span>${title}</span><b>${val}</b><small>${sub||''}</small></div>`;
  document.getElementById('mode').textContent='Flowchart tecnico';
  document.getElementById('flow').innerHTML=`<div class="flowchart-energy">
    ${box('solar','Fotovoltaico',kw(p.pvPowerKw),`${fmt(p.pvVoltage,0)} V · ${fmt(p.pvCurrent,1)} A`)}
    <div class="fc-line down active"><i></i></div>
    ${box('inverter','Inverter',kw(p.inverterPowerKw||p.pvPowerKw),`Temp. ${temp(p.inverterTemp)}`)}
    <div class="fc-branches">
      <div class="fc-branch"><div class="fc-line left ${Math.abs(p.batteryPowerKw)>0.05?'active':''} ${batt}"><i></i></div>${box('battery','Batteria',`${Math.round(p.batterySoc||0)}%`,`${fmt(p.batteryVoltage,1)} V · ${kw(p.batteryPowerKw)}`)}</div>
      <div class="fc-branch"><div class="fc-line down active"><i></i></div>${box('home','Casa',kw(p.housePowerKw),`${fmt(p.houseVoltage,0)} V · ${fmt(p.houseHz,2)} Hz`)}</div>
      <div class="fc-branch"><div class="fc-line right ${Math.abs(p.gridPowerKw)>0.05?'active':''} ${grid}"><i></i></div>${box('grid','Rete',kw(Math.abs(p.gridPowerKw||0)),`${fmt(p.gridVoltage,0)} V · ${fmt(p.gridHz,2)} Hz`)}</div>
    </div>
  </div>`;
};
function renderTermoSystemAdvanced(t){
  const s=state.settings||{}; const wrap=document.getElementById('thermalDiagram'); if(!wrap) return;
  const pelletEnabled=String(s.pelletBoilerEnabled)!=='false';
  const hpEnabled=String(s.heatPumpEnabled)!=='false';
  const pumpEnabled=String(s.returnPumpEnabled)!=='false';
  const pufferCount=Number(s.pufferCount||t.pufferCount||1);
  const pumpActive=!!(t.pumpReturnActive||t.pumpHeating) && pumpEnabled;
  const puffs=t.puffers||[];
  const pufferList=Array.from({length:pufferCount},(_,i)=>{
    const p=puffs[i]||{}; const min=Number(p.temperature_min_c||t.pufferMinTemp||t.bufferBottomTemp||0); const max=Number(p.temperature_max_c||t.pufferMaxTemp||t.bufferTopTemp||0);
    return `<div class="ts-puffer"><div class="tank mini"><div class="tank-fill" style="height:${Math.max(8,Math.min(92,((max-30)/55)*100))}%"></div><b>${temp(max)}</b><small>${p.name||'Puffer '+(i+1)} · min ${temp(min)}</small></div></div>`;
  }).join('');
  const sourceNodes=[];
  if(pelletEnabled) sourceNodes.push(`<div class="ts-source ${t.pelletBoilerActive?'on':''}"><span>🔥</span><b>${temp(t.boilerTemp||t.pufferMaxTemp)}</b><small>Caldaia pellet</small><em>${t.pelletBoilerActive?'attiva':'spenta'}</em></div>`);
  if(hpEnabled) sourceNodes.push(`<div class="ts-source hp ${t.heatPumpActive||Number(t.heatPumpPowerKw)>0?'on':''}"><span>⚡</span><b>${kw(t.heatPumpPowerKw||0)}</b><small>Pompa di calore</small><em>COP ${fmt(t.heatPumpCop||s.heatPumpCop,1)}</em></div>`);
  wrap.innerHTML=`<div class="ts-flow">
    <div class="ts-sources">${sourceNodes.join('')||'<div class="ts-source disabled"><span>⛔</span><b>OFF</b><small>Generatori disabilitati</small></div>'}</div>
    <div class="pipe v animated ${sourceNodes.length?'':'muted'}"></div>
    <div class="ts-puffer-bank">${pufferList}</div>
    <div class="ts-circuit"><div class="pipe h animated"></div><div class="return-pump ${pumpActive?'spin active':''}">↻</div><div class="pipe h animated reverse"></div></div>
    <div class="house-thermal"><span>🏠</span><b>${temp(t.roomTemp)}</b><small>Casa · mandata ${temp(t.flowTemp)} / ritorno ${temp(t.returnTemp)}</small></div>
    <div class="ts-footer"><span>Imbuto pellet: ${s.pelletHopperVolumeL||80} L</span><span>Livello: ${Math.round(t.pelletLevelPct||0)}%</span><span>Pompa ritorno: ${pumpActive?'ON':'OFF'}</span></div>
  </div>`;
};


// --- SolarView Pro V0.14 RC1 official GUI login, splash, demo mode ---
const SVP_VERSION='V0.14 RC1';
function svpSession(){try{return JSON.parse(localStorage.getItem('svp_gui_session')||'null')}catch{return null}}
function setSvpSession(obj){localStorage.setItem('svp_gui_session',JSON.stringify(obj));}
function clearSvpSession(){localStorage.removeItem('svp_gui_session');}
function isDemo(){return svpSession()?.mode==='demo'}
function zeroPoint(p={}){return {...p,status:'demo',pvPowerKw:0,pvVoltage:0,pvCurrent:0,pvTemp:0,housePowerKw:0,houseVoltage:0,houseHz:0,batteryVoltage:0,batterySoc:0,batteryPowerKw:0,batteryTemp:0,gridPowerKw:0,gridVoltage:0,gridHz:0,inverterTemp:0};}
function zeroThermal(t={}){return {...t,status:'demo',thermalPowerKw:0,boilerTemp:0,bufferTopTemp:0,bufferBottomTemp:0,flowTemp:0,returnTemp:0,roomTemp:0,outdoorTemp:0,dhwTemp:0,pressureBar:0,pelletLevelPct:0,heatPumpPowerKw:0,heatPumpCop:0,pumpHeating:false,pumpReturnActive:false,pelletBoilerActive:false,heatPumpActive:false};}
function applyDemoMode(){
  if(!isDemo()) return;
  state.latest=zeroPoint(state.latest||{});
  state.thermal=zeroThermal(state.thermal||{});
  state.history=(state.history||[]).map(zeroPoint);
  state.daily=(state.daily||[]).map(d=>({...d,pvKwh:0,loadKwh:0,importKwh:0,exportKwh:0,selfConsumption:0,autarky:0,saving:0,co2:0}));
  state.thermalHistory=(state.thermalHistory||[]).map(zeroThermal);
  state.thermalDaily=(state.thermalDaily||[]).map(d=>({...d,thermalKwh:0,heatPumpKwh:0,heatingHours:0,avgRoom:0}));
  if(state.forecast){state.forecast.estimatedKwh=0;state.forecast.peakKw=0;state.forecast.confidence=0;state.forecast.hours=(state.forecast.hours||[]).map(h=>({...h,kw:0}));}
  document.querySelector('.app')?.classList.add('demo-mode');
  const b=document.getElementById('demoBanner'); if(b && !localStorage.getItem('svp_demo_ack')) b.hidden=false;
}
const _svpLoad=load;
load=async function(){ await _svpLoad(); applyDemoMode(); render(); drawAll(); renderTable(); };
function showLogin(){document.querySelector('.app')?.classList.add('locked'); const l=document.getElementById('loginScreen'); if(l){l.hidden=false; l.style.display='grid';}}
function hideLogin(){document.querySelector('.app')?.classList.remove('locked'); const l=document.getElementById('loginScreen'); if(l){l.hidden=true; l.style.display='none';}}
function startSolarViewApp(){
  const splash=document.getElementById('splashScreen');
  setTimeout(()=>{ if(splash){ splash.classList.add('hide'); setTimeout(()=>{splash.hidden=true; splash.style.display='none';},500); } },1150);
  const session=svpSession();
  if(!session){showLogin(); return;}
  hideLogin(); if(window.__svpTimer) clearInterval(window.__svpTimer); load().catch(console.error); window.__svpTimer=setInterval(load,300000);
}
document.getElementById('loginForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const u=document.getElementById('loginUser').value.trim();
  const p=document.getElementById('loginPass').value;
  const err=document.getElementById('loginError');
  if(u==='wincklers' && p==='theone'){
    setSvpSession({user:'wincklers',mode:'live',loginAt:new Date().toISOString(),version:SVP_VERSION}); hideLogin(); if(window.__svpTimer) clearInterval(window.__svpTimer); load().catch(console.error); window.__svpTimer=setInterval(load,300000); return;
  }
  if(u==='Admin' && p==='Admin'){
    setSvpSession({user:'Admin',mode:'demo',loginAt:new Date().toISOString(),version:SVP_VERSION}); localStorage.removeItem('svp_demo_ack'); hideLogin(); if(window.__svpTimer) clearInterval(window.__svpTimer); load().catch(console.error); window.__svpTimer=setInterval(load,300000); return;
  }
  if(err) err.textContent='Username o password non validi';
});
document.getElementById('logoutBtn')?.addEventListener('click',()=>{clearSvpSession(); location.reload();});
document.getElementById('demoOk')?.addEventListener('click',()=>{localStorage.setItem('svp_demo_ack','1'); document.getElementById('demoBanner').hidden=true;});


// SolarView Pro V0.14 RC1 login fix: avvio dopo inizializzazione completa
function bootSolarViewPro(){ if(window.__svpBooted)return; window.__svpBooted=true; startSolarViewApp(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bootSolarViewPro); else bootSolarViewPro();
