const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'solarview-demo-key';
const DB = path.join(__dirname, 'solarview-db.json');
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
function defaultSettings(){return {deviceName:'ESP32-Inverter-01',deviceLocation:'Locale inverter',deviceWifiSsid:'',devicePostIntervalMin:5,deviceProtocol:'placeholder-rs232',cloudUrl:'',esp32Enabled:true,siteName:'Casa Molini',ownerName:'Stephan',currency:'€',energyBuyPrice:0.32,energySellPrice:0.10,batteryMinVoltage:41.6,batteryMaxVoltage:58.4,batteryCapacityKwh:16.4,panelCount:20,panelWatt:230,systemEfficiency:0.78,latitude:43.99,longitude:7.77,thermalEnabled:true,thermalMode:'automatico',thermalTargetTemp:21,thermalMinBufferTemp:48,thermalMaxBufferTemp:72,thermalFuelPrice:0.42,pufferCount:2,pelletHopperVolumeL:80,pelletBoilerEnabled:true,returnPumpEnabled:true,heatPumpEnabled:true,heatPumpCop:3.2,heatPumpMaxKw:4.0,heatPumpSurplusStartKw:1.0,theme:'auto',flowStyle:'balanced',flowViewMode:'graphic',flowSpeed:'normal',flowTechnical:true,chartMobileMode:'compact',easterEggs:true,calibration:{pvPowerKw:{offset:0,multiplier:1},pvVoltage:{offset:0,multiplier:1},housePowerKw:{offset:0,multiplier:1},houseVoltage:{offset:0,multiplier:1},batteryVoltage:{offset:0,multiplier:1},batteryPowerKw:{offset:0,multiplier:1},gridPowerKw:{offset:0,multiplier:1},gridVoltage:{offset:0,multiplier:1},thermalPowerKw:{offset:0,multiplier:1},boilerTemp:{offset:0,multiplier:1},roomTemp:{offset:0,multiplier:1},bufferTopTemp:{offset:0,multiplier:1},heatPumpPowerKw:{offset:0,multiplier:1},heatPumpCop:{offset:0,multiplier:1},pufferMinTemp:{offset:0,multiplier:1},pufferMaxTemp:{offset:0,multiplier:1},pelletLevelPct:{offset:0,multiplier:1}}}}
function nowIso(){return new Date().toISOString()}
function demoEnergy(offsetMin=0){const d=new Date(Date.now()+offsetMin*60000); const h=d.getHours()+d.getMinutes()/60; const sun=Math.max(0,Math.sin((h-6)/12*Math.PI)); const pv=+(sun*(4.9+Math.sin(h)*0.45)).toFixed(2); const home=+(1.0+Math.random()*1.4+(h>18&&h<22?1.25:0)).toFixed(2); const batt=+(pv-home).toFixed(2); return {timestamp:d.toISOString(),pvPowerKw:pv,pvVoltage:+(250+sun*130).toFixed(0),pvCurrent:+(pv*1000/Math.max(80,250+sun*130)).toFixed(1),inverterPowerKw:pv,inverterTemp:+(34+sun*10).toFixed(1),housePowerKw:home,houseVoltage:+(229+Math.random()*4).toFixed(1),houseHz:+(49.96+Math.random()*0.08).toFixed(2),batteryVoltage:+(51.5+sun*3.8-Math.max(0,home-pv)*0.35).toFixed(2),batteryPowerKw:batt,batteryCurrent:+(batt*1000/53).toFixed(1),batteryTemp:+(23+sun*4).toFixed(1),gridPowerKw:+Math.max(0,home-pv-1.2).toFixed(2),gridVoltage:+(230+Math.random()*3).toFixed(1),gridHz:+(49.96+Math.random()*0.07).toFixed(2),status:'online'}}
function demoThermal(offsetMin=0){const d=new Date(Date.now()+offsetMin*60000); const h=d.getHours()+d.getMinutes()/60; const active=(h<8||h>18); const buffer=active?+(58+Math.sin(h)*7).toFixed(1):+(49+Math.sin(h)*4).toFixed(1); const sun=Math.max(0,Math.sin((h-6)/12*Math.PI)); const hpActive=sun>0.35||active&&Math.random()>0.55; const hpKw=hpActive?+(0.8+sun*2.8+Math.random()*0.4).toFixed(2):0; const hpCop=+(2.7+sun*0.9).toFixed(1); return {timestamp:d.toISOString(),status:active||hpActive?'heating':'standby',source:'termosystem',boilerTemp:+(active?68+Math.random()*5:52+Math.random()*4).toFixed(1),bufferTopTemp:buffer,bufferBottomTemp:+(buffer-8-Math.random()*5).toFixed(1),flowTemp:+(active?48+Math.random()*4:30+Math.random()*3).toFixed(1),returnTemp:+(active?39+Math.random()*3:27+Math.random()*2).toFixed(1),roomTemp:+(20.2+Math.sin(h/2)*0.8).toFixed(1),targetTemp:21,outdoorTemp:+(8+Math.sin((h-8)/24*Math.PI*2)*5).toFixed(1),pumpHeating:active,pumpDhw:false,burnerPowerPct:active?Math.round(38+Math.random()*35):0,pelletLevelPct:72,thermalPowerKw:+((active?8+Math.random()*6:0)+hpKw*hpCop).toFixed(1),heatPumpPowerKw:hpKw,heatPumpCop:hpCop,heatPumpThermalKw:+(hpKw*hpCop).toFixed(1),dhwTemp:+(47+Math.random()*3).toFixed(1),pressureBar:+(1.4+Math.random()*0.15).toFixed(2)}}
function load(){if(!fs.existsSync(DB)){const settings=defaultSettings(); const history=[]; const thermalHistory=[]; for(let i=192;i>=0;i--){history.push(demoEnergy(-i*15)); thermalHistory.push(demoThermal(-i*15));} fs.writeFileSync(DB,JSON.stringify({settings,latest:history.at(-1),history,thermalLatest:thermalHistory.at(-1),thermalHistory},null,2));} return JSON.parse(fs.readFileSync(DB,'utf8'))}
function save(db){fs.writeFileSync(DB,JSON.stringify(db,null,2))}
function socFromVoltage(v,s){return Math.max(0,Math.min(100,((v-s.batteryMinVoltage)/(s.batteryMaxVoltage-s.batteryMinVoltage))*100))}
function enrich(p,s){const x=applyCalibrations({...p,timestamp:p.timestamp||nowIso()},s,'energy'); x.pvPowerKw=Number(x.pvPowerKw??0); x.housePowerKw=Number(x.housePowerKw??0); x.batteryPowerKw=Number(x.batteryPowerKw??0); x.gridPowerKw=Number(x.gridPowerKw??0); x.batteryVoltage=Number(x.batteryVoltage??0); x.batterySoc=Number(x.batterySoc??socFromVoltage(x.batteryVoltage,s)); x.batterySoc=+Math.max(0,Math.min(100,x.batterySoc)).toFixed(0); return x}
function aggregate(history,settings){const byDay={}; for(let i=1;i<history.length;i++){const a=history[i-1],b=history[i]; const dt=(new Date(b.timestamp)-new Date(a.timestamp))/3600000; if(dt<=0||dt>2)continue; const day=b.timestamp.slice(0,10); byDay[day]??={date:day,pvKwh:0,loadKwh:0,importKwh:0,exportKwh:0,chargeKwh:0,dischargeKwh:0}; const d=byDay[day]; d.pvKwh+=Math.max(0,b.pvPowerKw)*dt; d.loadKwh+=Math.max(0,b.housePowerKw)*dt; d.importKwh+=Math.max(0,b.gridPowerKw)*dt; d.exportKwh+=Math.max(0,-b.gridPowerKw)*dt; d.chargeKwh+=Math.max(0,b.batteryPowerKw)*dt; d.dischargeKwh+=Math.max(0,-b.batteryPowerKw)*dt;} return Object.values(byDay).map(d=>{for(const k of ['pvKwh','loadKwh','importKwh','exportKwh','chargeKwh','dischargeKwh'])d[k]=+d[k].toFixed(2); d.selfConsumption=d.pvKwh?+Math.min(100,((d.pvKwh-d.exportKwh)/d.pvKwh)*100).toFixed(0):0; d.autarky=d.loadKwh?+Math.min(100,((d.loadKwh-d.importKwh)/d.loadKwh)*100).toFixed(0):0; d.saving=+((d.pvKwh-d.exportKwh)*settings.energyBuyPrice+d.exportKwh*settings.energySellPrice).toFixed(2); d.co2=+(d.pvKwh*0.32).toFixed(1); return d}).sort((a,b)=>a.date.localeCompare(b.date))}
function thermalAggregate(history){const byDay={}; for(let i=1;i<history.length;i++){const a=history[i-1],b=history[i]; const dt=(new Date(b.timestamp)-new Date(a.timestamp))/3600000; if(dt<=0||dt>2)continue; const day=b.timestamp.slice(0,10); byDay[day]??={date:day,thermalKwh:0,heatPumpKwh:0,heatingHours:0,avgRoom:0,n:0}; byDay[day].thermalKwh+=Math.max(0,b.thermalPowerKw||0)*dt; byDay[day].heatPumpKwh+=Math.max(0,b.heatPumpPowerKw||0)*dt; byDay[day].heatingHours+=(b.pumpHeating?dt:0); byDay[day].avgRoom+=Number(b.roomTemp||0); byDay[day].n++;} return Object.values(byDay).map(d=>({date:d.date,thermalKwh:+d.thermalKwh.toFixed(1),heatPumpKwh:+d.heatPumpKwh.toFixed(1),heatingHours:+d.heatingHours.toFixed(1),avgRoom:+(d.avgRoom/Math.max(1,d.n)).toFixed(1)})).sort((a,b)=>a.date.localeCompare(b.date))}

function applyCalibrations(x,s,domain='energy'){
  const cal=s.calibration||{};
  for(const [key,c] of Object.entries(cal)){
    if(x[key]===undefined) continue;
    const mult=Number(c.multiplier??1);
    const off=Number(c.offset??0);
    x[key]=+(Number(x[key]||0)*mult+off).toFixed(key.toLowerCase().includes('hz')?2:3);
  }
  return x;
}
function deepMerge(a,b){
  for(const [k,v] of Object.entries(b||{})){
    if(v&&typeof v==='object'&&!Array.isArray(v)){a[k]=deepMerge(a[k]||{},v)} else a[k]=v;
  }
  return a;
}

function auth(req,res,next){if((req.headers['x-api-key']||req.query.key)!==API_KEY)return res.status(401).json({error:'API key non valida'}); next()}
app.get('/api/latest',(req,res)=>{const db=load();res.json({latest:enrich(db.latest,db.settings),thermal:db.thermalLatest,settings:db.settings})});
app.get('/api/history',(req,res)=>{const db=load(); const limit=Math.min(Number(req.query.limit||672),5000); res.json({history:db.history.slice(-limit),daily:aggregate(db.history,db.settings),thermalHistory:db.thermalHistory.slice(-limit),thermalDaily:thermalAggregate(db.thermalHistory),settings:db.settings})});
app.post('/api/update',auth,(req,res)=>{const db=load(); const point=enrich(req.body,db.settings); db.latest=point; db.history.push(point); db.history=db.history.slice(-40000); save(db); res.json({ok:true,point})});
app.post('/api/thermal/update',auth,(req,res)=>{const db=load(); const point=applyCalibrations({...req.body,timestamp:req.body.timestamp||nowIso()},db.settings,'thermal'); db.thermalLatest=point; db.thermalHistory.push(point); db.thermalHistory=db.thermalHistory.slice(-40000); save(db); res.json({ok:true,point})});


// --- SolarView Pro V0.14 RC1: ingest autonomo ESP32 + storico su file ---
const DATA_DIR = path.join(__dirname, 'data');
function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); }
function writeJson(file,obj){ ensureDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(obj,null,2)); }
function stampParts(ts){ const d=new Date(ts||Date.now()); const z=n=>String(n).padStart(2,'0'); return {yyyy:d.getFullYear(),mm:z(d.getMonth()+1),dd:z(d.getDate()),HH:z(d.getHours()),MM:z(d.getMinutes()),SS:z(d.getSeconds()),date:d.toISOString().slice(0,10)}; }
function persistTelemetry(source,payload,point){ const t=stampParts(payload.generated_at||point.timestamp||Date.now()); writeJson(path.join(DATA_DIR,'latest',`${source}_latest.json`),payload); writeJson(path.join(DATA_DIR,'history','raw',source,String(t.yyyy),t.mm,t.dd,`${t.HH}-${t.MM}-${t.SS}.json`),payload); }
function normalizeTechnoSolarPayload(payload,settings){
  if(payload.schema==='solarview.technosolar.v1' || payload.device?.source==='technosolar'){
    const b=payload.battery||{}, f=payload.flow||{}, solar=payload.solar||{}, home=payload.home||{}, grid=payload.grid||{}, inv=payload.inverter||{};
    const battPower=(Number(b.charge_power_kw||0)-Number(b.discharge_power_kw||0));
    return enrich({
      timestamp: payload.generated_at || nowIso(), status:'online', rawSchema:payload.schema,
      pvPowerKw: solar.power_kw, pvVoltage: solar.voltage_v, pvCurrent: solar.current_a, pvTemp: solar.temperature_c,
      housePowerKw: home.load_power_kw, houseVoltage: home.voltage_v, houseHz: home.frequency_hz,
      batteryVoltage: b.voltage_v, batterySoc: b.soc_percent, batteryPowerKw: battPower, batteryTemp: b.temperature_c,
      gridPowerKw: grid.power_kw, gridVoltage: grid.voltage_v, gridHz: grid.frequency_hz,
      inverterTemp: inv.temperature_c, acBypassActive: !!inv.ac_bypass_active,
      flow:f
    },settings);
  }
  return enrich(payload,settings);
}
function normalizeTermoSystemPayload(payload,settings){
  if(payload.schema==='solarview.termosystem.v1' || payload.device?.source==='termosystem'){
    const pellet=payload.heating_sources?.pellet_boiler||{}, hp=payload.heating_sources?.heat_pump||{}, sum=payload.puffer_summary||{};
    const puffers=Array.isArray(payload.puffers)?payload.puffers:[];
    const maxP=Number(sum.system_temperature_max_c ?? Math.max(...puffers.map(x=>x.temperature_max_c||0),0));
    const minP=Number(sum.system_temperature_min_c ?? Math.min(...puffers.map(x=>x.temperature_min_c||999),0));
    const hpKw=Number(hp.estimated_power_kw||0);
    const cop=Number(settings.heatPumpCop||3.2);
    return applyCalibrations({
      timestamp: payload.generated_at||nowIso(), status: payload.system_state?.mode || (pellet.active||hp.active?'heating':'standby'), source:'termosystem',
      puffers, pufferCount:puffers.length, pufferMinTemp:minP, pufferMaxTemp:maxP,
      boilerTemp: pellet.boiler_temperature_c || maxP, bufferTopTemp:maxP, bufferBottomTemp:minP,
      flowTemp:maxP, returnTemp:minP, roomTemp:payload.room_temperature_c || settings.thermalTargetTemp,
      outdoorTemp:payload.outdoor_temperature_c, dhwTemp:payload.dhw_temperature_c, pressureBar:payload.pressure_bar,
      pumpHeating:!!pellet.pump_return_active, pumpReturnActive:!!pellet.pump_return_active,
      pelletBoilerActive:!!pellet.active, pelletLevelPct:pellet.hopper_pellet_percent, boilerRoomTemp:pellet.boiler_room_temperature_c,
      heatPumpActive:!!hp.active, heatPumpPowerKw:hpKw, heatPumpCop:cop, heatPumpThermalKw:+(hpKw*cop).toFixed(2),
      thermalPowerKw:+((pellet.active?8:0)+(hpKw*cop)).toFixed(2), combinedOptimizationActive:!!payload.system_state?.combined_optimization_active,
      rawSchema:payload.schema
    },settings,'thermal');
  }
  return applyCalibrations({...payload,timestamp:payload.timestamp||nowIso()},settings,'thermal');
}
function updateRollupFiles(db){
  const daily=aggregate(db.history||[],db.settings||{}); const thermalDaily=thermalAggregate(db.thermalHistory||[]);
  for(const d of daily.slice(-3)) writeJson(path.join(DATA_DIR,'history','rollups','daily',`technosolar_${d.date}.json`),{schema:'solarview.rollup.daily.v1',source:'technosolar',site_id:db.settings?.siteName||'site',...d});
  for(const d of thermalDaily.slice(-3)) writeJson(path.join(DATA_DIR,'history','rollups','daily',`termosystem_${d.date}.json`),{schema:'solarview.rollup.daily.v1',source:'termosystem',site_id:db.settings?.siteName||'site',...d});
}
function ingestPayload(payload){
  const db=load(); const source=payload.device?.source || (String(payload.schema||'').includes('termosystem')?'termosystem':'technosolar');
  if(source==='termosystem'){
    const point=normalizeTermoSystemPayload(payload,db.settings); db.thermalLatest=point; db.thermalHistory.push(point); db.thermalHistory=db.thermalHistory.slice(-210240); persistTelemetry('termosystem',payload,point);
  } else {
    const point=normalizeTechnoSolarPayload(payload,db.settings); db.latest=point; db.history.push(point); db.history=db.history.slice(-210240); persistTelemetry('technosolar',payload,point);
  }
  updateRollupFiles(db); save(db); return {ok:true,source,latest:source==='termosystem'?db.thermalLatest:db.latest};
}
app.post('/api/telemetry/ingest',auth,(req,res)=>{try{res.json(ingestPayload(req.body))}catch(e){res.status(400).json({ok:false,error:e.message})}});

app.get('/api/settings',(req,res)=>res.json(load().settings));
app.post('/api/settings',(req,res)=>{const db=load(); db.settings=deepMerge(db.settings,req.body); db.latest=enrich(db.latest,db.settings); save(db); res.json({ok:true,settings:db.settings})});
app.get('/api/device-config',(req,res)=>{const db=load(); const s=db.settings; const host=(s.cloudUrl||((req.protocol+'://'+req.get('host')))); res.json({deviceName:s.deviceName,location:s.deviceLocation,enabled:s.esp32Enabled,protocol:s.deviceProtocol,postIntervalMs:Number(s.devicePostIntervalMin||5)*60000,unifiedEndpoint:host+'/api/telemetry/ingest',energyEndpoint:host+'/api/update',thermalEndpoint:host+'/api/thermal/update',termosystem:{pufferCount:s.pufferCount,pelletHopperVolumeL:s.pelletHopperVolumeL,pelletBoilerEnabled:s.pelletBoilerEnabled,heatPumpEnabled:s.heatPumpEnabled,returnPumpEnabled:s.returnPumpEnabled},headers:{'Content-Type':'application/json','x-api-key':'INSERISCI_API_KEY_RENDER'},battery:{minVoltage:s.batteryMinVoltage,maxVoltage:s.batteryMaxVoltage,capacityKwh:s.batteryCapacityKwh},calibration:s.calibration||{}})});
app.get('/api/forecast',(req,res)=>{const db=load(),s=db.settings; const installedKw=(s.panelCount*s.panelWatt)/1000; const hours=[]; let total=0,peak=0; for(let h=0;h<24;h++){const sun=Math.max(0,Math.sin((h-6)/12*Math.PI)); const cloud=0.70+0.18*Math.sin((new Date().getDate()+h)/3); const kw=+(installedKw*s.systemEfficiency*sun*cloud).toFixed(2); total+=kw; peak=Math.max(peak,kw); hours.push({hour:String(h).padStart(2,'0')+':00',kw})} res.json({source:'stima locale meteo',installedKw:+installedKw.toFixed(2),estimatedKwh:+total.toFixed(1),peakKw:+peak.toFixed(2),confidence:78,hours})});
app.listen(PORT,()=>console.log(`SolarView Pro V0.14 RC1 attivo su http://localhost:${PORT}`));
