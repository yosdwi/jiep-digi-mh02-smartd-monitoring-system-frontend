export function mountAnalysisWorkspaceRuntime() {
  if (globalThis.__AW_V23_REACT_RUNTIME_MOUNTED__) return () => {};
  globalThis.__AW_V23_REACT_RUNTIME_MOUNTED__ = true;

  /* ===== runtimeGuardV142 ===== */
  
  window.addEventListener('error',function(event){
    try{
      var mask=document.getElementById('loadingMask');
      var title=mask&&mask.querySelector('.title');
      var text=document.getElementById('loadingText');
      if(title)title.textContent='Runtime error';
      if(text){
        var where=event&&event.lineno?(' · line '+event.lineno+(event.colno?':'+event.colno:'')):'';
        text.textContent=((event&&event.message)||'JavaScript gagal dijalankan')+where;
      }
      if(mask)mask.classList.remove('hidden');
    }catch(_){ }
  });
  window.addEventListener('unhandledrejection',function(event){
    try{
      var mask=document.getElementById('loadingMask');
      var title=mask&&mask.querySelector('.title');
      var text=document.getElementById('loadingText');
      if(title)title.textContent='Runtime error';
      if(text)text.textContent=(event&&event.reason&&event.reason.message)||String(event&&event.reason||'Promise gagal');
      if(mask)mask.classList.remove('hidden');
    }catch(_){ }
  });
  
  
  /* ===== analysisWorkspaceMainV142 ===== */
  
  const RAW=globalThis.__AW_RUNTIME_CONFIG__?.rawBaseUrl || 'https://raw.githubusercontent.com/yosdwi/jiep-digi-mh02-smartd-monitoring-system-frontend/main';
  const API_BASE=globalThis.__AW_RUNTIME_CONFIG__?.apiBaseUrl || '/Monitoring/api';
  const URLS={
    trace:`${RAW}/public/fixtures/brcb-2026-08-22-trace-2s.json`,
    ortho:`${RAW}/public/fixtures/brcb-orthophoto-layers.json`,
    boundary:`${RAW}/public/kml/BOUNDARY_BRCB.kml`,
    roads:`${RAW}/public/kml/ROADS_BRCB.kml`
  };
  const $=id=>document.getElementById(id);
  const state={
    analysisMode:'cycle',
    fixture:null,orthoMeta:null,boundary:null,roads:null,assignment:null,source:'miforce',
    selectedLoaders:new Set(),selectedUnits:new Set(),interval:2,loaderQuery:'',unitQuery:'',
    start:null,end:null,initial:null,analytics:new Map(),
    mapRoot:null,mapApi:null,view:{longitude:117.28,latitude:1.91,zoom:13,pitch:0,bearing:0},
    visible:{trace:true,loading:true,boundary:true,roads:true,ortho:true},
    tool:'pan',measurePoints:[],trendMetrics:new Set(['ritase','cycle']),trendIndex:0,trendBuckets:[],analysisWindow:null,trendDrag:null,focusedLoader:null,expandedLoaders:new Set(),mapSelectedUnits:new Set(),gridApi:null,syncGridSelection:false,mapSampleCount:0,
    playback:{active:false,playing:false,speed:10,currentMs:null,startMs:null,endMs:null,raf:null,lastFrame:null,lastUi:0,trips:[],segments:[],focusedUnit:null,resumeAfterScrub:false},
    speedAnalysis:{
      active:null,
      history:[],
      draft:null,
      selectedSegments:new Set(),
      expandedSegments:new Set(),
      editedSegments:new Set(),
      generation:0
    }
  };
  const fmt=(n,d=1)=>Number.isFinite(n)?Number(n).toLocaleString('id-ID',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const fmtInt=n=>Number.isFinite(n)?Math.round(n).toLocaleString('id-ID'):'—';
  const pad=n=>String(n).padStart(2,'0');
  const dateParts=iso=>{const d=new Date(iso);return {y:d.getFullYear(),m:d.getMonth()+1,d:d.getDate(),h:d.getHours()}};
  const toLocalIso=(date,hour)=>`${date}T${pad(hour)}:00`;
  const displayRange=(a,b)=>{
    if(!a||!b)return'—'; const A=a.split('T'),B=b.split('T'), [ya,ma,da]=A[0].split('-'),[yb,mb,db]=B[0].split('-');
    return A[0]===B[0]?`${da}/${ma} ${A[1]} – ${B[1]}`:`${da}/${ma} ${A[1]} – ${db}/${mb} ${B[1]}`;
  };
  function parseLocal(s){
    if(!s)return new Date(NaN);
    const raw=String(s);
    if(/[zZ]$|[+-]\d{2}:\d{2}$/.test(raw))return new Date(raw);
    const withSeconds=/T\d{2}:\d{2}:\d{2}/.test(raw)?raw:`${raw}:00`;
    return new Date(Date.parse(`${withSeconds}+08:00`));
  }
  function hav(a,b,c,d){const R=6371,r=Math.PI/180,p1=b*r,p2=d*r,dp=(d-b)*r,dl=(c-a)*r,x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
  function fmtDur(ms){if(!Number.isFinite(ms)||ms<=0)return'—';const m=ms/60000;if(m<60)return`${fmt(m,1)} min`;const h=Math.floor(m/60);return`${h}j ${fmt(m-h*60,0)}m`}
  function pct(arr,p){if(!arr.length)return NaN;const s=[...arr].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.max(0,Math.round((s.length-1)*p)))]}
  function speedColor(s){
    if(s<10)return[239,68,68,205];
    if(s<20)return[139,69,19,205];
    if(s<25)return[251,191,36,205];
    if(s<30)return[34,197,94,205];
    return[59,130,246,205];
  }
  function place(pop,btn){const r=btn.getBoundingClientRect();pop.style.left=`${Math.min(r.left,innerWidth-pop.offsetWidth-10)}px`;pop.style.top=`${r.bottom+6}px`}
  function closePops(except=null){['timePop','loaderPop','unitPop','intervalPop'].forEach(id=>{if(id!==except)$(id).classList.add('hidden')})}
  function togglePop(popId,btn){const p=$(popId),show=p.classList.contains('hidden');closePops(show?popId:null);p.classList.toggle('hidden',!show);if(show)requestAnimationFrame(()=>place(p,btn))}
  document.addEventListener('click',e=>{if(!e.target.closest('.popover')&&!e.target.closest('.filterbtn'))closePops()});
  
  for(let h=0;h<24;h++){['startHour','endHour'].forEach(id=>{const o=document.createElement('option');o.value=h;o.textContent=`${pad(h)}:00`;$(id).appendChild(o)})}
  const intervals=[2,5,10,30];
  intervals.forEach(v=>{const b=document.createElement('button');b.type='button';b.className='check-row';b.style.width='100%';b.style.border='0';b.style.background='#fff';b.innerHTML=`<span>${v} detik</span><span class="small">${v===2?'Default':''}</span>`;b.addEventListener('click',()=>{state.interval=v;$('intervalLabel').textContent=`${v} detik`;$('intervalPop').classList.add('hidden')});$('intervalList').appendChild(b)});
  
  $('timeBtn').addEventListener('click',()=>togglePop('timePop',$('timeBtn')));
  $('loaderBtn').addEventListener('click',()=>{togglePop('loaderPop',$('loaderBtn'));loadAssignment()});
  $('unitBtn').addEventListener('click',()=>togglePop('unitPop',$('unitBtn')));
  $('intervalBtn').addEventListener('click',()=>togglePop('intervalPop',$('intervalBtn')));
  
  document.querySelectorAll('[data-time-mode]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-time-mode]').forEach(x=>x.classList.toggle('active',x===b));$('timeQuick').classList.toggle('hidden',b.dataset.timeMode!=='quick');$('timeCustom').classList.toggle('hidden',b.dataset.timeMode!=='custom')}));
  function syncRangeInputs(){const a=state.start.split('T'),b=state.end.split('T');$('startDate').value=a[0];$('startHour').value=Number(a[1].slice(0,2));$('endDate').value=b[0];$('endHour').value=Number(b[1].slice(0,2))}
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{
    const base=parseLocal(state.initial.start),date=`${base.getFullYear()}-${pad(base.getMonth()+1)}-${pad(base.getDate())}`;
    if(b.dataset.preset==='shift1'){state.start=toLocalIso(date,6);state.end=toLocalIso(date,18)}
    if(b.dataset.preset==='shift2'){state.start=toLocalIso(date,18);const n=new Date(base.getFullYear(),base.getMonth(),base.getDate()+1);state.end=toLocalIso(`${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`,6)}
    if(b.dataset.preset==='today'||b.dataset.preset==='full'){state.start=toLocalIso(date,0);state.end=toLocalIso(date,23)}
    syncRangeInputs();$('timeLabel').textContent=displayRange(state.start,state.end)
  }));
  $('timeApply').addEventListener('click',()=>{
    if(!$('timeCustom').classList.contains('hidden')){const a=toLocalIso($('startDate').value,Number($('startHour').value)),b=toLocalIso($('endDate').value,Number($('endHour').value));if(parseLocal(b)<=parseLocal(a)){$('rangeError').textContent='Waktu selesai harus setelah waktu mulai.';return}state.start=a;state.end=b}
    $('timeLabel').textContent=displayRange(state.start,state.end);$('timePop').classList.add('hidden')
  });
  $('timeCancel').addEventListener('click',()=>{$('timePop').classList.add('hidden');syncRangeInputs()});
  
  document.querySelectorAll('[data-source]').forEach(b=>b.addEventListener('click',async()=>{state.source=b.dataset.source;document.querySelectorAll('[data-source]').forEach(x=>x.classList.toggle('active',x===b));await loadAssignment(true)}));
  $('loaderClear').addEventListener('click',()=>{state.selectedLoaders.clear();renderLoaderPop();updateFilterLabels()});
  $('loaderDone').addEventListener('click',()=>{$('loaderPop').classList.add('hidden');applyLoaderUnits();updateUnitPop()});
  $('unitClear').addEventListener('click',()=>{state.selectedUnits.clear();updateUnitPop();updateFilterLabels()});
  $('unitDone').addEventListener('click',()=>{$('unitPop').classList.add('hidden');updateFilterLabels()});
  $('loaderSearch').addEventListener('input',e=>{state.loaderQuery=e.target.value||'';renderLoaderPop()});
  $('unitSearch').addEventListener('input',e=>{state.unitQuery=e.target.value||'';updateUnitPop()});
  
  function renderLoaderPop(){
    const list=$('loaderList');list.innerHTML='';
    const all=state.assignment?.loaders||[],q=(state.loaderQuery||'').trim().toUpperCase();
    const entries=q?all.filter(e=>String(e.loader||'').toUpperCase().includes(q)):all;
    if(!all.length){list.innerHTML='<div class="small" style="padding:8px 4px">Data loader belum tersedia dari sumber ini.</div>';return}
    if(!entries.length){list.innerHTML='<div class="small" style="padding:8px 4px">Tidak ada loader yang cocok.</div>';return}
    entries.forEach(e=>{const row=document.createElement('label');row.className='check-row';row.innerHTML=`<span class="check-main"><input type="checkbox" ${state.selectedLoaders.has(e.loader)?'checked':''}><strong>${e.loader}</strong></span><span class="availability"><span class="availability-badge">${e.withData??0}/${e.unitCount??e.units?.length??0} DT</span></span>`;row.querySelector('input').addEventListener('change',ev=>{ev.target.checked?state.selectedLoaders.add(e.loader):state.selectedLoaders.delete(e.loader);updateFilterLabels()});list.appendChild(row)})
  }
  function applyLoaderUnits(){if(!state.selectedLoaders.size)return;const wanted=new Set();(state.assignment?.loaders||[]).filter(e=>state.selectedLoaders.has(e.loader)).forEach(e=>(e.units||[]).forEach(u=>wanted.add(u)));if(wanted.size)state.selectedUnits=wanted}
  function updateUnitPop(){
    const list=$('unitListPop');list.innerHTML='';
    const all=unitAvailabilityRows(),q=(state.unitQuery||'').trim().toUpperCase();
    const units=q?all.filter(u=>String(u.unitNo).toUpperCase().includes(q)):all;
    if(!units.length){list.innerHTML='<div class="small" style="padding:8px 4px">Tidak ada unit yang cocok.</div>';return}
    units.forEach(u=>{
      const row=document.createElement('label');row.className='check-row';
      row.innerHTML=`<span class="check-main"><input type="checkbox" ${state.selectedUnits.has(u.unitNo)?'checked':''}><strong>${u.unitNo}</strong></span>${coverageHtml(u)}`;
      row.querySelector('input').addEventListener('change',e=>{
        e.target.checked?state.selectedUnits.add(u.unitNo):state.selectedUnits.delete(u.unitNo);
        updateFilterLabels();
      });
      list.appendChild(row);
    });
  }
  
  function expectedHourSlots(){
    const start=parseLocal(state.start).getTime(),end=parseLocal(state.end).getTime();
    return Math.max(1,Math.ceil((end-start)/3600000));
  }
  function fallbackUnitAvailability(){
    if(!state.fixture)return[];
    const start=parseLocal(state.start).getTime(),end=parseLocal(state.end).getTime();
    const expected=expectedHourSlots();
    return state.fixture.unitNos.map((unitNo,i)=>{
      const ts=state.fixture.traces[i]?.[0]||[];
      const slots=new Set();
      ts.forEach(raw=>{
        const t=Number(raw);
        if(t<start||t>end)return;
        const idx=Math.floor((t-start)/3600000);
        if(idx>=0&&idx<expected)slots.add(idx);
      });
      const hoursAvailable=slots.size;
      return{
        unitNo,
        hoursAvailable,
        hoursExpected:expected,
        coverage:hoursAvailable===0?'none':hoursAvailable>=expected?'full':'partial',
        slots:[...slots].sort((a,b)=>a-b),
        registered:true,
        loaders:[]
      };
    });
  }
  function unitAvailabilityRows(){
    const server=state.assignment?.units;
    return Array.isArray(server)&&server.length?server:fallbackUnitAvailability();
  }
  function coverageHtml(unit){
    const total=Number(unit.hoursExpected||expectedHourSlots()||1);
    const present=new Set(Array.isArray(unit.slots)?unit.slots:[]);
    let cells='';
    for(let i=0;i<Math.min(total,36);i++)cells+=`<i class="${present.has(i)?'on':''}"></i>`;
    const label=unit.coverage==='none'?'tanpa data':
      unit.coverage==='full'?`${unit.hoursAvailable??total} jam`:
      `${unit.hoursAvailable??0}/${unit.hoursExpected??total} jam`;
    return `<span class="availability"><span class="availability-strip">${cells}</span><span class="availability-badge">${label}</span></span>`;
  }
  
  function updateFilterLabels(){
    $('loaderLabel').textContent=!state.selectedLoaders.size?'Semua loader':state.selectedLoaders.size===1?[...state.selectedLoaders][0]:`${state.selectedLoaders.size} loader`;
    $('unitLabel').textContent=state.selectedUnits.size===state.fixture?.unitNos?.length?'Semua unit':`${state.selectedUnits.size} unit`;
  }
  
  async function loadAssignment(force=false){
    if(location.protocol==='file:'){state.assignment=null;renderLoaderPop();return}
    try{
      const q=new URLSearchParams({district:'BRCB',start:state.start,end:state.end,source:state.source});
      const r=await fetch(`${API_BASE}/HistoryContextV3/units?${q}`);if(!r.ok)throw new Error();const d=await r.json();state.assignment=d?.success?d:null
    }catch{state.assignment=null}
    renderLoaderPop();updateUnitPop();if(force)applyLoaderUnits()
  }
  
  function parseKml(text){
    const xml=new DOMParser().parseFromString(text,'text/xml'),features=[];
    const coords=n=>(n?.textContent||'').trim().split(/\s+/).map(s=>s.split(',').slice(0,2).map(Number)).filter(a=>a.length===2&&a.every(Number.isFinite));
    xml.querySelectorAll('Placemark').forEach(pm=>{const name=pm.querySelector('name')?.textContent?.trim()||'';pm.querySelectorAll('LineString').forEach(ls=>{const c=coords(ls.querySelector('coordinates'));if(c.length>1)features.push({type:'Feature',properties:{name},geometry:{type:'LineString',coordinates:c}})});pm.querySelectorAll('Polygon').forEach(pg=>{const c=coords(pg.querySelector('outerBoundaryIs coordinates'));if(c.length>3)features.push({type:'Feature',properties:{name},geometry:{type:'Polygon',coordinates:[c]}})})});
    return{type:'FeatureCollection',features}
  }
  function extent(layer){const {boundsMinX:x1,boundsMinY:y1,boundsMaxX:x2,boundsMaxY:y2}=layer;if(![x1,y1,x2,y2].every(Number.isFinite))return null;const O=20037508.342789244,lng=x=>x/O*180,lat=y=>{const d=y/O*180;return 180/Math.PI*(2*Math.atan(Math.exp(d*Math.PI/180))-Math.PI/2)};return[Math.abs(x2)<=180?x1:lng(x1),Math.abs(y2)<=90?y1:lat(y1),Math.abs(x2)<=180?x2:lng(x2),Math.abs(y2)<=90?y2:lat(y2)]}
  function analyze(i){
    const f=state.fixture,[ts,lons,lats,speeds,statuses]=f.traces[i],start=state.analysisWindow?.startMs??parseLocal(state.start).getTime(),end=state.analysisWindow?.endMs??parseLocal(state.end).getTime(),stride=Math.max(1,Math.round(state.interval/2));
    let speedSum=0,n=0,loaded=0,empty=0,total=0,prevStatus=null;const dumping=[],loadingPts=[],points=[],stateMs=[0,0,0,0,0,0,0];
    let prevIndex=null;
    for(let k=0;k<ts.length;k+=stride){const t=Number(ts[k]);if(t<start||t>end)continue;const lon=Number(lons[k]),lat=Number(lats[k]),sp=Number(speeds[k]||0),st=Number(statuses[k]||0);if(![t,lon,lat,sp,st].every(Number.isFinite))continue;
      speedSum+=sp;n++;if(st===3)loadingPts.push([lon,lat]);if(prevIndex!==null){const d=hav(Number(lons[prevIndex]),Number(lats[prevIndex]),lon,lat);if(Number.isFinite(d)&&d<2){total+=d;if(st===4||st===5)loaded+=d;if(st===2)empty+=d}const dt=Math.max(0,Math.min(120000,t-Number(ts[prevIndex])));if(st>=0&&st<7)stateMs[st]+=dt}
      if(st===6&&prevStatus!==6)dumping.push(t);prevStatus=st;prevIndex=k;points.push({position:[lon,lat],speed:sp,status:st,unitNo:f.unitNos[i]})
    }
    const cycles=[];for(let k=1;k<dumping.length;k++){const dt=dumping[k]-dumping[k-1];if(dt>60000&&dt<8*3600000)cycles.push(dt)}
    return{unitNo:f.unitNos[i],points,pointCount:points.length,ritase:dumping.length,avgCycle:cycles.length?cycles.reduce((a,b)=>a+b,0)/cycles.length:NaN,avgSpeed:n?speedSum/n:NaN,loaded,empty,total,stateMs,loadingPts}
  }
  function compute(){state.analytics.clear();state.fixture.traces.forEach((_,i)=>state.analytics.set(state.fixture.unitNos[i],analyze(i)));buildTrendBuckets()}
  function rows(){return[...state.analytics.values()].filter(r=>state.selectedUnits.has(r.unitNo))}
  function aggregate(rs){const a={units:rs.length,ritase:0,loaded:0,empty:0,points:0,speedX:0,speedN:0,cycleX:0,cycleN:0,stateMs:[0,0,0,0,0,0,0],loadingPts:[]};rs.forEach(r=>{a.ritase+=r.ritase;a.loaded+=r.loaded;a.empty+=r.empty;a.points+=r.pointCount;if(Number.isFinite(r.avgSpeed)){a.speedX+=r.avgSpeed*r.pointCount;a.speedN+=r.pointCount}if(Number.isFinite(r.avgCycle)){a.cycleX+=r.avgCycle*Math.max(1,r.ritase);a.cycleN+=Math.max(1,r.ritase)}r.stateMs.forEach((v,i)=>a.stateMs[i]+=v||0);a.loadingPts.push(...r.loadingPts)});a.avgSpeed=a.speedN?a.speedX/a.speedN:NaN;a.avgCycle=a.cycleN?a.cycleX/a.cycleN:NaN;return a}
  function centerRadius(pts){if(!pts.length)return{c:null,r:NaN};const x=pts.reduce((s,p)=>s+p[0],0)/pts.length,y=pts.reduce((s,p)=>s+p[1],0)/pts.length,d=pts.map(p=>hav(x,y,p[0],p[1])*1000);return{c:[x,y],r:pct(d,.9)}}
  function loaderEntries(){
    return state.assignment?.loaders||[];
  }
  function loaderPerformanceRows(){
    const byUnit=state.analytics;
    return loaderEntries().map(entry=>{
      const rs=(entry.units||[]).map(u=>byUnit.get(u)).filter(Boolean);
      return {entry,rows:rs,agg:aggregate(rs)};
    }).filter(x=>x.rows.length);
  }
  function focusedRows(){
    const base=rows();
    if(state.mapSelectedUnits.size>0){
      return base.filter(r=>state.mapSelectedUnits.has(r.unitNo));
    }
    return base;
  }
  
  function hourLabel(ms){
    const d=new Date(ms+8*3600000);
    return `${pad(d.getUTCHours())}:00`;
  }
  function buildTrendBuckets(){
    const startMs=parseLocal(state.start).getTime(),endMs=parseLocal(state.end).getTime();
    const first=Math.floor(startMs/3600000)*3600000;
    const bucketMap=new Map();
    for(let t=first;t<=endMs;t+=3600000){
      bucketMap.set(t,{t,ritase:0,speedSum:0,speedN:0,stopMs:0,loadedDistance:0,emptyDistance:0,cycleDurations:[],dumpByUnit:new Map(),prevStatus:new Map(),lastTsByUnit:new Map()});
    }
    const stride=Math.max(1,Math.round(state.interval/2));
    state.fixture.traces.forEach((trace,i)=>{
      const unit=state.fixture.unitNos[i];
      if(!state.selectedUnits.has(unit))return;
      const [ts,lons,lats,speeds,statuses]=trace;
      let prevStatus=null,lastDump=null,prevTs=null,prevLon=null,prevLat=null;
      for(let k=0;k<ts.length;k+=stride){
        const t=Number(ts[k]); if(t<startMs||t>endMs)continue;
        const h=Math.floor(t/3600000)*3600000,b=bucketMap.get(h); if(!b)continue;
        const sp=Number(speeds[k]||0),st=Number(statuses[k]||0);
        if(Number.isFinite(sp)){b.speedSum+=sp;b.speedN++}
        if(prevTs!==null&&st===5)b.stopMs+=Math.max(0,Math.min(120000,t-prevTs));
        const lon=Number(lons[k]),lat=Number(lats[k]);
        if(prevTs!==null&&Number.isFinite(lon)&&Number.isFinite(lat)&&Number.isFinite(prevLon)&&Number.isFinite(prevLat)){
          const dist=hav(prevLon,prevLat,lon,lat);
          if(Number.isFinite(dist)&&dist<2){
            if(st===4||st===5)b.loadedDistance+=dist;
            if(st===2)b.emptyDistance+=dist;
          }
        }
        if(st===6&&prevStatus!==6){
          b.ritase++;
          if(lastDump!==null){
            const ct=t-lastDump;
            if(ct>60000&&ct<8*3600000)b.cycleDurations.push(ct);
          }
          lastDump=t;
        }
        prevStatus=st;prevTs=t;prevLon=Number(lons[k]);prevLat=Number(lats[k]);
      }
    });
    state.trendBuckets=[...bucketMap.values()].map(b=>({
      t:b.t,
      ritase:b.ritase,
      cycle:b.cycleDurations.length?b.cycleDurations.reduce((a,c)=>a+c,0)/b.cycleDurations.length:NaN,
      speed:b.speedN?b.speedSum/b.speedN:NaN,
      loadedDistance:b.loadedDistance,
      emptyDistance:b.emptyDistance,
      stop:b.stopMs
    }));
    state.trendIndex=Math.min(state.trendIndex,Math.max(0,state.trendBuckets.length-1));
  }
  function trendValue(bucket,metric){
    if(!bucket)return NaN;
    return bucket[metric];
  }
  const TREND_META={
    ritase:{label:'Ritase',unit:'rit',color:'#287c94'},
    cycle:{label:'Avg Cycle Time',unit:'menit',color:'#d48a47'},
    loadedDistance:{label:'Jarak Muatan',unit:'km',color:'#548767'},
    emptyDistance:{label:'Jarak Kosongan',unit:'km',color:'#5c8798'},
    speed:{label:'Actual Avg Speed',unit:'km/h',color:'#9f6662'},
    stop:{label:'Stop Muatan',unit:'menit',color:'#929ba6'}
  };
  function trendFormat(value,metric){
    if(!Number.isFinite(value))return '—';
    if(metric==='ritase')return `${fmtInt(value)} rit`;
    if(metric==='cycle'||metric==='stop')return fmtDur(value);
    if(metric==='speed')return `${fmt(value,1)} km/h`;
    return `${fmt(value,1)} km`;
  }
  function renderTrend(){
    if(state.analysisMode==='speed')return renderSpeedTrend();
    if((!state.trendBuckets||!state.trendBuckets.length)&&state.fixture&&state.selectedUnits.size){
      try{buildTrendBuckets()}catch(e){console.warn('Trend rebuild:',e)}
    }
    const data=state.trendBuckets||[],svg=$('trendSvg'),empty=$('trendEmpty'),content=$('trendContent');
    const selected=[...state.trendMetrics];
    if(!data.length||!selected.length){
      content.classList.add('hidden');empty.classList.remove('hidden');
      empty.textContent=!selected.length?'Pilih minimal satu metrik.':'Tidak ada data trend pada rentang ini.';
      return;
    }
    content.classList.remove('hidden');empty.classList.add('hidden');
  
    const W=1200,H=220,L=48,R=16,T=12,B=31,plotW=W-L-R,plotH=H-T-B;
    const x=i=>L+(data.length<=1?plotW/2:i/(data.length-1)*plotW);
  
    const stats={};
    selected.forEach(metric=>{
      const vals=data.map(d=>trendValue(d,metric)).filter(Number.isFinite);
      let lo=vals.length?Math.min(...vals):0,hi=vals.length?Math.max(...vals):1;
      if(lo===hi){lo=Math.max(0,lo-(Math.abs(lo)*.1||1));hi=hi+(Math.abs(hi)*.1||1)}
      stats[metric]={lo,hi};
    });
    const y=(metric,v)=>{
      const {lo,hi}=stats[metric];
      return T+(hi-v)/(hi-lo)*plotH;
    };
  
    const grids=[0,.25,.5,.75,1].map(q=>`<line class="trend-grid" x1="${L}" x2="${W-R}" y1="${T+q*plotH}" y2="${T+q*plotH}"/>`).join('');
    let seriesSvg='';
    selected.forEach(metric=>{
      const color=TREND_META[metric].color;
      let segments=[],cur=[];
      data.forEach((d,i)=>{
        const v=trendValue(d,metric);
        if(Number.isFinite(v))cur.push(`${x(i)},${y(metric,v)}`);
        else if(cur.length){segments.push(cur);cur=[]}
      });
      if(cur.length)segments.push(cur);
      seriesSvg+=segments.map(seg=>`<polyline points="${seg.join(' ')}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    });
  
    const idx=Math.min(state.trendIndex,data.length-1),active=data[idx];
    let points='';
    selected.forEach(metric=>{
      const v=trendValue(active,metric);
      if(Number.isFinite(v))points+=`<circle cx="${x(idx)}" cy="${y(metric,v)}" r="4" fill="#fff" stroke="${TREND_META[metric].color}" stroke-width="2.2"/>`;
    });
    const guide=`<line x1="${x(idx)}" x2="${x(idx)}" y1="${T}" y2="${T+plotH}" stroke="#98a2b3" stroke-width="1" stroke-dasharray="3 3"/>`;
    const xlabels=data.map((d,i)=>i===0||i===data.length-1||i%Math.max(1,Math.ceil(data.length/8))===0
      ?`<text class="trend-axis" text-anchor="middle" x="${x(i)}" y="${H-7}">${hourLabel(d.t)}</text>`:'').join('');
  
    let brush='';
    if(state.analysisWindow&&data.length>1){
      const span=Math.max(1,data[data.length-1].t-data[0].t);
      const a=Math.max(0,(state.analysisWindow.startMs-data[0].t)/span);
      const b=Math.min(1,(state.analysisWindow.endMs-data[0].t)/span);
      brush=`<rect x="${L+a*plotW}" y="${T}" width="${Math.max(2,(b-a)*plotW)}" height="${plotH}" fill="rgba(40,124,148,.06)" stroke="rgba(40,124,148,.55)" stroke-width="1.2"/>`;
    }
    svg.innerHTML=grids+brush+seriesSvg+guide+points+xlabels;
  
    const legend=$('trendLegend');legend.innerHTML='';
    selected.forEach(metric=>{
      const meta=TREND_META[metric],el=document.createElement('div');
      el.className='trend-legend-item';
      el.innerHTML=`<span class="trend-legend-line" style="background:${meta.color}"></span><span>${meta.label}</span><strong>${trendFormat(trendValue(active,metric),metric)}</strong>`;
      legend.appendChild(el);
    });
    $('trendValue').textContent=selected.length===1?trendFormat(trendValue(active,selected[0]),selected[0]):`${selected.length} metrik`;
    $('trendTime').textContent=hourLabel(active.t);
  }
  function updateMetrics(){
    const a=aggregate(rows());$('mUnits').textContent=fmtInt(a.units);$('mRitase').textContent=fmtInt(a.ritase);$('mCycle').textContent=fmtDur(a.avgCycle);const avgLoadedDist=a.ritase>0?a.loaded/a.ritase:NaN,avgEmptyDist=a.ritase>0?a.empty/a.ritase:NaN;
    $('mLoaded').textContent=`${fmt(avgLoadedDist,2)} km`;$('mEmpty').textContent=`${fmt(avgEmptyDist,2)} km`;$('mSpeed').textContent=`${fmt(a.avgSpeed,1)} km/h`;state.mapSampleCount=a.points;updateMapStatus();
    const s={loading:a.stateMs[3],loaded:a.stateMs[4],stop:a.stateMs[5],dump:a.stateMs[6],empty:a.stateMs[2]};
    const unitDiv=Math.max(1,a.units);
    const avg={loading:s.loading/unitDiv,loaded:s.loaded/unitDiv,stop:s.stop/unitDiv,dump:s.dump/unitDiv,empty:s.empty/unitDiv};
    const totalAvg=Object.values(avg).reduce((x,y)=>x+y,0)||1;
    const share=k=>avg[k]/totalAvg;
    $('cycleTotalAvg').textContent=fmtDur(totalAvg);
  
    $('stackLoading').style.width=`${share('loading')*100}%`;$('stackLoaded').style.width=`${share('loaded')*100}%`;$('stackStop').style.width=`${share('stop')*100}%`;$('stackDump').style.width=`${share('dump')*100}%`;$('stackEmpty').style.width=`${share('empty')*100}%`;
    $('ovLoading').textContent=fmtDur(avg.loading);$('ovLoaded').textContent=fmtDur(avg.loaded);$('ovStop').textContent=fmtDur(avg.stop);$('ovDump').textContent=fmtDur(avg.dump);$('ovEmpty').textContent=fmtDur(avg.empty);
    $('ovLoadingPct').textContent=`${fmt(share('loading')*100,1)}%`;$('ovLoadedPct').textContent=`${fmt(share('loaded')*100,1)}%`;$('ovStopPct').textContent=`${fmt(share('stop')*100,1)}%`;$('ovDumpPct').textContent=`${fmt(share('dump')*100,1)}%`;$('ovEmptyPct').textContent=`${fmt(share('empty')*100,1)}%`;
    renderTrend();
  }
  function performanceRowData(){
    const loaderRows=loaderPerformanceRows();
    const out=[];
    if(loaderRows.length){
      loaderRows.forEach(({entry,rows:unitRows,agg})=>{
        const rit=Math.max(0,agg.ritase);
        out.push({
          id:`loader:${entry.loader}`,rowType:'loader',label:entry.loader,
          unitCount:entry.unitCount??entry.units?.length??unitRows.length,
          ritase:agg.ritase,avgCycle:agg.avgCycle,
          avgLoaded:rit?agg.loaded/rit:NaN,avgEmpty:rit?agg.empty/rit:NaN,
          avgSpeed:agg.avgSpeed,unitNos:[...(entry.units||unitRows.map(r=>r.unitNo))]
        });
        if(state.expandedLoaders.has(entry.loader)){
          unitRows.forEach(r=>{
            const ritU=Math.max(0,r.ritase);
            out.push({
              id:`unit:${entry.loader}:${r.unitNo}`,rowType:'unit',parentLoader:entry.loader,label:r.unitNo,
              unitCount:null,ritase:r.ritase,avgCycle:r.avgCycle,
              avgLoaded:ritU?r.loaded/ritU:NaN,avgEmpty:ritU?r.empty/ritU:NaN,
              avgSpeed:r.avgSpeed,unitNo:r.unitNo
            });
          });
        }
      });
    }else{
      rows().forEach(r=>{
        const rit=Math.max(0,r.ritase);
        out.push({
          id:`unit:${r.unitNo}`,rowType:'unit',parentLoader:null,label:r.unitNo,
          ritase:r.ritase,avgCycle:r.avgCycle,
          avgLoaded:rit?r.loaded/rit:NaN,avgEmpty:rit?r.empty/rit:NaN,
          avgSpeed:r.avgSpeed,unitNo:r.unitNo
        });
      });
    }
    return out;
  }
  function hierarchyRenderer(params){
    const d=params.data||{},wrap=document.createElement('div');wrap.className='hier-cell';
    if(d.rowType==='loader'){
      const b=document.createElement('button');b.type='button';b.className='hier-toggle';
      b.textContent=state.expandedLoaders.has(d.label)?'▾':'▸';
      b.title=state.expandedLoaders.has(d.label)?'Tutup unit':'Lihat unit';
      b.addEventListener('click',e=>{
        e.stopPropagation();
        state.expandedLoaders.has(d.label)?state.expandedLoaders.delete(d.label):state.expandedLoaders.add(d.label);
        renderTable();
      });
      const s=document.createElement('span');s.className='hier-loader';s.textContent=d.label;
      wrap.append(b,s);
    }else{
      const s=document.createElement('span');s.className='hier-unit';s.textContent=d.label;
      wrap.append(s);
    }
    return wrap;
  }
  function updatePlaybackAction(){
    const n=state.mapSelectedUnits.size;
    const btn=$('playbackStartBtn');
    if(btn){
      btn.classList.toggle('hidden',n===0);
      btn.disabled=n===0;
      btn.textContent=n?`▶ Playback ${n} unit`:'▶ Playback';
    }
    if(state.analysisMode==='speed'){
      const segN=state.speedAnalysis.selectedSegments.size;
      $('gridSelectionCount').textContent=segN?`${segN} segment · ${n} unit evidence`:'0 segment dipilih';
    }else{
      $('gridSelectionCount').textContent=n?`${n} unit dipilih`:'0 unit dipilih';
    }
  }
  
  function syncGridSelection(){
    if(state.analysisMode==='speed')return syncSpeedGridSelection();
    if(!state.gridApi)return;
    state.syncGridSelection=true;
    state.gridApi.forEachNode(node=>{
      const d=node.data;
      if(!d)return;
      const selected=d.rowType==='loader'
        ? (d.unitNos?.length>0&&d.unitNos.every(u=>state.mapSelectedUnits.has(u)))
        : state.mapSelectedUnits.has(d.unitNo);
      node.setSelected(Boolean(selected),false,'sync');
    });
    state.syncGridSelection=false;
    updatePlaybackAction();
  }
  
  let selectionFocusTimer=null;
  let pendingGridSelection=null;
  let gridSelectionFlushTimer=null;
  
  function fitSelectedTrace(){
    const map=state.mapRoot;
    if(!map||!state._mapReady)return;
  
    const selected=state.mapSelectedUnits;
    const sourceRows=selected.size
      ? rows().filter(r=>selected.has(r.unitNo))
      : rows();
  
    const pts=sourceRows.flatMap(r=>{
      const step=Math.max(1,Math.ceil((r.points?.length||0)/700));
      return (r.points||[]).filter((_,i)=>i%step===0).map(p=>p.position);
    });
  
    if(!pts.length)return;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    pts.forEach(([x,y])=>{
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      minX=Math.min(minX,x);minY=Math.min(minY,y);
      maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    });
    if(![minX,minY,maxX,maxY].every(Number.isFinite))return;
  
    map.fitBounds([[minX,minY],[maxX,maxY]],{
      padding:{top:34,right:66,bottom:currentDockPadding(),left:38},
      maxZoom:17.5,
      duration:620
    });
  }
  function queueSelectionFocus(){
    clearTimeout(selectionFocusTimer);
    selectionFocusTimer=setTimeout(fitSelectedTrace,90);
  }
  
  function flushGridSelectionBatch(){
    gridSelectionFlushTimer=null;
    if(!pendingGridSelection)return;
    if(state.playback.active)closePlayback();
  
    state.mapSelectedUnits=new Set(pendingGridSelection);
    pendingGridSelection=null;
  
    syncGridSelection();
    refreshMap();
    queueSelectionFocus();
  }
  
  function handleGridRowSelected(event){
    if(state.analysisMode==='speed')return handleSpeedGridRowSelected(event);
    if(state.syncGridSelection)return;
    const d=event.data;if(!d)return;
  
    // AG Grid header Select All emits one row event per row. Do not refresh the
    // map between those intermediate events: accumulate the full transaction and
    // commit it once at the end of the current event loop.
    if(!pendingGridSelection){
      pendingGridSelection=new Set(state.mapSelectedUnits);
    }
  
    const selected=event.node.isSelected();
    if(d.rowType==='loader'){
      (d.unitNos||[]).forEach(u=>{
        selected?pendingGridSelection.add(u):pendingGridSelection.delete(u);
      });
    }else if(d.unitNo){
      selected?pendingGridSelection.add(d.unitNo):pendingGridSelection.delete(d.unitNo);
    }
  
    clearTimeout(gridSelectionFlushTimer);
    gridSelectionFlushTimer=setTimeout(flushGridSelectionBatch,0);
  }
  function renderTable(){
    if(state.analysisMode==='speed')return renderSpeedTable();
    const rowData=performanceRowData();
    $('perfTitle').textContent='Performance';
  
    const numCell='perf-num-cell';
    const numHead='perf-num-header';
    const columnDefs=[
      {
        field:'label',headerName:'Loader / Unit',
        minWidth:220,flex:1.35,
        sortable:true,
        cellRenderer:hierarchyRenderer,
        suppressHeaderMenuButton:true
      },
      {
        field:'unitCount',headerName:'Unit',
        width:76,minWidth:70,maxWidth:90,
        cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>p.value==null?'—':fmtInt(p.value),
        suppressHeaderMenuButton:true
      },
      {
        field:'ritase',headerName:'Ritase',
        width:84,minWidth:76,maxWidth:100,
        cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>fmtInt(p.value),
        suppressHeaderMenuButton:true
      },
      {
        field:'avgCycle',headerName:'Avg Cycle Time',
        width:124,minWidth:116,
        cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>fmtDur(p.value),
        suppressHeaderMenuButton:true
      },
      {
        field:'avgLoaded',headerName:'Avg Jarak Muatan',
        width:142,minWidth:132,
        cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,2)} km`:'—',
        suppressHeaderMenuButton:true
      },
      {
        field:'avgEmpty',headerName:'Avg Jarak Kosongan',
        width:152,minWidth:142,
        cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,2)} km`:'—',
        suppressHeaderMenuButton:true
      },
      {
        field:'avgSpeed',headerName:'Avg Actual Speed',
        width:138,minWidth:128,
        cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,1)} km/h`:'—',
        suppressHeaderMenuButton:true
      }
    ];
  
    if(!state.gridApi){
      if(!globalThis.agGrid?.createGrid){
        $('performanceGrid').innerHTML='<div class="small" style="padding:14px">Grid belum dapat dimuat.</div>';
        return;
      }
  
      const baseTheme=agGrid.themeQuartz||agGrid.themeBalham||agGrid.themeAlpine;
      const nativeTheme=baseTheme?.withParams?baseTheme.withParams({
        spacing:5,
        rowVerticalPaddingScale:.82,
        headerVerticalPaddingScale:.82,
        accentColor:'#287c94',
        backgroundColor:'#ffffff',
        foregroundColor:'#172033',
        headerBackgroundColor:'#f7f9fb',
        headerTextColor:'#475467',
        borderColor:'#dfe3e8',
        rowHoverColor:'#f6fafb',
        selectedRowBackgroundColor:'#edf7f9',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize:12
      }):baseTheme;
  
      const options={
        theme:nativeTheme,
        rowData,
        columnDefs,
        getRowId:p=>p.data.id,
        rowHeight:34,
        headerHeight:36,
        defaultColDef:{
          sortable:true,
          resizable:true,
          suppressHeaderMenuButton:true
        },
        rowSelection:{
          mode:'multiRow',
          checkboxes:true,
          headerCheckbox:true,
          enableClickSelection:false
        },
        selectionColumnDef:{
          pinned:'left',
          width:44,minWidth:44,maxWidth:44,
          resizable:false,sortable:false,
          suppressHeaderMenuButton:true
        },
        getRowClass:p=>p.data?.rowType==='loader'?'perf-loader-row':'perf-unit-row',
        onRowSelected:handleGridRowSelected,
        suppressCellFocus:false,
        animateRows:false
      };
  
      state.gridApi=agGrid.createGrid($('performanceGrid'),options);
      $('gridSearch').addEventListener('input',e=>{
        state.gridApi?.setGridOption('quickFilterText',e.target.value||'');
      });
    }else{
      state.gridApi.setGridOption('columnDefs',columnDefs);
      state.gridApi.setGridOption('rowData',rowData);
    }
  
    requestAnimationFrame(()=>{
      syncGridSelection();
      try{
        state.gridApi?.refreshCells?.({force:true});
        state.gridApi?.redrawRows?.();
      }catch(e){console.warn('Performance grid refresh:',e)}
    });
  }
  
  function pathPositions(){return rows().flatMap(r=>r.points.filter((_,i)=>i%8===0).map(p=>p.position))}
  
  function mapSpeedBand(speed){
    if(speed<10)return 0;
    if(speed<20)return 1;
    if(speed<25)return 2;
    if(speed<30)return 3;
    return 4;
  }
  function latestOrtho(){
    return state.orthoMeta?.layers?.filter(x=>x.converted).sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt))[0]||null;
  }
  function emptyFC(){return{type:'FeatureCollection',features:[]}}
  function mapSourceSet(id,data){
    const map=state.mapRoot;
    if(!map||!state._mapReady)return;
    const src=map.getSource(id);
    if(src?.setData)src.setData(data);
  }
  function mapVisibility(id,visible){
    const map=state.mapRoot;
    if(!map||!state._mapReady||!map.getLayer(id))return;
    map.setLayoutProperty(id,'visibility',visible?'visible':'none');
  }
  
  function speedBandColor(speed){
    const s=Number(speed||0);
    if(s<10)return [239,68,68,225];
    if(s<20)return [139,69,19,225];
    if(s<25)return [251,191,36,225];
    if(s<30)return [34,197,94,225];
    return [59,130,246,225];
  }
  function dotRadiusForCount(n){
    if(n>1500000)return{min:0.7,max:2};
    if(n>400000)return{min:1,max:3};
    if(n>80000)return{min:1.4,max:4};
    return{min:2,max:6};
  }
  function buildDeckDotData(){
    const rows=focusedRows(),dots=[],loading=[];
    if(!rows.length)return{dots,loading};
  
    const selectedSpeedPolygons=state.analysisMode==='speed'&&state.speedAnalysis.selectedSegments.size
      ?activeSpeedSegments()
        .filter(seg=>state.speedAnalysis.selectedSegments.has(seg.id))
        .map(seg=>seg.polygon)
        .filter(Boolean)
      :[];
  
    // Prototype object budget only. Production V3 uses the existing typed-array
    // registry directly in ScatterplotLayer, so it does not pay this JS-object cost.
    const budget=90000;
    const perUnit=Math.max(160,Math.floor(budget/Math.max(1,rows.length)));
    let loadingBudget=10000;
  
    rows.forEach(r=>{
      const pts=r.points||[];
      const step=Math.max(1,Math.ceil(pts.length/perUnit));
      for(let i=0;i<pts.length;i+=step){
        const p=pts[i],pos=p?.position;
        if(!pos||!Number.isFinite(pos[0])||!Number.isFinite(pos[1]))continue;
        if(selectedSpeedPolygons.length){
          const insideEvidence=selectedSpeedPolygons.some(polygon=>{
            const bounds=polygonBounds(polygon);
            return pointInsideBounds(pos,bounds)&&pointInPolygon(pos,polygon);
          });
          if(!insideEvidence)continue;
        }
        dots.push({
          position:pos,
          speed:Number(p.speed||0),
          color:speedBandColor(p.speed),
          unitNo:r.unitNo,
          status:p.status
        });
        if(p.status===3&&loadingBudget>0){
          loading.push({position:pos,unitNo:r.unitNo});
          loadingBudget--;
        }
      }
    });
    return{dots,loading};
  }
  const PLAYBACK_UNIT_COLORS=[
    [40,124,148,245],
    [215,132,67,245],
    [84,135,103,245],
    [111,104,162,245],
    [171,93,109,245],
    [74,113,166,245],
    [141,117,78,245],
    [74,145,144,245]
  ];
  
  const MINING_ICON_ATLAS=`${RAW}/public/icons/mining-atlas.png`;
  const MINING_ICON_MAPPING={
    dumptruck:{x:0,y:0,width:128,height:128,mask:false},
    excavator:{x:128,y:0,width:128,height:128,mask:false},
    dot:{x:256,y:0,width:32,height:32,mask:false}
  };
  
  const PLM_STATUS={
    0:{label:'ACC ON',color:'#64748b'},
    1:{label:'Standby',color:'#f59e0b'},
    2:{label:'Running kosongan',color:'#3b82f6'},
    3:{label:'Loading',color:'#8b5cf6'},
    4:{label:'Running muatan',color:'#22c55e'},
    5:{label:'Stop muatan',color:'#ef4444'},
    6:{label:'Dumping',color:'#d48a47'}
  };
  
  function loaderNameForUnit(unitNo){
    const hit=(state.assignment?.loaders||[]).find(e=>(e.units||[]).includes(unitNo));
    return hit?.loader||'—';
  }
  
  function playbackUnitColor(unitNo){
    const units=[...state.mapSelectedUnits];
    const i=Math.max(0,units.indexOf(unitNo));
    return PLAYBACK_UNIT_COLORS[i%PLAYBACK_UNIT_COLORS.length];
  }
  
  function playbackRange(){
    const startMs=state.analysisWindow?.startMs??parseLocal(state.start).getTime();
    const endMs=state.analysisWindow?.endMs??parseLocal(state.end).getTime();
    return{startMs,endMs};
  }
  
  function validPlaybackCoord(lon,lat){
    return Number.isFinite(lon)&&Number.isFinite(lat)&&Math.abs(lon)<=180&&Math.abs(lat)<=90&&!(lon===0&&lat===0);
  }
  function playbackHeading(a,b){
    if(!a||!b)return 0;
    const dLon=b[0]-a[0],dLat=b[1]-a[1];
    if(!dLon&&!dLat)return 0;
    let deg=Math.atan2(dLon,dLat)*180/Math.PI;
    if(deg<0)deg+=360;
    return deg;
  }
  
  function buildPlaybackData(){
    const selected=state.mapSelectedUnits;
    const {startMs,endMs}=playbackRange();
    const trips=[],segments=[];
  
    state.fixture.traces.forEach((trace,i)=>{
      const unitNo=state.fixture.unitNos[i];
      if(!selected.has(unitNo))return;
  
      const [ts,lons,lats,speeds]=trace;
      let path=[],timestamps=[],previous=null;
  
      const flush=()=>{
        if(path.length>1){
          trips.push({unitNo,color:playbackUnitColor(unitNo),path,timestamps});
        }
        path=[];timestamps=[];previous=null;
      };
  
      for(let k=0;k<ts.length;k++){
        const t=Number(ts[k]),lon=Number(lons[k]),lat=Number(lats[k]);
        if(t<startMs||t>endMs||!validPlaybackCoord(lon,lat))continue;
  
        const current=[lon,lat];
        if(previous){
          const gap=t-previous.t;
          const distance=hav(previous.pos[0],previous.pos[1],lon,lat);
  
          // Break the path across stale data or GPS jumps. This mirrors the older
          // replay's "do not draw a bridge across the pit" behaviour.
          if(gap>120000||!Number.isFinite(distance)||distance>2){
            flush();
          }else{
            segments.push({
              unitNo,
              path:[previous.pos,current],
              tStart:previous.t,
              tEnd:t,
              filterT:(t-startMs)/1000,
              color:speedBandColor(previous.speed)
            });
          }
        }
  
        path.push(current);
        timestamps.push(t);
        previous={t,pos:current,speed:Number(speeds[k]||0)};
      }
      flush();
    });
  
    return{trips,segments};
  }
  
  function playbackSample(unitNo,ms){
    const idx=state.fixture.unitNos.indexOf(unitNo);
    if(idx<0)return null;
  
    // Optional arrays 5..7 are supported for future/production fixtures. The
    // current compact standalone fixture only guarantees status + speed.
    const trace=state.fixture.traces[idx];
    const [ts,lons,lats,speeds,statuses,hms,fuelLevels,actTonnages]=trace;
  
    let lo=0,hi=ts.length-1,best=-1;
    while(lo<=hi){
      const mid=(lo+hi)>>1;
      const t=Number(ts[mid]);
      if(t<=ms){best=mid;lo=mid+1}else hi=mid-1;
    }
    if(best<0)return null;
  
    const t=Number(ts[best]);
    if(Math.abs(ms-t)>120000)return null;
  
    const lon=Number(lons[best]),lat=Number(lats[best]);
    if(!validPlaybackCoord(lon,lat))return null;
  
    let prev=null;
    for(let j=best-1;j>=Math.max(0,best-8);j--){
      const plon=Number(lons[j]),plat=Number(lats[j]);
      if(validPlaybackCoord(plon,plat)){prev=[plon,plat];break}
    }
  
    const position=[lon,lat];
    const finiteOrNull=v=>Number.isFinite(Number(v))?Number(v):null;
  
    return{
      unitNo,
      position,
      timestamp:t,
      speed:finiteOrNull(speeds[best])??0,
      status:finiteOrNull(statuses?.[best]),
      heading:playbackHeading(prev,position),
      hm:finiteOrNull(hms?.[best]),
      fuel:finiteOrNull(fuelLevels?.[best]),
      payload:finiteOrNull(actTonnages?.[best]),
      color:playbackUnitColor(unitNo)
    };
  }
  
  function progressiveTrailLayer(){
    const p=state.playback;
    if(!p.segments.length||!globalThis.deck?.PathLayer)return null;
  
    const common={
      id:'cycle-playback-progressive-speed-trail',
      getPath:d=>d.path,
      getColor:d=>d.color,
      widthUnits:'pixels',
      getWidth:5,
      widthMinPixels:3,
      widthMaxPixels:8,
      capRounded:true,
      jointRounded:true,
      pickable:false
    };
  
    if(globalThis.deck.DataFilterExtension){
      return new deck.PathLayer({
        ...common,
        data:p.segments,
        getFilterValue:d=>d.filterT,
        filterRange:[0,Math.max(0,(p.currentMs-p.startMs)/1000)],
        extensions:[new deck.DataFilterExtension({filterSize:1})]
      });
    }
  
    // CDN-safe fallback if the extension is unavailable.
    return new deck.PathLayer({
      ...common,
      data:p.segments.filter(s=>s.tEnd<=p.currentMs)
    });
  }
  
  function buildPlaybackLayers(){
    if(!state.playback.active||!globalThis.deck)return[];
    const out=[];
    const trail=progressiveTrailLayer();
    if(trail)out.push(trail);
  
    const markers=[...state.mapSelectedUnits]
      .map(unit=>playbackSample(unit,state.playback.currentMs))
      .filter(Boolean);
  
    if(markers.length&&globalThis.deck.IconLayer){
      out.push(new deck.IconLayer({
        id:'cycle-playback-mining-icons',
        data:markers,
        iconAtlas:MINING_ICON_ATLAS,
        iconMapping:MINING_ICON_MAPPING,
        getPosition:d=>d.position,
        getIcon:()=> 'dumptruck',
        getSize:40,
        sizeUnits:'pixels',
        sizeMinPixels:34,
        sizeMaxPixels:46,
        getAngle:d=>d.heading||0,
        getColor:[255,255,255,255],
        pickable:true,
        onClick:info=>{
          const unit=info?.object?.unitNo;
          if(!unit)return;
          state.playback.focusedUnit=unit;
          syncPlaybackTelemetry();
          if(info.coordinate&&state.mapRoot){
            state.mapRoot.easeTo({
              center:info.coordinate,
              zoom:Math.max(state.mapRoot.getZoom(),15.5),
              duration:500
            });
          }
        }
      }));
    }else if(markers.length){
      out.push(new deck.ScatterplotLayer({
        id:'cycle-playback-marker-fallback',
        data:markers,
        getPosition:d=>d.position,
        getFillColor:d=>d.color,
        radiusUnits:'pixels',
        getRadius:9,
        stroked:true,
        getLineColor:[255,255,255,255],
        getLineWidth:2,
        pickable:true,
        onClick:info=>{
          if(info?.object?.unitNo){
            state.playback.focusedUnit=info.object.unitNo;
            syncPlaybackTelemetry();
          }
        }
      }));
    }
  
    if(markers.length&&globalThis.deck.TextLayer){
      out.push(new deck.TextLayer({
        id:'cycle-playback-unit-labels',
        data:markers,
        getPosition:d=>d.position,
        getText:d=>String(d.unitNo),
        getSize:11,
        sizeUnits:'pixels',
        getColor:[255,255,255,255],
        getPixelOffset:[0,24],
        background:true,
        getBackgroundColor:d=>d.unitNo===state.playback.focusedUnit?[23,32,51,245]:[23,32,51,210],
        backgroundPadding:[5,2],
        fontFamily:'ui-sans-serif,system-ui,sans-serif',
        fontWeight:700,
        pickable:false
      }));
    }
  
    return out;
  }
  
  function applyDeckLayers(){
    if(!state.deckOverlay)return;
    const layers=[...(state.staticDeckLayers||[]),...buildPlaybackLayers()];
    state.deckOverlay.setProps({layers});
  }
  
  function updateDeckDotTrace(){
    if(!state.deckOverlay||!globalThis.deck)return;
  
    // Playback is deliberately a separate map mode. Static analytical dots and
    // PLM-loading points disappear; progressive speed trails + mining icons take over.
    if(state.playback.active){
      state.staticDeckLayers=[];
      applyDeckLayers();
      return;
    }
  
    const {dots,loading}=buildDeckDotData();
    const {min:radiusMinPixels,max:radiusMaxPixels}=dotRadiusForCount(dots.length);
    const layers=[];
  
    if(state.visible.trace){
      layers.push(new deck.ScatterplotLayer({
        id:'cycle-v3-dot-trace',
        data:dots,
        getPosition:d=>d.position,
        getFillColor:d=>d.color,
        radiusUnits:'pixels',
        getRadius:1,
        radiusMinPixels,
        radiusMaxPixels,
        stroked:false,
        filled:true,
        opacity:.92,
        pickable:state.tool==='pan',
        onClick:info=>{
          if(state.tool!=='pan'||!info?.object||!info.coordinate)return;
          new maplibregl.Popup({closeButton:false,offset:8})
            .setLngLat(info.coordinate)
            .setHTML(`<strong>${info.object.unitNo}</strong><br><span style="font-size:11px;color:#667085">${fmt(info.object.speed,1)} km/h · dot trace</span>`)
            .addTo(state.mapRoot);
        }
      }));
    }
  
    if(state.visible.loading){
      layers.push(new deck.ScatterplotLayer({
        id:'cycle-v3-plm-loading',
        data:loading,
        getPosition:d=>d.position,
        getFillColor:[39,54,74,220],
        radiusUnits:'pixels',
        getRadius:1,
        radiusMinPixels:2.4,
        radiusMaxPixels:5,
        stroked:true,
        getLineColor:[255,255,255,220],
        lineWidthUnits:'pixels',
        getLineWidth:.6,
        pickable:false
      }));
    }
  
    state.staticDeckLayers=layers;
    applyDeckLayers();
  }
  
  function ensureMapLayers(){
    const map=state.mapRoot;
    if(!map||!state._mapReady)return;
  
    const ortho=latestOrtho(),e=ortho?extent(ortho):null;
    if(ortho&&!map.getSource('ortho-src')){
      map.addSource('ortho-src',{
        type:'raster',
        tiles:[`${RAW}/public${ortho.localTileUrl}`],
        tileSize:256,
        minzoom:0,
        maxzoom:ortho.maxZoom||15,
        ...(e?{bounds:e}:{}),
        attribution:''
      });
      map.addLayer({
        id:'ortho-layer',type:'raster',source:'ortho-src',
        paint:{'raster-opacity':1,'raster-fade-duration':0,'raster-resampling':'linear'}
      });
    }
  
    if(!map.getSource('roads-src')){
      map.addSource('roads-src',{type:'geojson',data:state.roads||emptyFC()});
      map.addLayer({id:'roads-layer',type:'line',source:'roads-src',paint:{'line-color':'#7d8997','line-width':1.5,'line-opacity':.82}});
    }
    if(!map.getSource('boundary-src')){
      map.addSource('boundary-src',{type:'geojson',data:state.boundary||emptyFC()});
      map.addLayer({id:'boundary-layer',type:'line',source:'boundary-src',paint:{'line-color':'#c97b37','line-width':2,'line-dasharray':[4,3]}});
    }
    if(!map.getSource('loader-src')){
      map.addSource('loader-src',{type:'geojson',data:emptyFC()});
      map.addLayer({
        id:'loader-layer',type:'circle',source:'loader-src',
        paint:{
          'circle-radius':['case',['==',['get','focused'],1],15,11],
          'circle-color':'rgba(40,124,148,.14)',
          'circle-stroke-width':['case',['==',['get','focused'],1],3,1.5],
          'circle-stroke-color':'#287c94'
        }
      });
    }
    if(!map.getSource('measure-src')){
      map.addSource('measure-src',{type:'geojson',data:emptyFC()});
      map.addLayer({id:'measure-layer',type:'line',source:'measure-src',paint:{'line-color':'#287c94','line-width':3}});
      map.addLayer({id:'measure-point-layer',type:'circle',source:'measure-src',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':4,'circle-color':'#287c94','circle-stroke-width':2,'circle-stroke-color':'#fff'}});
    }
    if(!map.getSource('draw-src')){
      map.addSource('draw-src',{type:'geojson',data:emptyFC()});
      map.addLayer({id:'draw-fill-layer',type:'fill',source:'draw-src',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#287c94','fill-opacity':.13}});
      map.addLayer({id:'draw-line-layer',type:'line',source:'draw-src',paint:{'line-color':'#287c94','line-width':2.5,'line-dasharray':[3,2]}});
      map.addLayer({id:'draw-point-layer',type:'circle',source:'draw-src',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':4,'circle-color':'#287c94','circle-stroke-width':2,'circle-stroke-color':'#fff'}});
    }
  
    if(!map.getSource('speed-segment-src')){
      map.addSource('speed-segment-src',{type:'geojson',data:emptyFC()});
  
      map.addLayer({
        id:'speed-segment-fill',type:'fill',source:'speed-segment-src',
        paint:{
          'fill-color':[
            'case',
            ['==',['get','selected'],1],'#287c94',
            ['==',['get','conflict'],1],'#f79009',
            ['==',['get','reviewed'],1],'#287c94',
            ['==',['get','change'],'Speed Review'],'#d48a47',
            ['==',['get','change'],'No Recent Coverage'],'#98a2b3',
            ['==',['get','change'],'New Segment'],'#7b61a8',
            '#287c94'
          ],
          'fill-opacity':[
            'case',
            ['==',['get','selected'],1],.24,
            ['==',['get','reviewed'],1],.11,
            .065
          ]
        }
      });
  
      map.addLayer({
        id:'speed-segment-casing',type:'line',source:'speed-segment-src',
        paint:{
          'line-color':'rgba(255,255,255,.94)',
          'line-width':['case',['==',['get','selected'],1],5,3],
          'line-opacity':.96
        }
      });
  
      map.addLayer({
        id:'speed-segment-layer',type:'line',source:'speed-segment-src',
        paint:{
          'line-color':[
            'case',
            ['==',['get','selected'],1],'#172033',
            ['==',['get','conflict'],1],'#f79009',
            ['==',['get','reviewed'],1],'#287c94',
            ['==',['get','change'],'Speed Review'],'#d48a47',
            ['==',['get','change'],'No Recent Coverage'],'#98a2b3',
            ['==',['get','change'],'New Segment'],'#7b61a8',
            '#287c94'
          ],
          'line-width':['case',['==',['get','selected'],1],3,1.6],
          'line-opacity':['case',['==',['get','coverage'],0],.55,.92]
        }
      });
  
      map.addLayer({
        id:'speed-segment-label',type:'symbol',source:'speed-segment-src',
        minzoom:14,
        layout:{
          'text-field':['get','segmentId'],
          'text-size':10,
          'text-font':['Open Sans Semibold','Arial Unicode MS Bold'],
          'text-allow-overlap':false,
          'text-ignore-placement':false
        },
        paint:{
          'text-color':'#172033',
          'text-halo-color':'rgba(255,255,255,.95)',
          'text-halo-width':1.5
        }
      });
  
      map.on('mouseenter','speed-segment-fill',()=>{map.getCanvas().style.cursor='pointer'});
      map.on('mouseleave','speed-segment-fill',()=>{map.getCanvas().style.cursor=''});
      map.on('click','speed-segment-fill',e=>{
        if(state.analysisMode!=='speed'||!e.features?.length)return;
        const id=e.features[0].properties?.segmentId;
        if(!id)return;
        if(e.originalEvent?.shiftKey){
          const next=new Set(state.speedAnalysis.selectedSegments);
          if(next.has(id))next.delete(id);else next.add(id);
          selectSpeedSegments(next,false,'map-shift');
        }else{
          selectSpeedSegments(new Set([id]),true,'map');
        }
      });
    }
    if(!map.getSource('speed-suggest-route-src')){
      map.addSource('speed-suggest-route-src',{type:'geojson',data:emptyFC()});
      map.addLayer({
        id:'speed-suggest-route-layer',type:'line',source:'speed-suggest-route-src',
        paint:{
          'line-color':'#172033',
          'line-width':1.2,
          'line-dasharray':[3,3],
          'line-opacity':.42
        }
      });
    }
    if(!map.getSource('speed-uncovered-src')){
      map.addSource('speed-uncovered-src',{type:'geojson',data:emptyFC()});
      map.addLayer({
        id:'speed-uncovered-layer',type:'circle',source:'speed-uncovered-src',
        paint:{
          'circle-radius':['interpolate',['linear'],['zoom'],10,2,16,4],
          'circle-color':'#d92d20','circle-opacity':.86,
          'circle-stroke-width':1,'circle-stroke-color':'rgba(255,255,255,.92)'
        }
      });
    }
    if(!map.getSource('speed-overlap-alt-src')){
      map.addSource('speed-overlap-alt-src',{type:'geojson',data:emptyFC()});
      map.addLayer({
        id:'speed-overlap-alt-fill',type:'fill',source:'speed-overlap-alt-src',
        paint:{'fill-color':'#f79009','fill-opacity':.10}
      });
      map.addLayer({
        id:'speed-overlap-alt-line',type:'line',source:'speed-overlap-alt-src',
        paint:{'line-color':'#f79009','line-width':2,'line-dasharray':[2,2],'line-opacity':.86}
      });
    }
  }
  function updateMeasureLayer(){
    if(!state._mapReady)return;
    const features=state.measurePoints.map(p=>({type:'Feature',properties:{},geometry:{type:'Point',coordinates:p}}));
    if(state.measurePoints.length>=2){
      features.unshift({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:state.measurePoints}});
    }
    mapSourceSet('measure-src',{type:'FeatureCollection',features});
  }
  function updateDrawLayer(){
    if(!state._mapReady)return;
    state.drawPoints=state.drawPoints||[];
    const features=state.drawPoints.map(p=>({type:'Feature',properties:{},geometry:{type:'Point',coordinates:p}}));
    if(state.drawPoints.length>=2){
      features.unshift({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:state.drawPoints}});
    }
    if(state.drawClosed&&state.drawPoints.length>=3){
      const ring=[...state.drawPoints,state.drawPoints[0]];
      features.unshift({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ring]}});
    }
    mapSourceSet('draw-src',{type:'FeatureCollection',features});
  }
  function updateMapStatus(viewState=state.view){
    $('mapStatus').textContent=`z${Number(viewState?.zoom||0).toFixed(1)} · ${Number(viewState?.latitude||0).toFixed(5)}, ${Number(viewState?.longitude||0).toFixed(5)} · ${fmtInt(state.mapSampleCount)} sampel`;
  }
  function renderReactMap(camera=null){
    const map=state.mapRoot;
    if(!map||!state._mapReady)return;
    ensureMapLayers();
  
    mapSourceSet('roads-src',state.roads||emptyFC());
    mapSourceSet('boundary-src',state.boundary||emptyFC());
  
    const loaderFeatures=loaderPerformanceRows().map(({entry,rows})=>{
      const cr=centerRadius(rows.flatMap(r=>r.loadingPts));
      if(!cr.c)return null;
      return{
        type:'Feature',
        properties:{loader:entry.loader,focused:entry.loader===state.focusedLoader?1:0},
        geometry:{type:'Point',coordinates:cr.c}
      };
    }).filter(Boolean);
    mapSourceSet('loader-src',{type:'FeatureCollection',features:loaderFeatures});
  
    updateMeasureLayer();
    updateDrawLayer();
    updateDeckDotTrace();
  
    mapVisibility('ortho-layer',state.visible.ortho);
    mapVisibility('roads-layer',state.visible.roads);
    mapVisibility('boundary-layer',state.visible.boundary);
    mapVisibility('loader-layer',true);
    if(state.analysisMode==='speed'||state.analysisMode==='gis'){
      renderSpeedMapLayer();
      mapVisibility('speed-segment-fill',true);
      mapVisibility('speed-segment-casing',true);
      mapVisibility('speed-segment-layer',true);
      mapVisibility('speed-segment-label',true);
      mapVisibility('speed-suggest-route-layer',true);
      mapVisibility('speed-uncovered-layer',true);
      mapVisibility('speed-overlap-alt-fill',Boolean(state.speedAnalysis.showOverlapAlternatives));
      mapVisibility('speed-overlap-alt-line',Boolean(state.speedAnalysis.showOverlapAlternatives));
      mapVisibility('loader-layer',state.analysisMode==='gis'&&Boolean(state.gisWorkspace?.layers?.loader));
    }else{
      mapSourceSet('speed-segment-src',emptyFC());
      mapVisibility('speed-segment-fill',false);
      mapVisibility('speed-segment-casing',false);
      mapVisibility('speed-segment-layer',false);
      mapVisibility('speed-segment-label',false);
      mapVisibility('speed-suggest-route-layer',false);
      mapVisibility('speed-uncovered-layer',false);
      mapVisibility('speed-overlap-alt-fill',false);
      mapVisibility('speed-overlap-alt-line',false);
    }
  
    if(camera&&Number.isFinite(camera.longitude)&&Number.isFinite(camera.latitude)){
      map.easeTo({
        center:[camera.longitude,camera.latitude],
        zoom:Number.isFinite(camera.zoom)?camera.zoom:map.getZoom(),
        bearing:Number.isFinite(camera.bearing)?camera.bearing:map.getBearing(),
        pitch:Number.isFinite(camera.pitch)?camera.pitch:map.getPitch(),
        duration:Number(camera.transitionDuration||0)
      });
    }
  }
  function refreshMap(){renderReactMap()}
  function refresh(){if(state.analysisMode==='speed')return refreshSpeedAnalysis();updateMetrics();renderTable();renderTrend();refreshMap()}
  function currentDockPadding(){
    const dock=document.getElementById('analysisDock');
    const mapEl=$('deck-map');
    if(!dock||!mapEl)return 48;
    const mh=mapEl.getBoundingClientRect().height||600;
    if(dock.classList.contains('state-collapsed'))return 58;
    return Math.min(Math.round(mh*.64),Math.round(dock.getBoundingClientRect().height+22));
  }
  function fitData(){
    if(state.analysisMode==='speed'&&activeSpeedSegments().length){
      const ids=state.speedAnalysis.selectedSegments.size
        ?new Set(state.speedAnalysis.selectedSegments)
        :new Set(activeSpeedSegments().map(s=>s.id));
      return fitSpeedSegments(ids);
    }
    const map=state.mapRoot;
    if(!map||!state._mapReady)return;
    const pts=focusedRows().flatMap(r=>r.points.filter((_,i)=>i%Math.max(8,Math.ceil(r.points.length/500))===0).map(p=>p.position));
    let bounds=null;
    if(pts.length){
      let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
      pts.forEach(([x,y])=>{if(Number.isFinite(x)&&Number.isFinite(y)){a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y)}});
      if([a,b,c,d].every(Number.isFinite))bounds=[[a,b],[c,d]];
    }else{
      const o=latestOrtho(),e=o?extent(o):null;
      if(e)bounds=[[e[0],e[1]],[e[2],e[3]]];
    }
    if(!bounds)return;
    map.fitBounds(bounds,{
      padding:{top:26,right:55,bottom:currentDockPadding(),left:28},
      duration:520,maxZoom:17
    });
  }
  
  
  
  /* ========================================================================
     SPEED ANALYSIS — shared workspace mode
     Business contract:
     - primary object = road segment
     - existing engineering Speed Plan is global/context-level
     - this mode refines it into reviewed per-segment plans
     - telemetry = evidence, never direct authoritative mutation
     - geometry changes are handed to GIS
     ======================================================================== */
  
  const SPEED_CHANGE_LABELS={
    Suggested:'Suggested',
    'Speed Review':'Speed Review',
    'No Recent Coverage':'No Recent Coverage',
    Unchanged:'Unchanged',
    'Boundary Change':'Boundary Change',
    'New Segment':'New Segment'
  };
  
  function getGlobalSpeedPlan(){
    const f=state.fixture||{};
    const candidates=[
      f?.targetSpeedData?.targetSpeed,
      f?.targetSpeedData?.speedPlan,
      f?.targetSpeed,
      f?.speedPlan
    ];
    for(const value of candidates){
      const n=Number(value);
      if(Number.isFinite(n)&&n>0)return n;
    }
    return NaN;
  }
  
  function roundSuggestedSpeed(value){
    if(!Number.isFinite(value)||value<=0)return NaN;
    // Prototype suggestion heuristic only. Final engineering algorithm remains
    // replaceable. It deliberately produces a human-reviewable 5 km/h bucket.
    return Math.max(5,Math.round(value/5)*5);
  }
  
  function metersBetween(a,b){
    return hav(a[0],a[1],b[0],b[1])*1000;
  }
  
  function lineDistanceKm(path){
    let total=0;
    for(let i=1;i<path.length;i++){
      const d=hav(path[i-1][0],path[i-1][1],path[i][0],path[i][1]);
      if(Number.isFinite(d)&&d<2)total+=d;
    }
    return total;
  }
  
  function pointToSegmentMeters(p,a,b){
    // Local equirectangular projection is sufficient for sub-km segment matching.
    const lat0=(p[1]+a[1]+b[1])/3*Math.PI/180;
    const sx=111320*Math.cos(lat0),sy=110540;
    const px=p[0]*sx,py=p[1]*sy,ax=a[0]*sx,ay=a[1]*sy,bx=b[0]*sx,by=b[1]*sy;
    const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay;
    const vv=vx*vx+vy*vy||1;
    const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/vv));
    return Math.hypot(px-(ax+t*vx),py-(ay+t*vy));
  }
  
  function pointToPathMeters(position,path){
    if(!path?.length)return Infinity;
    if(path.length===1)return metersBetween(position,path[0]);
    let best=Infinity;
    for(let i=1;i<path.length;i++){
      best=Math.min(best,pointToSegmentMeters(position,path[i-1],path[i]));
    }
    return best;
  }
  
  function representativeSpeedRoute(){
    const candidates=rows()
      .map(r=>({
        unitNo:r.unitNo,
        loaded:(r.points||[]).filter(p=>p.status===4||p.status===5),
        empty:(r.points||[]).filter(p=>p.status===2),
        all:r.points||[]
      }))
      .sort((a,b)=>Math.max(b.loaded.length,b.empty.length,b.all.length)-Math.max(a.loaded.length,a.empty.length,a.all.length));
  
    if(!candidates.length)return[];
    const c=candidates[0];
    const source=c.loaded.length>120?c.loaded:(c.empty.length>120?c.empty:c.all);
    if(source.length<2)return[];
  
    const out=[];
    const stride=Math.max(1,Math.ceil(source.length/2500));
    for(let i=0;i<source.length;i+=stride){
      const pos=source[i]?.position;
      if(!pos||!pos.every(Number.isFinite))continue;
      if(out.length&&metersBetween(out[out.length-1],pos)<8)continue;
      if(out.length&&metersBetween(out[out.length-1],pos)>1200)continue;
      out.push(pos);
    }
    return out;
  }
  
  function splitRouteIntoSuggestedSegments(path,targetMeters=650){
    const chunks=[];
    if(path.length<2)return chunks;
    let current=[path[0]],distance=0;
  
    for(let i=1;i<path.length;i++){
      const d=metersBetween(path[i-1],path[i]);
      if(!Number.isFinite(d)||d>1200)continue;
      current.push(path[i]);
      distance+=d;
      if(distance>=targetMeters&&current.length>=3){
        chunks.push(current);
        current=[path[i]];
        distance=0;
      }
    }
    if(current.length>=3)chunks.push(current);
  
    // Keep prototype operational even on a very short trace.
    if(!chunks.length&&path.length>=2)chunks.push(path);
    return chunks.slice(0,36);
  }
  
  function speedSegmentBounds(path,padMeters=90){
    if(!path?.length)return null;
    let minLon=Infinity,minLat=Infinity,maxLon=-Infinity,maxLat=-Infinity;
    path.forEach(([lon,lat])=>{
      if(!Number.isFinite(lon)||!Number.isFinite(lat))return;
      minLon=Math.min(minLon,lon);minLat=Math.min(minLat,lat);
      maxLon=Math.max(maxLon,lon);maxLat=Math.max(maxLat,lat);
    });
    if(![minLon,minLat,maxLon,maxLat].every(Number.isFinite))return null;
    const midLat=(minLat+maxLat)/2*Math.PI/180;
    const dLat=padMeters/110540;
    const dLon=padMeters/(111320*Math.max(.2,Math.cos(midLat)));
    return[minLon-dLon,minLat-dLat,maxLon+dLon,maxLat+dLat];
  }
  
  function pointInsideBounds(pos,bounds){
    return !!bounds &&
      pos[0]>=bounds[0]&&pos[0]<=bounds[2]&&
      pos[1]>=bounds[1]&&pos[1]<=bounds[3];
  }
  
  function assignEvidenceToSegments(segments){
    if(!segments?.length)return;
  
    const MATCH_METERS=80;
    const meta=segments.map(seg=>({
      seg,
      bounds:speedSegmentBounds(seg.path,MATCH_METERS+20),
      byUnit:new Map(),
      sum:0,
      count:0
    }));
  
    // Reset evidence before the single-pass assignment.
    segments.forEach(seg=>{
      seg.avgActual=NaN;
      seg.samples=0;
      seg.units=[];
      seg.unitNos=[];
    });
  
    // Prototype optimization:
    // scan telemetry ONCE. A cheap bbox filter rejects almost all segments
    // before we run point-to-polyline distance.
    rows().forEach(r=>{
      const pts=r.points||[];
      const stride=Math.max(1,Math.ceil(pts.length/18000));
  
      for(let i=0;i<pts.length;i+=stride){
        const p=pts[i],pos=p?.position;
        if(!pos||!Number.isFinite(p.speed)||!Number.isFinite(pos[0])||!Number.isFinite(pos[1]))continue;
  
        let bestMeta=null,bestDist=Infinity;
        for(const m of meta){
          if(!pointInsideBounds(pos,m.bounds))continue;
          const dist=pointToPathMeters(pos,m.seg.path);
          if(dist<=MATCH_METERS&&dist<bestDist){
            bestDist=dist;
            bestMeta=m;
          }
        }
        if(!bestMeta)continue;
  
        bestMeta.sum+=p.speed;
        bestMeta.count++;
  
        let u=bestMeta.byUnit.get(r.unitNo);
        if(!u){
          u={unitNo:r.unitNo,sum:0,count:0};
          bestMeta.byUnit.set(r.unitNo,u);
        }
        u.sum+=p.speed;
        u.count++;
      }
    });
  
    meta.forEach(m=>{
      const seg=m.seg;
      seg.samples=m.count;
      seg.avgActual=m.count?m.sum/m.count:NaN;
      seg.units=[...m.byUnit.values()]
        .map(u=>({unitNo:u.unitNo,avgSpeed:u.count?u.sum/u.count:NaN,samples:u.count}))
        .sort((a,b)=>String(a.unitNo).localeCompare(String(b.unitNo)));
      seg.unitNos=seg.units.map(u=>u.unitNo);
    });
  }
  
  function speedEvidenceForGeometry(path){
    // Kept only for small one-off geometry checks.
    const temp={path};
    assignEvidenceToSegments([temp]);
    return{
      avgActual:temp.avgActual,
      samples:temp.samples,
      units:temp.units||[],
      unitNos:temp.unitNos||[]
    };
  }
  
  function createInitialSpeedDraftLegacyV11(){
    const route=representativeSpeedRoute();
    const chunks=splitRouteIntoSuggestedSegments(route);
    const globalPlan=getGlobalSpeedPlan();
  
    const segments=chunks.map((path,i)=>({
      id:`SEG-${String(i+1).padStart(2,'0')}`,
      path,
      distanceKm:lineDistanceKm(path),
      currentPlan:Number.isFinite(globalPlan)?globalPlan:NaN,
      proposedPlan:NaN,
      suggestedPlan:NaN,
      avgActual:NaN,
      samples:0,
      units:[],
      unitNos:[],
      change:'Suggested',
      reviewed:false,
      source:'auto-suggest'
    }));
  
    assignEvidenceToSegments(segments);
    segments.forEach(seg=>{
      seg.suggestedPlan=roundSuggestedSpeed(seg.avgActual);
      seg.proposedPlan=seg.suggestedPlan;
    });
  
    state.speedAnalysis.generation+=1;
    state.speedAnalysis.draft={
      version:1,
      createdAt:Date.now(),
      telemetryStart:state.start,
      telemetryEnd:state.end,
      segments
    };
    state.speedAnalysis.selectedSegments.clear();
    state.speedAnalysis.expandedSegments.clear();
    state.speedAnalysis.editedSegments.clear();
  }
  
  function refreshDraftEvidence(){
    const draft=state.speedAnalysis.draft;
    if(!draft)return;
    draft.telemetryStart=state.start;
    draft.telemetryEnd=state.end;
  
    assignEvidenceToSegments(draft.segments);
  
    draft.segments.forEach(seg=>{
      seg.suggestedPlan=roundSuggestedSpeed(seg.avgActual);
  
      if(!state.speedAnalysis.active){
        if(!state.speedAnalysis.editedSegments.has(seg.id)){
          seg.proposedPlan=seg.suggestedPlan;
        }
        seg.change='Suggested';
        return;
      }
  
      if(seg.source==='auto-suggest-new-route'){
        seg.change=seg.samples>0?'New Segment':'No Recent Coverage';
        if(!state.speedAnalysis.editedSegments.has(seg.id)){
          seg.proposedPlan=seg.suggestedPlan;
        }
      }else if(seg.samples===0){
        seg.change='No Recent Coverage';
        seg.suggestedPlan=NaN;
        if(!state.speedAnalysis.editedSegments.has(seg.id)){
          seg.proposedPlan=seg.currentPlan;
        }
      }else if(Number.isFinite(seg.suggestedPlan)&&Number.isFinite(seg.currentPlan)&&seg.suggestedPlan!==seg.currentPlan){
        seg.change='Speed Review';
        if(!state.speedAnalysis.editedSegments.has(seg.id)){
          seg.proposedPlan=seg.suggestedPlan;
        }
      }else{
        seg.change='Unchanged';
        if(!state.speedAnalysis.editedSegments.has(seg.id)){
          seg.proposedPlan=seg.currentPlan;
        }
      }
    });
  }
  
  function detectNewSpeedSegments(activeSegments){
    const route=representativeSpeedRoute();
    if(route.length<3||!activeSegments?.length)return[];
  
    const thresholdMeters=105;
    const groups=[];
    let current=[];
  
    // This pass only compares route points to ACTIVE segment geometry.
    // Route is already down-sampled heavily by representativeSpeedRoute().
    route.forEach(pos=>{
      let nearest=Infinity;
      for(const seg of activeSegments){
        const bounds=seg._speedBounds||(seg._speedBounds=speedSegmentBounds(seg.path,thresholdMeters+30));
        if(!pointInsideBounds(pos,bounds))continue;
        nearest=Math.min(nearest,pointToPathMeters(pos,seg.path));
      }
  
      if(nearest>thresholdMeters){
        if(current.length&&metersBetween(current[current.length-1],pos)>350){
          if(current.length>=4)groups.push(current);
          current=[pos];
        }else{
          current.push(pos);
        }
      }else{
        if(current.length>=4)groups.push(current);
        current=[];
      }
    });
    if(current.length>=4)groups.push(current);
  
    const existingIds=new Set(activeSegments.map(s=>s.id));
    let seq=1;
    const nextId=()=>{
      let id;
      do{id=`NEW-${String(seq++).padStart(2,'0')}`}while(existingIds.has(id));
      return id;
    };
  
    const proposed=groups
      .flatMap(group=>splitRouteIntoSuggestedSegments(group,650))
      .map(path=>({
        id:nextId(),
        path,
        distanceKm:lineDistanceKm(path),
        currentPlan:NaN,
        proposedPlan:NaN,
        suggestedPlan:NaN,
        avgActual:NaN,
        samples:0,
        units:[],
        unitNos:[],
        change:'New Segment',
        reviewed:false,
        source:'auto-suggest-new-route'
      }))
      .filter(seg=>seg.distanceKm>.08);
  
    if(!proposed.length)return[];
    assignEvidenceToSegments(proposed);
    proposed.forEach(seg=>{
      seg.suggestedPlan=roundSuggestedSpeed(seg.avgActual);
      seg.proposedPlan=seg.suggestedPlan;
    });
    return proposed.filter(seg=>seg.samples>0);
  }
  
  function buildReviewDraftFromActive(){
    const active=state.speedAnalysis.active;
    if(!active){createInitialSpeedDraft();return}
  
    const segments=active.segments.map(seg=>({
      ...seg,
      path:seg.path.map(p=>[...p]),
      units:[],
      unitNos:[],
      currentPlan:seg.approvedPlan,
      proposedPlan:seg.approvedPlan,
      suggestedPlan:NaN,
      avgActual:NaN,
      samples:0,
      change:'Unchanged',
      reviewed:false
    }));
  
    // Telemetry outside current ACTIVE geometry becomes a review-only proposal.
    // It never mutates the active layer automatically.
    segments.push(...detectNewSpeedSegments(active.segments));
  
    state.speedAnalysis.draft={
      version:active.version+1,
      createdAt:Date.now(),
      telemetryStart:state.start,
      telemetryEnd:state.end,
      segments,
      _evidenceKey:speedEvidenceKey()
    };
    state.speedAnalysis.selectedSegments.clear();
    state.speedAnalysis.expandedSegments.clear();
    state.speedAnalysis.editedSegments.clear();
    refreshDraftEvidence();
  }
  
  function speedEvidenceKey(){
    return `${state.start}|${state.end}|${state.interval}|${state.selectedUnits.size}`;
  }
  
  function ensureSpeedAnalysis(){
    const key=speedEvidenceKey();
    if(state.speedAnalysis.draft){
      if(state.speedAnalysis.draft._evidenceKey!==key){
        refreshDraftEvidence();
        state.speedAnalysis.draft._evidenceKey=key;
      }
      return;
    }
    if(state.speedAnalysis.active){
      return;
    }
    createInitialSpeedDraft();
    if(state.speedAnalysis.draft)state.speedAnalysis.draft._evidenceKey=key;
  }
  
  function activeSpeedSegments(){
    return state.speedAnalysis.draft?.segments||state.speedAnalysis.active?.segments||[];
  }
  
  function speedStatusClass(change=''){
    return change.toLowerCase().replace(/\s+/g,'-');
  }
  
  function speedSegmentFeatures(){
    return activeSpeedSegments().map(seg=>({
      type:'Feature',
      properties:{
        segmentId:seg.id,
        change:seg.change||'Unchanged',
        coverage:seg.samples>0?1:0,
        selected:state.speedAnalysis.selectedSegments.has(seg.id)?1:0,
        speedPlan:Number.isFinite(seg.proposedPlan)?seg.proposedPlan:null,
        actual:Number.isFinite(seg.avgActual)?seg.avgActual:null
      },
      geometry:{type:'LineString',coordinates:seg.path}
    }));
  }
  
  function renderSpeedMapLayer(){
    if(!state._mapReady)return;
    mapSourceSet('speed-segment-src',{type:'FeatureCollection',features:speedSegmentFeatures()});
  }
  
  function selectedSpeedSegment(){
    if(state.speedAnalysis.selectedSegments.size!==1)return null;
    const id=[...state.speedAnalysis.selectedSegments][0];
    return activeSpeedSegments().find(s=>s.id===id)||null;
  }
  
  function fitSpeedSegments(ids=state.speedAnalysis.selectedSegments){
    const map=state.mapRoot;
    if(!map||!state._mapReady)return;
    const selected=activeSpeedSegments().filter(s=>ids.has(s.id));
    if(!selected.length)return;
  
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    selected.flatMap(s=>s.path).forEach(([x,y])=>{
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    });
    if(![minX,minY,maxX,maxY].every(Number.isFinite))return;
    map.fitBounds([[minX,minY],[maxX,maxY]],{
      padding:{top:70,right:70,bottom:currentDockPadding(),left:70},
      maxZoom:17.8,duration:560
    });
  }
  
  function updateSpeedSelectionDerivedUnits(){
    const selected=activeSpeedSegments().filter(s=>state.speedAnalysis.selectedSegments.has(s.id));
    state.mapSelectedUnits=new Set(selected.flatMap(s=>s.unitNos||[]));
    updatePlaybackAction();
  }
  
  function selectSpeedSegments(ids,fit=false){
    if(state.playback.active)closePlayback();
    state.speedAnalysis.selectedSegments=new Set(ids);
    updateSpeedSelectionDerivedUnits();
    syncSpeedGridSelection();
    renderSpeedMapLayer();
    renderSpeedRibbon();
    if(fit)fitSpeedSegments(ids);
  }
  
  function speedRows(){
    const out=[];
    activeSpeedSegments().forEach(seg=>{
      if(!state.speedAnalysis.draft&&state.speedAnalysis.active&&Number.isFinite(seg.approvedPlan)){
        seg.proposedPlan=seg.approvedPlan;
      }
      out.push({
        id:`segment:${seg.id}`,
        rowType:'segment',
        segmentId:seg.id,
        label:seg.id,
        change:seg.change,
        speedPlan:seg.proposedPlan,
        suggested:seg.suggestedPlan,
        avgActual:seg.avgActual,
        distanceKm:seg.distanceKm,
        unitCount:seg.unitNos?.length||0,
        unitNos:seg.unitNos||[]
      });
      if(state.speedAnalysis.expandedSegments.has(seg.id)){
        (seg.units||[]).forEach(u=>out.push({
          id:`segment:${seg.id}:unit:${u.unitNo}`,
          rowType:'unitEvidence',
          segmentId:seg.id,
          label:u.unitNo,
          change:'',
          basis:'',
          speedPlan:null,
          suggested:null,
          avgActual:u.avgSpeed,
          distanceKm:null,
          unitCount:null,
          unitNo:u.unitNo,
          samples:u.samples
        }));
      }
    });
    return out;
  }
  
  function speedHierarchyRenderer(params){
    const d=params.data||{};
    const wrap=document.createElement('div');
    wrap.className='hier-cell';
  
    if(d.rowType==='segment'){
      const b=document.createElement('button');
      b.type='button';b.className='hier-toggle';
      b.textContent=state.speedAnalysis.expandedSegments.has(d.segmentId)?'▾':'▸';
      b.title=state.speedAnalysis.expandedSegments.has(d.segmentId)?'Tutup evidence unit':'Lihat evidence unit';
      b.addEventListener('click',e=>{
        e.stopPropagation();
        state.speedAnalysis.expandedSegments.has(d.segmentId)
          ?state.speedAnalysis.expandedSegments.delete(d.segmentId)
          :state.speedAnalysis.expandedSegments.add(d.segmentId);
        renderSpeedTable();
      });
      const s=document.createElement('span');s.className='hier-loader';s.textContent=d.label;
      wrap.append(b,s);
    }else{
      const s=document.createElement('span');s.className='speed-unit-label';s.textContent=d.label;
      wrap.append(s);
    }
    return wrap;
  }
  
  function speedStatusRenderer(params){
    const d=params.data||{};
    if(d.rowType!=='segment'||!d.change)return '';
    const span=document.createElement('span');
    span.className=`speed-status ${speedStatusClass(d.change)}`;
    span.textContent=d.change;
    return span;
  }
  
  function destroyPerformanceGridForModeSwitch(){
    if(state.gridApi){
      try{state.gridApi.destroy()}catch{}
      state.gridApi=null;
    }
    $('performanceGrid').innerHTML='';
  }
  
  function renderSpeedTable(){
    ensureSpeedAnalysis();
    const rowData=speedRows();
    $('perfTitle').textContent='Segment Performance';
    $('gridSearch').placeholder='Cari segment atau unit…';
  
    const numCell='perf-num-cell';
    const numHead='perf-num-header';
    const columnDefs=[
      {field:'label',headerName:'Segment / Unit',minWidth:190,flex:1.25,cellRenderer:speedHierarchyRenderer,suppressHeaderMenuButton:true},
      {field:'change',headerName:'Review',width:145,minWidth:135,cellRenderer:speedStatusRenderer,suppressHeaderMenuButton:true},
      {field:'speedPlan',headerName:'Speed Plan',width:110,minWidth:105,cellClass:`${numCell} speed-plan-cell`,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,0)} km/h`:'—',suppressHeaderMenuButton:true},
      {field:'suggested',headerName:'Suggested',width:108,minWidth:100,cellClass:`${numCell} speed-suggested-cell`,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,0)} km/h`:'—',suppressHeaderMenuButton:true},
      {field:'avgActual',headerName:'Avg Actual Speed',width:132,minWidth:124,cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,1)} km/h`:'—',suppressHeaderMenuButton:true},
      {field:'distanceKm',headerName:'Distance',width:100,minWidth:92,cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,2)} km`:'—',suppressHeaderMenuButton:true},
      {field:'unitCount',headerName:'Unit',width:76,minWidth:70,maxWidth:86,cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>p.value==null?'—':fmtInt(p.value),suppressHeaderMenuButton:true}
    ];
  
    if(!state.gridApi){
      if(!globalThis.agGrid?.createGrid){
        $('performanceGrid').innerHTML='<div class="small" style="padding:14px">Grid belum dapat dimuat.</div>';
        return;
      }
      const baseTheme=agGrid.themeQuartz||agGrid.themeBalham||agGrid.themeAlpine;
      const nativeTheme=baseTheme?.withParams?baseTheme.withParams({
        spacing:5,rowVerticalPaddingScale:.82,headerVerticalPaddingScale:.82,
        accentColor:'#287c94',backgroundColor:'#ffffff',foregroundColor:'#172033',
        headerBackgroundColor:'#f7f9fb',headerTextColor:'#475467',borderColor:'#dfe3e8',
        rowHoverColor:'#f6fafb',selectedRowBackgroundColor:'#edf7f9',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize:12
      }):baseTheme;
  
      state.gridApi=agGrid.createGrid($('performanceGrid'),{
        theme:nativeTheme,rowData,columnDefs,getRowId:p=>p.data.id,
        rowHeight:34,headerHeight:36,
        defaultColDef:{sortable:true,resizable:true,suppressHeaderMenuButton:true},
        rowSelection:{mode:'multiRow',checkboxes:p=>p.node?.data?.rowType==='segment',headerCheckbox:true,enableClickSelection:false},
        isRowSelectable:node=>node.data?.rowType==='segment',
        selectionColumnDef:{pinned:'left',width:44,minWidth:44,maxWidth:44,resizable:false,sortable:false,suppressHeaderMenuButton:true},
        getRowClass:p=>p.data?.rowType==='segment'?'speed-segment-row':'speed-unit-row',
        onRowSelected:handleGridRowSelected,
        suppressCellFocus:false,animateRows:false
      });
      if($('gridSearch').dataset.speedSearchBound!=='1'){
        $('gridSearch').dataset.speedSearchBound='1';
        $('gridSearch').addEventListener('input',e=>{
          state.gridApi?.setGridOption('quickFilterText',e.target.value||'');
        });
      }
  
    }else{
      state.gridApi.setGridOption('columnDefs',columnDefs);
      state.gridApi.setGridOption('rowData',rowData);
    }
  
    requestAnimationFrame(()=>{
      syncSpeedGridSelection();
      try{state.gridApi?.refreshCells?.({force:true});state.gridApi?.redrawRows?.()}catch{}
    });
  }
  
  let pendingSpeedSegments=null;
  let speedSelectionFlushTimer=null;
  
  function syncSpeedGridSelection(){
    renderSpeedHandoffTrayV16();
    if(!state.gridApi)return;
    state.syncGridSelection=true;
    state.gridApi.forEachNode(node=>{
      if(node.data?.rowType!=='segment')return;
      node.setSelected(state.speedAnalysis.selectedSegments.has(node.data.segmentId),false,'sync-speed');
    });
    state.syncGridSelection=false;
  
    const segN=state.speedAnalysis.selectedSegments.size;
    const unitN=state.mapSelectedUnits.size;
    $('gridSelectionCount').textContent=segN
      ?`${segN} segment · ${unitN} unit evidence`
      :'0 segment dipilih';
  
    $('speedMarkReviewedBtn').classList.toggle('hidden',segN!==1||!state.speedAnalysis.draft);
    $('speedEditPlanBtn').classList.toggle('hidden',segN!==1||!state.speedAnalysis.draft);
    $('speedOpenGisBtn').classList.toggle('hidden',segN!==1);
    updatePlaybackAction();
  }
  
  function handleSpeedGridRowSelected(event){
    if(state.syncGridSelection)return;
    const d=event.data;
    if(!d||d.rowType!=='segment')return;
  
    if(!pendingSpeedSegments)pendingSpeedSegments=new Set(state.speedAnalysis.selectedSegments);
    event.node.isSelected()?pendingSpeedSegments.add(d.segmentId):pendingSpeedSegments.delete(d.segmentId);
  
    clearTimeout(speedSelectionFlushTimer);
    speedSelectionFlushTimer=setTimeout(()=>{
      const ids=new Set(pendingSpeedSegments||[]);
      pendingSpeedSegments=null;
      speedSelectionFlushTimer=null;
      selectSpeedSegments(ids,true);
    },0);
  }
  
  function updateSpeedMetrics(){
    ensureSpeedAnalysis();
    const segments=activeSpeedSegments();
    const totalDistance=segments.reduce((s,x)=>s+(Number.isFinite(x.distanceKm)?x.distanceKm:0),0);
    const actuals=segments.map(s=>s.avgActual).filter(Number.isFinite);
    const plans=segments.map(s=>s.proposedPlan).filter(Number.isFinite);
    const reviewed=segments.filter(s=>s.reviewed||state.speedAnalysis.editedSegments.has(s.id)).length;
    const evidenceUnits=new Set(segments.flatMap(s=>s.unitNos||[]));
  
    $('kUnits').textContent='Total Segment';
    $('mUnits').textContent=fmtInt(segments.length);
    $('kRitase').textContent='Global Speed Plan';
    $('mRitase').textContent=Number.isFinite(getGlobalSpeedPlan())?`${fmt(getGlobalSpeedPlan(),0)} km/h`:'—';
    $('kCycle').textContent='Avg Actual Speed';
    $('mCycle').textContent=actuals.length?`${fmt(actuals.reduce((a,b)=>a+b,0)/actuals.length,1)} km/h`:'—';
    $('kLoaded').textContent='Avg Segment Plan';
    $('mLoaded').textContent=plans.length?`${fmt(plans.reduce((a,b)=>a+b,0)/plans.length,1)} km/h`:'—';
    $('kEmpty').textContent='Evidence Unit';
    $('mEmpty').textContent=fmtInt(evidenceUnits.size);
    $('kSpeed').textContent='Distance Analyzed';
    $('mSpeed').textContent=`${fmt(totalDistance,2)} km`;
  }
  
  function restoreCycleKpiLabels(){
    $('kUnits').textContent='Total Unit';
    $('kRitase').textContent='Total Ritase';
    $('kCycle').textContent='Avg Cycle Time';
    $('kLoaded').textContent='Avg Jarak Muatan';
    $('kEmpty').textContent='Avg Jarak Kosongan';
    $('kSpeed').textContent='Avg Actual Speed';
  }
  
  function renderSpeedRibbon(){
    ensureSpeedAnalysis();
    const draft=state.speedAnalysis.draft;
    const active=state.speedAnalysis.active;
    const segments=activeSpeedSegments();
    const actuals=segments.map(s=>s.avgActual).filter(Number.isFinite);
    const reviewed=segments.filter(s=>s.reviewed||state.speedAnalysis.editedSegments.has(s.id)).length;
    const changes=segments.reduce((m,s)=>(m[s.change]=(m[s.change]||0)+1,m),{});
  
    $('speedLayerState').textContent=draft
      ?`Review Draft v${draft.version}`
      :(active?`Active v${active.version}`:'Belum ada layer');
    $('speedReviewSummary').textContent=draft
      ?Object.entries(changes).map(([k,v])=>`${v} ${k}`).join(' · ')
      :'Tidak ada draft aktif';
  
    $('speedGlobalPlan').textContent=Number.isFinite(getGlobalSpeedPlan())?fmt(getGlobalSpeedPlan(),0):'—';
    $('speedAvgActual').textContent=actuals.length?fmt(actuals.reduce((a,b)=>a+b,0)/actuals.length,1):'—';
    $('speedSegmentCount').textContent=fmtInt(segments.length);
    $('speedReviewedCount').textContent=`${reviewed}/${segments.length}`;
  
    $('speedApplyDraftBtn').disabled=!draft;
    $('speedReevaluateBtn').textContent=active?'↻ Re-evaluate':'↻ Auto Suggest';
  }
  
  function configureTrendToolbarForSpeed(){
    const tb=document.querySelector('.trend-toolbar');
    if(!tb)return;
    tb.innerHTML=`
      <button class="metric-toggle active" type="button" data-speed-trend="actual">Avg Actual Speed</button>
      <button class="metric-toggle active" type="button" data-speed-trend="plan">Global Speed Plan</button>
    `;
  }
  
  function configureTrendToolbarForCycle(){
    const tb=document.querySelector('.trend-toolbar');
    if(!tb)return;
    tb.innerHTML=`
      <button class="metric-toggle active" type="button" data-trend="ritase">Ritase</button>
      <button class="metric-toggle active" type="button" data-trend="cycle">Avg Cycle Time</button>
      <button class="metric-toggle" type="button" data-trend="loadedDistance">Jarak Muatan</button>
      <button class="metric-toggle" type="button" data-trend="emptyDistance">Jarak Kosongan</button>
      <button class="metric-toggle" type="button" data-trend="speed">Actual Avg Speed</button>
      <button class="metric-toggle" type="button" data-trend="stop">Stop Muatan</button>
    `;
    bindTrendButtons();
  }
  
  function renderSpeedTrend(){
    configureTrendToolbarForSpeed();
    const svg=$('trendSvg');
    const buckets=(state.trendBuckets||[]).filter(b=>Number.isFinite(b.speed));
    $('trendEmpty').classList.toggle('hidden',buckets.length>0);
    $('trendContent').classList.toggle('hidden',!buckets.length);
    if(!buckets.length){svg.innerHTML='';return}
  
    const W=1200,H=220,padX=46,padY=30;
    const globalPlan=getGlobalSpeedPlan();
    const vals=buckets.map(b=>b.speed);
    if(Number.isFinite(globalPlan))vals.push(globalPlan);
    let min=Math.min(...vals),max=Math.max(...vals);
    if(max-min<5){min-=2.5;max+=2.5}else{min-=2;max+=2}
    const x=i=>padX+(W-padX*2)*(i/Math.max(1,buckets.length-1));
    const y=v=>H-padY-(H-padY*2)*((v-min)/(max-min||1));
    const path=buckets.map((b,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(b.speed).toFixed(1)}`).join(' ');
    const planLine=Number.isFinite(globalPlan)
      ?`<line x1="${padX}" y1="${y(globalPlan)}" x2="${W-padX}" y2="${y(globalPlan)}" stroke="#d48a47" stroke-width="2" stroke-dasharray="8 6"/>`
      :'';
  
    svg.innerHTML=`
      <g opacity=".55">
        ${[0,.25,.5,.75,1].map(r=>`<line x1="${padX}" y1="${padY+r*(H-padY*2)}" x2="${W-padX}" y2="${padY+r*(H-padY*2)}" stroke="#e7eaee" stroke-width="1"/>`).join('')}
      </g>
      ${planLine}
      <path d="${path}" fill="none" stroke="#287c94" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${buckets.map((b,i)=>`<circle cx="${x(i)}" cy="${y(b.speed)}" r="3" fill="#287c94"/>`).join('')}
    `;
  
    const avg=vals.filter(Number.isFinite).reduce((a,b)=>a+b,0)/vals.filter(Number.isFinite).length;
    $('trendValue').textContent=`${fmt(avg,1)} km/h`;
    $('trendTime').textContent='Actual speed per jam';
    $('trendLegend').innerHTML=`
      <span><i style="background:#287c94"></i>Avg Actual Speed</span>
      ${Number.isFinite(globalPlan)?'<span><i style="background:#d48a47"></i>Global Speed Plan</span>':''}
    `;
    $('trendWindowLabel').textContent='Telemetry window aktif';
  }
  
  function refreshSpeedAnalysis(){
    ensureSpeedAnalysis();
    updateSpeedMetrics();
    renderSpeedRibbon();
    renderSpeedTable();
    renderSpeedTrend();
    refreshMap();
  }
  
  async function setAnalysisMode(mode){
    if(mode===state.analysisMode)return;
    if(state.playback.active)closePlayback();
  
    state.analysisMode=mode;
    document.querySelectorAll('[data-analysis-mode]').forEach(b=>b.classList.toggle('active',b.dataset.analysisMode===mode));
    const shell=document.querySelector('.map-shell');
  
    if(mode==='gis'){
      initializeGisWorkspaceV18();
      shell?.classList.remove('speed-mode');
      shell?.classList.add('gis-mode');
      document.body.classList.add('gis-workspace-mode');
      $('cycleAnalysisRibbon').classList.add('hidden');
      $('speedAnalysisRibbon').classList.add('hidden');
      $('speedGisHandoffModal').classList.remove('hidden');
      $('speedGroupWrap').classList.add('hidden');
      $('speedAssignRoadBtn').classList.add('hidden');
      $('speedMarkReviewedBtn').classList.add('hidden');
      $('speedEditPlanBtn').classList.add('hidden');
      $('speedOpenGisBtn').classList.add('hidden');
      prepareGisWorkspaceV18();
      requestAnimationFrame(()=>{
        state.mapRoot?.resize?.();
        refreshMap();
        fitGisSelectionV18();
      });
      return;
    }
  
    leaveGisWorkspaceV18();
    shell?.classList.remove('gis-mode');
    document.body.classList.remove('gis-workspace-mode');
    $('speedGisHandoffModal').classList.add('hidden');
  
    if(mode==='speed'){
      shell?.classList.add('speed-mode');
      $('cycleAnalysisRibbon').classList.add('hidden');
      $('speedAnalysisRibbon').classList.remove('hidden');
      $('speedGroupWrap').classList.remove('hidden');
      $('speedAssignRoadBtn').classList.add('hidden');
      $('speedMarkReviewedBtn').classList.add('hidden');
      $('speedEditPlanBtn').classList.add('hidden');
      $('speedOpenGisBtn').classList.add('hidden');
      document.querySelector('.trend-card .title').textContent='Trend Speed';
      const perfTab=document.querySelector('[data-dock-tab="performance"]');
      const trendTab=document.querySelector('[data-dock-tab="trend"]');
      if(perfTab)perfTab.textContent='Segment Performance';
      if(trendTab)trendTab.textContent='Trend Speed';
      state.mapSelectedUnits.clear();
      destroyPerformanceGridForModeSwitch();
  
      $('speedLayerState').textContent='Preparing…';
      $('speedReviewSummary').textContent='Menyusun segment dan evidence telemetry';
      $('speedAnalysisRibbon').classList.remove('hidden');
  
      const mask=$('loadingMask');
      const loadingTitle=mask?.querySelector('.title');
      if(mask){
        if(loadingTitle)loadingTitle.textContent='Menyiapkan Speed Analysis';
        $('loadingText').textContent='Membentuk segment dan evidence telemetry…';
        mask.classList.remove('hidden');
      }
  
      // Let the browser paint the mode switch before CPU work starts.
      await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  
      try{
        refreshSpeedAnalysis();
        fitData();
      }finally{
        mask?.classList.add('hidden');
        if(loadingTitle)loadingTitle.textContent='Memuat data Cycle Time';
        $('loadingText').textContent='Membaca fixture BRCB dan layer peta.';
      }
    }else{
      shell?.classList.remove('speed-mode');
      $('cycleAnalysisRibbon').classList.remove('hidden');
      $('speedAnalysisRibbon').classList.add('hidden');
      $('speedGroupWrap').classList.add('hidden');
      $('speedAssignRoadBtn').classList.add('hidden');
      $('speedMarkReviewedBtn').classList.add('hidden');
      $('speedEditPlanBtn').classList.add('hidden');
      $('speedOpenGisBtn').classList.add('hidden');
      document.querySelector('.trend-card .title').textContent='Trend Performa';
      const perfTab=document.querySelector('[data-dock-tab="performance"]');
      const trendTab=document.querySelector('[data-dock-tab="trend"]');
      if(perfTab)perfTab.textContent='Performance';
      if(trendTab)trendTab.textContent='Trend Performa';
      state.speedAnalysis.selectedSegments.clear();
      state.mapSelectedUnits.clear();
      destroyPerformanceGridForModeSwitch();
      configureTrendToolbarForCycle();
      restoreCycleKpiLabels();
      updateMetrics();
      renderTable();
      renderTrend();
      refreshMap();
      fitData();
    }
  }
  
  function applySpeedDraft(){
    const draft=state.speedAnalysis.draft;
    if(!draft)return;
  
    const previous=state.speedAnalysis.active;
    if(previous){
      state.speedAnalysis.history.unshift({...previous,isActive:false});
    }
  
    const approvedSegments=draft.segments.map(seg=>({
      ...seg,
      path:seg.path.map(p=>[...p]),
      approvedPlan:Number.isFinite(seg.proposedPlan)?seg.proposedPlan:seg.currentPlan,
      currentPlan:Number.isFinite(seg.proposedPlan)?seg.proposedPlan:seg.currentPlan,
      reviewed:true,
      change:'Unchanged'
    }));
  
    state.speedAnalysis.active={
      version:draft.version,
      appliedAt:Date.now(),
      telemetryStart:draft.telemetryStart,
      telemetryEnd:draft.telemetryEnd,
      segments:approvedSegments,
      isActive:true
    };
    state.speedAnalysis.draft=null;
    state.speedAnalysis.editedSegments.clear();
    state.speedAnalysis.selectedSegments.clear();
    state.mapSelectedUnits.clear();
  
    showSpeedNotice(`Active v${state.speedAnalysis.active.version} diterapkan. Versi sebelumnya tetap tersimpan di History.`);
    refreshSpeedAnalysis();
  }
  
  
  function markSelectedSpeedReviewed(){
    const seg=selectedSpeedSegment();
    if(!seg||!state.speedAnalysis.draft)return;
    seg.reviewed=true;
    showSpeedNotice(`${seg.id} ditandai reviewed. Nilai/geometry baru menjadi ACTIVE setelah Apply Draft.`);
    refreshSpeedAnalysis();
  }
  
  function openSpeedPlanEditor(){
    const seg=selectedSpeedSegment();
    if(!seg)return;
    $('speedPlanModalMeta').textContent=`${seg.id} · ${fmt(seg.distanceKm,2)} km · ${seg.unitNos.length} unit evidence`;
    $('speedPlanInput').value=Number.isFinite(seg.proposedPlan)?Math.round(seg.proposedPlan):'';
    $('speedPlanSuggested').textContent=Number.isFinite(seg.suggestedPlan)?`${fmt(seg.suggestedPlan,0)} km/h`:'—';
    $('speedPlanActual').textContent=Number.isFinite(seg.avgActual)?`${fmt(seg.avgActual,1)} km/h`:'—';
    $('speedPlanGlobalRef').textContent=Number.isFinite(getGlobalSpeedPlan())?`${fmt(getGlobalSpeedPlan(),0)} km/h`:'—';
    $('speedPlanModal').classList.remove('hidden');
  }
  
  function saveSpeedPlanEditor(){
    const seg=selectedSpeedSegment();
    if(!seg)return;
    const value=Number($('speedPlanInput').value);
    if(!Number.isFinite(value)||value<=0)return;
    seg.proposedPlan=value;
    seg.reviewed=true;
    state.speedAnalysis.editedSegments.add(seg.id);
    if(state.speedAnalysis.active&&seg.change==='Unchanged')seg.change='Speed Review';
    $('speedPlanModal').classList.add('hidden');
    refreshSpeedAnalysis();
  }
  
  function renderSpeedHistory(){
    const versions=[
      ...(state.speedAnalysis.active?[state.speedAnalysis.active]:[]),
      ...state.speedAnalysis.history
    ].sort((a,b)=>b.version-a.version);
  
    $('speedHistoryBody').innerHTML=versions.length
      ?versions.map(v=>`
        <div class="speed-history-item">
          <div>
            <div class="speed-history-version">v${v.version}</div>
            <div class="speed-history-meta">${v.appliedAt?new Date(v.appliedAt).toLocaleString('id-ID'):'—'}</div>
          </div>
          <div>
            <div class="speed-history-change">${v.segments.length} segment · telemetry ${displayRange(v.telemetryStart,v.telemetryEnd)}</div>
          </div>
          ${v.isActive?'<span class="speed-history-active">ACTIVE</span>':'<span></span>'}
        </div>
      `).join('')
      :'<div class="small" style="padding:12px 0">Belum ada versi yang di-Apply.</div>';
  }
  
  function showSpeedNotice(message){
    const el=$('speedNotice');
    el.textContent=message;
    el.classList.remove('hidden');
    clearTimeout(showSpeedNotice._timer);
    showSpeedNotice._timer=setTimeout(()=>el.classList.add('hidden'),3600);
  }
  
  function speedOpenInGis(){
    const seg=selectedSpeedSegment();
    if(!seg)return;
    showSpeedNotice(`Handoff GIS disiapkan: Speed Segments › ${seg.id} · viewport + telemetry context dipertahankan. Geometry editor belum diaktifkan di prototype ini.`);
  }
  
  
  /* ========================================================================
     V12 SPEED SEGMENT MODEL
     - polygon corridor is the authoritative visual/analysis shape
     - uploaded mh02geofencingsegment_DT.json is used as structural reference
     - first Auto Suggest starts Unassigned; Road Name is human/domain input
     - point-in-polygon assigns telemetry evidence to each segment
     ======================================================================== */
  
  function ensureSpeedV12State(){
    const s=state.speedAnalysis;
    if(!s.expandedGroups)s.expandedGroups=new Set();
    if(!s.groupBy)s.groupBy='none';
  }
  
  function referenceRoadBaseName(value=''){
    const text=String(value||'');
    const idx=text.lastIndexOf('-');
    return idx>0?text.slice(0,idx):text;
  }
  
  function referenceStaLabel(value=''){
    const text=String(value||'');
    const idx=text.lastIndexOf('-');
    return idx>=0?text.slice(idx+1):text;
  }
  
  function normalizePolygonRing(ring){
    const pts=(ring||[])
      .map(p=>[Number(p?.[0]),Number(p?.[1])])
      .filter(p=>p.every(Number.isFinite));
    if(pts.length<3)return[];
    const first=pts[0],last=pts[pts.length-1];
    if(first[0]!==last[0]||first[1]!==last[1])pts.push([...first]);
    return pts;
  }
  
  function polygonBounds(ring){
    const pts=ring||[];
    if(!pts.length)return null;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    pts.forEach(([x,y])=>{
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      minX=Math.min(minX,x);minY=Math.min(minY,y);
      maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    });
    return [minX,minY,maxX,maxY].every(Number.isFinite)?[minX,minY,maxX,maxY]:null;
  }
  
  function pointInPolygon(point,ring){
    const x=point?.[0],y=point?.[1];
    if(!Number.isFinite(x)||!Number.isFinite(y)||!ring?.length)return false;
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
      const intersect=((yi>y)!==(yj>y)) &&
        (x < (xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi);
      if(intersect)inside=!inside;
    }
    return inside;
  }
  
  function polygonCentroid(ring){
    const pts=(ring||[]).slice(0,-1);
    if(!pts.length)return null;
    const sum=pts.reduce((a,p)=>[a[0]+p[0],a[1]+p[1]],[0,0]);
    return [sum[0]/pts.length,sum[1]/pts.length];
  }
  
  function polygonSegmentLengthKm(ring){
    // For the reference quadrilateral, length is measured between the midpoint
    // of the two opposite cross-road edges. It is only a display estimate.
    const pts=(ring||[]).slice(0,-1);
    if(pts.length<4)return 0;
    const left=[(pts[0][0]+pts[3][0])/2,(pts[0][1]+pts[3][1])/2];
    const right=[(pts[1][0]+pts[2][0])/2,(pts[1][1]+pts[2][1])/2];
    return hav(left[0],left[1],right[0],right[1]);
  }
  
  function polygonCenterline(ring){
    const pts=(ring||[]).slice(0,-1);
    if(pts.length<4)return pts.slice(0,2);
    return [
      [(pts[0][0]+pts[3][0])/2,(pts[0][1]+pts[3][1])/2],
      [(pts[1][0]+pts[2][0])/2,(pts[1][1]+pts[2][1])/2]
    ];
  }
  
  function buildReferencePolygonSegments(){
    const ref=window.SPEED_SEGMENT_REFERENCE||[];
    const globalPlan=getGlobalSpeedPlan();
  
    return ref.map((entry,i)=>{
      const polygon=normalizePolygonRing(entry.polygon||[entry.pA,entry.pB,entry.pC,entry.pD,entry.pE]);
      const path=polygonCenterline(polygon);
      return{
        id:`SEG-${String(i+1).padStart(2,'0')}`,
        sourceSegmentIndex:entry.segmentindex??i+1,
        polygon,
        path,
        centroid:polygonCentroid(polygon),
        distanceKm:polygonSegmentLengthKm(polygon),
  
        // The uploaded file contains roadname/sta because it is an existing
        // human-authored format. First-time Auto Suggest intentionally does NOT
        // assume the system knows the Road Name.
        roadName:'',
        referenceRoadName:referenceRoadBaseName(entry.roadname||entry.sta||''),
        sta:referenceStaLabel(entry.sta||entry.roadname||''),
  
        currentPlan:Number.isFinite(globalPlan)?globalPlan:NaN,
        proposedPlan:NaN,
        suggestedPlan:NaN,
        avgActual:NaN,
        samples:0,
        units:[],
        unitNos:[],
        change:'Suggested',
        reviewed:false,
        source:'polygon-reference'
      };
    }).filter(seg=>seg.polygon.length>=4);
  }
  
  function assignEvidenceToPolygonSegments(segments){
    if(!segments?.length)return;
    const meta=segments.map(seg=>({
      seg,
      bounds:polygonBounds(seg.polygon),
      sum:0,count:0,byUnit:new Map()
    }));
  
    segments.forEach(seg=>{
      seg.avgActual=NaN;seg.samples=0;seg.units=[];seg.unitNos=[];
    });
  
    // One pass over telemetry. BBox first, point-in-polygon second.
    rows().forEach(r=>{
      const pts=r.points||[];
      const stride=Math.max(1,Math.ceil(pts.length/20000));
      for(let i=0;i<pts.length;i+=stride){
        const p=pts[i],pos=p?.position;
        if(!pos||!Number.isFinite(p.speed))continue;
  
        let hit=null;
        for(const m of meta){
          if(!pointInsideBounds(pos,m.bounds))continue;
          if(pointInPolygon(pos,m.seg.polygon)){hit=m;break}
        }
        if(!hit)continue;
  
        hit.sum+=p.speed;hit.count++;
        let u=hit.byUnit.get(r.unitNo);
        if(!u){
          u={unitNo:r.unitNo,sum:0,count:0};
          hit.byUnit.set(r.unitNo,u);
        }
        u.sum+=p.speed;u.count++;
      }
    });
  
    meta.forEach(m=>{
      const seg=m.seg;
      seg.samples=m.count;
      seg.avgActual=m.count?m.sum/m.count:NaN;
      seg.units=[...m.byUnit.values()]
        .map(u=>({unitNo:u.unitNo,avgSpeed:u.count?u.sum/u.count:NaN,samples:u.count}))
        .sort((a,b)=>String(a.unitNo).localeCompare(String(b.unitNo)));
      seg.unitNos=seg.units.map(u=>u.unitNo);
    });
  }
  
  /* Override: first draft uses polygon corridor shape. */
  function createInitialSpeedDraft(){
    ensureSpeedV12State();
    const segments=buildReferencePolygonSegments();
    assignEvidenceToPolygonSegments(segments);
  
    segments.forEach(seg=>{
      seg.suggestedPlan=roundSuggestedSpeed(seg.avgActual);
      seg.proposedPlan=Number.isFinite(seg.suggestedPlan)
        ?seg.suggestedPlan
        :seg.currentPlan;
      seg.change='Suggested';
      seg.reviewed=false;
    });
  
    state.speedAnalysis.generation+=1;
    state.speedAnalysis.draft={
      version:1,
      createdAt:Date.now(),
      telemetryStart:state.start,
      telemetryEnd:state.end,
      segments,
      _evidenceKey:speedEvidenceKey()
    };
    state.speedAnalysis.selectedSegments.clear();
    state.speedAnalysis.expandedSegments.clear();
    state.speedAnalysis.expandedGroups.clear();
    state.speedAnalysis.editedSegments.clear();
  }
  
  /* Override: evidence is point-in-polygon. */
  function refreshDraftEvidence(){
    const draft=state.speedAnalysis.draft;
    if(!draft)return;
    draft.telemetryStart=state.start;
    draft.telemetryEnd=state.end;
  
    assignEvidenceToPolygonSegments(draft.segments);
  
    draft.segments.forEach(seg=>{
      seg.suggestedPlan=roundSuggestedSpeed(seg.avgActual);
  
      if(!state.speedAnalysis.active){
        if(!state.speedAnalysis.editedSegments.has(seg.id)){
          seg.proposedPlan=Number.isFinite(seg.suggestedPlan)?seg.suggestedPlan:seg.currentPlan;
        }
        seg.change='Suggested';
        return;
      }
  
      if(seg.samples===0){
        seg.change='No Recent Coverage';
        if(!state.speedAnalysis.editedSegments.has(seg.id))seg.proposedPlan=seg.currentPlan;
      }else if(Number.isFinite(seg.suggestedPlan)&&Number.isFinite(seg.currentPlan)&&seg.suggestedPlan!==seg.currentPlan){
        seg.change='Speed Review';
        if(!state.speedAnalysis.editedSegments.has(seg.id))seg.proposedPlan=seg.suggestedPlan;
      }else{
        seg.change='Unchanged';
        if(!state.speedAnalysis.editedSegments.has(seg.id))seg.proposedPlan=seg.currentPlan;
      }
    });
    computeSpeedCoverageDiagnosticsV15(draft.segments);
  }
  
  /* Prototype scope: adaptive generation of entirely new corridor geometry is
     intentionally deferred. Re-evaluation still detects Speed Review and
     No Recent Coverage on the current ACTIVE polygons. */
  function detectNewSpeedSegments(){return[]}
  
  function buildReviewDraftFromActive(){
    const active=state.speedAnalysis.active;
    if(!active){createInitialSpeedDraft();return}
  
    const segments=active.segments.map(seg=>({
      ...seg,
      polygon:(seg.polygon||[]).map(p=>[...p]),
      path:(seg.path||[]).map(p=>[...p]),
      units:[],
      unitNos:[],
      currentPlan:seg.approvedPlan,
      proposedPlan:seg.approvedPlan,
      suggestedPlan:NaN,
      avgActual:NaN,
      samples:0,
      change:'Unchanged',
      reviewed:false
    }));
  
    state.speedAnalysis.draft={
      version:active.version+1,
      createdAt:Date.now(),
      telemetryStart:state.start,
      telemetryEnd:state.end,
      segments,
      _evidenceKey:speedEvidenceKey()
    };
    state.speedAnalysis.selectedSegments.clear();
    state.speedAnalysis.expandedSegments.clear();
    state.speedAnalysis.expandedGroups.clear();
    state.speedAnalysis.editedSegments.clear();
    refreshDraftEvidence();
  }
  
  function speedSegmentFeatures(){
    return activeSpeedSegments().map(seg=>({
      type:'Feature',
      properties:{
        segmentId:seg.id,
        roadName:seg.roadName||'',
        sta:seg.sta||'',
        change:seg.change||'Unchanged',
        reviewed:seg.reviewed?1:0,
        coverage:seg.samples>0?1:0,
        conflict:seg.coverageConflict?1:0,
        lengthIssue:seg.lengthIssue?1:0,
        selected:state.speedAnalysis.selectedSegments.has(seg.id)?1:0,
        speedPlan:Number.isFinite(seg.proposedPlan)?seg.proposedPlan:null,
        actual:Number.isFinite(seg.avgActual)?seg.avgActual:null
      },
      geometry:{type:'Polygon',coordinates:[seg.polygon]}
    }));
  }
  
  function fitSpeedSegments(ids=state.speedAnalysis.selectedSegments){
    const map=state.mapRoot;
    if(!map||!state._mapReady)return;
    const selected=activeSpeedSegments().filter(s=>ids.has(s.id));
    if(!selected.length)return;
  
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    selected.flatMap(s=>s.polygon||[]).forEach(([x,y])=>{
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      minX=Math.min(minX,x);minY=Math.min(minY,y);
      maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    });
    if(![minX,minY,maxX,maxY].every(Number.isFinite))return;
  
    map.fitBounds([[minX,minY],[maxX,maxY]],{
      padding:{top:70,right:70,bottom:currentDockPadding(),left:70},
      maxZoom:17.2,duration:500
    });
  }
  
  function speedDisplayStatus(seg){
    if(seg.reviewed)return'Reviewed';
    return seg.change||'Suggested';
  }
  
  function speedGroupKey(seg,groupBy){
    if(groupBy==='road')return seg.roadName?.trim()||'Belum diberi nama';
    if(groupBy==='status')return speedDisplayStatus(seg);
    return null;
  }
  
  function pushSpeedSegmentRows(out,seg){
    out.push({
      id:`segment:${seg.id}`,
      rowType:'segment',
      segmentId:seg.id,
      label:seg.id,
      roadName:seg.roadName||'—',
      sta:seg.sta||'—',
      change:seg.coverageConflict?'Conflict':(seg.lengthIssue?'Length review':speedDisplayStatus(seg)),
      basis:seg.lengthIssue?'Length guard'
        :seg.coverageConflict?'Overlap review'
        :seg.boundaryReason==='geometry'?'Geometry'
        :seg.boundaryReason==='speed'?'Speed pattern'
        :seg.boundaryReason==='length-guard'?'~100m guard'
        :seg.boundaryReason==='tail-merge'?'Tail merge'
        :seg.boundaryReason==='baseline'?'~100m baseline'
        :'—',
      speedPlan:seg.proposedPlan,
      suggested:seg.suggestedPlan,
      avgActual:seg.avgActual,
      distanceKm:seg.distanceKm,
      unitCount:seg.unitNos?.length||0,
      unitNos:seg.unitNos||[]
    });
  
    if(state.speedAnalysis.expandedSegments.has(seg.id)){
      (seg.units||[]).forEach(u=>out.push({
        id:`segment:${seg.id}:unit:${u.unitNo}`,
        rowType:'unitEvidence',
        segmentId:seg.id,
        label:u.unitNo,
        roadName:'',
        sta:'',
        change:'',
        speedPlan:null,
        suggested:null,
        avgActual:u.avgSpeed,
        distanceKm:null,
        unitCount:null,
        unitNo:u.unitNo,
        samples:u.samples
      }));
    }
  }
  
  function speedRows(){
    ensureSpeedV12State();
    const out=[];
    const segments=activeSpeedSegments();
  
    if(!state.speedAnalysis.draft&&state.speedAnalysis.active){
      segments.forEach(seg=>{
        if(Number.isFinite(seg.approvedPlan))seg.proposedPlan=seg.approvedPlan;
      });
    }
  
    const groupBy=state.speedAnalysis.groupBy||'none';
    if(groupBy==='none'){
      segments.forEach(seg=>pushSpeedSegmentRows(out,seg));
      return out;
    }
  
    const grouped=new Map();
    segments.forEach(seg=>{
      const key=speedGroupKey(seg,groupBy);
      if(!grouped.has(key))grouped.set(key,[]);
      grouped.get(key).push(seg);
    });
  
    [...grouped.entries()]
      .sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
      .forEach(([group,items])=>{
        const groupId=`group:${groupBy}:${group}`;
        out.push({
          id:groupId,rowType:'group',label:group,
          segmentCount:items.length,unitNos:[...new Set(items.flatMap(s=>s.unitNos||[]))]
        });
        if(state.speedAnalysis.expandedGroups.has(groupId)){
          items.forEach(seg=>pushSpeedSegmentRows(out,seg));
        }
      });
  
    return out;
  }
  
  function speedHierarchyRenderer(params){
    const d=params.data||{};
    const wrap=document.createElement('div');
  
    if(d.rowType==='group'){
      wrap.className='speed-group-label';
      const b=document.createElement('button');
      b.type='button';b.className='hier-toggle';
      b.textContent=state.speedAnalysis.expandedGroups.has(d.id)?'▾':'▸';
      b.addEventListener('click',e=>{
        e.stopPropagation();
        state.speedAnalysis.expandedGroups.has(d.id)
          ?state.speedAnalysis.expandedGroups.delete(d.id)
          :state.speedAnalysis.expandedGroups.add(d.id);
        renderSpeedTable();
      });
      const s=document.createElement('span');
      s.textContent=`${d.label} (${d.segmentCount})`;
      wrap.append(b,s);
      return wrap;
    }
  
    wrap.className='hier-cell';
    if(d.rowType==='segment'){
      const b=document.createElement('button');
      b.type='button';b.className='hier-toggle';
      b.textContent=state.speedAnalysis.expandedSegments.has(d.segmentId)?'▾':'▸';
      b.title='Evidence unit';
      b.addEventListener('click',e=>{
        e.stopPropagation();
        state.speedAnalysis.expandedSegments.has(d.segmentId)
          ?state.speedAnalysis.expandedSegments.delete(d.segmentId)
          :state.speedAnalysis.expandedSegments.add(d.segmentId);
        renderSpeedTable();
      });
      const s=document.createElement('span');
      s.className='hier-loader';
      s.textContent=d.label;
      wrap.append(b,s);
    }else{
      const s=document.createElement('span');
      s.className='speed-unit-label';
      s.textContent=d.label;
      wrap.append(s);
    }
    return wrap;
  }
  
  function speedStatusRenderer(params){
    const d=params.data||{};
    if(d.rowType!=='segment'||!d.change)return'';
    const span=document.createElement('span');
    span.className=`speed-status ${speedStatusClass(d.change)}`;
    span.textContent=d.change;
    return span;
  }
  
  function renderSpeedTable(){
    ensureSpeedAnalysis();
    ensureSpeedV12State();
    const rowData=speedRows();
    $('perfTitle').textContent='Segment Performance';
    $('gridSearch').placeholder='Cari segment, road, atau unit…';
    $('speedGroupWrap').classList.remove('hidden');
    $('speedGroupBy').value=state.speedAnalysis.groupBy||'none';
  
    const numCell='perf-num-cell',numHead='perf-num-header';
    const columnDefs=[
      {field:'label',headerName:'Segment / Unit',minWidth:170,flex:1.05,cellRenderer:speedHierarchyRenderer,suppressHeaderMenuButton:true},
      {field:'roadName',headerName:'Road Name',width:130,minWidth:115,cellClass:'speed-road-name',suppressHeaderMenuButton:true},
      {field:'sta',headerName:'STA',width:90,minWidth:80,cellClass:'speed-sta',suppressHeaderMenuButton:true},
      {field:'basis',headerName:'Basis',width:112,minWidth:100,suppressHeaderMenuButton:true},
      {field:'change',headerName:'Review',width:132,minWidth:120,cellRenderer:speedStatusRenderer,suppressHeaderMenuButton:true},
      {field:'speedPlan',headerName:'Speed Plan',width:105,minWidth:96,cellClass:`${numCell} speed-plan-cell`,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,0)} km/h`:'—',suppressHeaderMenuButton:true},
      {field:'suggested',headerName:'Suggested',width:104,minWidth:94,cellClass:`${numCell} speed-suggested-cell`,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,0)} km/h`:'—',suppressHeaderMenuButton:true},
      {field:'avgActual',headerName:'Avg Actual',width:110,minWidth:102,cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,1)} km/h`:'—',suppressHeaderMenuButton:true},
      {field:'distanceKm',headerName:'Length',width:90,minWidth:82,cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value*1000,0)} m`:'—',suppressHeaderMenuButton:true},
      {field:'unitCount',headerName:'Unit',width:68,minWidth:62,maxWidth:76,cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>p.value==null?'—':fmtInt(p.value),suppressHeaderMenuButton:true}
    ];
  
    if(!state.gridApi){
      if(!globalThis.agGrid?.createGrid){
        $('performanceGrid').innerHTML='<div class="small" style="padding:14px">Grid belum dapat dimuat.</div>';
        return;
      }
      const baseTheme=agGrid.themeQuartz||agGrid.themeBalham||agGrid.themeAlpine;
      const nativeTheme=baseTheme?.withParams?baseTheme.withParams({
        spacing:5,rowVerticalPaddingScale:.82,headerVerticalPaddingScale:.82,
        accentColor:'#287c94',backgroundColor:'#fff',foregroundColor:'#172033',
        headerBackgroundColor:'#f7f9fb',headerTextColor:'#475467',borderColor:'#dfe3e8',
        rowHoverColor:'#f6fafb',selectedRowBackgroundColor:'#edf7f9',fontSize:12
      }):baseTheme;
  
      state.gridApi=agGrid.createGrid($('performanceGrid'),{
        theme:nativeTheme,rowData,columnDefs,getRowId:p=>p.data.id,
        rowHeight:34,headerHeight:36,
        defaultColDef:{sortable:true,resizable:true,suppressHeaderMenuButton:true},
        rowSelection:{mode:'multiRow',checkboxes:p=>p.node?.data?.rowType==='segment',headerCheckbox:true,enableClickSelection:false},
        isRowSelectable:node=>node.data?.rowType==='segment',
        selectionColumnDef:{pinned:'left',width:44,minWidth:44,maxWidth:44,resizable:false,sortable:false,suppressHeaderMenuButton:true},
        getRowClass:p=>{
          if(p.data?.rowType==='group')return'speed-group-row';
          return p.data?.rowType==='segment'?'speed-segment-row':'speed-unit-row';
        },
        onRowSelected:handleGridRowSelected,
        suppressCellFocus:false,animateRows:false
      });
  
      if($('gridSearch').dataset.speedSearchBound!=='1'){
        $('gridSearch').dataset.speedSearchBound='1';
        $('gridSearch').addEventListener('input',e=>{
          state.gridApi?.setGridOption('quickFilterText',e.target.value||'');
        });
      }
    }else{
      state.gridApi.setGridOption('columnDefs',columnDefs);
      state.gridApi.setGridOption('rowData',rowData);
    }
  
    requestAnimationFrame(()=>{
      syncSpeedGridSelection();
      try{state.gridApi?.refreshCells?.({force:true});state.gridApi?.redrawRows?.()}catch{}
    });
  }
  
  function syncSpeedGridSelection(){
    if(!state.gridApi)return;
    state.syncGridSelection=true;
    state.gridApi.forEachNode(node=>{
      if(node.data?.rowType!=='segment')return;
      node.setSelected(state.speedAnalysis.selectedSegments.has(node.data.segmentId),false,'sync-speed');
    });
    state.syncGridSelection=false;
  
    const segN=state.speedAnalysis.selectedSegments.size;
    const unitN=state.mapSelectedUnits.size;
    $('gridSelectionCount').textContent=segN
      ?`${segN} segment · ${unitN} unit evidence`
      :'0 segment dipilih';
  
    $('speedAssignRoadBtn').classList.toggle('hidden',segN===0||!state.speedAnalysis.draft);
    $('speedMarkReviewedBtn').classList.toggle('hidden',segN===0||!state.speedAnalysis.draft);
    $('speedEditPlanBtn').classList.toggle('hidden',segN!==1||!state.speedAnalysis.draft);
    ensureSpeedV15State();
    $('speedBoxSelectBtn').classList.toggle('hidden',!state.speedAnalysis.draft);
    $('speedSuggestSelectionBtn').classList.toggle('hidden',!state.speedAnalysis.draft||!state.speedAnalysis.selectionBounds);
    $('speedRemoveDraftBtn').classList.toggle('hidden',segN===0||!state.speedAnalysis.draft);
    $('speedUndoBtn').classList.toggle('hidden',!state.speedAnalysis.draft||state.speedAnalysis.undoStack.length===0);
    $('speedOpenGisBtn').classList.toggle('hidden',segN===0);
    renderSpeedCoverageSummaryV15();
    renderSpeedHandoffTrayV16();
    updatePlaybackAction();
  }
  
  function markSelectedSpeedReviewed(){
    if(!state.speedAnalysis.draft)return;
    const selected=state.speedAnalysis.selectedSegments;
    if(!selected.size)return;
    activeSpeedSegments().forEach(seg=>{
      if(selected.has(seg.id))seg.reviewed=true;
    });
    showSpeedNotice(`${selected.size} segment ditandai Reviewed. Belum ACTIVE sampai Apply Draft.`);
    refreshSpeedAnalysis();
  }
  
  function openRoadNameEditor(){
    if(!state.speedAnalysis.draft||!state.speedAnalysis.selectedSegments.size)return;
    const selected=activeSpeedSegments().filter(seg=>state.speedAnalysis.selectedSegments.has(seg.id));
    const sameName=selected.every(s=>(s.roadName||'')===(selected[0]?.roadName||''));
    $('speedRoadNameInput').value=sameName?(selected[0]?.roadName||''):'';
    $('speedRoadModalMeta').textContent=`${selected.length} segment dipilih`;
    $('speedRoadModal').classList.remove('hidden');
    setTimeout(()=>$('speedRoadNameInput').focus(),30);
  }
  
  function saveRoadNameEditor(){
    const value=$('speedRoadNameInput').value.trim();
    if(!value)return;
    const ids=state.speedAnalysis.selectedSegments;
    activeSpeedSegments().forEach(seg=>{
      if(ids.has(seg.id)){
        seg.roadName=value;
        seg.reviewed=true;
      }
    });
    $('speedRoadModal').classList.add('hidden');
    showSpeedNotice(`${ids.size} segment di-assign ke road "${value}".`);
    refreshSpeedAnalysis();
  }
  
  function renderSpeedRibbon(){
    ensureSpeedAnalysis();
    ensureSpeedV12State();
    const draft=state.speedAnalysis.draft;
    const active=state.speedAnalysis.active;
    const segments=activeSpeedSegments();
    const actuals=segments.map(s=>s.avgActual).filter(Number.isFinite);
    const reviewed=segments.filter(s=>s.reviewed).length;
  
    $('speedLayerState').textContent=draft
      ?`Review Draft v${draft.version}`
      :(active?`Active v${active.version}`:'Belum ada layer');
  
    if(draft&&!active){
      $('speedReviewSummary').textContent=`${reviewed} Reviewed · ${segments.length-reviewed} Suggested · polygon corridor`;
    }else if(draft&&active){
      const changes=segments.reduce((m,s)=>(m[s.change]=(m[s.change]||0)+1,m),{});
      $('speedReviewSummary').textContent=Object.entries(changes).map(([k,v])=>`${v} ${k}`).join(' · ');
    }else{
      $('speedReviewSummary').textContent='Active segment layer';
    }
  
    $('speedGlobalPlan').textContent=Number.isFinite(getGlobalSpeedPlan())?fmt(getGlobalSpeedPlan(),0):'—';
    $('speedAvgActual').textContent=actuals.length?fmt(actuals.reduce((a,b)=>a+b,0)/actuals.length,1):'—';
    $('speedSegmentCount').textContent=fmtInt(segments.length);
    $('speedReviewedCount').textContent=`${reviewed}/${segments.length}`;
    $('speedApplyDraftBtn').disabled=!draft;
    $('speedReevaluateBtn').textContent=active?'↻ Re-evaluate':'↻ Auto Suggest';
  }
  
  function applySpeedDraft(){
    const draft=state.speedAnalysis.draft;
    if(!draft)return;
    const unreviewed=draft.segments.filter(s=>!s.reviewed).length;
    if(unreviewed){
      const ok=window.confirm(`${unreviewed} segment belum ditandai Reviewed.\n\nTetap Apply Draft?`);
      if(!ok)return;
    }
  
    const previous=state.speedAnalysis.active;
    if(previous)state.speedAnalysis.history.unshift({...previous,isActive:false});
  
    const approvedSegments=draft.segments.map(seg=>({
      ...seg,
      polygon:(seg.polygon||[]).map(p=>[...p]),
      path:(seg.path||[]).map(p=>[...p]),
      approvedPlan:Number.isFinite(seg.proposedPlan)?seg.proposedPlan:seg.currentPlan,
      currentPlan:Number.isFinite(seg.proposedPlan)?seg.proposedPlan:seg.currentPlan,
      reviewed:true,
      change:'Unchanged'
    }));
  
    state.speedAnalysis.active={
      version:draft.version,
      appliedAt:Date.now(),
      telemetryStart:draft.telemetryStart,
      telemetryEnd:draft.telemetryEnd,
      segments:approvedSegments,
      isActive:true
    };
    state.speedAnalysis.draft=null;
    state.speedAnalysis.editedSegments.clear();
    state.speedAnalysis.selectedSegments.clear();
    state.mapSelectedUnits.clear();
  
    showSpeedNotice(`Active v${state.speedAnalysis.active.version} diterapkan. Versi sebelumnya tetap tersimpan.`);
    refreshSpeedAnalysis();
  }
  
  function openSpeedPlanEditor(){
    const seg=selectedSpeedSegment();
    if(!seg)return;
    const road=seg.roadName||'Belum diberi nama';
    $('speedPlanModalMeta').textContent=`${seg.id} · ${road} · STA ${seg.sta||'—'} · ${fmt(seg.distanceKm*1000,0)} m`;
    $('speedPlanInput').value=Number.isFinite(seg.proposedPlan)?Math.round(seg.proposedPlan):'';
    $('speedPlanSuggested').textContent=Number.isFinite(seg.suggestedPlan)?`${fmt(seg.suggestedPlan,0)} km/h`:'—';
    $('speedPlanActual').textContent=Number.isFinite(seg.avgActual)?`${fmt(seg.avgActual,1)} km/h`:'—';
    $('speedPlanGlobalRef').textContent=Number.isFinite(getGlobalSpeedPlan())?`${fmt(getGlobalSpeedPlan(),0)} km/h`:'—';
    $('speedPlanModal').classList.remove('hidden');
  }
  
  function speedOpenInGis(){
    const ids=[...state.speedAnalysis.selectedSegments];
    if(!ids.length)return;
    const draft=state.speedAnalysis.draft;
    const version=draft?.version??state.speedAnalysis.active?.version??'—';
    $('gisDraftVersion').textContent=`v${version}`;
    $('gisSegmentSelection').textContent=ids.length<=4?ids.join(', '):`${ids.length} segments`;
    $('speedGisHandoffMeta').textContent=`Speed Analysis → GIS · ${ids.length} segment selected`;
    $('speedGisHandoffModal').classList.remove('hidden');
  }
  
  
  /* ========================================================================
     V13 TELEMETRY-DRIVEN AUTO SUGGEST
     Standalone proof-of-flow:
     - no backend required
     - no uploaded reference JSON used for generated geometry
     - representative traversal comes from the active telemetry fixture
     - default target length is configurable (100 m)
     - boundary positions adapt using geometry curvature + sustained speed shift
     - output is polygon corridor
     ======================================================================== */
  
  
  function assignEvidenceToPolygonSegments(segments){
    if(!segments?.length)return;
  
    const selectedRows=rows();
    const cellSize=.0012; // ~130 m latitude; coarse candidate grid only
    const grid=new Map();
    const meta=segments.map((seg,index)=>({
      seg,index,bounds:polygonBounds(seg.polygon),sum:0,count:0,byUnit:new Map()
    }));
  
    const key=(ix,iy)=>`${ix}:${iy}`;
    meta.forEach(m=>{
      if(!m.bounds)return;
      const ix0=Math.floor(m.bounds[0]/cellSize),ix1=Math.floor(m.bounds[2]/cellSize);
      const iy0=Math.floor(m.bounds[1]/cellSize),iy1=Math.floor(m.bounds[3]/cellSize);
      for(let ix=ix0;ix<=ix1;ix++)for(let iy=iy0;iy<=iy1;iy++){
        const k=key(ix,iy);
        if(!grid.has(k))grid.set(k,[]);
        grid.get(k).push(m);
      }
    });
  
    segments.forEach(seg=>{
      seg.avgActual=NaN;seg.samples=0;seg.units=[];seg.unitNos=[];
    });
  
    const totalBudget=120000;
    const perUnitBudget=Math.max(2500,Math.floor(totalBudget/Math.max(1,selectedRows.length)));
  
    selectedRows.forEach(r=>{
      const pts=r.points||[];
      const stride=Math.max(1,Math.ceil(pts.length/perUnitBudget));
  
      for(let i=0;i<pts.length;i+=stride){
        const p=pts[i],pos=p?.position;
        if(!pos||!Number.isFinite(p.speed))continue;
  
        const candidates=grid.get(key(Math.floor(pos[0]/cellSize),Math.floor(pos[1]/cellSize)))||[];
        let hit=null;
        for(const m of candidates){
          if(!pointInsideBounds(pos,m.bounds))continue;
          if(pointInPolygon(pos,m.seg.polygon)){hit=m;break}
        }
        if(!hit)continue;
  
        hit.sum+=p.speed;hit.count++;
        let u=hit.byUnit.get(r.unitNo);
        if(!u){
          u={unitNo:r.unitNo,sum:0,count:0};
          hit.byUnit.set(r.unitNo,u);
        }
        u.sum+=p.speed;u.count++;
      }
    });
  
    meta.forEach(m=>{
      const seg=m.seg;
      seg.samples=m.count;
      seg.avgActual=m.count?m.sum/m.count:NaN;
      seg.units=[...m.byUnit.values()]
        .map(u=>({unitNo:u.unitNo,avgSpeed:u.count?u.sum/u.count:NaN,samples:u.count}))
        .sort((a,b)=>String(a.unitNo).localeCompare(String(b.unitNo)));
      seg.unitNos=seg.units.map(u=>u.unitNo);
    });
  }
  
  function ensureSpeedV13State(){
    ensureSpeedV12State();
    const s=state.speedAnalysis;
    if(!s.suggestSettings)s.suggestSettings={targetLength:100};
    if(!('suggestBusy' in s))s.suggestBusy=false;
  }
  
  function formatStationMeters(meters){
    const m=Math.max(0,Math.round(Number(meters)||0));
    const km=Math.floor(m/1000);
    const rem=String(m%1000).padStart(3,'0');
    return `${km}+${rem}`;
  }
  
  function bearingDeg(a,b){
    if(!a||!b)return 0;
    const lat1=a[1]*Math.PI/180,lat2=b[1]*Math.PI/180;
    const dLon=(b[0]-a[0])*Math.PI/180;
    const y=Math.sin(dLon)*Math.cos(lat2);
    const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
    return (Math.atan2(y,x)*180/Math.PI+360)%360;
  }
  
  function angleDeltaDeg(a,b){
    let d=Math.abs(a-b)%360;
    return d>180?360-d:d;
  }
  
  function rawSelectedTraceChunks(){
    const chunks=[];
    const f=state.fixture;
    if(!f?.traces?.length)return chunks;
  
    f.traces.forEach((trace,i)=>{
      const unitNo=f.unitNos[i];
      if(!state.selectedUnits.has(unitNo))return;
  
      const [ts,lons,lats,speeds,statuses]=trace;
      const modes=[
        {name:'Loaded',accept:s=>s===4||s===5},
        {name:'Empty',accept:s=>s===2}
      ];
  
      modes.forEach(mode=>{
        let current=[];
        const flush=()=>{
          if(current.length>=12){
            let distance=0;
            for(let k=1;k<current.length;k++){
              const d=hav(current[k-1].lon,current[k-1].lat,current[k].lon,current[k].lat);
              if(Number.isFinite(d)&&d<1.5)distance+=d;
            }
            if(distance>=.25){
              chunks.push({
                unitNo,mode:mode.name,points:current,
                distanceKm:distance,
                durationMs:current[current.length-1].t-current[0].t
              });
            }
          }
          current=[];
        };
  
        for(let k=0;k<ts.length;k++){
          const status=Number(statuses[k]);
          if(!mode.accept(status)){flush();continue}
  
          const t=Number(ts[k]),lon=Number(lons[k]),lat=Number(lats[k]),speed=Number(speeds[k]);
          if(!Number.isFinite(t)||!validPlaybackCoord(lon,lat)){flush();continue}
  
          if(current.length){
            const prev=current[current.length-1];
            const gap=t-prev.t;
            const jump=hav(prev.lon,prev.lat,lon,lat);
            if(gap>120000||jump>.22){flush()}
          }
          current.push({t,lon,lat,speed:Number.isFinite(speed)?speed:0,status});
        }
        flush();
      });
    });
  
    return chunks.sort((a,b)=>{
      const scoreA=a.distanceKm*Math.min(2,Math.max(.5,a.durationMs/600000));
      const scoreB=b.distanceKm*Math.min(2,Math.max(.5,b.durationMs/600000));
      return scoreB-scoreA;
    });
  }
  
  function fallbackMovingChunk(){
    const f=state.fixture;
    const chunks=[];
    if(!f?.traces?.length)return null;
  
    f.traces.forEach((trace,i)=>{
      const unitNo=f.unitNos[i];
      if(!state.selectedUnits.has(unitNo))return;
      const [ts,lons,lats,speeds,statuses]=trace;
      let current=[];
  
      const flush=()=>{
        if(current.length>=20){
          let distance=0;
          for(let k=1;k<current.length;k++){
            const d=hav(current[k-1].lon,current[k-1].lat,current[k].lon,current[k].lat);
            if(Number.isFinite(d)&&d<1.5)distance+=d;
          }
          if(distance>.25)chunks.push({unitNo,mode:'Moving',points:current,distanceKm:distance,durationMs:current.at(-1).t-current[0].t});
        }
        current=[];
      };
  
      for(let k=0;k<ts.length;k++){
        const t=Number(ts[k]),lon=Number(lons[k]),lat=Number(lats[k]),speed=Number(speeds[k]||0),status=Number(statuses[k]);
        if(!Number.isFinite(t)||!validPlaybackCoord(lon,lat)||speed<2){flush();continue}
        if(current.length){
          const prev=current.at(-1);
          if(t-prev.t>120000||hav(prev.lon,prev.lat,lon,lat)>.22)flush();
        }
        current.push({t,lon,lat,speed,status});
      }
      flush();
    });
  
    return chunks.sort((a,b)=>b.distanceKm-a.distanceKm)[0]||null;
  }
  
  function chooseRepresentativeTraversal(){
    const chunks=rawSelectedTraceChunks();
    return chunks[0]||fallbackMovingChunk();
  }
  
  function smoothTraversalPoints(points){
    if(points.length<5)return points.map(p=>({...p}));
    return points.map((p,i)=>{
      const a=Math.max(0,i-2),b=Math.min(points.length-1,i+2);
      let lon=0,lat=0,speed=0,n=0;
      for(let k=a;k<=b;k++){
        lon+=points[k].lon;lat+=points[k].lat;speed+=points[k].speed;n++;
      }
      return {...p,lon:lon/n,lat:lat/n,speed:speed/n};
    });
  }
  
  function resampleTraversal(points,stepMeters=12){
    if(points.length<2)return points;
    const out=[points[0]];
    let accumulated=0;
    let prev=points[0];
  
    for(let i=1;i<points.length;i++){
      const p=points[i];
      const d=hav(prev.lon,prev.lat,p.lon,p.lat)*1000;
      if(!Number.isFinite(d)||d>220){prev=p;continue}
      accumulated+=d;
      if(accumulated>=stepMeters){
        out.push(p);
        accumulated=0;
      }
      prev=p;
    }
    if(out.at(-1)!==points.at(-1))out.push(points.at(-1));
    return out;
  }
  
  function routeCumulativeMeters(route){
    const cum=[0];
    for(let i=1;i<route.length;i++){
      cum[i]=cum[i-1]+hav(route[i-1].lon,route[i-1].lat,route[i].lon,route[i].lat)*1000;
    }
    return cum;
  }
  
  function localMeanSpeed(route,index,side){
    const vals=[];
    if(side<0){
      for(let k=Math.max(0,index-4);k<index;k++)if(Number.isFinite(route[k].speed))vals.push(route[k].speed);
    }else{
      for(let k=index+1;k<=Math.min(route.length-1,index+4);k++)if(Number.isFinite(route[k].speed))vals.push(route[k].speed);
    }
    return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:NaN;
  }
  
  function adaptiveSegmentSlices(route,targetLength){
    if(route.length<2)return[];
    const target=Math.max(50,Math.min(300,Number(targetLength)||100));
    const minLen=Math.max(35,target*.55);
    const maxLen=Math.max(target+30,target*1.55);
    const cum=routeCumulativeMeters(route);
    const slices=[];
    let start=0;
  
    while(start<route.length-2){
      const base=cum[start];
      const candidates=[];
  
      for(let i=start+1;i<route.length;i++){
        const len=cum[i]-base;
        if(len<minLen)continue;
        if(len>maxLen)break;
  
        const proximity=Math.max(0,1-Math.abs(len-target)/Math.max(target*.65,1));
  
        const i0=Math.max(start,i-2),i2=Math.min(route.length-1,i+2);
        const h1=bearingDeg([route[i0].lon,route[i0].lat],[route[i].lon,route[i].lat]);
        const h2=bearingDeg([route[i].lon,route[i].lat],[route[i2].lon,route[i2].lat]);
        const turn=Math.min(1,angleDeltaDeg(h1,h2)/55);
  
        const before=localMeanSpeed(route,i,-1),after=localMeanSpeed(route,i,1);
        const speedShift=Number.isFinite(before)&&Number.isFinite(after)
          ?Math.min(1,Math.abs(before-after)/10)
          :0;
  
        const score=proximity + turn*1.55 + speedShift*1.15;
        candidates.push({i,len,score,turn,speedShift});
      }
  
      if(!candidates.length){
        const end=route.length-1;
        slices.push({start,end,startM:base,endM:cum[end],reason:'tail'});
        break;
      }
  
      candidates.sort((a,b)=>b.score-a.score);
      let chosen=candidates[0];
  
      // Avoid pathological short micro segments when there is no strong feature.
      if(chosen.turn<.22&&chosen.speedShift<.28){
        chosen=[...candidates].sort((a,b)=>Math.abs(a.len-target)-Math.abs(b.len-target))[0];
      }
  
      slices.push({
        start,end:chosen.i,
        startM:base,endM:cum[chosen.i],
        reason:chosen.turn>=.22?'geometry':(chosen.speedShift>=.28?'speed':'baseline')
      });
      start=chosen.i;
    }
  
    // Merge a very short final tail into the previous segment.
    if(slices.length>=2){
      const last=slices.at(-1);
      if(last.endM-last.startM<Math.max(30,target*.38)){
        const prev=slices[slices.length-2];
        prev.end=last.end;prev.endM=last.endM;
        prev.reason=prev.reason==='baseline'?'tail-merge':prev.reason;
        slices.pop();
      }
    }
    return slices;
  }
  
  function sampledTelemetryForWidth(limit=3200){
    const all=[];
    rows().forEach(r=>{
      const pts=r.points||[];
      const stride=Math.max(1,Math.ceil(pts.length/Math.max(1,Math.floor(limit/Math.max(1,rows().length)))));
      for(let i=0;i<pts.length;i+=stride){
        const p=pts[i];
        if(p?.position?.every(Number.isFinite))all.push(p.position);
      }
    });
    return all.slice(0,limit);
  }
  
  function pathPointDistanceMeters(pos,route){
    const path=route.map(p=>[p.lon,p.lat]);
    return pointToPathMeters(pos,path);
  }
  
  function estimateCorridorHalfWidth(route){
    const samples=sampledTelemetryForWidth(1800);
    if(!samples.length)return 38;
    const routeStride=Math.max(1,Math.ceil(route.length/280));
    const widthRoute=route.filter((_,i)=>i%routeStride===0);
    if(widthRoute.at(-1)!==route.at(-1))widthRoute.push(route.at(-1));
    const ds=[];
    samples.forEach(pos=>{
      const d=pathPointDistanceMeters(pos,widthRoute);
      if(Number.isFinite(d)&&d<=120)ds.push(d);
    });
    if(ds.length<30)return 38;
    ds.sort((a,b)=>a-b);
    const p85=ds[Math.min(ds.length-1,Math.floor(ds.length*.85))];
    return Math.max(28,Math.min(55,p85+12));
  }
  
  function offsetLonLat(pos,dxMeters,dyMeters){
    const lat=pos[1],cos=Math.max(.2,Math.cos(lat*Math.PI/180));
    return[
      pos[0]+dxMeters/(111320*cos),
      pos[1]+dyMeters/110540
    ];
  }
  
  function corridorPolygonFromRoute(route,halfWidth){
    if(route.length<2)return[];
    const left=[],right=[];
  
    route.forEach((p,i)=>{
      const prev=route[Math.max(0,i-1)],next=route[Math.min(route.length-1,i+1)];
      const lat0=p.lat*Math.PI/180;
      const sx=111320*Math.max(.2,Math.cos(lat0)),sy=110540;
      const vx=(next.lon-prev.lon)*sx,vy=(next.lat-prev.lat)*sy;
      const len=Math.hypot(vx,vy)||1;
      const nx=-vy/len,ny=vx/len;
      left.push(offsetLonLat([p.lon,p.lat],nx*halfWidth,ny*halfWidth));
      right.push(offsetLonLat([p.lon,p.lat],-nx*halfWidth,-ny*halfWidth));
    });
  
    const ring=[...left,...right.reverse()];
    if(ring.length){
      const first=ring[0],last=ring.at(-1);
      if(first[0]!==last[0]||first[1]!==last[1])ring.push([...first]);
    }
    return ring;
  }
  
  function buildAdaptiveSuggestedSegments(route,targetLength,halfWidth){
    const slices=adaptiveSegmentSlices(route,targetLength);
    return slices.map((slice,i)=>{
      const part=route.slice(slice.start,slice.end+1);
      const polygon=corridorPolygonFromRoute(part,halfWidth);
      const path=part.map(p=>[p.lon,p.lat]);
      return{
        id:`SEG-${String(i+1).padStart(2,'0')}`,
        polygon,
        path,
        centroid:polygonCentroid(polygon),
        distanceKm:(slice.endM-slice.startM)/1000,
        roadName:'',
        referenceRoadName:'',
        sta:formatStationMeters(slice.endM),
        startSta:formatStationMeters(slice.startM),
        currentPlan:Number.isFinite(getGlobalSpeedPlan())?getGlobalSpeedPlan():NaN,
        proposedPlan:NaN,
        suggestedPlan:NaN,
        avgActual:NaN,
        samples:0,
        units:[],
        unitNos:[],
        change:'Suggested',
        reviewed:false,
        source:'telemetry-adaptive',
        boundaryReason:slice.reason
      };
    }).filter(seg=>seg.polygon.length>=4&&seg.distanceKm>.02);
  }
  
  async function nextSuggestFrame(stage,detail){
    const mask=$('loadingMask');
    const title=mask?.querySelector('.title');
    if(title)title.textContent='Auto Suggest Speed Segment';
    if($('loadingText'))$('loadingText').textContent=`${stage}${detail?` · ${detail}`:''}`;
    mask?.classList.remove('hidden');
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,20)));
  }
  
  async function generateTelemetryAutoSuggest(){
    ensureSpeedV13State();
    if(state.speedAnalysis.suggestBusy)return;
    state.speedAnalysis.suggestBusy=true;
  
    const target=Math.max(50,Math.min(300,Number($('suggestTargetLength').value)||100));
    state.speedAnalysis.suggestSettings.targetLength=target;
    $('speedSuggestRun').disabled=true;
    $('speedSuggestModal').classList.add('hidden');
  
    try{
      await nextSuggestFrame('1/4 Mencari representative traversal','loaded / empty telemetry');
      const traversal=chooseRepresentativeTraversal();
      if(!traversal)throw new Error('Tidak ada traversal telemetry yang cukup panjang untuk membentuk segment.');
  
      const smoothed=smoothTraversalPoints(traversal.points);
      const route=resampleTraversal(smoothed,12);
      const routeLength=routeCumulativeMeters(route).at(-1)||0;
      if(route.length<6||routeLength<200)throw new Error('Traversal terlalu pendek untuk Auto Suggest.');
  
      await nextSuggestFrame('2/4 Menganalisis geometry + speed pattern',`${Math.round(routeLength)} m route`);
      const halfWidth=estimateCorridorHalfWidth(route);
  
      await nextSuggestFrame('3/4 Membentuk polygon corridor',`target ${target} m`);
      const segments=buildAdaptiveSuggestedSegments(route,target,halfWidth);
      if(!segments.length)throw new Error('Auto Suggest tidak menghasilkan polygon segment.');
  
      await nextSuggestFrame('4/4 Menghitung evidence telemetry',`${segments.length} segment`);
      assignEvidenceToPolygonSegments(segments);
      segments.forEach(seg=>{
        seg.suggestedPlan=roundSuggestedSpeed(seg.avgActual);
        seg.proposedPlan=Number.isFinite(seg.suggestedPlan)?seg.suggestedPlan:seg.currentPlan;
      });
  
      archiveCurrentDraftV18();
      const previousDraftVersion=Number(state.speedAnalysis.draftHistory?.[0]?.version)||0;
      const activeVersion=Number(state.speedAnalysis.active?.version)||0;
      state.speedAnalysis.generation+=1;
      state.speedAnalysis.draft={
        version:Math.max(previousDraftVersion,activeVersion)+1,
        parentVersion:previousDraftVersion||activeVersion||null,
        createdAt:Date.now(),
        telemetryStart:state.start,
        telemetryEnd:state.end,
        segments,
        _evidenceKey:speedEvidenceKey(),
        algorithmMeta:{
          method:'Adaptive',
          targetLength:target,
          corridorWidth:Math.round(halfWidth*2),
          sourceUnit:traversal.unitNo,
          sourceMode:traversal.mode,
          routeLength:Math.round(routeLength),
          route:route.map(p=>[p.lon,p.lat]),
          segmentCount:segments.length
        }
      };
  
      state.speedAnalysis.selectedSegments.clear();
      state.speedAnalysis.expandedSegments.clear();
      state.speedAnalysis.expandedGroups.clear();
      state.speedAnalysis.editedSegments.clear();
      state.mapSelectedUnits.clear();
  
      refreshSpeedAnalysis();
      fitData();
      showSpeedNotice(`Auto Suggest selesai: ${segments.length} polygon segment dari ${traversal.unitNo} ${traversal.mode} · target ${target} m.`);
    }catch(err){
      console.error(err);
      showSpeedNotice(err?.message||'Auto Suggest gagal.');
    }finally{
      state.speedAnalysis.suggestBusy=false;
      $('speedSuggestRun').disabled=false;
      $('loadingMask')?.classList.add('hidden');
      const title=$('loadingMask')?.querySelector('.title');
      if(title)title.textContent='Memuat data Cycle Time';
      if($('loadingText'))$('loadingText').textContent='Membaca fixture BRCB dan layer peta.';
    }
  }
  
  /* v13: entering Speed Analysis does NOT silently generate a draft. */
  function ensureSpeedAnalysis(){
    ensureSpeedV13State();
    const key=speedEvidenceKey();
  
    if(state.speedAnalysis.draft){
      if(state.speedAnalysis.draft._evidenceKey!==key){
        refreshDraftEvidence();
        state.speedAnalysis.draft._evidenceKey=key;
      }
      return;
    }
    // ACTIVE may exist without a review draft. No automatic mutation.
  }
  
  /* Recompute evidence against already-generated polygons. */
  function refreshDraftEvidence(){
    const draft=state.speedAnalysis.draft;
    if(!draft)return;
    draft.telemetryStart=state.start;
    draft.telemetryEnd=state.end;
    assignEvidenceToPolygonSegments(draft.segments);
  
    draft.segments.forEach(seg=>{
      seg.suggestedPlan=roundSuggestedSpeed(seg.avgActual);
  
      if(!state.speedAnalysis.active){
        if(!state.speedAnalysis.editedSegments.has(seg.id)){
          seg.proposedPlan=Number.isFinite(seg.suggestedPlan)?seg.suggestedPlan:seg.currentPlan;
        }
        seg.change='Suggested';
        return;
      }
  
      if(seg.samples===0){
        seg.change='No Recent Coverage';
        if(!state.speedAnalysis.editedSegments.has(seg.id))seg.proposedPlan=seg.currentPlan;
      }else if(Number.isFinite(seg.suggestedPlan)&&Number.isFinite(seg.currentPlan)&&seg.suggestedPlan!==seg.currentPlan){
        seg.change='Speed Review';
        if(!state.speedAnalysis.editedSegments.has(seg.id))seg.proposedPlan=seg.suggestedPlan;
      }else{
        seg.change='Unchanged';
        if(!state.speedAnalysis.editedSegments.has(seg.id))seg.proposedPlan=seg.currentPlan;
      }
    });
    computeSpeedCoverageDiagnosticsV15(draft.segments);
  }
  
  /* First-time button opens settings instead of auto-generating silently. */
  function openAutoSuggestModal(){
    ensureSpeedV13State();
    $('suggestTargetLength').value=state.speedAnalysis.suggestSettings.targetLength||100;
    $('suggestScopeUnits').textContent=`${state.selectedUnits.size} unit`;
    $('suggestScopeTime').textContent=displayRange(state.start,state.end);
    $('speedSuggestModal').classList.remove('hidden');
  }
  
  /* Override ribbon to surface actual algorithm output. */
  function renderSpeedRibbon(){
    ensureSpeedV13State();
    const draft=state.speedAnalysis.draft;
    const active=state.speedAnalysis.active;
    const segments=activeSpeedSegments();
    const actuals=segments.map(s=>s.avgActual).filter(Number.isFinite);
    const reviewed=segments.filter(s=>s.reviewed).length;
  
    $('speedLayerState').textContent=draft
      ?`Review Draft v${draft.version}`
      :(active?`Active v${active.version}`:'Belum ada segment layer');
  
    if(draft?.algorithmMeta){
      const m=draft.algorithmMeta;
      $('speedReviewSummary').innerHTML=`
        <span class="speed-algo-meta">
          <span>${m.method}</span>
          <span>target ${m.targetLength} m</span>
          <span>corridor ${m.corridorWidth} m</span>
          <span>${m.sourceUnit} · ${m.sourceMode}</span>
          <span>${reviewed}/${segments.length} reviewed</span>
        </span>
      `;
    }else if(draft&&!active){
      $('speedReviewSummary').textContent=`${reviewed} Reviewed · ${segments.length-reviewed} Suggested`;
    }else if(draft&&active){
      const changes=segments.reduce((m,s)=>(m[s.change]=(m[s.change]||0)+1,m),{});
      $('speedReviewSummary').textContent=Object.entries(changes).map(([k,v])=>`${v} ${k}`).join(' · ');
    }else{
      $('speedReviewSummary').textContent=active?'Active segment layer':'Klik Auto Suggest untuk generate dari telemetry aktif';
    }
  
    $('speedGlobalPlan').textContent=Number.isFinite(getGlobalSpeedPlan())?fmt(getGlobalSpeedPlan(),0):'—';
    $('speedAvgActual').textContent=actuals.length?fmt(actuals.reduce((a,b)=>a+b,0)/actuals.length,1):'—';
    $('speedSegmentCount').textContent=segments.length?fmtInt(segments.length):'—';
    $('speedReviewedCount').textContent=segments.length?`${reviewed}/${segments.length}`:'—';
    $('speedApplyDraftBtn').disabled=!draft;
    $('speedReevaluateBtn').textContent=active?'↻ Re-evaluate':'✦ Auto Suggest';
    renderSpeedTopActionsV17();
  }
  
  /* Derived centerline is shown only as explanation/evidence of the suggestion. */
  function renderSpeedMapLayer(){
    if(!state._mapReady)return;
    mapSourceSet('speed-segment-src',{type:'FeatureCollection',features:speedSegmentFeatures()});
  
    const route=state.speedAnalysis.draft?.algorithmMeta?.route||[];
    mapSourceSet('speed-suggest-route-src',route.length>=2?{
      type:'FeatureCollection',
      features:[{
        type:'Feature',properties:{},
        geometry:{type:'LineString',coordinates:route}
      }]
    }:emptyFC());
  }
  
  
  /* ========================================================================
     V14 MULTI-ROUTE AUTO SUGGEST
     - discovers multiple distinct telemetry corridors, not just one traversal
     - each corridor becomes a Generated Route group
     - segment technical id pattern: R01-S001, R01-S002, ...
     - map click synchronizes exact row in AG Grid
     ======================================================================== */
  
  function routePathFromChunk(chunk){
    const smoothed=smoothTraversalPoints(chunk.points||[]);
    return resampleTraversal(smoothed,12);
  }
  
  function routeLengthMeters(route){
    return routeCumulativeMeters(route).at(-1)||0;
  }
  
  function sampleRouteCoords(route,maxPoints=80){
    if(!route?.length)return[];
    const stride=Math.max(1,Math.ceil(route.length/maxPoints));
    const out=route.filter((_,i)=>i%stride===0).map(p=>[p.lon,p.lat]);
    const last=route.at(-1);
    if(last){
      const coord=[last.lon,last.lat];
      const prev=out.at(-1);
      if(!prev||prev[0]!==coord[0]||prev[1]!==coord[1])out.push(coord);
    }
    return out;
  }
  
  function routeOverlapScore(candidateRoute,acceptedRoute,thresholdMeters=85){
    const a=sampleRouteCoords(candidateRoute,70);
    const bPath=sampleRouteCoords(acceptedRoute,110);
    if(!a.length||bPath.length<2)return 0;
    let hits=0;
    a.forEach(pos=>{
      if(pointToPathMeters(pos,bPath)<=thresholdMeters)hits++;
    });
    return hits/a.length;
  }
  
  function routeEndpointDistanceMeters(a,b){
    if(!a?.length||!b?.length)return Infinity;
    const a0=[a[0].lon,a[0].lat],a1=[a.at(-1).lon,a.at(-1).lat];
    const b0=[b[0].lon,b[0].lat],b1=[b.at(-1).lon,b.at(-1).lat];
    return Math.min(
      metersBetween(a0,b0),metersBetween(a0,b1),
      metersBetween(a1,b0),metersBetween(a1,b1)
    );
  }
  
  function pointInsideSelectionBoundsV15(point,bounds){
    if(!bounds)return true;
    const lon=Number(point?.lon??point?.[0]),lat=Number(point?.lat??point?.[1]);
    return Number.isFinite(lon)&&Number.isFinite(lat)&&
      lon>=bounds.minLon&&lon<=bounds.maxLon&&lat>=bounds.minLat&&lat<=bounds.maxLat;
  }
  
  function chunkDistanceKmV15(points){
    let distance=0;
    for(let i=1;i<points.length;i++){
      const d=hav(points[i-1].lon,points[i-1].lat,points[i].lon,points[i].lat);
      if(Number.isFinite(d)&&d<.5)distance+=d;
    }
    return distance;
  }
  
  function clipTelemetryChunksToBoundsV15(chunks,bounds){
    if(!bounds)return chunks;
    const clipped=[];
    chunks.forEach(chunk=>{
      let current=[];
      const flush=()=>{
        if(current.length>=6){
          const distanceKm=chunkDistanceKmV15(current);
          if(distanceKm>=.08)clipped.push({
            ...chunk,points:current,distanceKm,
            durationMs:current.at(-1).t-current[0].t
          });
        }
        current=[];
      };
      (chunk.points||[]).forEach(point=>{
        if(pointInsideSelectionBoundsV15(point,bounds))current.push(point);else flush();
      });
      flush();
    });
    return clipped;
  }
  
  function allFallbackMovingChunksV15(bounds=null){
    const f=state.fixture;
    const chunks=[];
    if(!f?.traces?.length)return chunks;
  
    f.traces.forEach((trace,i)=>{
      const unitNo=f.unitNos[i];
      if(!state.selectedUnits.has(unitNo))return;
      const [ts,lons,lats,speeds,statuses]=trace;
      let current=[];
      const flush=()=>{
        if(current.length>=10){
          const distanceKm=chunkDistanceKmV15(current);
          const minDistance=bounds ? .08 : .18;
          if(distanceKm>=minDistance)chunks.push({
            unitNo,mode:'Moving',points:current,distanceKm,
            durationMs:current.at(-1).t-current[0].t
          });
        }
        current=[];
      };
  
      for(let k=0;k<ts.length;k++){
        const t=Number(ts[k]),lon=Number(lons[k]),lat=Number(lats[k]);
        const speed=Number(speeds[k]||0),status=Number(statuses[k]);
        const point={t,lon,lat,speed,status};
        if(!Number.isFinite(t)||!validPlaybackCoord(lon,lat)||speed<2||!pointInsideSelectionBoundsV15(point,bounds)){
          flush();continue;
        }
        if(current.length){
          const prev=current.at(-1);
          if(t-prev.t>120000||hav(prev.lon,prev.lat,lon,lat)>.22)flush();
        }
        current.push(point);
      }
      flush();
    });
  
    return chunks.sort((a,b)=>b.distanceKm-a.distanceKm).slice(0,160);
  }
  
  function routeUniqueDistanceMetersV15(route,accepted,thresholdMeters=70){
    if(!accepted.length)return routeLengthMeters(route);
    let unique=0;
    for(let i=1;i<route.length;i++){
      const pos=[route[i].lon,route[i].lat];
      let nearest=Infinity;
      for(const item of accepted){
        const path=item._routePathV15||(item._routePathV15=item.route.map(p=>[p.lon,p.lat]));
        nearest=Math.min(nearest,pointToPathMeters(pos,path));
        if(nearest<=thresholdMeters)break;
      }
      if(nearest>thresholdMeters){
        unique+=metersBetween([route[i-1].lon,route[i-1].lat],pos);
      }
    }
    return unique;
  }
  
  function strictAdaptiveSlicesV15(route,targetLength){
    const target=Math.max(50,Math.min(300,Number(targetLength)||100));
    const maximum=Math.max(target+20,target*1.35);
    const cumulative=routeCumulativeMeters(route);
    const out=[];
  
    adaptiveSegmentSlices(route,target).forEach(slice=>{
      const length=slice.endM-slice.startM;
      const partCount=Math.max(1,Math.ceil(length/maximum));
      if(partCount===1){out.push(slice);return}
  
      let start=slice.start;
      for(let part=1;part<=partCount;part++){
        const endTarget=slice.startM+(length*part/partCount);
        let end=part===partCount?slice.end:start+1;
        if(part!==partCount){
          while(end<slice.end&&cumulative[end]<endTarget)end++;
        }
        if(end<=start)continue;
        out.push({
          start,end,startM:cumulative[start],endM:cumulative[end],
          reason:partCount>1?'length-guard':slice.reason
        });
        start=end;
      }
    });
    return out;
  }
  
  function discoverDistinctTelemetryRoutes(bounds=null){
    const statusChunks=clipTelemetryChunksToBoundsV15(rawSelectedTraceChunks(),bounds);
    const candidates=[...statusChunks,...allFallbackMovingChunksV15(bounds)];
  
    const prepared=candidates
      .map(chunk=>({...chunk,route:routePathFromChunk(chunk)}))
      .filter(c=>c.route.length>=6&&routeLengthMeters(c.route)>=180)
      .sort((a,b)=>routeLengthMeters(b.route)-routeLengthMeters(a.route));
  
    const accepted=[];
    let duplicateCount=0;
  
    for(const cand of prepared){
      let duplicate=false;
      let strongestOverlap=0;
  
      for(const existing of accepted){
        const overlap=routeOverlapScore(cand.route,existing.route,85);
        const reverseOverlap=routeOverlapScore(existing.route,cand.route,85);
        strongestOverlap=Math.max(strongestOverlap,overlap,reverseOverlap);
      }
  
      // Preserve a branch even when it shares a trunk with a longer route.
      // It is discarded only when almost all of it is already represented.
      const uniqueMeters=routeUniqueDistanceMetersV15(cand.route,accepted,70);
      if(accepted.length&&strongestOverlap>=.80&&uniqueMeters<110)duplicate=true;
  
      if(!duplicate){
        cand.uniqueMeters=Math.round(uniqueMeters);
        accepted.push(cand);
        if(accepted.length>=48)break; // browser safety only; not a discovery target
      }else duplicateCount++;
    }
  
    state.speedAnalysis.discoveryDiagnostics={
      candidateCount:prepared.length,acceptedCount:accepted.length,
      duplicateCount,capped:accepted.length>=48,bounds:bounds||null
    };
  
    return accepted;
  }
  
  function buildAdaptiveSuggestedSegmentsForRoute(route,targetLength,halfWidth,routeIndex,routeMeta){
    const slices=strictAdaptiveSlicesV15(route,targetLength);
    const routeId=`R${String(routeIndex+1).padStart(2,'0')}`;
    const routeLabel=`Route ${String(routeIndex+1).padStart(2,'0')}`;
  
    return slices.map((slice,i)=>{
      const part=route.slice(slice.start,slice.end+1);
      const polygon=corridorPolygonFromRoute(part,halfWidth);
      const path=part.map(p=>[p.lon,p.lat]);
      return{
        id:`${routeId}-S${String(i+1).padStart(3,'0')}`,
        routeId,
        routeLabel,
        routeSourceUnit:routeMeta?.unitNo||'—',
        routeSourceMode:routeMeta?.mode||'Moving',
        routeOrder:routeIndex+1,
        segmentOrder:i+1,
  
        polygon,
        path,
        centroid:polygonCentroid(polygon),
        distanceKm:(slice.endM-slice.startM)/1000,
  
        roadName:'',
        referenceRoadName:'',
        sta:formatStationMeters(slice.endM),
        startSta:formatStationMeters(slice.startM),
  
        currentPlan:Number.isFinite(getGlobalSpeedPlan())?getGlobalSpeedPlan():NaN,
        proposedPlan:NaN,
        suggestedPlan:NaN,
        avgActual:NaN,
        samples:0,
        units:[],
        unitNos:[],
        change:'Suggested',
        reviewed:false,
        source:'telemetry-adaptive-multi-route',
        boundaryReason:slice.reason
      };
    }).filter(seg=>seg.polygon.length>=4&&seg.distanceKm>.02);
  }
  
  function ensureSpeedV15State(){
    ensureSpeedV13State();
    if(!Array.isArray(state.speedAnalysis.undoStack))state.speedAnalysis.undoStack=[];
    if(!Array.isArray(state.speedAnalysis.removedSegments))state.speedAnalysis.removedSegments=[];
    if(!('selectionBounds' in state.speedAnalysis))state.speedAnalysis.selectionBounds=null;
    if(!('boxSelectActive' in state.speedAnalysis))state.speedAnalysis.boxSelectActive=false;
    if(!('coverageDiagnostics' in state.speedAnalysis))state.speedAnalysis.coverageDiagnostics=null;
  }
  
  function boundsOverlapV15(a,b){
    return Boolean(a&&b&&a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1]);
  }
  
  function polygonsConflictV15(a,b){
    const aBounds=polygonBounds(a),bBounds=polygonBounds(b);
    if(!boundsOverlapV15(aBounds,bBounds))return false;
    const ac=polygonCentroid(a),bc=polygonCentroid(b);
    if((ac&&pointInPolygon(ac,b))||(bc&&pointInPolygon(bc,a)))return true;
    const aPts=(a||[]).slice(0,-1),bPts=(b||[]).slice(0,-1);
    const aStride=Math.max(1,Math.floor(aPts.length/8));
    const bStride=Math.max(1,Math.floor(bPts.length/8));
    let hits=0;
    for(let i=0;i<aPts.length;i+=aStride)if(pointInPolygon(aPts[i],b)&&++hits>=2)return true;
    hits=0;
    for(let i=0;i<bPts.length;i+=bStride)if(pointInPolygon(bPts[i],a)&&++hits>=2)return true;
    return false;
  }
  
  function computeSpeedCoverageDiagnosticsV15(segments=activeSpeedSegments()){
    ensureSpeedV15State();
    const target=Math.max(50,Number(state.speedAnalysis.suggestSettings?.targetLength)||100);
    const meta=(segments||[]).map(seg=>({seg,bounds:polygonBounds(seg.polygon)}));
    const conflictIds=new Set();
  
    segments.forEach(seg=>{
      seg.coverageConflict=false;
      seg.conflictWith=[];
      seg.lengthIssue=(seg.distanceKm*1000)>Math.max(target+25,target*1.4);
    });
  
    for(let i=0;i<meta.length;i++){
      for(let j=i+1;j<meta.length;j++){
        const a=meta[i].seg,b=meta[j].seg;
        if(a.routeId===b.routeId&&Math.abs((a.segmentOrder||0)-(b.segmentOrder||0))<=1)continue;
        if(!boundsOverlapV15(meta[i].bounds,meta[j].bounds))continue;
        if(!headingCompatibleV16(a,b))continue;
        const directionalOverlap=Math.max(
          segmentOverlapAgainstPrimaryV16(a,[b]).ratio,
          segmentOverlapAgainstPrimaryV16(b,[a]).ratio
        );
        if(directionalOverlap<.38)continue;
        a.coverageConflict=b.coverageConflict=true;
        a.conflictWith.push(b.id);b.conflictWith.push(a.id);
        conflictIds.add(a.id);conflictIds.add(b.id);
      }
    }
  
    const sourceRows=rows();
    const totalPoints=sourceRows.reduce((sum,row)=>sum+(row.points?.length||0),0);
    const stride=Math.max(1,Math.ceil(totalPoints/6000));
    const uncoveredFeatures=[];
    let eligible=0,covered=0;
  
    sourceRows.forEach(row=>{
      const pts=row.points||[];
      for(let i=0;i<pts.length;i+=stride){
        const point=pts[i],pos=point?.position;
        if(!pos?.every(Number.isFinite)||!Number.isFinite(point.speed)||point.speed<2)continue;
        eligible++;
        let hit=false;
        for(const item of meta){
          if(!pointInsideBounds(pos,item.bounds))continue;
          if(pointInPolygon(pos,item.seg.polygon)){hit=true;break}
        }
        if(hit)covered++;
        else if(uncoveredFeatures.length<2500)uncoveredFeatures.push({
          type:'Feature',properties:{unitNo:row.unitNo,speed:point.speed},
          geometry:{type:'Point',coordinates:pos}
        });
      }
    });
  
    const diagnostics={
      sampled:eligible,covered,uncovered:Math.max(0,eligible-covered),
      coveragePct:eligible?covered/eligible*100:0,
      conflictSegments:conflictIds.size,
      longSegments:segments.filter(seg=>seg.lengthIssue).length,
      uncoveredFeatures,
      computedAt:Date.now()
    };
    state.speedAnalysis.coverageDiagnostics=diagnostics;
    renderSpeedCoverageSummaryV15();
    return diagnostics;
  }
  
  function renderSpeedCoverageSummaryV15(){
    ensureSpeedV15State();
    const d=state.speedAnalysis.coverageDiagnostics;
    const removed=state.speedAnalysis.removedSegments.length;
    const alternatives=state.speedAnalysis.draft?.overlapAlternatives?.length||0;
    if($('speedCoveredChip'))$('speedCoveredChip').textContent=d?`Coverage ${fmt(d.coveragePct,1)}%`:'Coverage —';
    if($('speedUncoveredChip'))$('speedUncoveredChip').textContent=d?`Gaps ${fmtInt(d.uncovered)}`:'Gaps —';
    if($('speedConflictChip'))$('speedConflictChip').textContent=d
      ?`Review ${fmtInt((d.conflictSegments||0)+(d.longSegments||0))}`
      :'Review —';
    if($('speedRemovedChip'))$('speedRemovedChip').textContent=`Removed ${removed}`;
    if($('speedOverlapReviewBtn')){
      $('speedOverlapReviewBtn').classList.toggle('hidden',alternatives===0);
      $('speedOverlapReviewBtn').textContent=alternatives?`Review ${alternatives} alternatives`:'Review alternatives';
    }
    if($('speedOverlapStep')){
      $('speedOverlapStep').classList.toggle('done',Boolean(state.speedAnalysis.draft)&&alternatives>=0);
      $('speedOverlapStep').classList.toggle('active',!state.speedAnalysis.selectedSegments.size);
    }
    renderSpeedTopActionsV17();
  }
  
  function renderSpeedTopActionsV17(){
    const draft=state.speedAnalysis.draft;
    const diagnostics=state.speedAnalysis.coverageDiagnostics;
    const selected=state.speedAnalysis.selectedSegments.size;
    const manualReview=(diagnostics?.conflictSegments||0)+(diagnostics?.longSegments||0);
    const health=$('speedDraftHealthBtn');
    const gis=$('speedOpenGisTopBtn');
    const apply=$('speedApplyDraftBtn');
  
    $('modeGisBtn').disabled=!draft;
    $('modeGisBtn').title=draft?'Open selected Draft geometry':'Generate Speed Draft terlebih dahulu';
    health.disabled=!draft;
    health.title=draft?'Open Draft Health details':'Draft Health tersedia setelah Auto Suggest';
    $('speedReevaluateBtn').textContent=draft?'Re-run Suggest':'Auto Suggest';
  
    gis.disabled=!draft||selected===0;
    gis.textContent=selected?`Edit ${selected} in GIS`:'Edit in GIS';
    apply.disabled=!draft||manualReview>0;
    apply.title=manualReview?`${manualReview} geometry review perlu diselesaikan sebelum Apply`:'';
  
    gis.classList.toggle('primary',Boolean(draft)&&manualReview>0&&selected>0);
    apply.classList.toggle('primary',Boolean(draft)&&manualReview===0);
  }
  
  function openDraftHealthV17(){
    const draft=state.speedAnalysis.draft;
    if(!draft)return;
    openOverlapDrawerV16();
  }
  
  function ensureSpeedV16State(){
    ensureSpeedV15State();
    if(!('showOverlapAlternatives' in state.speedAnalysis))state.speedAnalysis.showOverlapAlternatives=false;
    if(!('previewAlternativeRoute' in state.speedAnalysis))state.speedAnalysis.previewAlternativeRoute=null;
  }
  
  function segmentHeadingV16(segment){
    const path=segment?.path||[];
    if(path.length<2)return 0;
    return bearingDeg(path[0],path.at(-1));
  }
  
  function headingCompatibleV16(a,b){
    const delta=angleDeltaDeg(segmentHeadingV16(a),segmentHeadingV16(b));
    return Math.min(delta,Math.abs(180-delta))<=34;
  }
  
  function segmentOverlapAgainstPrimaryV16(segment,primary){
    const path=segment.path||[];
    if(path.length<2||!primary.length)return{ratio:0,duplicateOf:null};
    const candidates=primary.filter(item=>item.routeId!==segment.routeId&&headingCompatibleV16(segment,item));
    if(!candidates.length)return{ratio:0,duplicateOf:null};
    const hitById=new Map();
    let covered=0;
  
    path.forEach(pos=>{
      let best=null,bestDistance=Infinity;
      candidates.forEach(item=>{
        const bounds=item._overlapBoundsV16||(item._overlapBoundsV16=polygonBounds(item.polygon));
        const inside=pointInsideBounds(pos,bounds)&&pointInPolygon(pos,item.polygon);
        const distance=inside?0:pointToPathMeters(pos,item.path||[]);
        if(distance<=38&&distance<bestDistance){best=item;bestDistance=distance}
      });
      if(best){
        covered++;
        hitById.set(best.id,(hitById.get(best.id)||0)+1);
      }
    });
  
    const duplicateOf=[...hitById.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
    return{ratio:covered/path.length,duplicateOf};
  }
  
  function resolveOverlapAlternativesV16(segments){
    const ordered=[...(segments||[])].sort((a,b)=>(a.routeOrder-b.routeOrder)||(a.segmentOrder-b.segmentOrder));
    const primary=[],alternatives=[];
  
    ordered.forEach(segment=>{
      const overlap=segmentOverlapAgainstPrimaryV16(segment,primary);
      if(overlap.ratio>=.68){
        segment.overlapAlternative=true;
        segment.overlapRatio=overlap.ratio;
        segment.duplicateOf=overlap.duplicateOf;
        alternatives.push(segment);
      }else{
        segment.overlapAlternative=false;
        primary.push(segment);
      }
    });
  
    return{primary,alternatives,rawCount:ordered.length};
  }
  
  function overlapAlternativeGroupsV16(){
    const alternatives=state.speedAnalysis.draft?.overlapAlternatives||[];
    const groups=new Map();
    alternatives.forEach(segment=>{
      const key=segment.routeId||'Alternative';
      if(!groups.has(key))groups.set(key,{
        routeId:key,routeLabel:segment.routeLabel||key,
        sourceUnit:segment.routeSourceUnit||'—',segments:[]
      });
      groups.get(key).segments.push(segment);
    });
    return[...groups.values()].sort((a,b)=>String(a.routeId).localeCompare(String(b.routeId)));
  }
  
  async function generateTelemetryAutoSuggest(){
    ensureSpeedV13State();
    if(state.speedAnalysis.suggestBusy)return;
    state.speedAnalysis.suggestBusy=true;
  
    const target=Math.max(50,Math.min(300,Number($('suggestTargetLength').value)||100));
    state.speedAnalysis.suggestSettings.targetLength=target;
    $('speedSuggestRun').disabled=true;
    $('speedSuggestModal').classList.add('hidden');
  
    try{
      await nextSuggestFrame('1/5 Mencari seluruh movement corridor','scanning telemetry aktif');
      const discovered=discoverDistinctTelemetryRoutes();
      if(!discovered.length)throw new Error('Tidak ada corridor telemetry yang cukup panjang untuk Auto Suggest.');
  
      await nextSuggestFrame('2/5 Mengelompokkan corridor',`${discovered.length} Generated Route`);
      const allSegments=[];
      const routeMeta=[];
  
      for(let r=0;r<discovered.length;r++){
        const item=discovered[r];
        const route=item.route;
        const length=routeLengthMeters(route);
        if(route.length<6||length<180)continue;
  
        await nextSuggestFrame(
          `3/5 Membentuk polygon Route ${String(r+1).padStart(2,'0')}`,
          `${Math.round(length)} m · ${item.unitNo} ${item.mode}`
        );
  
        const halfWidth=estimateCorridorHalfWidth(route);
        const segments=buildAdaptiveSuggestedSegmentsForRoute(route,target,halfWidth,r,item);
        allSegments.push(...segments);
  
        routeMeta.push({
          routeId:`R${String(r+1).padStart(2,'0')}`,
          routeLabel:`Route ${String(r+1).padStart(2,'0')}`,
          sourceUnit:item.unitNo,
          sourceMode:item.mode,
          routeLength:Math.round(length),
          corridorWidth:Math.round(halfWidth*2),
          route:route.map(p=>[p.lon,p.lat]),
          segmentCount:segments.length
        });
      }
  
      if(!allSegments.length)throw new Error('Auto Suggest tidak menghasilkan polygon segment.');
  
      await nextSuggestFrame('4/5 Menghitung telemetry evidence',`${allSegments.length} segment`);
      assignEvidenceToPolygonSegments(allSegments);
  
      allSegments.forEach(seg=>{
        seg.suggestedPlan=roundSuggestedSpeed(seg.avgActual);
        seg.proposedPlan=Number.isFinite(seg.suggestedPlan)?seg.suggestedPlan:seg.currentPlan;
      });
  
      const overlapResolution=resolveOverlapAlternativesV16(allSegments);
      const primarySegments=overlapResolution.primary;
      routeMeta.forEach(route=>{
        route.alternativeCount=overlapResolution.alternatives.filter(seg=>seg.routeId===route.routeId).length;
        route.primaryCount=primarySegments.filter(seg=>seg.routeId===route.routeId).length;
      });
  
      await nextSuggestFrame(
        '5/5 Menyiapkan Review Draft',
        `${primarySegments.length} primary · ${overlapResolution.alternatives.length} overlap alternatives`
      );
  
      archiveCurrentDraftV18();
      const previousDraftVersion=Number(state.speedAnalysis.draftHistory?.[0]?.version)||0;
      const activeVersion=Number(state.speedAnalysis.active?.version)||0;
      state.speedAnalysis.generation+=1;
      state.speedAnalysis.draft={
        version:Math.max(previousDraftVersion,activeVersion)+1,
        parentVersion:previousDraftVersion||activeVersion||null,
        createdAt:Date.now(),
        telemetryStart:state.start,
        telemetryEnd:state.end,
        segments:primarySegments,
        overlapAlternatives:overlapResolution.alternatives,
        _evidenceKey:speedEvidenceKey(),
        algorithmMeta:{
          method:'Adaptive Multi-Route · Overlap Resolved',
          targetLength:target,
          routeCount:routeMeta.length,
          segmentCount:primarySegments.length,
          rawSegmentCount:overlapResolution.rawCount,
          overlapAlternativeCount:overlapResolution.alternatives.length,
          routes:routeMeta,
          discovery:{...state.speedAnalysis.discoveryDiagnostics}
        }
      };
  
      ensureSpeedV15State();
      state.speedAnalysis.undoStack=[];
      state.speedAnalysis.removedSegments=[];
      state.speedAnalysis.selectionBounds=null;
      state.speedAnalysis.showOverlapAlternatives=false;
      state.speedAnalysis.previewAlternativeRoute=null;
      state.speedAnalysis.selectedSegments=new Set(primarySegments.map(seg=>seg.id));
      state.speedAnalysis.expandedSegments.clear();
      state.speedAnalysis.expandedGroups.clear();
      state.speedAnalysis.editedSegments.clear();
      updateSpeedSelectionDerivedUnits();
  
      // Generated Route is the most useful first view immediately after discovery.
      state.speedAnalysis.groupBy='route';
  
      computeSpeedCoverageDiagnosticsV15(primarySegments);
  
      refreshSpeedAnalysis();
      fitData();
  
      showSpeedNotice(
        `Auto Suggest selesai: ${primarySegments.length} primary segment · ${overlapResolution.alternatives.length} shared-trunk alternatives disembunyikan.`
      );
    }catch(err){
      console.error(err);
      showSpeedNotice(err?.message||'Auto Suggest gagal.');
    }finally{
      state.speedAnalysis.suggestBusy=false;
      $('speedSuggestRun').disabled=false;
      $('loadingMask')?.classList.add('hidden');
      const title=$('loadingMask')?.querySelector('.title');
      if(title)title.textContent='Memuat data Cycle Time';
      if($('loadingText'))$('loadingText').textContent='Membaca fixture BRCB dan layer peta.';
    }
  }
  
  function speedGroupKey(seg,groupBy){
    if(groupBy==='route')return seg.routeLabel||seg.routeId||'Route';
    if(groupBy==='road')return seg.roadName?.trim()||'Belum diberi nama';
    if(groupBy==='status')return speedDisplayStatus(seg);
    return null;
  }
  
  function groupIdForSegment(seg,groupBy){
    if(groupBy==='none')return null;
    return `group:${groupBy}:${speedGroupKey(seg,groupBy)}`;
  }
  
  function revealSpeedSegmentInGrid(segmentId){
    const seg=activeSpeedSegments().find(s=>s.id===segmentId);
    if(!seg)return;
  
    ensureSpeedV12State();
    const groupBy=state.speedAnalysis.groupBy||'none';
  
    if(groupBy!=='none'){
      const gid=groupIdForSegment(seg,groupBy);
      if(gid&&!state.speedAnalysis.expandedGroups.has(gid)){
        state.speedAnalysis.expandedGroups.add(gid);
        renderSpeedTable();
      }
    }
  
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const node=state.gridApi?.getRowNode?.(`segment:${segmentId}`);
        if(node){
          try{
            state.gridApi.ensureNodeVisible(node,'middle');
            state.gridApi.flashCells?.({rowNodes:[node]});
          }catch{}
        }
      });
    });
  }
  
  function selectSpeedSegments(ids,fit=false,source='generic'){
    if(state.playback.active)closePlayback();
    state.speedAnalysis.selectedSegments=new Set(ids);
    updateSpeedSelectionDerivedUnits();
    syncSpeedGridSelection();
    renderSpeedMapLayer();
    renderSpeedRibbon();
  
    if(ids.size===1){
      const id=[...ids][0];
      revealSpeedSegmentInGrid(id);
    }
    if(fit)fitSpeedSegments(ids);
  }
  
  /* Override map layer so all discovered route centerlines can be inspected. */
  function renderSpeedMapLayer(){
    if(!state._mapReady)return;
    mapSourceSet('speed-segment-src',{type:'FeatureCollection',features:speedSegmentFeatures()});
  
    const routes=state.speedAnalysis.draft?.algorithmMeta?.routes||[];
    const activeRouteIds=new Set(activeSpeedSegments().map(seg=>seg.routeId).filter(Boolean));
    const features=routes
      .filter(r=>activeRouteIds.has(r.routeId)&&Array.isArray(r.route)&&r.route.length>=2)
      .map(r=>({
        type:'Feature',
        properties:{routeId:r.routeId,routeLabel:r.routeLabel},
        geometry:{type:'LineString',coordinates:r.route}
      }));
  
    mapSourceSet('speed-suggest-route-src',{type:'FeatureCollection',features});
    const uncovered=state.speedAnalysis.coverageDiagnostics?.uncoveredFeatures||[];
    mapSourceSet('speed-uncovered-src',{type:'FeatureCollection',features:uncovered});
    const previewRoute=state.speedAnalysis.previewAlternativeRoute;
    const alternatives=(state.speedAnalysis.draft?.overlapAlternatives||[])
      .filter(seg=>!previewRoute||seg.routeId===previewRoute)
      .map(seg=>({
        type:'Feature',
        properties:{segmentId:seg.id,routeId:seg.routeId,duplicateOf:seg.duplicateOf||''},
        geometry:{type:'Polygon',coordinates:[seg.polygon]}
      }));
    mapSourceSet('speed-overlap-alt-src',{type:'FeatureCollection',features:alternatives});
    mapVisibility('speed-overlap-alt-fill',Boolean(state.speedAnalysis.showOverlapAlternatives));
    mapVisibility('speed-overlap-alt-line',Boolean(state.speedAnalysis.showOverlapAlternatives));
    renderSpeedCoverageSummaryV15();
  }
  
  /* Richer ribbon for multi-route output. */
  function renderSpeedRibbon(){
    ensureSpeedV13State();
    const draft=state.speedAnalysis.draft;
    const active=state.speedAnalysis.active;
    const segments=activeSpeedSegments();
    const actuals=segments.map(s=>s.avgActual).filter(Number.isFinite);
    const reviewed=segments.filter(s=>s.reviewed).length;
  
    $('speedLayerState').textContent=draft
      ?`Review Draft v${draft.version}`
      :(active?`Active v${active.version}`:'Belum ada segment layer');
  
    if(draft?.algorithmMeta?.routes){
      const m=draft.algorithmMeta;
      $('speedReviewSummary').textContent=`${m.segmentCount} primary segments · ${m.routeCount} routes`;
    }else if(draft&&!active){
      $('speedReviewSummary').textContent=`${reviewed} Reviewed · ${segments.length-reviewed} Suggested`;
    }else if(draft&&active){
      const changes=segments.reduce((m,s)=>(m[s.change]=(m[s.change]||0)+1,m),{});
      $('speedReviewSummary').textContent=Object.entries(changes).map(([k,v])=>`${v} ${k}`).join(' · ');
    }else{
      $('speedReviewSummary').textContent=active?'Active segment layer':'No Draft yet';
    }
  
    $('speedGlobalPlan').textContent=Number.isFinite(getGlobalSpeedPlan())?fmt(getGlobalSpeedPlan(),0):'—';
    $('speedAvgActual').textContent=actuals.length?fmt(actuals.reduce((a,b)=>a+b,0)/actuals.length,1):'—';
    $('speedSegmentCount').textContent=segments.length?fmtInt(segments.length):'—';
    $('speedReviewedCount').textContent=segments.length?`${reviewed}/${segments.length}`:'—';
    $('speedApplyDraftBtn').disabled=!draft;
    $('speedReevaluateBtn').textContent=active?'↻ Re-evaluate':'✦ Auto Suggest';
    renderSpeedTopActionsV17();
  }
  
  function updateDraftAlgorithmCountsV15(){
    const draft=state.speedAnalysis.draft;
    if(!draft?.algorithmMeta)return;
    draft.algorithmMeta.segmentCount=draft.segments.length;
    draft.algorithmMeta.overlapAlternativeCount=draft.overlapAlternatives?.length||0;
    draft.algorithmMeta.rawSegmentCount=draft.segments.length+(draft.overlapAlternatives?.length||0);
    const routeIds=new Set(draft.segments.map(seg=>seg.routeId).filter(Boolean));
    draft.algorithmMeta.routeCount=routeIds.size;
    if(Array.isArray(draft.algorithmMeta.routes)){
      draft.algorithmMeta.routes.forEach(route=>{
        route.segmentCount=draft.segments.filter(seg=>seg.routeId===route.routeId).length;
      });
    }
  }
  
  function refreshDraftCleanupV15(message){
    const draft=state.speedAnalysis.draft;
    if(!draft)return;
    updateDraftAlgorithmCountsV15();
    assignEvidenceToPolygonSegments(draft.segments);
    draft.segments.forEach(seg=>{
      seg.suggestedPlan=roundSuggestedSpeed(seg.avgActual);
      if(!state.speedAnalysis.editedSegments.has(seg.id)){
        seg.proposedPlan=Number.isFinite(seg.suggestedPlan)?seg.suggestedPlan:seg.currentPlan;
      }
    });
    computeSpeedCoverageDiagnosticsV15(draft.segments);
    refreshSpeedAnalysis();
    if(message)showSpeedNotice(message);
  }
  
  function removeSelectedSpeedSegmentsV15(){
    ensureSpeedV15State();
    const draft=state.speedAnalysis.draft;
    const selected=state.speedAnalysis.selectedSegments;
    if(!draft||!selected.size)return;
    const items=draft.segments
      .map((segment,index)=>({segment,index}))
      .filter(item=>selected.has(item.segment.id));
    if(!items.length)return;
  
    const ids=new Set(items.map(item=>item.segment.id));
    draft.segments=draft.segments.filter(seg=>!ids.has(seg.id));
    state.speedAnalysis.removedSegments.push(...items.map(item=>({
      id:item.segment.id,segment:item.segment,index:item.index,removedAt:Date.now()
    })));
    state.speedAnalysis.undoStack.push({type:'remove',items});
    state.speedAnalysis.selectedSegments.clear();
    state.mapSelectedUnits.clear();
    refreshDraftCleanupV15(`${items.length} segment dikeluarkan dari Draft. Undo masih tersedia.`);
  }
  
  function undoSpeedCleanupV15(){
    ensureSpeedV15State();
    const draft=state.speedAnalysis.draft;
    const action=state.speedAnalysis.undoStack.pop();
    if(!draft||!action)return;
  
    if(action.type==='remove'){
      const restoredIds=new Set(action.items.map(item=>item.segment.id));
      action.items.sort((a,b)=>a.index-b.index).forEach(item=>{
        draft.segments.splice(Math.min(item.index,draft.segments.length),0,item.segment);
      });
      state.speedAnalysis.removedSegments=state.speedAnalysis.removedSegments
        .filter(item=>!restoredIds.has(item.id));
      state.speedAnalysis.selectedSegments=new Set(restoredIds);
      refreshDraftCleanupV15(`${restoredIds.size} segment dipulihkan ke Draft.`);
      return;
    }
  
    if(action.type==='append'){
      const ids=new Set(action.segmentIds);
      draft.segments=draft.segments.filter(seg=>!ids.has(seg.id));
      if(Array.isArray(draft.algorithmMeta?.routes)){
        const routeIds=new Set(action.routeIds||[]);
        draft.algorithmMeta.routes=draft.algorithmMeta.routes.filter(route=>!routeIds.has(route.routeId));
      }
      state.speedAnalysis.selectedSegments.clear();
      refreshDraftCleanupV15(`${ids.size} segment hasil Suggest Selected Area dibatalkan.`);
    }
  }
  
  function segmentMostlyRepresentedV15(segment,existing){
    const points=segment.path||[];
    if(!points.length)return false;
    let hits=0;
    points.forEach(pos=>{
      if(existing.some(seg=>{
        const bounds=seg._coverageBoundsV15||(seg._coverageBoundsV15=polygonBounds(seg.polygon));
        return pointInsideBounds(pos,bounds)&&pointInPolygon(pos,seg.polygon);
      }))hits++;
    });
    return hits/points.length>=.70;
  }
  
  async function suggestFromSelectedAreaV15(){
    ensureSpeedV15State();
    const draft=state.speedAnalysis.draft;
    const bounds=state.speedAnalysis.selectionBounds;
    if(!draft||!bounds)return;
    if(state.speedAnalysis.suggestBusy)return;
    state.speedAnalysis.suggestBusy=true;
    $('speedSuggestSelectionBtn').disabled=true;
  
    try{
      await nextSuggestFrame('1/3 Membaca area pilihan','uncovered telemetry');
      const discovered=discoverDistinctTelemetryRoutes(bounds);
      if(!discovered.length)throw new Error('Tidak ada traversal telemetry yang cukup panjang di area pilihan.');
  
      const existing=[...draft.segments];
      const routeBase=Math.max(0,...existing.map(seg=>Number(seg.routeOrder)||0));
      const target=Math.max(50,Math.min(300,Number(state.speedAnalysis.suggestSettings?.targetLength)||100));
      const newSegments=[];
      const newRoutes=[];
  
      await nextSuggestFrame('2/3 Membentuk kandidat segment',`${discovered.length} corridor`);
      discovered.forEach((item,index)=>{
        const routeIndex=routeBase+index;
        const halfWidth=estimateCorridorHalfWidth(item.route);
        const segments=buildAdaptiveSuggestedSegmentsForRoute(item.route,target,halfWidth,routeIndex,item)
          .filter(seg=>!segmentMostlyRepresentedV15(seg,existing));
        if(!segments.length)return;
        newSegments.push(...segments);
        newRoutes.push({
          routeId:`R${String(routeIndex+1).padStart(2,'0')}`,
          routeLabel:`Route ${String(routeIndex+1).padStart(2,'0')}`,
          sourceUnit:item.unitNo,sourceMode:item.mode,
          routeLength:Math.round(routeLengthMeters(item.route)),
          corridorWidth:Math.round(halfWidth*2),
          route:item.route.map(p=>[p.lon,p.lat]),segmentCount:segments.length,
          source:'selected-area'
        });
      });
  
      if(!newSegments.length)throw new Error('Area pilihan sudah terwakili Draft; tidak ada segment baru yang ditambahkan.');
      await nextSuggestFrame('3/3 Menghitung evidence',`${newSegments.length} segment baru`);
      draft.segments.push(...newSegments);
      draft.algorithmMeta.routes.push(...newRoutes);
      state.speedAnalysis.undoStack.push({
        type:'append',segmentIds:newSegments.map(seg=>seg.id),routeIds:newRoutes.map(route=>route.routeId)
      });
      state.speedAnalysis.selectedSegments=new Set(newSegments.map(seg=>seg.id));
      refreshDraftCleanupV15(`${newSegments.length} segment baru ditambahkan dari area pilihan. Review sebelum Apply.`);
    }catch(error){
      console.error(error);
      showSpeedNotice(error?.message||'Suggest Selected Area gagal.');
    }finally{
      state.speedAnalysis.suggestBusy=false;
      $('speedSuggestSelectionBtn').disabled=false;
      $('loadingMask')?.classList.add('hidden');
    }
  }
  
  function setSpeedBoxSelectModeV15(active){
    ensureSpeedV15State();
    state.speedAnalysis.boxSelectActive=Boolean(active);
    document.querySelector('.map-shell')?.classList.toggle('speed-box-selecting',Boolean(active));
    $('speedBoxSelectBtn')?.classList.toggle('active',Boolean(active));
    if($('speedBoxSelectBtn'))$('speedBoxSelectBtn').textContent=active?'Drag on Map…':'Box Select';
    const map=state.mapRoot;
    if(map?.dragPan){
      if(active)map.dragPan.disable();else map.dragPan.enable();
    }
  }
  
  function finishSpeedBoxSelectionV15(start,end){
    const map=state.mapRoot;
    if(!map)return;
    const a=map.unproject([start.x,start.y]),b=map.unproject([end.x,end.y]);
    const bounds={
      minLon:Math.min(a.lng,b.lng),maxLon:Math.max(a.lng,b.lng),
      minLat:Math.min(a.lat,b.lat),maxLat:Math.max(a.lat,b.lat)
    };
    state.speedAnalysis.selectionBounds=bounds;
    const ids=new Set(activeSpeedSegments()
      .filter(seg=>{
        const anchor=seg.centroid||seg.path?.[Math.floor((seg.path?.length||1)/2)];
        return pointInsideSelectionBoundsV15(anchor,bounds);
      })
      .map(seg=>seg.id));
    setSpeedBoxSelectModeV15(false);
    selectSpeedSegments(ids,false,'box');
    syncSpeedGridSelection();
    showSpeedNotice(ids.size
      ?`${ids.size} primary segment dipilih. GIS handoff tersedia pada tray di atas analysis dock.`
      :'Tidak ada segment di area ini. Suggest Selected Area dapat mencoba menutup gap telemetry.');
  }
  
  function bindSpeedBoxSelectionV15(){
    const surface=$('deck-map'),box=$('speedSelectionBox');
    if(!surface||!box||surface.dataset.speedBoxBound==='1')return;
    surface.dataset.speedBoxBound='1';
    let start=null;
  
    surface.addEventListener('pointerdown',event=>{
      if(!state.speedAnalysis.boxSelectActive||state.analysisMode!=='speed'||event.button!==0)return;
      event.preventDefault();event.stopPropagation();
      const rect=surface.getBoundingClientRect();
      start={x:event.clientX-rect.left,y:event.clientY-rect.top};
      box.style.left=`${start.x}px`;box.style.top=`${start.y}px`;
      box.style.width='0px';box.style.height='0px';box.style.display='block';
    },true);
  
    document.addEventListener('pointermove',event=>{
      if(!start)return;
      const rect=surface.getBoundingClientRect();
      const end={x:event.clientX-rect.left,y:event.clientY-rect.top};
      box.style.left=`${Math.min(start.x,end.x)}px`;
      box.style.top=`${Math.min(start.y,end.y)}px`;
      box.style.width=`${Math.abs(end.x-start.x)}px`;
      box.style.height=`${Math.abs(end.y-start.y)}px`;
    },true);
  
    document.addEventListener('pointerup',event=>{
      if(!start)return;
      event.preventDefault();event.stopPropagation();
      const rect=surface.getBoundingClientRect();
      const end={x:event.clientX-rect.left,y:event.clientY-rect.top};
      const origin=start;start=null;box.style.display='none';
      if(Math.hypot(end.x-origin.x,end.y-origin.y)<8){setSpeedBoxSelectModeV15(false);return}
      finishSpeedBoxSelectionV15(origin,end);
    },true);
  }
  
  function renderOverlapDrawerV16(){
    ensureSpeedV16State();
    const groups=overlapAlternativeGroupsV16();
    const count=groups.reduce((sum,group)=>sum+group.segments.length,0);
    const health=state.speedAnalysis.coverageDiagnostics;
    $('speedOverlapDrawerMeta').textContent=health
      ?`${fmt(health.coveragePct,1)}% coverage · ${fmtInt(health.uncovered)} gaps · ${fmtInt(health.conflictSegments)} manual review · ${count} alternatives`
      :(count?`${count} shared-trunk alternatives`:'Draft Health belum tersedia.');
    $('speedOverlapList').innerHTML=groups.length?groups.map(group=>`
      <div class="speed-overlap-route">
        <div>
          <strong>${group.routeLabel}</strong>
          <small>${group.segments.length} alternative · ${group.sourceUnit}</small>
        </div>
        <div class="speed-overlap-route-actions">
          <button type="button" data-overlap-preview="${group.routeId}">Preview</button>
          <button class="primary" type="button" data-overlap-use="${group.routeId}">Use route</button>
        </div>
      </div>
    `).join(''):'<div class="small" style="padding:12px 2px">Draft utama sudah bersih dari duplicate corridor.</div>';
  }
  
  function openOverlapDrawerV16(){
    ensureSpeedV16State();
    state.speedAnalysis.showOverlapAlternatives=true;
    state.speedAnalysis.previewAlternativeRoute=null;
    renderOverlapDrawerV16();
    $('speedOverlapDrawer').classList.remove('hidden');
    renderSpeedMapLayer();
  }
  
  function closeOverlapDrawerV16(){
    ensureSpeedV16State();
    state.speedAnalysis.showOverlapAlternatives=false;
    state.speedAnalysis.previewAlternativeRoute=null;
    $('speedOverlapDrawer').classList.add('hidden');
    renderSpeedMapLayer();
  }
  
  function previewAlternativeRouteV16(routeId){
    ensureSpeedV16State();
    state.speedAnalysis.showOverlapAlternatives=true;
    state.speedAnalysis.previewAlternativeRoute=routeId;
    renderSpeedMapLayer();
    const ids=new Set((state.speedAnalysis.draft?.overlapAlternatives||[])
      .filter(seg=>seg.routeId===routeId).map(seg=>seg.duplicateOf).filter(Boolean));
    if(ids.size)fitSpeedSegments(ids);
    showSpeedNotice(`${routeId} ditampilkan sebagai garis putus-putus. Draft utama belum berubah.`);
  }
  
  function useAlternativeRouteV16(routeId){
    const draft=state.speedAnalysis.draft;
    if(!draft)return;
    const chosen=(draft.overlapAlternatives||[]).filter(seg=>seg.routeId===routeId);
    if(!chosen.length)return;
    const duplicateIds=new Set(chosen.map(seg=>seg.duplicateOf).filter(Boolean));
    const displaced=draft.segments.filter(seg=>duplicateIds.has(seg.id));
    const untouched=draft.segments.filter(seg=>!duplicateIds.has(seg.id));
    chosen.forEach(seg=>{
      seg.overlapAlternative=false;seg.overlapRatio=0;seg.duplicateOf=null;
    });
    displaced.forEach((seg,index)=>{
      seg.overlapAlternative=true;
      seg.duplicateOf=chosen[Math.min(index,chosen.length-1)]?.id||chosen[0].id;
    });
    draft.segments=[...untouched,...chosen].sort((a,b)=>(a.routeOrder-b.routeOrder)||(a.segmentOrder-b.segmentOrder));
    draft.overlapAlternatives=[
      ...(draft.overlapAlternatives||[]).filter(seg=>seg.routeId!==routeId),
      ...displaced
    ];
    state.speedAnalysis.selectedSegments=new Set(chosen.map(seg=>seg.id));
    state.speedAnalysis.previewAlternativeRoute=null;
    refreshDraftCleanupV15(`${routeId} dipakai untuk shared corridor. ${displaced.length} segment primer dipindahkan menjadi alternative.`);
    renderOverlapDrawerV16();
  }
  
  function renderSpeedHandoffTrayV16(){
    const tray=$('speedHandoffTray');
    if(!tray)return;
    const draft=state.speedAnalysis.draft;
    const selected=activeSpeedSegments().filter(seg=>state.speedAnalysis.selectedSegments.has(seg.id));
    const visible=state.analysisMode==='speed'&&Boolean(draft)&&selected.length>0;
    tray.classList.toggle('hidden',!visible);
    if(!visible){
      $('speedGisStep')?.classList.remove('active');
      return;
    }
    const routes=[...new Set(selected.map(seg=>seg.routeLabel||seg.routeId).filter(Boolean))];
    tray.style.bottom=`${Math.max(54,currentDockPadding()+8)}px`;
    $('speedHandoffTitle').textContent=`${selected.length} segment ready for GIS`;
    $('speedHandoffMeta').textContent=routes.length<=4?routes.join(' · '):`${routes.length} routes selected`;
    $('speedGisStep')?.classList.add('active');
    $('speedOverlapStep')?.classList.remove('active');
  }
  
  function renderGisWorkspacePreviewV16(segments){
    const svg=$('gisGeometryPreview');
    if(!svg)return;
    const all=(segments||[]).flatMap(seg=>seg.polygon||[]);
    if(!all.length){svg.innerHTML='';return}
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    all.forEach(([x,y])=>{minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)});
    const dx=Math.max(1e-9,maxX-minX),dy=Math.max(1e-9,maxY-minY);
    const scale=Math.min(880/dx,530/dy);
    const ox=60+(880-dx*scale)/2,oy=60+(530-dy*scale)/2;
    const project=([x,y])=>[ox+(x-minX)*scale,oy+(maxY-y)*scale];
    svg.innerHTML=(segments||[]).map((seg,index)=>{
      const points=(seg.polygon||[]).map(project);
      const pointText=points.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const handles=points.slice(0,-1).filter((_,i)=>i%Math.max(1,Math.ceil(points.length/12))===0)
        .map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="#fff" stroke="#172033" stroke-width="2"/>`).join('');
      const label=project(seg.centroid||seg.path?.[Math.floor((seg.path?.length||1)/2)]||seg.polygon[0]);
      return`<g><polygon points="${pointText}" fill="rgba(40,124,148,.16)" stroke="#287c94" stroke-width="2.5"/>${handles}<text x="${label[0].toFixed(1)}" y="${label[1].toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="#172033">${seg.id}</text></g>`;
    }).join('');
  }
  
  function initializeGisWorkspaceTabV17(){
    const workspace=$('speedGisHandoffModal');
    const shell=document.querySelector('.map-shell');
    if(!workspace||!shell||workspace.dataset.workspaceTab==='1')return;
    workspace.dataset.workspaceTab='1';
    workspace.classList.add('gis-tab-workspace');
    workspace.removeAttribute('aria-modal');
    workspace.setAttribute('role','region');
    workspace.setAttribute('aria-label','GIS Workspace');
    shell.appendChild(workspace);
  }
  
  function prepareGisWorkspaceTabV17(){
    const draft=state.speedAnalysis.draft;
    if(!draft)return;
    if(!state.speedAnalysis.selectedSegments.size){
      state.speedAnalysis.selectedSegments=new Set(draft.segments.map(seg=>seg.id));
      updateSpeedSelectionDerivedUnits();
    }
    const ids=[...state.speedAnalysis.selectedSegments];
    const selected=activeSpeedSegments().filter(seg=>state.speedAnalysis.selectedSegments.has(seg.id));
    const center=state.mapRoot?.getCenter?.();
    state.speedAnalysis.gisHandoffContext={
      sourceMode:'speed-analysis',dataset:'speed-segments',intent:'edit-geometry',
      draftVersion:draft.version,segmentIds:ids,
      evidenceUnitIds:[...new Set(selected.flatMap(seg=>seg.unitNos||[]))],
      telemetryStart:state.start,telemetryEnd:state.end,
      viewport:center?{
        longitude:center.lng,latitude:center.lat,zoom:state.mapRoot.getZoom(),
        bearing:state.mapRoot.getBearing(),pitch:state.mapRoot.getPitch()
      }:null
    };
    $('gisDraftVersion').textContent=`v${draft.version}`;
    $('gisSegmentSelection').textContent=ids.length<=4?ids.join(', '):`${ids.length} segments`;
    $('speedGisHandoffMeta').textContent=`Analysis → GIS · Draft v${draft.version} · ${ids.length} selected`;
    $('gisSelectedChips').innerHTML=ids.map(id=>`<span>${id}</span>`).join('');
    renderGisWorkspacePreviewV16(selected);
  }
  
  function speedOpenInGis(){
    if(!state.speedAnalysis.draft)return;
    setAnalysisMode('gis');
  }
  
  function saveGisGeometryToDraftV16(){
    return saveGisGeometryToDraftV18();
  }
  
  /* Keep Generated Route visible in segment rows. */
  function pushSpeedSegmentRows(out,seg){
    out.push({
      id:`segment:${seg.id}`,
      rowType:'segment',
      segmentId:seg.id,
      label:seg.id,
      routeLabel:seg.routeLabel||'—',
      roadName:seg.roadName||'—',
      sta:seg.sta||'—',
      change:seg.coverageConflict?'Manual conflict':(seg.lengthIssue?'Length review':speedDisplayStatus(seg)),
      basis:seg.boundaryReason==='gis-edit'?'GIS geometry'
        :seg.lengthIssue?'Length guard'
        :seg.coverageConflict?'Overlap review'
        :seg.boundaryReason==='geometry'?'Geometry'
        :seg.boundaryReason==='speed'?'Speed pattern'
        :seg.boundaryReason==='length-guard'?'~100m guard'
        :seg.boundaryReason==='tail-merge'?'Tail merge'
        :seg.boundaryReason==='baseline'?'~100m baseline'
        :'—',
      speedPlan:seg.proposedPlan,
      suggested:seg.suggestedPlan,
      avgActual:seg.avgActual,
      distanceKm:seg.distanceKm,
      unitCount:seg.unitNos?.length||0,
      unitNos:seg.unitNos||[]
    });
  
    if(state.speedAnalysis.expandedSegments.has(seg.id)){
      (seg.units||[]).forEach(u=>out.push({
        id:`segment:${seg.id}:unit:${u.unitNo}`,
        rowType:'unitEvidence',
        segmentId:seg.id,
        label:u.unitNo,
        routeLabel:'',
        roadName:'',
        sta:'',
        change:'',
        basis:'',
        speedPlan:null,
        suggested:null,
        avgActual:u.avgSpeed,
        distanceKm:null,
        unitCount:null,
        unitNo:u.unitNo,
        samples:u.samples
      }));
    }
  }
  
  /* Override table with Generated Route column and group styling. */
  function renderSpeedTable(){
    ensureSpeedAnalysis();
    ensureSpeedV12State();
    const rowData=speedRows();
    $('perfTitle').textContent='Segment Performance';
    $('gridSearch').placeholder='Cari route, segment, road, atau unit…';
    $('speedGroupWrap').classList.remove('hidden');
    $('speedGroupBy').value=state.speedAnalysis.groupBy||'none';
  
    const numCell='perf-num-cell',numHead='perf-num-header';
    const columnDefs=[
      {field:'label',headerName:'Segment / Unit',minWidth:170,flex:1.02,cellRenderer:speedHierarchyRenderer,suppressHeaderMenuButton:true},
      {field:'routeLabel',headerName:'Generated Route',width:118,minWidth:105,suppressHeaderMenuButton:true},
      {field:'roadName',headerName:'Road Name',width:125,minWidth:110,cellClass:'speed-road-name',suppressHeaderMenuButton:true},
      {field:'sta',headerName:'STA',width:86,minWidth:78,cellClass:'speed-sta',suppressHeaderMenuButton:true},
      {field:'basis',headerName:'Basis',width:110,minWidth:96,suppressHeaderMenuButton:true},
      {field:'change',headerName:'Review',width:126,minWidth:116,cellRenderer:speedStatusRenderer,suppressHeaderMenuButton:true},
      {field:'speedPlan',headerName:'Speed Plan',width:100,minWidth:92,cellClass:`${numCell} speed-plan-cell`,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,0)} km/h`:'—',suppressHeaderMenuButton:true},
      {field:'suggested',headerName:'Suggested',width:100,minWidth:92,cellClass:`${numCell} speed-suggested-cell`,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,0)} km/h`:'—',suppressHeaderMenuButton:true},
      {field:'avgActual',headerName:'Avg Actual',width:108,minWidth:100,cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value,1)} km/h`:'—',suppressHeaderMenuButton:true},
      {field:'distanceKm',headerName:'Length',width:86,minWidth:78,cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>Number.isFinite(p.value)?`${fmt(p.value*1000,0)} m`:'—',suppressHeaderMenuButton:true},
      {field:'unitCount',headerName:'Unit',width:64,minWidth:60,maxWidth:72,cellClass:numCell,headerClass:numHead,
        valueFormatter:p=>p.value==null?'—':fmtInt(p.value),suppressHeaderMenuButton:true}
    ];
  
    if(!state.gridApi){
      if(!globalThis.agGrid?.createGrid){
        $('performanceGrid').innerHTML='<div class="small" style="padding:14px">Grid belum dapat dimuat.</div>';
        return;
      }
      const baseTheme=agGrid.themeQuartz||agGrid.themeBalham||agGrid.themeAlpine;
      const nativeTheme=baseTheme?.withParams?baseTheme.withParams({
        spacing:5,rowVerticalPaddingScale:.82,headerVerticalPaddingScale:.82,
        accentColor:'#287c94',backgroundColor:'#fff',foregroundColor:'#172033',
        headerBackgroundColor:'#f7f9fb',headerTextColor:'#475467',borderColor:'#dfe3e8',
        rowHoverColor:'#f6fafb',selectedRowBackgroundColor:'#edf7f9',fontSize:12
      }):baseTheme;
  
      state.gridApi=agGrid.createGrid($('performanceGrid'),{
        theme:nativeTheme,rowData,columnDefs,getRowId:p=>p.data.id,
        rowHeight:34,headerHeight:36,
        defaultColDef:{sortable:true,resizable:true,suppressHeaderMenuButton:true},
        rowSelection:{mode:'multiRow',checkboxes:p=>p.node?.data?.rowType==='segment',headerCheckbox:true,enableClickSelection:false},
        isRowSelectable:node=>node.data?.rowType==='segment',
        selectionColumnDef:{pinned:'left',width:44,minWidth:44,maxWidth:44,resizable:false,sortable:false,suppressHeaderMenuButton:true},
        getRowClass:p=>{
          if(p.data?.rowType==='group')return'route-group-row';
          if(p.data?.rowType==='segment'){
            const seg=activeSpeedSegments().find(item=>item.id===p.data.segmentId);
            return seg?.coverageConflict?'speed-segment-row speed-conflict-row':'speed-segment-row';
          }
          return'speed-unit-row';
        },
        onRowSelected:handleGridRowSelected,
        suppressCellFocus:false,animateRows:false
      });
  
      if($('gridSearch').dataset.speedSearchBound!=='1'){
        $('gridSearch').dataset.speedSearchBound='1';
        $('gridSearch').addEventListener('input',e=>{
          state.gridApi?.setGridOption('quickFilterText',e.target.value||'');
        });
      }
    }else{
      state.gridApi.setGridOption('columnDefs',columnDefs);
      state.gridApi.setGridOption('rowData',rowData);
    }
  
    requestAnimationFrame(()=>{
      syncSpeedGridSelection();
      try{state.gridApi?.refreshCells?.({force:true});state.gridApi?.redrawRows?.()}catch{}
    });
  }
  
  /* Speed Analysis UI bindings */
  $('modeCycleBtn').addEventListener('click',()=>setAnalysisMode('cycle'));
  $('modeSpeedBtn').addEventListener('click',()=>setAnalysisMode('speed'));
  $('modeGisBtn').addEventListener('click',()=>speedOpenInGis());
  
  $('speedReevaluateBtn').addEventListener('click',()=>{
    if(state.speedAnalysis.active){
      buildReviewDraftFromActive();
      refreshSpeedAnalysis();
      fitData();
    }else{
      openAutoSuggestModal();
    }
  });
  $('speedApplyDraftBtn').addEventListener('click',applySpeedDraft);
  $('speedMarkReviewedBtn').addEventListener('click',markSelectedSpeedReviewed);
  $('speedEditPlanBtn').addEventListener('click',openSpeedPlanEditor);
  $('speedBoxSelectBtn').addEventListener('click',()=>setSpeedBoxSelectModeV15(!state.speedAnalysis.boxSelectActive));
  $('speedSuggestSelectionBtn').addEventListener('click',suggestFromSelectedAreaV15);
  $('speedRemoveDraftBtn').addEventListener('click',removeSelectedSpeedSegmentsV15);
  $('speedUndoBtn').addEventListener('click',undoSpeedCleanupV15);
  $('speedOpenGisBtn').addEventListener('click',speedOpenInGis);
  $('speedOpenGisTopBtn').addEventListener('click',speedOpenInGis);
  $('speedDraftHealthBtn').addEventListener('click',openDraftHealthV17);
  $('speedHandoffOpen').addEventListener('click',speedOpenInGis);
  $('speedHandoffClear').addEventListener('click',()=>selectSpeedSegments(new Set(),false,'handoff-clear'));
  $('speedOverlapReviewBtn').addEventListener('click',openOverlapDrawerV16);
  $('speedOverlapDrawerClose').addEventListener('click',closeOverlapDrawerV16);
  $('speedOverlapList').addEventListener('click',event=>{
    const preview=event.target.closest('[data-overlap-preview]');
    const use=event.target.closest('[data-overlap-use]');
    if(preview)previewAlternativeRouteV16(preview.dataset.overlapPreview);
    if(use)useAlternativeRouteV16(use.dataset.overlapUse);
  });
  bindSpeedBoxSelectionV15();
  
  $('speedPlanModalClose').addEventListener('click',()=>$('speedPlanModal').classList.add('hidden'));
  $('speedPlanCancel').addEventListener('click',()=>$('speedPlanModal').classList.add('hidden'));
  $('speedPlanSave').addEventListener('click',saveSpeedPlanEditor);
  
  $('speedHistoryBtn').addEventListener('click',()=>{
    renderSpeedHistory();
    $('speedHistoryModal').classList.remove('hidden');
  });
  $('speedHistoryClose').addEventListener('click',()=>$('speedHistoryModal').classList.add('hidden'));
  $('speedHistoryDone').addEventListener('click',()=>$('speedHistoryModal').classList.add('hidden'));
  
  
  /* V12 polygon workflow bindings */
  $('speedGroupBy').addEventListener('change',e=>{
    ensureSpeedV12State();
    state.speedAnalysis.groupBy=e.target.value||'none';
    state.speedAnalysis.expandedGroups.clear();
    renderSpeedTable();
  });
  
  $('speedAssignRoadBtn').addEventListener('click',openRoadNameEditor);
  $('speedRoadModalClose').addEventListener('click',()=>$('speedRoadModal').classList.add('hidden'));
  $('speedRoadCancel').addEventListener('click',()=>$('speedRoadModal').classList.add('hidden'));
  $('speedRoadSave').addEventListener('click',saveRoadNameEditor);
  $('speedRoadNameInput').addEventListener('keydown',e=>{
    if(e.key==='Enter')saveRoadNameEditor();
  });
  
  $('speedGisHandoffClose').addEventListener('click',()=>closeGisWithoutSaveV18());
  $('speedGisHandoffDone').addEventListener('click',()=>closeGisWithoutSaveV18());
  $('speedGisHandoffSimulate').addEventListener('click',saveGisGeometryToDraftV16);
  document.querySelectorAll('[data-gis-tool]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('[data-gis-tool]').forEach(item=>item.classList.toggle('active',item===button));
    $('gisMapStage').dataset.tool=button.dataset.gisTool;
  }));
  
  
  /* V13 Auto Suggest bindings */
  $('speedSuggestClose').addEventListener('click',()=>$('speedSuggestModal').classList.add('hidden'));
  $('speedSuggestCancel').addEventListener('click',()=>$('speedSuggestModal').classList.add('hidden'));
  $('speedSuggestRun').addEventListener('click',generateTelemetryAutoSuggest);
  $('suggestTargetLength').addEventListener('keydown',e=>{
    if(e.key==='Enter')generateTelemetryAutoSuggest();
  });
  
  function playbackClock(ms){
    if(!Number.isFinite(ms))return'--:--:--';
    const d=new Date(ms+8*3600000);
    return [d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()].map(pad).join(':');
  }
  
  function populatePlaybackFocusUnits(){
    const select=$('playbackFocusUnit');
    if(!select)return;
    const units=[...state.mapSelectedUnits];
    select.innerHTML=units.map(u=>`<option value="${String(u).replace(/"/g,'&quot;')}">${u}</option>`).join('');
    if(!units.includes(state.playback.focusedUnit)){
      state.playback.focusedUnit=units[0]||null;
    }
    if(state.playback.focusedUnit)select.value=state.playback.focusedUnit;
  }
  
  function syncPlaybackTelemetry(){
    if(!state.playback.active)return;
  
    const unit=state.playback.focusedUnit||[...state.mapSelectedUnits][0];
    if(!unit)return;
    state.playback.focusedUnit=unit;
  
    const sample=playbackSample(unit,state.playback.currentMs);
    $('playbackFocusUnit').value=unit;
    $('pbLoader').textContent=loaderNameForUnit(unit);
  
    if(!sample){
      $('pbSpeed').textContent='—';
      $('pbStatus').lastChild.nodeValue='—';
      $('pbTime').textContent=playbackClock(state.playback.currentMs);
      $('pbPosition').textContent='—';
      return;
    }
  
    $('pbSpeed').textContent=fmt(sample.speed,1);
    const status=PLM_STATUS[sample.status]||{label:'Unknown',color:'#98a2b3'};
    $('pbStatus').lastChild.nodeValue=status.label;
    $('pbStatusDot').style.background=status.color;
    $('pbTime').textContent=playbackClock(sample.timestamp);
    $('pbPosition').textContent=`${sample.position[1].toFixed(5)}, ${sample.position[0].toFixed(5)}`;
  
    const optional=[
      ['pbPayloadWrap','pbPayload',sample.payload,1],
      ['pbFuelWrap','pbFuel',sample.fuel,0],
      ['pbHmWrap','pbHm',sample.hm,1]
    ];
    optional.forEach(([wrapId,valueId,value,digits])=>{
      const wrap=$(wrapId);
      const has=Number.isFinite(value);
      wrap.classList.toggle('hidden',!has);
      if(has)$(valueId).textContent=fmt(value,digits);
    });
  }
  
  function syncPlaybackUi(force=false){
    if(!state.playback.active)return;
    const p=state.playback;
    const span=Math.max(1,p.endMs-p.startMs);
    const ratio=Math.max(0,Math.min(1,(p.currentMs-p.startMs)/span));
  
    $('playbackClock').textContent=playbackClock(p.currentMs);
    $('playbackTimeline').value=String(Math.round(ratio*1000));
    $('playbackToggle').textContent=p.playing?'❚❚':'▶';
    $('playbackToggle').title=p.playing?'Pause':'Play';
    $('playbackUnitCount').textContent=`${state.mapSelectedUnits.size} unit`;
  
    document.querySelectorAll('[data-play-speed]').forEach(b=>{
      b.classList.toggle('active',Number(b.dataset.playSpeed)===p.speed);
    });
  
    syncPlaybackTelemetry();
  }
  
  function renderPlaybackFrame(){
    applyDeckLayers();
  }
  
  function playbackTick(now){
    const p=state.playback;
    if(!p.active||!p.playing){p.raf=null;return}
  
    if(p.lastFrame==null)p.lastFrame=now;
    const delta=(now-p.lastFrame)*p.speed;
    p.lastFrame=now;
    p.currentMs=Math.min(p.endMs,p.currentMs+delta);
  
    renderPlaybackFrame();
    if(now-p.lastUi>160){
      p.lastUi=now;
      syncPlaybackUi();
    }
  
    if(p.currentMs>=p.endMs){
      p.playing=false;
      p.lastFrame=null;
      syncPlaybackUi(true);
      p.raf=null;
      return;
    }
    p.raf=requestAnimationFrame(playbackTick);
  }
  
  function ensurePlaybackRaf(){
    const p=state.playback;
    if(!p.active||!p.playing||p.raf)return;
    p.lastFrame=null;
    p.raf=requestAnimationFrame(playbackTick);
  }
  
  function startPlayback(){
    if(!state.mapSelectedUnits.size)return;
    const p=state.playback;
    const {startMs,endMs}=playbackRange();
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)return;
  
    const data=buildPlaybackData();
    p.active=true;
    p.playing=true;
    p.speed=p.speed||10;
    p.startMs=startMs;
    p.endMs=endMs;
    p.currentMs=startMs;
    p.lastFrame=null;
    p.lastUi=0;
    p.trips=data.trips;
    p.segments=data.segments;
    p.focusedUnit=[...state.mapSelectedUnits][0]||null;
  
    populatePlaybackFocusUnits();
  
    $('playbackBar').classList.remove('hidden');
    $('playbackTelemetry').classList.remove('hidden');
    $('cycleAnalysisRibbon').classList.add('hidden');
    $('speedAnalysisRibbon').classList.add('hidden');
    document.querySelector('.map-shell')?.classList.add('playback-active');
    window.dispatchEvent(new CustomEvent('cycle:playback-start'));
  
    updateDeckDotTrace();
    syncPlaybackUi(true);
    fitSelectedTrace();
    ensurePlaybackRaf();
  }
  
  function pausePlayback(){
    const p=state.playback;
    p.playing=false;
    p.lastFrame=null;
    if(p.raf)cancelAnimationFrame(p.raf);
    p.raf=null;
    syncPlaybackUi(true);
  }
  
  function stopPlayback(){
    const p=state.playback;
    pausePlayback();
    p.currentMs=p.startMs;
    renderPlaybackFrame();
    syncPlaybackUi(true);
  }
  
  function closePlayback(){
    const p=state.playback;
    if(!p.active)return;
    if(p.raf)cancelAnimationFrame(p.raf);
  
    p.raf=null;
    p.active=false;
    p.playing=false;
    p.lastFrame=null;
    p.trips=[];
    p.segments=[];
    p.focusedUnit=null;
  
    $('playbackBar').classList.add('hidden');
    $('playbackTelemetry').classList.add('hidden');
    document.querySelector('.map-shell')?.classList.remove('playback-active');
    if(state.analysisMode==='speed'){
      $('speedAnalysisRibbon').classList.remove('hidden');
      $('cycleAnalysisRibbon').classList.add('hidden');
    }else{
      $('cycleAnalysisRibbon').classList.remove('hidden');
      $('speedAnalysisRibbon').classList.add('hidden');
    }
    window.dispatchEvent(new CustomEvent('cycle:playback-stop'));
  
    updateDeckDotTrace();
  }
  
  function togglePlayback(){
    const p=state.playback;
    if(!p.active)return;
    if(p.playing){
      pausePlayback();
    }else{
      if(p.currentMs>=p.endMs)p.currentMs=p.startMs;
      p.playing=true;
      syncPlaybackUi(true);
      ensurePlaybackRaf();
    }
  }
  
  $('playbackStartBtn').addEventListener('click',startPlayback);
  $('playbackToggle').addEventListener('click',togglePlayback);
  $('playbackStop').addEventListener('click',stopPlayback);
  $('playbackClose').addEventListener('click',closePlayback);
  
  $('playbackFocusUnit').addEventListener('change',e=>{
    state.playback.focusedUnit=e.target.value||null;
    syncPlaybackTelemetry();
  });
  
  document.querySelectorAll('[data-play-speed]').forEach(b=>b.addEventListener('click',()=>{
    state.playback.speed=Number(b.dataset.playSpeed)||10;
    state.playback.lastFrame=null;
    syncPlaybackUi(true);
  }));
  
  $('playbackTimeline').addEventListener('pointerdown',()=>{
    state.playback.resumeAfterScrub=state.playback.playing;
    pausePlayback();
  });
  $('playbackTimeline').addEventListener('input',e=>{
    const p=state.playback;
    const ratio=Number(e.target.value)/1000;
    p.currentMs=p.startMs+ratio*(p.endMs-p.startMs);
    renderPlaybackFrame();
    syncPlaybackUi(true);
  });
  $('playbackTimeline').addEventListener('pointerup',()=>{
    if(state.playback.resumeAfterScrub){
      state.playback.playing=true;
      state.playback.resumeAfterScrub=false;
      ensurePlaybackRaf();
    }
  });
  
  $('applyBtn').addEventListener('click',()=>{if(state.playback.active)closePlayback();state.trendIndex=0;state.analysisWindow=null;state.focusedLoader=null;state.mapSelectedUnits=new Set();updatePlaybackAction();$('trendWindowLabel').textContent='Seluruh rentang';compute();refresh();fitData()});
  $('resetBtn').addEventListener('click',()=>{if(state.playback.active)closePlayback();state.start=state.initial.start;state.end=state.initial.end;state.interval=state.initial.interval;state.source=state.initial.source;state.selectedLoaders.clear();state.selectedUnits=new Set(state.fixture.unitNos);state.loaderQuery='';state.unitQuery='';state.trendIndex=0;state.analysisWindow=null;state.focusedLoader=null;state.expandedLoaders.clear();state.mapSelectedUnits=new Set();updatePlaybackAction();$('loaderSearch').value='';$('unitSearch').value='';$('intervalLabel').textContent=`${state.interval} detik`;$('timeLabel').textContent=displayRange(state.start,state.end);$('trendWindowLabel').textContent='Seluruh rentang';syncRangeInputs();document.querySelectorAll('[data-source]').forEach(x=>x.classList.toggle('active',x.dataset.source===state.source));updateFilterLabels();compute();refresh();state.measurePoints=[];setTool('pan');fitData()});
  
  function setTool(t){
    state.tool=t;
    state.drawPoints=state.drawPoints||[];
    state.drawClosed=Boolean(state.drawClosed);
  
    $('panTool').classList.toggle('active',t==='pan');
    $('drawTool').classList.toggle('active',t==='draw');
    $('measureTool').classList.toggle('active',t==='measure');
    $('measureReadout').classList.toggle('hidden',t!=='measure');
    $('drawReadout').classList.toggle('hidden',t!=='draw');
  
    if(t!=='measure')state.measurePoints=[];
    else $('measureReadout').textContent='Klik titik awal';
  
    if(t==='draw'){
      state.drawPoints=[];state.drawClosed=false;
      $('drawReadout').textContent='Klik titik polygon · double click untuk selesai';
    }else{
      state.drawPoints=[];state.drawClosed=false;
    }
  
    const map=state.mapRoot;
    if(map&&state._mapReady){
      if(t==='pan'){
        map.dragPan.enable();
        map.doubleClickZoom.enable();
        map.getCanvas().style.cursor='';
      }else{
        map.dragPan.disable();
        if(t==='draw')map.doubleClickZoom.disable(); else map.doubleClickZoom.enable();
        map.getCanvas().style.cursor='crosshair';
      }
    }
  
    updateMeasureLayer();
    updateDrawLayer();
    updateDeckDotTrace();
  }
  $('panTool').addEventListener('click',()=>setTool('pan'));
  $('drawTool').addEventListener('click',()=>setTool(state.tool==='draw'?'pan':'draw'));
  $('measureTool').addEventListener('click',()=>setTool(state.tool==='measure'?'pan':'measure'));
  $('tiltTool').addEventListener('click',()=>{
    const map=state.mapRoot;if(!map||!state._mapReady)return;
    const levels=[0,45,60];
    const current=map.getPitch();
    let idx=levels.findIndex(x=>Math.abs(x-current)<3);
    idx=(idx+1)%levels.length;
    map.easeTo({pitch:levels[idx],duration:420});
  });
  $('zoomIn').addEventListener('click',()=>{
    const map=state.mapRoot;
    if(map&&state._mapReady)map.easeTo({zoom:Math.min(20,map.getZoom()+1),duration:220});
  });
  $('zoomOut').addEventListener('click',()=>{
    const map=state.mapRoot;
    if(map&&state._mapReady)map.easeTo({zoom:Math.max(3,map.getZoom()-1),duration:220});
  });
  $('fitMap').addEventListener('click',fitData);
  $('layerBtn').addEventListener('click',()=>{$('layerPop').classList.toggle('hidden')});
  document.querySelectorAll('[data-layer]').forEach(c=>c.addEventListener('change',()=>{
    state.visible[c.dataset.layer]=c.checked;
    refreshMap();
  }));
  function bindTrendButtons(){
    document.querySelectorAll('[data-trend]').forEach(b=>{
      if(b.dataset.boundTrend==='1')return;
      b.dataset.boundTrend='1';
      b.addEventListener('click',()=>{
    const key=b.dataset.trend;
    if(state.trendMetrics.has(key)){
      if(state.trendMetrics.size===1)return;
      state.trendMetrics.delete(key);
    }else{
      state.trendMetrics.add(key);
    }
    document.querySelectorAll('[data-trend]').forEach(x=>x.classList.toggle('active',state.trendMetrics.has(x.dataset.trend)));
    renderTrend();
  });
    });
  }
  bindTrendButtons();
  function trendIndexAt(clientX){
    const rect=$('trendSvg').getBoundingClientRect(),r=Math.min(1,Math.max(0,(clientX-rect.left)/rect.width));
    return Math.min(state.trendBuckets.length-1,Math.max(0,Math.round(r*(state.trendBuckets.length-1))));
  }
  $('trendSvg').addEventListener('pointerdown',e=>{
    if(!state.trendBuckets.length||e.button!==0)return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const i=trendIndexAt(e.clientX);state.trendDrag={from:i,to:i};
  });
  $('trendSvg').addEventListener('pointermove',e=>{
    const i=trendIndexAt(e.clientX);
    if(Number.isFinite(i)){
      state.trendIndex=i;renderTrend();
      const bucket=state.trendBuckets[i],tt=$('trendTooltip');
      if(bucket){
        tt.innerHTML=`<div class="tt-time">${hourLabel(bucket.t)}</div>`+[...state.trendMetrics].map(metric=>`<div class="tt-row"><span>${TREND_META[metric].label}</span><strong>${trendFormat(trendValue(bucket,metric),metric)}</strong></div>`).join('');
        const box=$('trendContent').getBoundingClientRect();
        tt.style.left=`${Math.min(box.width-170,Math.max(6,e.clientX-box.left+10))}px`;
        tt.style.top=`${Math.max(42,e.clientY-box.top-10)}px`;
        tt.classList.remove('hidden');
      }
    }
    if(state.trendDrag){state.trendDrag.to=i}
  });
  $('trendSvg').addEventListener('pointerleave',()=>{$('trendTooltip').classList.add('hidden')});
  $('trendSvg').addEventListener('pointerup',e=>{
    if(!state.trendDrag)return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const a=Math.min(state.trendDrag.from,state.trendDrag.to),b=Math.max(state.trendDrag.from,state.trendDrag.to);
    state.trendDrag=null;
    const first=state.trendBuckets[a],last=state.trendBuckets[b];
    if(!first||!last)return;
    state.analysisWindow={startMs:first.t,endMs:last.t+3600000};
    $('trendWindowLabel').textContent=`${hourLabel(first.t)} – ${hourLabel(last.t+3600000)}`;
    compute();refresh();fitData();
  });
  $('trendSvg').addEventListener('dblclick',()=>{
    state.analysisWindow=null;$('trendWindowLabel').textContent='Seluruh rentang';compute();refresh();fitData();
  });
  
  async function initDeck(){
    if(!globalThis.maplibregl)throw new Error('MapLibre runtime tidak dapat dimuat');
  
    const map=new maplibregl.Map({
      container:'deck-map',
      style:{
        version:8,
        sources:{},
        layers:[{id:'background',type:'background',paint:{'background-color':'#dfe5ea'}}]
      },
      center:[state.view.longitude,state.view.latitude],
      zoom:state.view.zoom,
      pitch:0,
      bearing:0,
      maxPitch:60,
      dragRotate:true,
      touchPitch:true,
      attributionControl:false,
      renderWorldCopies:false,
      maxZoom:20
    });
  
    state.mapRoot=map;
    state.mapApi=globalThis.maplibregl;
    state.drawPoints=[];
    state.drawClosed=false;
  
    await new Promise(resolve=>{
      let settled=false;
      const done=()=>{if(settled)return;settled=true;resolve()};
      const timer=setTimeout(done,5000);
      map.once('load',()=>{clearTimeout(timer);done()});
      map.on('error',e=>console.warn('MapLibre:',e?.error||e));
    });
  
    state._mapReady=true;
    ensureMapLayers();
  
    if(globalThis.deck?.MapboxOverlay&&globalThis.deck?.ScatterplotLayer){
      state.deckOverlay=new deck.MapboxOverlay({interleaved:true,layers:[]});
      map.addControl(state.deckOverlay);
    }else{
      console.warn('Deck.GL standalone bundle tidak tersedia; dot trace tidak dirender.');
    }
  
    map.on('move',()=>{
      const c=map.getCenter();
      state.view={
        ...state.view,
        longitude:c.lng,
        latitude:c.lat,
        zoom:map.getZoom(),
        bearing:map.getBearing(),
        pitch:map.getPitch()
      };
      updateMapStatus(state.view);
      const tilt=$('tiltTool');
      if(tilt){
        const deg=Math.round(map.getPitch());
        tilt.dataset.pitch=`${deg}°`;
        tilt.title=`Tilt ${deg}°`;
      }
    });
  
    map.on('click',e=>{
      if(state.tool==='measure'){
        const p=[e.lngLat.lng,e.lngLat.lat];
        if(state.measurePoints.length>=2)state.measurePoints=[];
        state.measurePoints.push(p);
        if(state.measurePoints.length===1){
          $('measureReadout').textContent='Klik titik akhir';
        }else{
          const[a,b]=state.measurePoints,d=hav(a[0],a[1],b[0],b[1]);
          $('measureReadout').textContent=d>=1?`${fmt(d,2)} km`:`${fmt(d*1000,0)} m`;
        }
        updateMeasureLayer();
        return;
      }
  
      if(state.tool==='draw'){
        state.drawClosed=false;
        state.drawPoints.push([e.lngLat.lng,e.lngLat.lat]);
        $('drawReadout').textContent=`${state.drawPoints.length} titik · double click untuk selesai`;
        updateDrawLayer();
      }
    });
  
    map.on('dblclick',e=>{
      if(state.tool!=='draw')return;
      e.preventDefault();
      if(state.drawPoints.length>=3){
        state.drawClosed=true;
        $('drawReadout').textContent=`Area selesai · ${state.drawPoints.length} titik`;
        updateDrawLayer();
      }
    });
  
    updateMapStatus();
    renderReactMap();
  }
  function fetchWithTimeout(url,{timeout=18000,label='resource',responseType='response'}={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
  
    return fetch(url,{signal:controller.signal,cache:'default'})
      .then(async r=>{
        if(!r.ok)throw new Error(`${label} gagal (${r.status})`);
        if(responseType==='json')return r.json();
        if(responseType==='text')return r.text();
        return r;
      })
      .catch(err=>{
        if(err?.name==='AbortError')throw new Error(`${label} timeout setelah ${Math.round(timeout/1000)} detik`);
        throw err;
      })
      .finally(()=>clearTimeout(timer));
  }
  
  function setBootStatus(title,text){
    const mask=$('loadingMask');
    const titleEl=mask?.querySelector('.title');
    if(titleEl&&title)titleEl.textContent=title;
    if($('loadingText')&&text)$('loadingText').textContent=text;
  }
  
  function showBootError(error){
    const mask=$('loadingMask');
    if(!mask)return;
  
    setBootStatus(
      'Gagal memuat data utama',
      error?.message||'Trace telemetry tidak dapat dimuat.'
    );
  
    const progress=mask.querySelector('.progress');
    if(progress)progress.style.display='none';
  
    let retry=$('bootRetryBtn');
    if(!retry){
      retry=document.createElement('button');
      retry.id='bootRetryBtn';
      retry.type='button';
      retry.className='btn primary';
      retry.style.marginTop='12px';
      retry.textContent='Coba Lagi';
      retry.addEventListener('click',()=>{
        retry.remove();
        if(progress)progress.style.display='';
        boot();
      });
      mask.querySelector('.loadingbox')?.appendChild(retry);
    }
    mask.classList.remove('hidden');
  }
  
  async function loadOptionalMapContext(){
    const results=await Promise.allSettled([
      fetchWithTimeout(URLS.ortho,{timeout:8000,label:'Metadata orthophoto',responseType:'json'}),
      fetchWithTimeout(URLS.boundary,{timeout:8000,label:'Boundary',responseType:'text'}),
      fetchWithTimeout(URLS.roads,{timeout:8000,label:'Road tambang',responseType:'text'})
    ]);
  
    if(results[0].status==='fulfilled')state.orthoMeta=results[0].value;
    if(results[1].status==='fulfilled'){
      try{state.boundary=parseKml(results[1].value)}catch(e){console.warn('Boundary parse skipped:',e)}
    }
    if(results[2].status==='fulfilled'){
      try{state.roads=parseKml(results[2].value)}catch(e){console.warn('Road parse skipped:',e)}
    }
  
    results.forEach((result,index)=>{
      if(result.status==='rejected'){
        console.warn(['Orthophoto','Boundary','Roads'][index]+' optional load skipped:',result.reason);
      }
    });
  
    try{
      if(!state.mapRoot)await initDeck();
      else refreshMap();
      fitData();
    }catch(mapError){
      console.warn('Map runtime optional startup skipped:',mapError);
    }
  }
  
  async function boot(){
    const mask=$('loadingMask');
    const progress=mask?.querySelector('.progress');
    const retry=$('bootRetryBtn');
    retry?.remove();
    if(progress)progress.style.display='';
    mask?.classList.remove('hidden');
  
    try{
      /*
        Regression lock: only the telemetry fixture may block first render.
        Assignment, orthophoto, KML, and map runtime are optional/background.
      */
      setBootStatus('Memuat data Cycle Time','Mengunduh telemetry utama…');
      const fixture=await fetchWithTimeout(
        URLS.trace,
        {timeout:20000,label:'Data telemetry utama',responseType:'json'}
      );
  
      if(!fixture?.traces?.length||!fixture?.unitNos?.length){
        throw new Error('Format data telemetry utama tidak valid');
      }
  
      state.fixture=fixture;
      state.orthoMeta=null;
      state.boundary=null;
      state.roads=null;
      state.assignment=null;
  
      state.start=fixture.startDateTime;
      state.end=fixture.endDateTime;
      state.initial={start:state.start,end:state.end,interval:2,source:'miforce'};
      state.selectedUnits=new Set(fixture.unitNos);
      state.mapSelectedUnits=new Set();
      state.interval=2;
  
      updatePlaybackAction();
      $('timeLabel').textContent=displayRange(state.start,state.end);
      syncRangeInputs();
      updateFilterLabels();
      updateUnitPop();
  
      setBootStatus('Memuat data Cycle Time','Menghitung analytics telemetry…');
      await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  
      compute();
      restoreCycleKpiLabels();
      refresh();
      globalThis.markSurveyFilterAppliedV23?.();
  
      $('applyBtn').disabled=false;
      $('resetBtn').disabled=false;
  
      // Core workspace is ready before optional dependencies begin.
      mask?.classList.add('hidden');
  
      Promise.resolve()
        .then(()=>loadAssignment())
        .then(()=>{
          if(state.analysisMode==='cycle')renderTable();
        })
        .catch(err=>console.warn('Assignment optional load skipped:',err));
  
      loadOptionalMapContext();
    }catch(e){
      console.error('Core boot failed:',e);
      showBootError(e);
    }
  }
  /* V23.1 boot lock: wait until every static workspace node and additive
     extension has been parsed before the asynchronous fixture can render. */
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});
  else boot();
  
  
  /* ===== mapCentricExplorationV2Script ===== */
  
  (function(){
    const run=()=>{
      const mapShell=document.querySelector('.map-shell');
      const performance=document.querySelector('.performance-card');
      const trend=document.querySelector('.trend-card');
      if(!mapShell||!performance||!trend)return;
  
      const dock=document.createElement('section');
      dock.id='analysisDock';
      dock.className='analysis-dock state-half';
      dock.innerHTML=`
        <header id="dockHeader" class="dock-header">
          <button id="dockGrip" class="dock-grab" type="button" title="Klik untuk ganti level, atau drag"></button>
          <span class="dock-title">Analisa Cycle Time</span>
          <nav class="dock-tabs">
            <button class="dock-tab active" type="button" data-dock-tab="performance">Performance</button>
            <button class="dock-tab" type="button" data-dock-tab="trend">Trend Performa</button>
          </nav>
          <span class="dock-spacer"></span>
          <span id="dockStateText" class="dock-state-text">Half · 36%</span>
          <button id="dockCollapse" class="dock-icon-btn" type="button" title="Collapse">⌄</button>
          <button id="dockMaximize" class="dock-icon-btn" type="button" title="Tampilkan semua analisa">⛶</button>
        </header>
        <div class="dock-content">
          <div class="dock-panels">
            <div class="dock-panel dock-performance active"></div>
            <div class="dock-panel dock-trend"></div>
          </div>
        </div>
      `;
      mapShell.appendChild(dock);
      dock.querySelector('.dock-performance').appendChild(performance);
      dock.querySelector('.dock-trend').appendChild(trend);
  
      let playbackRestoreState='half';
      window.addEventListener('cycle:playback-start',()=>{
        playbackRestoreState=stateName==='drag'?'half':stateName;
        setState('collapsed');
      });
      window.addEventListener('cycle:playback-stop',()=>{
        const restore=playbackRestoreState==='full'?'full':'half';
        setState(restore);
      });
  
      const tabs=[...dock.querySelectorAll('[data-dock-tab]')];
      const panels={
        performance:dock.querySelector('.dock-performance'),
        trend:dock.querySelector('.dock-trend')
      };
      let active='performance';
      let stateName='half';
      let drag=null,dragMoved=false;
  
      const shellHeight=()=>mapShell.getBoundingClientRect().height||600;
      const maxHeight=()=>Math.max(380,shellHeight()-12);
      function targetHeight(name){
        if(name==='collapsed')return 46;
        if(name==='full')return maxHeight();
        return Math.max(235,Math.round(shellHeight()*.36));
      }
      function updateMapInsets(){
        const h=dock.getBoundingClientRect().height||46;
        mapShell.style.setProperty('--dock-h',`${h}px`);
        const map=window.state?.mapRoot || null;
        // state is declared globally with const in the prototype script and may
        // not be a window property. Dispatch resize; fit/focus calls read dock size directly.
        setTimeout(()=>window.dispatchEvent(new Event('resize')),0);
      }
      function setActive(name){
        active=name;
        tabs.forEach(t=>t.classList.toggle('active',t.dataset.dockTab===name));
        Object.entries(panels).forEach(([k,p])=>p.classList.toggle('active',k===name));
        setTimeout(()=>{
          try{
            if(typeof state!=='undefined'&&state.fixture){
              if(name==='performance'&&typeof renderTable==='function')renderTable();
              if(name==='trend'&&typeof renderTrend==='function')renderTrend();
            }
          }catch(e){console.warn('Dock refresh:',e)}
          window.dispatchEvent(new Event('resize'));
        },0);
      }
      function applyHeight(px){
        const bounded=Math.max(46,Math.min(maxHeight(),px));
        dock.style.height=`${bounded}px`;
        mapShell.style.setProperty('--dock-h',`${bounded}px`);
        const pct=Math.round(bounded/shellHeight()*100);
        document.getElementById('dockStateText').textContent=
          stateName==='collapsed'?'Collapsed':
          stateName==='full'?`Full · ${pct}%`:`Half · ${pct}%`;
      }
      function setState(name){
        stateName=name;
        dock.classList.remove('state-collapsed','state-half','state-full');
        dock.classList.add(`state-${name}`);
        applyHeight(targetHeight(name));
        document.getElementById('dockCollapse').textContent=name==='collapsed'?'⌃':'⌄';
        document.getElementById('dockCollapse').title=name==='collapsed'?'Buka analisa':'Collapse';
        document.getElementById('dockMaximize').textContent=name==='full'?'↙':'⛶';
        document.getElementById('dockMaximize').title=name==='full'?'Kembali ke Half':'Tampilkan semua analisa';
        setTimeout(()=>{
          window.dispatchEvent(new Event('resize'));
          try{
            const m=typeof state!=='undefined'?state.mapRoot:null;
            m?.resize?.();
          }catch(_){}
        },240);
      }
      function cycleState(){
        if(stateName==='half')setState('full');
        else if(stateName==='full')setState('collapsed');
        else setState('half');
      }
  
      tabs.forEach(t=>t.addEventListener('click',()=>setActive(t.dataset.dockTab)));
      document.getElementById('dockCollapse').addEventListener('click',()=>setState(stateName==='collapsed'?'half':'collapsed'));
      document.getElementById('dockMaximize').addEventListener('click',()=>setState(stateName==='full'?'half':'full'));
  
      const grip=document.getElementById('dockGrip');
      grip.addEventListener('pointerdown',e=>{
        drag={startY:e.clientY,startH:dock.getBoundingClientRect().height,pointerId:e.pointerId};
        dragMoved=false;
        dock.classList.add('dragging');
        document.body.style.cursor='ns-resize';
        document.body.style.userSelect='none';
        grip.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      });
      grip.addEventListener('pointermove',e=>{
        if(!drag)return;
        const delta=drag.startY-e.clientY;
        if(Math.abs(delta)>4)dragMoved=true;
        if(!dragMoved)return;
        stateName='drag';
        applyHeight(drag.startH+delta);
      });
      const endGrip=e=>{
        if(!drag)return;
        const moved=dragMoved;
        const h=dock.getBoundingClientRect().height,H=shellHeight(),max=maxHeight();
        drag=null;dragMoved=false;
        dock.classList.remove('dragging');
        document.body.style.cursor='';document.body.style.userSelect='';
        try{grip.releasePointerCapture?.(e.pointerId)}catch(_){}
        if(!moved){cycleState();return}
        if(h<Math.max(95,H*.15))setState('collapsed');
        else if(h>max*.72)setState('full');
        else setState('half');
      };
      grip.addEventListener('pointerup',endGrip);
      grip.addEventListener('pointercancel',endGrip);
  
      window.addEventListener('resize',()=>{
        if(stateName!=='drag')applyHeight(targetHeight(stateName));
        try{if(typeof state!=='undefined')state.mapRoot?.resize?.()}catch(_){}
      });
  
      setActive('performance');
      setState('half');
      setTimeout(()=>{
        try{
          if(typeof state!=='undefined'&&state.fixture){
            renderTable();
            renderTrend();
            updatePlaybackAction();
          }
        }catch(e){console.warn('Initial dock analytics refresh:',e)}
      },120);
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});
    else run();
  })();
  
  
  /* ===== cycleMapToolKeyboard ===== */
  
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&typeof state!=='undefined'&&(state.tool==='draw'||state.tool==='measure')){
      setTool('pan');
    }
  });
  
  
  /* ===== cycleExportZipV7Script ===== */
  
  (function(){
    const $x=id=>document.getElementById(id);
    const modal=$x('exportModal'),btn=$x('exportBtn'),run=$x('exportRun');
    if(!modal||!btn||!run)return;
  
    const SITE_UTM_ZONE=50;
    const SITE_UTM_HEMISPHERE='N';
    const MAX_TRACE_ROWS_PER_SHEET=750000;
  
    function currentContext(){
      return{
        time:$x('timeLabel')?.textContent||'—',
        loader:$x('loaderLabel')?.textContent||'Semua loader',
        unit:$x('unitLabel')?.textContent||'Semua unit'
      };
    }
    function openExport(){
      const c=currentContext();
      $x('exportTime').textContent=c.time;
      $x('exportLoader').textContent=c.loader;
      $x('exportUnit').textContent=c.unit;
      $x('exportProgress').classList.add('hidden');
      $x('exportProgress').textContent='Menyiapkan file…';
      modal.classList.remove('hidden');
    }
    function closeExport(){
      if(run.disabled)return;
      modal.classList.add('hidden');
    }
    btn.addEventListener('click',openExport);
    $x('exportClose').addEventListener('click',closeExport);
    modal.querySelectorAll('[data-export-close]').forEach(x=>x.addEventListener('click',closeExport));
  
    function safeFilePart(s){
      return String(s||'').replace(/[^\w\-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||'cycle-time';
    }
    function witaText(ms){
      const d=new Date(Number(ms)+8*3600000);
      if(!Number.isFinite(d.getTime()))return '';
      const p=n=>String(n).padStart(2,'0');
      return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
    }
  
    // WGS84 latitude/longitude -> UTM. For BRCB the operational CRS is fixed
    // to Zone 50N so every exported X/Y remains in one comparable grid.
    function latLonToUtm(lat,lon,zone=SITE_UTM_ZONE){
      const a=6378137.0;
      const eccSquared=0.00669438;
      const k0=0.9996;
      const latRad=lat*Math.PI/180;
      const lonRad=lon*Math.PI/180;
      const lonOrigin=(zone-1)*6-180+3;
      const lonOriginRad=lonOrigin*Math.PI/180;
      const eccPrimeSquared=eccSquared/(1-eccSquared);
  
      const N=a/Math.sqrt(1-eccSquared*Math.sin(latRad)*Math.sin(latRad));
      const T=Math.tan(latRad)*Math.tan(latRad);
      const C=eccPrimeSquared*Math.cos(latRad)*Math.cos(latRad);
      const A=Math.cos(latRad)*(lonRad-lonOriginRad);
  
      const M=a*((1-eccSquared/4-3*eccSquared*eccSquared/64-5*eccSquared**3/256)*latRad
        -(3*eccSquared/8+3*eccSquared*eccSquared/32+45*eccSquared**3/1024)*Math.sin(2*latRad)
        +(15*eccSquared*eccSquared/256+45*eccSquared**3/1024)*Math.sin(4*latRad)
        -(35*eccSquared**3/3072)*Math.sin(6*latRad));
  
      const easting=k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*eccPrimeSquared)*A**5/120)+500000;
      let northing=k0*(M+N*Math.tan(latRad)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*eccPrimeSquared)*A**6/720));
      if(lat<0)northing+=10000000;
      return{zone,hemisphere:lat>=0?'N':'S',easting,northing};
    }
  
    function loaderForUnit(unitNo){
      const matches=(state.assignment?.loaders||[])
        .filter(e=>(e.units||[]).includes(unitNo))
        .map(e=>e.loader)
        .filter(Boolean);
      return matches.length?matches.join('; '):'';
    }
  
    function traceHeader(){
      return[
        'Waktu_WITA','Loader','Unit',
        'Latitude','Longitude',
        'UTM_Zone','Hemisphere','X_Easting_m','Y_Northing_m',
        'Speed_kmh'
      ];
    }
  
    function appendTraceSheet(wb,rows,index){
      const ws=XLSX.utils.aoa_to_sheet([traceHeader(),...rows]);
      ws['!cols']=[
        {wch:20},{wch:16},{wch:14},{wch:13},{wch:13},
        {wch:10},{wch:10},{wch:15},{wch:16},{wch:12}
      ];
      XLSX.utils.book_append_sheet(wb,ws,index===1?'Trace':`Trace_${index}`);
    }
  
    async function buildTraceWorkbook(){
      const wb=XLSX.utils.book_new();
      const startMs=state.analysisWindow?.startMs??parseLocal(state.start).getTime();
      const endMs=state.analysisWindow?.endMs??parseLocal(state.end).getTime();
      const stride=Math.max(1,Math.round(state.interval/2));
      let chunk=[],sheetIndex=1,total=0;
  
      for(let i=0;i<state.fixture.traces.length;i++){
        const unitNo=state.fixture.unitNos[i]??'';
        if(!state.selectedUnits.has(unitNo))continue;
        const loader=loaderForUnit(unitNo);
        const [ts,lons,lats,speeds]=state.fixture.traces[i];
  
        for(let k=0;k<ts.length;k+=stride){
          const time=Number(ts[k]);
          if(time<startMs||time>endMs)continue;
          const lon=Number(lons[k]),lat=Number(lats[k]),speed=Number(speeds[k]||0);
          if(![time,lon,lat,speed].every(Number.isFinite))continue;
          const utm=latLonToUtm(lat,lon);
  
          chunk.push([
            witaText(time),
            loader||null,
            unitNo||null,
            lat,
            lon,
            `${utm.zone}${utm.hemisphere}`,
            utm.hemisphere,
            Number(utm.easting.toFixed(3)),
            Number(utm.northing.toFixed(3)),
            Number(speed.toFixed(2))
          ]);
          total++;
  
          if(chunk.length>=MAX_TRACE_ROWS_PER_SHEET){
            appendTraceSheet(wb,chunk,sheetIndex++);
            chunk=[];
            $x('exportProgress').textContent=`Trace ${total.toLocaleString('id-ID')} baris…`;
            await new Promise(r=>setTimeout(r,0));
          }
        }
      }
  
      if(chunk.length||sheetIndex===1)appendTraceSheet(wb,chunk,sheetIndex);
      const data=XLSX.write(wb,{bookType:'xlsx',type:'array',compression:true});
      return{data,total};
    }
  
    function fullPerformanceRows(){
      const result=[];
      const loaderRows=loaderPerformanceRows();
  
      if(loaderRows.length){
        loaderRows.forEach(({entry,rows:units,agg})=>{
          const rit=Math.max(0,agg.ritase);
          result.push({
            Level:'Loader',Loader:entry.loader||'',Unit:'',
            Unit_Count:entry.unitCount??entry.units?.length??units.length,
            Ritase:agg.ritase,
            Avg_Cycle_Time_min:Number.isFinite(agg.avgCycle)?agg.avgCycle/60000:null,
            Avg_Jarak_Muatan_km:rit?agg.loaded/rit:null,
            Avg_Jarak_Kosongan_km:rit?agg.empty/rit:null,
            Avg_Actual_Speed_kmh:Number.isFinite(agg.avgSpeed)?agg.avgSpeed:null
          });
          units.forEach(r=>{
            const ritU=Math.max(0,r.ritase);
            result.push({
              Level:'Unit',Loader:entry.loader||'',Unit:r.unitNo||'',
              Unit_Count:null,Ritase:r.ritase,
              Avg_Cycle_Time_min:Number.isFinite(r.avgCycle)?r.avgCycle/60000:null,
              Avg_Jarak_Muatan_km:ritU?r.loaded/ritU:null,
              Avg_Jarak_Kosongan_km:ritU?r.empty/ritU:null,
              Avg_Actual_Speed_kmh:Number.isFinite(r.avgSpeed)?r.avgSpeed:null
            });
          });
        });
      }else{
        rows().forEach(r=>{
          const rit=Math.max(0,r.ritase);
          result.push({
            Level:'Unit',Loader:'',Unit:r.unitNo||'',
            Unit_Count:null,Ritase:r.ritase,
            Avg_Cycle_Time_min:Number.isFinite(r.avgCycle)?r.avgCycle/60000:null,
            Avg_Jarak_Muatan_km:rit?r.loaded/rit:null,
            Avg_Jarak_Kosongan_km:rit?r.empty/rit:null,
            Avg_Actual_Speed_kmh:Number.isFinite(r.avgSpeed)?r.avgSpeed:null
          });
        });
      }
      return result;
    }
  
    function buildPerformanceWorkbook(){
      if((!state.trendBuckets||!state.trendBuckets.length)&&state.fixture)buildTrendBuckets();
  
      const wb=XLSX.utils.book_new();
      const perf=fullPerformanceRows();
      const perfWs=XLSX.utils.json_to_sheet(perf);
      perfWs['!cols']=[
        {wch:10},{wch:16},{wch:14},{wch:11},{wch:10},
        {wch:20},{wch:22},{wch:24},{wch:22}
      ];
      XLSX.utils.book_append_sheet(wb,perfWs,'Performance');
  
      const trend=(state.trendBuckets||[]).map(b=>({
        Waktu_WITA:witaText(b.t),
        Ritase:b.ritase,
        Avg_Cycle_Time_min:Number.isFinite(b.cycle)?b.cycle/60000:null,
        Jarak_Muatan_km:Number.isFinite(b.loadedDistance)?b.loadedDistance:null,
        Jarak_Kosongan_km:Number.isFinite(b.emptyDistance)?b.emptyDistance:null,
        Avg_Actual_Speed_kmh:Number.isFinite(b.speed)?b.speed:null,
        Stop_Muatan_min:Number.isFinite(b.stop)?b.stop/60000:null
      }));
      const trendWs=XLSX.utils.json_to_sheet(trend);
      trendWs['!cols']=[{wch:20},{wch:10},{wch:20},{wch:20},{wch:22},{wch:22},{wch:18}];
      XLSX.utils.book_append_sheet(wb,trendWs,'Trend Performance');
  
      return XLSX.write(wb,{bookType:'xlsx',type:'array',compression:true});
    }
  
    async function exportZip(){
      if(!globalThis.XLSX||!globalThis.JSZip){
        throw new Error('Library XLSX/ZIP tidak dapat dimuat.');
      }
      if(!state.fixture)throw new Error('Data belum siap.');
  
      run.disabled=true;
      $x('exportClose').disabled=true;
      $x('exportProgress').classList.remove('hidden');
      $x('exportProgress').textContent='Menyiapkan trace UTM + Lat/Lon…';
  
      try{
        const trace=await buildTraceWorkbook();
        $x('exportProgress').textContent='Menyiapkan Performance + Trend…';
        await new Promise(r=>setTimeout(r,0));
        const performance=buildPerformanceWorkbook();
  
        $x('exportProgress').textContent='Membuat ZIP…';
        const zip=new JSZip();
        zip.file('cycle-time-trace.xlsx',trace.data);
        zip.file('cycle-time-performance.xlsx',performance);
        const blob=await zip.generateAsync(
          {type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},
          meta=>{
            $x('exportProgress').textContent=`Membuat ZIP… ${Math.round(meta.percent)}%`;
          }
        );
  
        const a=document.createElement('a');
        a.href=URL.createObjectURL(blob);
        a.download=`cycle-time-${safeFilePart(currentContext().time)}.zip`;
        document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  
        $x('exportProgress').textContent=`Selesai · ${trace.total.toLocaleString('id-ID')} trace rows`;
        setTimeout(()=>modal.classList.add('hidden'),700);
      }finally{
        run.disabled=false;
        $x('exportClose').disabled=false;
      }
    }
  
    run.addEventListener('click',async()=>{
      try{
        await exportZip();
      }catch(e){
        console.error(e);
        $x('exportProgress').classList.remove('hidden');
        $x('exportProgress').textContent=e?.message||'Export gagal.';
        run.disabled=false;
        $x('exportClose').disabled=false;
      }
    });
  
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!modal.classList.contains('hidden')&&!run.disabled)closeExport();
    });
  
    const syncDisabled=()=>{btn.disabled=Boolean($x('resetBtn')?.disabled)};
    new MutationObserver(syncDisabled).observe($x('resetBtn'),{attributes:true,attributeFilter:['disabled']});
    syncDisabled();
  })();
  
  
  /* ===== gisWorkspaceV18Script ===== */
  
  /* GIS Workspace v18 — shared MapLibre/deck.gl map, no secondary preview canvas. */
  function cloneGisValueV18(value){
    if(typeof structuredClone==='function')return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }
  
  function ensureGisWorkspaceV18State(){
    if(!Array.isArray(state.speedAnalysis.draftHistory))state.speedAnalysis.draftHistory=[];
    if(!state.gisWorkspace)state.gisWorkspace={};
    const gis=state.gisWorkspace;
    if(!gis.layers)gis.layers={
      selected:true,review:true,valid:true,alternatives:false,
      trace:true,loading:true,loader:true,roads:true,boundary:false,ortho:false
    };
    if(!Array.isArray(gis.undo))gis.undo=[];
    if(!Array.isArray(gis.redo))gis.redo=[];
    if(!('tool' in gis))gis.tool='select';
    if(!('dirty' in gis))gis.dirty=false;
    if(!('compareOpen' in gis))gis.compareOpen=false;
    if(!('compareFilter' in gis))gis.compareFilter='all';
    return gis;
  }
  
  function archiveCurrentDraftV18(){
    ensureGisWorkspaceV18State();
    const draft=state.speedAnalysis.draft;
    if(!draft)return;
    const history=state.speedAnalysis.draftHistory;
    if(history.some(item=>item.version===draft.version&&item.createdAt===draft.createdAt))return;
    history.unshift({...cloneGisValueV18(draft),archivedAt:Date.now()});
    if(history.length>8)history.length=8;
  }
  
  function gisDraftV18(){return state.speedAnalysis.draft}
  function gisSegmentsV18(){return gisDraftV18()?.segments||[]}
  function gisSelectedSegmentsV18(){
    const ids=state.speedAnalysis.selectedSegments;
    return gisSegmentsV18().filter(segment=>ids.has(segment.id));
  }
  function gisSegmentByIdV18(id){return gisSegmentsV18().find(segment=>segment.id===id)||null}
  
  function initializeGisWorkspaceV18(){
    const workspace=$('speedGisHandoffModal');
    const shell=document.querySelector('.map-shell');
    if(!workspace||!shell)return;
    if(workspace.parentElement!==shell)shell.appendChild(workspace);
    workspace.classList.add('gis-tab-workspace');
    workspace.removeAttribute('aria-modal');
    const commandBar=workspace.querySelector('.gis-command-bar');
    const commandActions=workspace.querySelector('.gis-command-actions');
    const tools=$('gisMapTools');
    if(commandBar&&commandActions&&tools&&tools.parentElement!==commandBar)commandBar.insertBefore(tools,commandActions);
    ensureGisWorkspaceV18State();
    ensureGisMapLayersV18();
    bindGisWorkspaceV18();
    bindGisLayerTreeV19();
  }
  
  function ensureGisMapLayersV18(){
    const map=state.mapRoot;
    if(!map||!state._mapReady)return;
    if(!map.getSource('gis-edit-handles-src')){
      map.addSource('gis-edit-handles-src',{type:'geojson',data:emptyFC()});
      map.addLayer({
        id:'gis-edit-handles-layer',type:'circle',source:'gis-edit-handles-src',
        paint:{
          'circle-radius':['case',['==',['get','midpoint'],1],4,5.5],
          'circle-color':['case',['==',['get','midpoint'],1],'#fff','#287c94'],
          'circle-stroke-color':['case',['==',['get','midpoint'],1],'#287c94','#fff'],
          'circle-stroke-width':2
        }
      });
    }
    if(!map.getSource('gis-diff-src')){
      map.addSource('gis-diff-src',{type:'geojson',data:emptyFC()});
      map.addLayer({
        id:'gis-diff-fill',type:'fill',source:'gis-diff-src',
        paint:{
          'fill-color':['match',['get','change'],'added','#12b76a','removed','#d92d20','modified','#f79009','#98a2b3'],
          'fill-opacity':['case',['==',['get','role'],'before'],.03,.22]
        }
      });
      map.addLayer({
        id:'gis-diff-line',type:'line',source:'gis-diff-src',
        paint:{
          'line-color':['match',['get','change'],'added','#039855','removed','#d92d20','modified','#f79009','#667085'],
          'line-width':['case',['==',['get','role'],'before'],2,3],
          'line-dasharray':['case',['==',['get','role'],'before'],['literal',[3,2]],['literal',[1,0]]]
        }
      });
    }
    if(!map.getSource('gis-issue-src')){
      map.addSource('gis-issue-src',{type:'geojson',data:emptyFC()});
      map.addLayer({
        id:'gis-issue-fill',type:'fill',source:'gis-issue-src',
        paint:{'fill-color':'#f79009','fill-opacity':.34}
      });
      map.addLayer({
        id:'gis-issue-line',type:'line',source:'gis-issue-src',
        paint:{'line-color':'#b54708','line-width':2,'line-dasharray':[2,1]}
      });
    }
    mapVisibility('gis-edit-handles-layer',false);
    mapVisibility('gis-diff-fill',false);
    mapVisibility('gis-diff-line',false);
    mapVisibility('gis-issue-fill',false);
    mapVisibility('gis-issue-line',false);
  }
  
  function prepareGisWorkspaceV18(){
    const draft=gisDraftV18();
    if(!draft)return;
    const gis=ensureGisWorkspaceV18State();
    if(gis.sessionVersion!==draft.version){
      gis.sessionVersion=draft.version;
      gis.originalSegments=cloneGisValueV18(draft.segments);
      gis.undo=[];gis.redo=[];gis.dirty=false;gis.compareOpen=false;
    }
    if(!gis.previousVisible)gis.previousVisible={...state.visible};
    if(!state.speedAnalysis.selectedSegments.size){
      state.speedAnalysis.selectedSegments=new Set(draft.segments.map(segment=>segment.id));
      updateSpeedSelectionDerivedUnits();
    }
    document.querySelectorAll('[data-gis-layer]').forEach(input=>{
      input.checked=Boolean(gis.layers[input.dataset.gisLayer]);
    });
    setGisToolV18('select',false);
    renderGisWorkspaceV18();
    populateGisCompareSelectorsV18();
  }
  
  function leaveGisWorkspaceV18(){
    const gis=state.gisWorkspace;
    if(!gis)return;
    setTool('pan');
    state.mapRoot?.dragPan?.enable?.();
    state.mapRoot?.doubleClickZoom?.enable?.();
    if(gis.previousVisible){state.visible={...gis.previousVisible};gis.previousVisible=null}
    gis.drag=null;
    gis.redrawPoints=[];
    mapSourceSet('gis-edit-handles-src',emptyFC());
    mapSourceSet('gis-diff-src',emptyFC());
    mapSourceSet('gis-issue-src',emptyFC());
    ['gis-edit-handles-layer','gis-diff-fill','gis-diff-line','gis-issue-fill','gis-issue-line'].forEach(id=>mapVisibility(id,false));
  }
  
  function closeGisWithoutSaveV18(){
    const gis=ensureGisWorkspaceV18State();
    const draft=gisDraftV18();
    if(gis.dirty&&!window.confirm('Perubahan GIS belum di-Save ke Draft.\n\nKembali ke Speed Analysis dan batalkan perubahan?'))return;
    if(draft&&gis.dirty&&Array.isArray(gis.originalSegments)){
      draft.segments=cloneGisValueV18(gis.originalSegments);
      gis.dirty=false;gis.undo=[];gis.redo=[];
    }
    setAnalysisMode('speed');
    refreshSpeedAnalysis();
    showSpeedNotice('Perubahan GIS dibatalkan. Review Draft tidak berubah.');
  }
  
  function markGisDirtyV18(label='Geometry berubah'){
    const gis=ensureGisWorkspaceV18State();
    gis.dirty=true;
    $('gisDirtyDot')?.classList.remove('clean');
    $('gisStatusDot')?.classList.add('review');
    if($('gisStatusText'))$('gisStatusText').textContent=label;
    renderGisToolbarStateV18();
  }
  
  function captureGisSegmentsV18(){return cloneGisValueV18(gisSegmentsV18())}
  function pushGisUndoV18(label,before){
    const gis=ensureGisWorkspaceV18State();
    gis.undo.push({label,segments:before||captureGisSegmentsV18()});
    if(gis.undo.length>20)gis.undo.shift();
    gis.redo=[];
    renderGisToolbarStateV18();
  }
  function restoreGisSegmentsV18(segments){
    const draft=gisDraftV18();if(!draft)return;
    draft.segments=cloneGisValueV18(segments);
    state.speedAnalysis.selectedSegments=new Set([...state.speedAnalysis.selectedSegments].filter(id=>draft.segments.some(segment=>segment.id===id)));
    updateSpeedSelectionDerivedUnits();
    renderGisWorkspaceV18();
  }
  function undoGisV18(){
    const gis=ensureGisWorkspaceV18State();
    const action=gis.undo.pop();if(!action)return;
    gis.redo.push({label:action.label,segments:captureGisSegmentsV18()});
    restoreGisSegmentsV18(action.segments);markGisDirtyV18(`Undo · ${action.label}`);
  }
  function redoGisV18(){
    const gis=ensureGisWorkspaceV18State();
    const action=gis.redo.pop();if(!action)return;
    gis.undo.push({label:action.label,segments:captureGisSegmentsV18()});
    restoreGisSegmentsV18(action.segments);markGisDirtyV18(`Redo · ${action.label}`);
  }
  function resetGisWorkspaceV18(){
    const gis=ensureGisWorkspaceV18State();
    if(!gis.originalSegments)return;
    pushGisUndoV18('Reset perubahan GIS');
    restoreGisSegmentsV18(gis.originalSegments);
    markGisDirtyV18('Geometry dikembalikan ke awal sesi');
  }
  
  function updateGisSegmentGeometryV18(segment,polygon,path=segment.path){
    segment.polygon=(polygon||[]).map(point=>[...point]);
    segment.path=(path||[]).map(point=>[...point]);
    segment.centroid=polygonCentroid(segment.polygon);
    segment.distanceKm=segment.path?.length>1?routeLengthMeters(segment.path)/1000:polygonSegmentLengthKm(segment.polygon);
    segment.geometryEdited=true;
    segment.reviewed=false;
    segment.boundaryReason='gis-edit';
    segment.change='Boundary Change';
    state.speedAnalysis.editedSegments.add(segment.id);
  }
  
  function renderGisWorkspaceV18(){
    const draft=gisDraftV18();if(!draft)return;
    const gis=ensureGisWorkspaceV18State();
    renderSpeedMapLayer();
    applyGisLayerVisibilityV18();
    renderGisIssueLayerV18();
    renderGisEditHandlesV18();
    renderGisInspectorV18();
    renderGisToolbarStateV18();
  
    const selected=gisSelectedSegmentsV18();
    const review=draft.segments.filter(segment=>segment.coverageConflict||segment.lengthIssue||!segment.reviewed);
    const valid=draft.segments.filter(segment=>!segment.coverageConflict&&!segment.lengthIssue);
    const alternatives=draft.overlapAlternatives||[];
    $('gisDraftGroupTitle').textContent=`Review Draft v${draft.version}`;
    $('gisDraftLayerCount').textContent=fmtInt(draft.segments.length);
    $('gisSelectedLayerCount').textContent=fmtInt(selected.length);
    $('gisReviewLayerCount').textContent=fmtInt(review.length);
    $('gisValidLayerCount').textContent=fmtInt(valid.length);
    $('gisAlternativeLayerCount').textContent=fmtInt(alternatives.length);
    renderGisLayerTreeV19();
    $('gisDraftVersion').textContent=`v${draft.version}`;
    $('gisSegmentSelection').textContent=selected.length<=3?selected.map(segment=>segment.id).join(', ')||'—':`${selected.length} segments`;
    $('speedGisHandoffMeta').textContent=`Shared map · Draft v${draft.version} · ${selected.length} selected · Active version belum berubah`;
    $('gisStatusSelection').textContent=`${selected.length} segment dipilih`;
    $('gisStatusZoom').textContent=`z${Number(state.mapRoot?.getZoom?.()||0).toFixed(1)}`;
    $('gisDirtyDot').classList.toggle('clean',!gis.dirty);
    $('gisStatusDot').classList.toggle('review',gis.dirty);
    if(!gis.dirty)$('gisStatusText').textContent='Ready';
  }
  
  function applyGisLayerVisibilityV18(){
    const gis=ensureGisWorkspaceV18State();
    const clauses=[];
    if(gis.layers.selected)clauses.push(['==',['get','selected'],1]);
    if(gis.layers.review)clauses.push(['any',['==',['get','conflict'],1],['==',['get','lengthIssue'],1]]);
    if(gis.layers.valid)clauses.push(['all',['==',['get','conflict'],0],['==',['get','lengthIssue'],0]]);
    const filter=clauses.length===1?clauses[0]:(clauses.length?['any',...clauses]:['==',['get','segmentId'],'__none__']);
    const map=state.mapRoot;
    ['speed-segment-fill','speed-segment-casing','speed-segment-layer','speed-segment-label'].forEach(id=>{
      if(map?.getLayer(id))map.setFilter(id,filter);
    });
    state.speedAnalysis.showOverlapAlternatives=Boolean(gis.layers.alternatives);
    mapVisibility('speed-overlap-alt-fill',gis.layers.alternatives);
    mapVisibility('speed-overlap-alt-line',gis.layers.alternatives);
    state.visible.trace=Boolean(gis.layers.trace);
    state.visible.loading=Boolean(gis.layers.loading);
    state.visible.roads=Boolean(gis.layers.roads);
    state.visible.boundary=Boolean(gis.layers.boundary);
    state.visible.ortho=Boolean(gis.layers.ortho);
    mapVisibility('roads-layer',state.visible.roads);
    mapVisibility('boundary-layer',state.visible.boundary);
    mapVisibility('ortho-layer',state.visible.ortho);
    mapVisibility('loader-layer',Boolean(gis.layers.loader));
    updateDeckDotTrace();
  }
  
  function renderGisIssueLayerV18(){
    const gis=ensureGisWorkspaceV18State();
    const byId=new Map(gisSegmentsV18().map(segment=>[segment.id,segment]));
    const seen=new Set(),features=[];
    gisSegmentsV18().forEach(segment=>{
      (segment.conflictWith||[]).forEach(otherId=>{
        const key=[segment.id,otherId].sort().join('|');if(seen.has(key))return;seen.add(key);
        const other=byId.get(otherId),a=polygonBounds(segment.polygon),b=polygonBounds(other?.polygon);
        if(!a||!b)return;
        const minX=Math.max(a[0],b[0]),minY=Math.max(a[1],b[1]),maxX=Math.min(a[2],b[2]),maxY=Math.min(a[3],b[3]);
        if(maxX<=minX||maxY<=minY)return;
        const width=hav(minX,minY,maxX,minY)*1000,height=hav(minX,minY,minX,maxY)*1000;
        features.push({
          type:'Feature',properties:{a:segment.id,b:otherId,area:Math.round(width*height)},
          geometry:{type:'Polygon',coordinates:[[[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY],[minX,minY]]]}
        });
      });
    });
    mapSourceSet('gis-issue-src',{type:'FeatureCollection',features});
    const visible=Boolean(gis.layers.review&&features.length&&!gis.compareOpen);
    mapVisibility('gis-issue-fill',visible);mapVisibility('gis-issue-line',visible);
  }
  
  function renderGisEditHandlesV18(){
    const gis=ensureGisWorkspaceV18State();
    const selected=gisSelectedSegmentsV18();
    const segment=selected.length===1?selected[0]:null;
    const features=[];
    if(segment&&gis.tool==='vertex'){
      const ring=(segment.polygon||[]).slice(0,-1);
      ring.forEach((point,index)=>features.push({type:'Feature',properties:{segmentId:segment.id,index},geometry:{type:'Point',coordinates:point}}));
    }
    mapSourceSet('gis-edit-handles-src',{type:'FeatureCollection',features});
    mapVisibility('gis-edit-handles-layer',features.length>0&&!gis.compareOpen);
  }
  
  function renderGisToolbarStateV18(){
    const gis=ensureGisWorkspaceV18State();
    const selected=gisSelectedSegmentsV18();
    const one=selected.length===1,two=selected.length===2,any=selected.length>0;
    const modeButtons={pan:'gisPanTool',select:'gisSelectTool',box:'gisBoxTool',vertex:'gisVertexTool',redraw:'gisRedrawTool',measure:'gisMeasureTool'};
    Object.entries(modeButtons).forEach(([mode,id])=>$(id)?.classList.toggle('active',gis.tool===mode));
    $('gisVertexTool').disabled=!one;
    $('gisRedrawTool').disabled=!one;
    $('gisSplitTool').disabled=!one;
    $('gisMergeTool').disabled=!two;
    $('gisExcludeTool').disabled=!any;
    $('gisFitSelectionTool').disabled=!any;
    $('gisResetTool').disabled=!gis.originalSegments;
    $('gisUndoTool').disabled=!gis.undo.length;
    $('gisRedoTool').disabled=!gis.redo.length;
    $('gisCompareDraftBtn').disabled=!state.speedAnalysis.draftHistory.length;
    $('gisCompareTool').disabled=!state.speedAnalysis.draftHistory.length;
  }
  
  function setGisToolV18(tool,announce=true){
    const gis=ensureGisWorkspaceV18State();
    gis.tool=tool;
    const map=state.mapRoot;
    if(tool==='measure')setTool('measure');
    else if(tool==='redraw')setTool('draw');
    else setTool('pan');
    if(tool==='box')map?.dragPan?.disable?.();
    const messages={
      pan:'Pan aktif',select:'Klik segment untuk memilih',box:'Drag area untuk Box Select',
      vertex:'Drag vertex untuk mengubah boundary',redraw:'Klik titik boundary · double click untuk selesai',measure:'Klik titik awal dan akhir'
    };
    const readout=$('gisToolReadout');
    if(readout){
      readout.textContent=messages[tool]||tool;
      readout.classList.toggle('hidden',tool==='pan'||tool==='select'||tool==='measure'||tool==='redraw');
    }
    if(announce&&messages[tool])$('gisStatusText').textContent=messages[tool];
    renderGisEditHandlesV18();renderGisToolbarStateV18();
  }
  
  function renderGisInspectorV18(){
    const selected=gisSelectedSegmentsV18();
    const inspector=$('gisInspector');
    if(state.analysisMode==='gis'){
      inspector.classList.add('hidden');
      renderGisToolbarStateV18();
      return;
    }
    if(!selected.length){inspector.classList.add('hidden');return}
    inspector.classList.remove('hidden');
    const multi=selected.length>1;
    const segment=selected[0];
    const review=selected.some(item=>item.coverageConflict||item.lengthIssue||!item.reviewed);
    $('gisInspectorTitle').textContent=multi?`${selected.length} segments selected`:segment.id;
    $('gisInspectorSubtitle').textContent=multi?'Ringkasan pilihan':`${segment.routeLabel||segment.routeId||'Generated Route'} · STA ${segment.sta||'—'}`;
    $('gisInspectorStatus').textContent=review?'Perlu Review':'Geometry valid';
    $('gisInspectorStatus').classList.toggle('valid',!review);
    $('gisInspectorRoad').textContent=multi?'Multiple':(segment.roadName||'Belum di-assign');
    $('gisInspectorRoute').textContent=multi?`${new Set(selected.map(item=>item.routeId)).size} routes`:(segment.routeLabel||segment.routeId||'—');
    $('gisInspectorLength').textContent=`${fmt(selected.reduce((sum,item)=>sum+(Number(item.distanceKm)||0),0)*1000,0)} m`;
    const actuals=selected.map(item=>item.avgActual).filter(Number.isFinite);
    $('gisInspectorSpeed').textContent=actuals.length?`${fmt(actuals.reduce((a,b)=>a+b,0)/actuals.length,1)} km/h`:'—';
    $('gisInspectorUnits').textContent=fmtInt(new Set(selected.flatMap(item=>item.unitNos||[])).size);
    $('gisInspectorGeometry').textContent=review
      ?`${selected.filter(item=>item.coverageConflict).length} overlap · ${selected.filter(item=>item.lengthIssue).length} length review`
      :(selected.some(item=>item.geometryEdited)?'GIS edited':'Auto Suggest');
    $('gisSelectedChips').innerHTML=selected.slice(0,18).map(item=>`<span>${item.id}</span>`).join('')+(selected.length>18?`<span>+${selected.length-18}</span>`:'');
    $('gisInspectorEdit').disabled=selected.length!==1;
    $('gisInspectorReview').disabled=!selected.length;
    $('gisInspectorExclude').disabled=!selected.length;
  }
  
  function selectGisSegmentsV18(ids,{fit=false,popupPoint=null}={}){
    const valid=new Set([...ids].filter(id=>gisSegmentByIdV18(id)));
    state.speedAnalysis.selectedSegments=valid;
    updateSpeedSelectionDerivedUnits();
    renderGisWorkspaceV18();
    if(fit)fitGisSelectionV18();
    if(popupPoint&&valid.size===1)showGisSegmentPopupV18(gisSegmentByIdV18([...valid][0]),popupPoint);
  }
  
  function showGisSegmentPopupV18(segment,lngLat){
    if(!segment||!state.mapRoot)return;
    const node=document.createElement('div');
    const status=segment.coverageConflict?'Overlap Review':segment.lengthIssue?'Length Review':segment.geometryEdited?'GIS Edited':'Valid';
    node.innerHTML=`
      <div class="gis-popup-head"><strong>${escapeGisTreeV19(segment.id)}</strong><span class="gis-popup-status">${status}</span></div>
      <div class="gis-popup-kv"><span>Route</span><b>${escapeGisTreeV19(segment.routeLabel||segment.routeId||'Generated Route')}</b></div>
      <div class="gis-popup-kv"><span>Road Name</span><b>${escapeGisTreeV19(segment.roadName||'Belum di-assign')}</b></div>
      <div class="gis-popup-kv"><span>Panjang</span><b>${fmt((segment.distanceKm||0)*1000,0)} m</b></div>
      <div class="gis-popup-kv"><span>Actual Speed</span><b>${Number.isFinite(segment.avgActual)?`${fmt(segment.avgActual,1)} km/h`:'—'}</b></div>
      <div class="gis-popup-kv"><span>Unit Evidence</span><b>${fmtInt((segment.unitNos||[]).length)}</b></div>
      <div class="gis-popup-kv"><span>Geometry</span><b>${segment.geometryEdited?'Sudah diedit':status}</b></div>
      <div class="gis-popup-actions">
        <button data-popup-fit>Fit</button>
        <button data-popup-rename>Rename</button>
        <button data-popup-review>Review</button>
        <button class="primary" data-popup-edit>Edit Geometry</button>
        <button class="danger" data-popup-exclude>Keluarkan</button>
      </div>`;
    const popup=new maplibregl.Popup({closeButton:true,offset:9,className:'gis-segment-popup'}).setLngLat(lngLat).setDOMContent(node).addTo(state.mapRoot);
    node.querySelector('[data-popup-fit]').addEventListener('click',()=>{selectGisSegmentsV18(new Set([segment.id]),{fit:true});popup.remove()});
    node.querySelector('[data-popup-rename]').addEventListener('click',()=>{popup.remove();renameGisSegmentV19(segment.id)});
    node.querySelector('[data-popup-review]').addEventListener('click',()=>{selectGisSegmentsV18(new Set([segment.id]));markGisReviewedV18();popup.remove()});
    node.querySelector('[data-popup-edit]').addEventListener('click',()=>{selectGisSegmentsV18(new Set([segment.id]));setGisToolV18('vertex');popup.remove()});
    node.querySelector('[data-popup-exclude]').addEventListener('click',()=>{selectGisSegmentsV18(new Set([segment.id]));excludeGisSelectionV18();popup.remove()});
  }
  
  function fitGisCoordinatesV18(points,maxZoom=18){
    const map=state.mapRoot;if(!map||!points.length)return;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    points.forEach(([x,y])=>{if(Number.isFinite(x)&&Number.isFinite(y)){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}});
    if(![minX,minY,maxX,maxY].every(Number.isFinite))return;
    map.fitBounds([[minX,minY],[maxX,maxY]],{padding:{top:76,right:28,bottom:24,left:306},duration:420,maxZoom});
  }
  function fitGisSelectionV18(){fitGisCoordinatesV18(gisSelectedSegmentsV18().flatMap(segment=>segment.polygon||[]))}
  function fitGisDraftV18(){fitGisCoordinatesV18(gisSegmentsV18().flatMap(segment=>segment.polygon||[]),17)}
  
  function splitGisSegmentV18(){
    const selected=gisSelectedSegmentsV18();if(selected.length!==1)return;
    const segment=selected[0],path=segment.path||[];
    if(path.length<4){showSpeedNotice('Segment ini tidak memiliki centerline yang cukup untuk Split.');return}
    const mid=Math.floor(path.length/2),pathA=path.slice(0,mid+1),pathB=path.slice(mid);
    const width=Math.max(5,Number(gisDraftV18()?.algorithmMeta?.corridorWidth||24)/2);
    pushGisUndoV18(`Split ${segment.id}`);
    updateGisSegmentGeometryV18(segment,corridorPolygonFromRoute(pathA,width),pathA);
    const used=new Set(gisSegmentsV18().map(item=>item.id));let index=1,newId;
    do{newId=`SEG-GIS-${String(index++).padStart(2,'0')}`}while(used.has(newId));
    const created={...cloneGisValueV18(segment),id:newId,reviewed:false,change:'New Segment',source:'gis-split'};
    updateGisSegmentGeometryV18(created,corridorPolygonFromRoute(pathB,width),pathB);
    gisDraftV18().segments.push(created);
    state.speedAnalysis.selectedSegments=new Set([segment.id,created.id]);
    updateSpeedSelectionDerivedUnits();markGisDirtyV18(`Split selesai · ${segment.id} + ${created.id}`);renderGisWorkspaceV18();
  }
  
  function orientAndJoinPathsV18(a,b){
    const variants=[
      {a:[...a],b:[...b]},{a:[...a],b:[...b].reverse()},
      {a:[...a].reverse(),b:[...b]},{a:[...a].reverse(),b:[...b].reverse()}
    ];
    variants.forEach(item=>item.distance=hav(item.a.at(-1)[0],item.a.at(-1)[1],item.b[0][0],item.b[0][1])*1000);
    variants.sort((x,y)=>x.distance-y.distance);
    return variants[0];
  }
  function mergeGisSegmentsV18(){
    const selected=gisSelectedSegmentsV18();if(selected.length!==2)return;
    if(selected.some(segment=>(segment.path||[]).length<2)){showSpeedNotice('Kedua segment harus memiliki centerline untuk Merge.');return}
    const joined=orientAndJoinPathsV18(selected[0].path,selected[1].path);
    if(joined.distance>80){showSpeedNotice(`Segment belum adjacent · gap ${fmt(joined.distance,0)} m.`);return}
    const width=Math.max(5,Number(gisDraftV18()?.algorithmMeta?.corridorWidth||24)/2);
    pushGisUndoV18(`Merge ${selected[0].id} + ${selected[1].id}`);
    const path=[...joined.a,...joined.b.slice(1)];
    updateGisSegmentGeometryV18(selected[0],corridorPolygonFromRoute(path,width),path);
    selected[0].source='gis-merge';
    gisDraftV18().segments=gisSegmentsV18().filter(segment=>segment.id!==selected[1].id);
    state.speedAnalysis.selectedSegments=new Set([selected[0].id]);
    updateSpeedSelectionDerivedUnits();markGisDirtyV18(`Merge selesai · ${selected[0].id}`);renderGisWorkspaceV18();
  }
  
  function excludeGisSelectionV18(){
    const ids=new Set(state.speedAnalysis.selectedSegments);if(!ids.size)return;
    pushGisUndoV18(`Exclude ${ids.size} segment`);
    gisDraftV18().segments=gisSegmentsV18().filter(segment=>!ids.has(segment.id));
    state.speedAnalysis.selectedSegments.clear();state.mapSelectedUnits.clear();
    markGisDirtyV18(`${ids.size} segment dikeluarkan dari Draft`);renderGisWorkspaceV18();
  }
  
  function markGisReviewedV18(){
    const selected=gisSelectedSegmentsV18();if(!selected.length)return;
    pushGisUndoV18(`Review ${selected.length} segment`);
    selected.forEach(segment=>{segment.reviewed=true;segment.coverageConflict=false;segment.conflictWith=[]});
    markGisDirtyV18(`${selected.length} segment ditandai Reviewed`);renderGisWorkspaceV18();
  }
  
  function saveGisGeometryToDraftV18(){
    const draft=gisDraftV18();if(!draft)return;
    const gis=ensureGisWorkspaceV18State();
    assignEvidenceToPolygonSegments(draft.segments);
    computeSpeedCoverageDiagnosticsV15(draft.segments);
    draft._evidenceKey=speedEvidenceKey();
    draft.updatedAt=Date.now();
    gis.originalSegments=cloneGisValueV18(draft.segments);
    gis.dirty=false;gis.undo=[];gis.redo=[];
    const count=draft.segments.filter(segment=>segment.geometryEdited).length;
    setAnalysisMode('speed');
    refreshDraftCleanupV15(`${count} geometry GIS tersimpan ke Review Draft. Evidence dan Draft Health dihitung ulang.`);
  }
  
  function geometrySignatureV18(segment){
    return JSON.stringify((segment?.polygon||[]).map(point=>point.map(value=>Number(value).toFixed(6))));
  }
  function gisDraftVersionsV18(){
    const values=[gisDraftV18(),...(state.speedAnalysis.draftHistory||[])].filter(Boolean);
    const seen=new Set();
    return values.filter(item=>{const key=`${item.version}:${item.createdAt}`;if(seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>b.version-a.version);
  }
  function populateGisCompareSelectorsV18(){
    const versions=gisDraftVersionsV18();
    const option=version=>`<option value="${version.version}:${version.createdAt}">Draft v${version.version}</option>`;
    $('gisCompareBase').innerHTML=versions.slice(1).map(option).join('');
    $('gisCompareTarget').innerHTML=versions.map(option).join('');
    if(versions[0])$('gisCompareTarget').value=`${versions[0].version}:${versions[0].createdAt}`;
    if(versions[1])$('gisCompareBase').value=`${versions[1].version}:${versions[1].createdAt}`;
  }
  function draftFromCompareKeyV18(key){return gisDraftVersionsV18().find(item=>`${item.version}:${item.createdAt}`===key)||null}
  function compareDraftDataV18(base,target){
    const a=new Map((base?.segments||[]).map(segment=>[segment.id,segment]));
    const b=new Map((target?.segments||[]).map(segment=>[segment.id,segment]));
    const changes=[];
    b.forEach((segment,id)=>{
      if(!a.has(id))changes.push({type:'added',id,before:null,after:segment});
      else if(geometrySignatureV18(a.get(id))!==geometrySignatureV18(segment))changes.push({type:'modified',id,before:a.get(id),after:segment});
      else changes.push({type:'unchanged',id,before:a.get(id),after:segment});
    });
    a.forEach((segment,id)=>{if(!b.has(id))changes.push({type:'removed',id,before:segment,after:null})});
    return changes;
  }
  
  function toggleGisCompareV18(force){
    const gis=ensureGisWorkspaceV18State();
    if(!state.speedAnalysis.draftHistory.length){showSpeedNotice('Belum ada Draft pembanding. Jalankan Auto Suggest lagi untuk membuat Draft berikutnya.');return}
    gis.compareOpen=force===undefined?!gis.compareOpen:Boolean(force);
    $('gisComparePanel').classList.toggle('hidden',!gis.compareOpen);
    $('gisCompareDraftBtn').classList.toggle('primary',gis.compareOpen);
    $('gisCompareTool').classList.toggle('active',gis.compareOpen);
    if(gis.compareOpen){populateGisCompareSelectorsV18();renderGisCompareV18()}
    else{mapSourceSet('gis-diff-src',emptyFC());mapVisibility('gis-diff-fill',false);mapVisibility('gis-diff-line',false);renderGisIssueLayerV18();renderGisEditHandlesV18()}
  }
  
  function renderGisCompareV18(){
    const gis=ensureGisWorkspaceV18State();
    const base=draftFromCompareKeyV18($('gisCompareBase').value);
    const target=draftFromCompareKeyV18($('gisCompareTarget').value)||gisDraftV18();
    if(!base||!target){
      $('gisCompareContent').innerHTML='<div class="gis-compare-empty">Belum ada Draft pembanding. Jalankan Auto Suggest lagi; hasil sekarang tetap tersimpan sebagai history.</div>';
      mapSourceSet('gis-diff-src',emptyFC());return;
    }
    const changes=compareDraftDataV18(base,target);
    gis.compareChanges=changes;
    const counts={added:0,removed:0,modified:0,unchanged:0};changes.forEach(item=>counts[item.type]++);
    $('gisCompareMeta').textContent=`Draft v${base.version} vs Draft v${target.version} · geometry diff`;
    const filter=gis.compareFilter;
    const visible=changes.filter(item=>filter==='all'||item.type===filter);
    $('gisCompareContent').innerHTML=`
      <div class="gis-compare-summary">
        <button class="gis-compare-stat ${filter==='all'?'active':''}" data-compare-filter="all"><strong>${changes.length}</strong><span>Semua</span></button>
        <button class="gis-compare-stat ${filter==='added'?'active':''}" data-compare-filter="added"><strong>${counts.added}</strong><span>Baru</span></button>
        <button class="gis-compare-stat ${filter==='removed'?'active':''}" data-compare-filter="removed"><strong>${counts.removed}</strong><span>Dihapus</span></button>
        <button class="gis-compare-stat ${filter==='modified'?'active':''}" data-compare-filter="modified"><strong>${counts.modified}</strong><span>Berubah</span></button>
        <button class="gis-compare-stat ${filter==='unchanged'?'active':''}" data-compare-filter="unchanged"><strong>${counts.unchanged}</strong><span>Sama</span></button>
      </div>
      <div class="gis-change-list">${visible.slice(0,80).map(item=>`
        <div class="gis-change-row" data-change-id="${item.id}" data-change-type="${item.type}">
          <i class="${item.type}"></i><div><strong>${item.id}</strong><span>${item.type==='modified'?'Geometry berubah':item.type==='added'?'Segment baru':item.type==='removed'?'Segment dihapus':'Tidak berubah'}</span></div><span>⌖</span>
        </div>`).join('')||'<div class="gis-compare-empty">Tidak ada perubahan pada kategori ini.</div>'}</div>`;
    $('gisCompareContent').querySelectorAll('[data-compare-filter]').forEach(button=>button.addEventListener('click',()=>{gis.compareFilter=button.dataset.compareFilter;renderGisCompareV18()}));
    $('gisCompareContent').querySelectorAll('[data-change-id]').forEach(row=>row.addEventListener('click',()=>{
      const item=changes.find(change=>change.id===row.dataset.changeId&&change.type===row.dataset.changeType);
      const segment=item?.after||item?.before;if(segment)fitGisCoordinatesV18(segment.polygon||[],19);
    }));
    const features=[];
    visible.filter(item=>item.type!=='unchanged').forEach(item=>{
      if(item.before)features.push({type:'Feature',properties:{segmentId:item.id,change:item.type,role:'before'},geometry:{type:'Polygon',coordinates:[item.before.polygon]}});
      if(item.after)features.push({type:'Feature',properties:{segmentId:item.id,change:item.type,role:'after'},geometry:{type:'Polygon',coordinates:[item.after.polygon]}});
    });
    mapSourceSet('gis-diff-src',{type:'FeatureCollection',features});
    mapVisibility('gis-diff-fill',features.length>0);mapVisibility('gis-diff-line',features.length>0);
    mapVisibility('gis-edit-handles-layer',false);mapVisibility('gis-issue-fill',false);mapVisibility('gis-issue-line',false);
  }
  
  function bindGisWorkspaceV18(){
    const workspace=$('speedGisHandoffModal');
    if(!workspace||workspace.dataset.gisBoundV18==='1')return;
    workspace.dataset.gisBoundV18='1';
    const map=state.mapRoot;
  
    document.querySelectorAll('[data-gis-layer]').forEach(input=>input.addEventListener('change',()=>{
      const gis=ensureGisWorkspaceV18State();gis.layers[input.dataset.gisLayer]=input.checked;renderGisWorkspaceV18();
    }));
    $('gisPanTool').addEventListener('click',()=>setGisToolV18('pan'));
    $('gisSelectTool').addEventListener('click',()=>setGisToolV18('select'));
    $('gisBoxTool').addEventListener('click',()=>setGisToolV18('box'));
    $('gisVertexTool').addEventListener('click',()=>setGisToolV18('vertex'));
    $('gisRedrawTool').addEventListener('click',()=>setGisToolV18('redraw'));
    $('gisSplitTool').addEventListener('click',splitGisSegmentV18);
    $('gisMergeTool').addEventListener('click',mergeGisSegmentsV18);
    $('gisExcludeTool').addEventListener('click',excludeGisSelectionV18);
    $('gisMeasureTool').addEventListener('click',()=>setGisToolV18('measure'));
    $('gisFitSelectionTool').addEventListener('click',fitGisSelectionV18);
    $('gisFitDraftTool').addEventListener('click',fitGisDraftV18);
    $('gisTiltTool').addEventListener('click',()=>{
      const levels=[0,45,60],current=map?.getPitch?.()||0;let index=levels.findIndex(value=>Math.abs(value-current)<3);index=(index+1)%levels.length;map?.easeTo?.({pitch:levels[index],duration:350});
    });
    $('gisUndoTool').addEventListener('click',undoGisV18);
    $('gisRedoTool').addEventListener('click',redoGisV18);
    $('gisResetTool').addEventListener('click',resetGisWorkspaceV18);
    $('gisCompareTool').addEventListener('click',()=>toggleGisCompareV18());
    $('gisCompareDraftBtn').addEventListener('click',()=>toggleGisCompareV18());
    $('gisZoomInTool').addEventListener('click',()=>map?.easeTo?.({zoom:Math.min(20,map.getZoom()+1),duration:200}));
    $('gisZoomOutTool').addEventListener('click',()=>map?.easeTo?.({zoom:Math.max(3,map.getZoom()-1),duration:200}));
    $('gisInspectorClose').addEventListener('click',()=>$('gisInspector').classList.add('hidden'));
    $('gisInspectorEdit').addEventListener('click',()=>setGisToolV18('vertex'));
    $('gisInspectorFit').addEventListener('click',fitGisSelectionV18);
    $('gisInspectorReview').addEventListener('click',markGisReviewedV18);
    $('gisInspectorExclude').addEventListener('click',excludeGisSelectionV18);
    $('gisCompareClose').addEventListener('click',()=>toggleGisCompareV18(false));
    $('gisCompareBase').addEventListener('change',renderGisCompareV18);
    $('gisCompareTarget').addEventListener('change',renderGisCompareV18);
  
    map.on('click','speed-segment-fill',event=>{
      if(state.analysisMode!=='gis'||!event.features?.length)return;
      const id=event.features[0].properties?.segmentId,segment=gisSegmentByIdV18(id);if(!segment)return;
      const gis=ensureGisWorkspaceV18State();
      if(gis.tool==='pan')return showGisSegmentPopupV18(segment,event.lngLat);
      if(gis.tool==='select'||gis.tool==='vertex'){
        const next=event.originalEvent?.shiftKey?new Set(state.speedAnalysis.selectedSegments):new Set();
        if(next.has(id))next.delete(id);else next.add(id);
        selectGisSegmentsV18(next,{popupPoint:gis.tool==='select'&&!event.originalEvent?.shiftKey?event.lngLat:null});
      }
    });
    map.on('mouseenter','gis-edit-handles-layer',()=>{map.getCanvas().style.cursor='grab'});
    map.on('mouseleave','gis-edit-handles-layer',()=>{if(!state.gisWorkspace?.drag)map.getCanvas().style.cursor=''});
    map.on('mousedown','gis-edit-handles-layer',event=>{
      if(state.analysisMode!=='gis'||ensureGisWorkspaceV18State().tool!=='vertex'||!event.features?.length)return;
      event.preventDefault();
      const feature=event.features[0],segment=gisSegmentByIdV18(feature.properties.segmentId);if(!segment)return;
      const index=Number(feature.properties.index);
      state.gisWorkspace.drag={segmentId:segment.id,index,before:captureGisSegmentsV18()};
      map.dragPan.disable();map.getCanvas().style.cursor='grabbing';
    });
    map.on('mousemove',event=>{
      const drag=state.gisWorkspace?.drag;if(!drag)return;
      const segment=gisSegmentByIdV18(drag.segmentId),ring=segment?.polygon;if(!segment||!ring?.length)return;
      ring[drag.index]=[event.lngLat.lng,event.lngLat.lat];
      if(drag.index===0)ring[ring.length-1]=[event.lngLat.lng,event.lngLat.lat];
      updateGisSegmentGeometryV18(segment,ring,segment.path);
      renderSpeedMapLayer();renderGisEditHandlesV18();
    });
    map.on('mouseup',()=>{
      const drag=state.gisWorkspace?.drag;if(!drag)return;
      state.gisWorkspace.drag=null;pushGisUndoV18(`Edit Vertex ${drag.segmentId}`,drag.before);
      map.dragPan.enable();map.getCanvas().style.cursor='';markGisDirtyV18(`Vertex ${drag.segmentId} diperbarui`);renderGisWorkspaceV18();
    });
    map.on('dblclick',event=>{
      const gis=state.gisWorkspace;if(state.analysisMode!=='gis'||gis?.tool!=='redraw')return;
      event.preventDefault();
      const selected=gisSelectedSegmentsV18();
      if(selected.length!==1||state.drawPoints.length<3)return;
      pushGisUndoV18(`Redraw ${selected[0].id}`);
      const polygon=[...state.drawPoints.map(point=>[...point]),[...state.drawPoints[0]]];
      updateGisSegmentGeometryV18(selected[0],polygon,selected[0].path);
      markGisDirtyV18(`Boundary ${selected[0].id} digambar ulang`);setGisToolV18('select');renderGisWorkspaceV18();
    });
    map.on('click','gis-issue-fill',event=>{
      if(state.analysisMode!=='gis'||!event.features?.length)return;
      const properties=event.features[0].properties;
      selectGisSegmentsV18(new Set([properties.a,properties.b]));
      const node=document.createElement('div');
      node.innerHTML=`<div class="gis-popup-head"><strong>Overlap Review</strong><span class="gis-popup-status">${fmtInt(Number(properties.area))} m²</span></div><div class="gis-popup-kv"><span>Segments</span><b>${properties.a} ↔ ${properties.b}</b></div><div class="gis-popup-actions"><button data-issue-fit>Fit</button><button class="primary" data-issue-review>Review</button></div>`;
      const popup=new maplibregl.Popup({offset:8,className:'gis-segment-popup'}).setLngLat(event.lngLat).setDOMContent(node).addTo(map);
      node.querySelector('[data-issue-fit]').addEventListener('click',()=>{fitGisSelectionV18();popup.remove()});
      node.querySelector('[data-issue-review]').addEventListener('click',()=>{markGisReviewedV18();popup.remove()});
    });
  
    const surface=$('deck-map'),box=$('speedSelectionBox');let boxStart=null;
    surface.addEventListener('pointerdown',event=>{
      if(state.analysisMode!=='gis'||state.gisWorkspace?.tool!=='box'||event.button!==0)return;
      event.preventDefault();event.stopPropagation();
      const rect=surface.getBoundingClientRect();boxStart={x:event.clientX-rect.left,y:event.clientY-rect.top};
      Object.assign(box.style,{left:`${boxStart.x}px`,top:`${boxStart.y}px`,width:'0px',height:'0px',display:'block'});
    },true);
    document.addEventListener('pointermove',event=>{
      if(!boxStart||state.analysisMode!=='gis')return;
      const rect=surface.getBoundingClientRect(),end={x:event.clientX-rect.left,y:event.clientY-rect.top};
      Object.assign(box.style,{left:`${Math.min(boxStart.x,end.x)}px`,top:`${Math.min(boxStart.y,end.y)}px`,width:`${Math.abs(end.x-boxStart.x)}px`,height:`${Math.abs(end.y-boxStart.y)}px`});
    },true);
    document.addEventListener('pointerup',event=>{
      if(!boxStart||state.analysisMode!=='gis')return;
      const rect=surface.getBoundingClientRect(),end={x:event.clientX-rect.left,y:event.clientY-rect.top},start=boxStart;boxStart=null;box.style.display='none';
      if(Math.hypot(end.x-start.x,end.y-start.y)<8){setGisToolV18('select');return}
      const a=map.unproject([start.x,start.y]),b=map.unproject([end.x,end.y]);
      const bounds={minLon:Math.min(a.lng,b.lng),maxLon:Math.max(a.lng,b.lng),minLat:Math.min(a.lat,b.lat),maxLat:Math.max(a.lat,b.lat)};
      const ids=new Set(gisSegmentsV18().filter(segment=>pointInsideSelectionBoundsV15(segment.centroid,bounds)).map(segment=>segment.id));
      selectGisSegmentsV18(ids);setGisToolV18('select');
    },true);
  
    map.on('move',()=>{if(state.analysisMode==='gis')$('gisStatusZoom').textContent=`z${map.getZoom().toFixed(1)}`});
    document.addEventListener('keydown',event=>{
      if(state.analysisMode!=='gis'||event.target?.matches?.('input,textarea,select'))return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redoGisV18():undoGisV18()}
      else if(event.key==='Escape')setGisToolV18('pan');
      else if(event.key==='Delete')excludeGisSelectionV18();
    });
  }
  
  
  /* ===== gisWorkspaceV19Script ===== */
  
  /* GIS Workspace v19 — Draft → Route → Segment tree and unified top toolbar. */
  function escapeGisTreeV19(value){
    return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  
  function ensureGisTreeStateV19(){
    const gis=ensureGisWorkspaceV18State();
    if(!(gis.expandedRoutes instanceof Set))gis.expandedRoutes=new Set(Array.isArray(gis.expandedRoutes)?gis.expandedRoutes:[]);
    if(typeof gis.treeQuery!=='string')gis.treeQuery='';
    if(typeof gis.treeInitialized!=='boolean')gis.treeInitialized=false;
    return gis;
  }
  
  function gisRouteGroupsV19(){
    const groups=new Map();
    gisSegmentsV18().forEach((segment,index)=>{
      const routeId=String(segment.routeId||segment.routeLabel||'Ungrouped');
      if(!groups.has(routeId))groups.set(routeId,{
        id:routeId,
        label:segment.routeLabel||segment.routeId||'Ungrouped Route',
        order:Number.isFinite(Number(segment.routeOrder))?Number(segment.routeOrder):index,
        segments:[]
      });
      groups.get(routeId).segments.push(segment);
    });
    return [...groups.values()].sort((a,b)=>a.order-b.order||a.label.localeCompare(b.label,undefined,{numeric:true}));
  }
  
  function renderGisLayerTreeV19(){
    const tree=$('gisLayerTree');
    if(!tree)return;
    const gis=ensureGisTreeStateV19();
    const draft=gisDraftV18();
    const query=gis.treeQuery.trim().toLowerCase();
    const groups=gisRouteGroupsV19();
    if(!gis.treeInitialized&&groups.length){gis.expandedRoutes.add(groups[0].id);gis.treeInitialized=true}
    const visibleGroups=groups.map(group=>{
      const routeMatch=`${group.id} ${group.label}`.toLowerCase().includes(query);
      const segments=query&&!routeMatch
        ?group.segments.filter(segment=>`${segment.id} ${segment.roadName||''} ${segment.sta||''}`.toLowerCase().includes(query))
        :group.segments;
      return {...group,segments};
    }).filter(group=>!query||group.segments.length);
    const selected=state.speedAnalysis.selectedSegments;
    tree.innerHTML=`
      <div class="gis-tree-root">
        <strong>Review Draft v${draft?.version||'—'}</strong>
        <span class="gis-tree-count">${fmtInt(gisSegmentsV18().length)}</span>
      </div>
      <div class="gis-tree-routes">
        ${visibleGroups.map(group=>{
          const open=query||gis.expandedRoutes.has(group.id);
          const issueCount=group.segments.filter(segment=>segment.coverageConflict||segment.lengthIssue||!segment.reviewed).length;
          return `
            <div class="gis-tree-route-wrap">
              <button class="gis-tree-route" type="button" data-tree-route="${escapeGisTreeV19(group.id)}" aria-expanded="${open}">
                <span class="gis-tree-caret">${open?'▾':'▸'}</span>
                <span class="gis-tree-route-name">${escapeGisTreeV19(group.label)}</span>
                ${issueCount?`<span class="gis-tree-route-meta">${issueCount} review</span>`:''}
                <span class="gis-tree-count">${fmtInt(group.segments.length)}</span>
              </button>
              ${open?`<div class="gis-tree-children">${group.segments.map(segment=>{
                const review=segment.coverageConflict||segment.lengthIssue||!segment.reviewed;
                const changed=segment.geometryEdited||segment.change==='New Segment';
                return `
                  <div class="gis-tree-segment ${selected.has(segment.id)?'selected':''}" data-tree-segment="${escapeGisTreeV19(segment.id)}" role="button" tabindex="0">
                    <span class="gis-tree-branch" aria-hidden="true"></span>
                    <i class="gis-tree-status ${changed?'changed':review?'review':''}" aria-hidden="true"></i>
                    <span class="gis-tree-segment-label">
                      <strong>${escapeGisTreeV19(segment.id)}</strong>
                      <span>${escapeGisTreeV19(segment.roadName||'Belum diberi Road Name')}</span>
                    </span>
                    <button class="gis-tree-segment-action" type="button" data-tree-rename="${escapeGisTreeV19(segment.id)}" title="Rename Road Name" aria-label="Rename ${escapeGisTreeV19(segment.id)}">✎</button>
                  </div>`;
              }).join('')}</div>`:''}
            </div>`;
        }).join('')||'<div class="gis-tree-empty">Tidak ada route atau segment yang cocok.</div>'}
      </div>
      <label class="gis-tree-options"><input data-tree-alternatives type="checkbox" ${gis.layers.alternatives?'checked':''}><span>Tampilkan overlap alternatives</span><span class="gis-tree-count">${fmtInt(draft?.overlapAlternatives?.length||0)}</span></label>`;
  }
  
  function renameGisSegmentV19(id){
    const segment=gisSegmentByIdV18(id);if(!segment)return;
    const value=window.prompt(`Road Name untuk ${segment.id}`,segment.roadName||'');
    if(value===null)return;
    const next=value.trim();
    if(next===(segment.roadName||''))return;
    pushGisUndoV18(`Rename ${segment.id}`);
    segment.roadName=next;
    segment.reviewed=false;
    state.speedAnalysis.editedSegments?.add?.(segment.id);
    markGisDirtyV18(next?`Road Name ${segment.id} diperbarui`:`Road Name ${segment.id} dikosongkan`);
    renderGisWorkspaceV18();
  }
  
  function openGisTreeSegmentV19(id){
    const segment=gisSegmentByIdV18(id);if(!segment)return;
    selectGisSegmentsV18(new Set([id]));
    fitGisCoordinatesV18(segment.polygon||[],19);
    const point=segment.centroid||(segment.polygon||[])[0];
    if(point)showGisSegmentPopupV18(segment,{lng:point[0],lat:point[1]});
  }
  
  function bindGisLayerTreeV19(){
    const tree=$('gisLayerTree'),search=$('gisTreeSearch');
    if(!tree||tree.dataset.boundV19==='1')return;
    tree.dataset.boundV19='1';
    search?.addEventListener('input',()=>{ensureGisTreeStateV19().treeQuery=search.value;renderGisLayerTreeV19()});
    tree.addEventListener('click',event=>{
      const rename=event.target.closest('[data-tree-rename]');
      if(rename){event.stopPropagation();renameGisSegmentV19(rename.dataset.treeRename);return}
      const route=event.target.closest('[data-tree-route]');
      if(route){
        const gis=ensureGisTreeStateV19(),id=route.dataset.treeRoute;
        if(gis.expandedRoutes.has(id))gis.expandedRoutes.delete(id);else gis.expandedRoutes.add(id);
        renderGisLayerTreeV19();return;
      }
      const segment=event.target.closest('[data-tree-segment]');
      if(segment){openGisTreeSegmentV19(segment.dataset.treeSegment);return}
      const alternatives=event.target.closest('[data-tree-alternatives]');
      if(alternatives){ensureGisTreeStateV19().layers.alternatives=alternatives.checked;renderGisWorkspaceV18()}
    });
    tree.addEventListener('keydown',event=>{
      if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-tree-segment]')){
        event.preventDefault();openGisTreeSegmentV19(event.target.dataset.treeSegment);
      }
    });
  }
  
  
  /* ===== analysisWorkspaceV20Source ===== */
  
  /* v20 — fixture-aligned Duration In Pit, Data Log Record, and vertex topology tools. */
  const V20_PIT_KML=`${RAW}/public/kml/durasipitstop/pitstops.kml`;
  
  function nearestRingEdgeV20(ring,point){
    const unique=(ring||[]).slice(0,-1);if(unique.length<2)return-1;
    const latScale=Math.cos((point[1]||0)*Math.PI/180);
    let best=-1,bestD=Infinity;
    for(let i=0;i<unique.length;i++){
      const a=unique[i],b=unique[(i+1)%unique.length];
      const ax=a[0]*latScale,ay=a[1],bx=b[0]*latScale,by=b[1],px=point[0]*latScale,py=point[1];
      const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy||1;
      const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len));
      const qx=ax+t*dx,qy=ay+t*dy,d=(px-qx)**2+(py-qy)**2;
      if(d<bestD){bestD=d;best=i}
    }
    return best;
  }
  
  function addGisVertexV20(segment,point){
    if(!segment||!Array.isArray(segment.polygon)||segment.polygon.length<4)return;
    const unique=segment.polygon.slice(0,-1);
    if(unique.some(vertex=>hav(vertex[0],vertex[1],point[0],point[1])*1000<1.5)){
      showSpeedNotice('Titik terlalu dekat dengan vertex yang sudah ada.');return;
    }
    const edge=nearestRingEdgeV20(segment.polygon,point);if(edge<0)return;
    pushGisUndoV18(`Tambah Vertex ${segment.id}`);
    unique.splice(edge+1,0,[...point]);
    updateGisSegmentGeometryV18(segment,[...unique,[...unique[0]]],segment.path);
    markGisDirtyV18(`Vertex ditambahkan · ${segment.id}`);renderGisWorkspaceV18();
  }
  
  function removeGisVertexV20(segment,index){
    if(!segment||!Array.isArray(segment.polygon))return;
    const unique=segment.polygon.slice(0,-1);
    if(unique.length<=3){showSpeedNotice('Polygon minimal harus memiliki 3 vertex.');return}
    if(index<0||index>=unique.length)return;
    pushGisUndoV18(`Hapus Vertex ${segment.id}`);
    unique.splice(index,1);
    updateGisSegmentGeometryV18(segment,[...unique,[...unique[0]]],segment.path);
    markGisDirtyV18(`Vertex dihapus · ${segment.id}`);renderGisWorkspaceV18();
  }
  
  const renderGisEditHandlesBeforeV20=renderGisEditHandlesV18;
  renderGisEditHandlesV18=function(){
    renderGisEditHandlesBeforeV20();
    const gis=ensureGisWorkspaceV18State(),selected=gisSelectedSegmentsV18();
    if(gis.tool!=='removeVertex'||selected.length!==1)return;
    const features=(selected[0].polygon||[]).slice(0,-1).map((point,index)=>({type:'Feature',properties:{segmentId:selected[0].id,index,removeVertex:1},geometry:{type:'Point',coordinates:point}}));
    mapSourceSet('gis-edit-handles-src',{type:'FeatureCollection',features});
    mapVisibility('gis-edit-handles-layer',features.length>0&&!gis.compareOpen);
  };
  
  const renderGisToolbarStateBeforeV20=renderGisToolbarStateV18;
  renderGisToolbarStateV18=function(){
    renderGisToolbarStateBeforeV20();
    const one=gisSelectedSegmentsV18().length===1,tool=ensureGisWorkspaceV18State().tool;
    $('gisAddVertexToolV20').disabled=!one;$('gisRemoveVertexToolV20').disabled=!one;
    $('gisAddVertexToolV20').classList.toggle('active',tool==='addVertex');
    $('gisRemoveVertexToolV20').classList.toggle('active',tool==='removeVertex');
  };
  
  const setGisToolBeforeV20=setGisToolV18;
  setGisToolV18=function(tool,announce=true){
    setGisToolBeforeV20(tool,announce);
    if(tool==='addVertex'||tool==='removeVertex'){
      const message=tool==='addVertex'?'Klik sisi polygon untuk menambah vertex':'Klik vertex yang ingin dihapus';
      if($('gisToolReadout')){$('gisToolReadout').textContent=message;$('gisToolReadout').classList.remove('hidden')}
      if(announce&&$('gisStatusText'))$('gisStatusText').textContent=message;
      renderGisToolbarStateV18();renderGisEditHandlesV18();
    }
  };
  
  function bindGisVertexToolsV20(){
    const workspace=$('speedGisHandoffModal'),map=state.mapRoot;
    if(!workspace||!map||workspace.dataset.vertexBoundV20==='1')return;
    workspace.dataset.vertexBoundV20='1';
    $('gisAddVertexToolV20').addEventListener('click',()=>setGisToolV18('addVertex'));
    $('gisRemoveVertexToolV20').addEventListener('click',()=>setGisToolV18('removeVertex'));
    map.on('click','speed-segment-fill',event=>{
      if(state.analysisMode!=='gis'||ensureGisWorkspaceV18State().tool!=='addVertex'||!event.features?.length)return;
      const segment=gisSegmentByIdV18(event.features[0].properties?.segmentId);if(!segment)return;
      selectGisSegmentsV18(new Set([segment.id]));addGisVertexV20(segment,[event.lngLat.lng,event.lngLat.lat]);
    });
    map.on('click','gis-edit-handles-layer',event=>{
      if(state.analysisMode!=='gis'||ensureGisWorkspaceV18State().tool!=='removeVertex'||!event.features?.length)return;
      event.preventDefault();
      const feature=event.features[0],segment=gisSegmentByIdV18(feature.properties?.segmentId);
      removeGisVertexV20(segment,Number(feature.properties?.index));
    });
  };
  
  const initializeGisWorkspaceBeforeV20=initializeGisWorkspaceV18;
  initializeGisWorkspaceV18=function(){initializeGisWorkspaceBeforeV20();bindGisVertexToolsV20()};
  
  function ensureDurationStateV20(){
    if(!state.durationV20)state.durationV20={polygons:[],events:[],thresholdMin:15,filter:'all',selectedKey:null,loaded:false,loading:false};
    return state.durationV20;
  }
  
  function clockWitaV20(ms,seconds=false){
    const d=new Date(Number(ms)+8*3600000),p=n=>String(n).padStart(2,'0');
    return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}${seconds?`:${p(d.getUTCSeconds())}`:''}`;
  }
  
  function durationEventKeyV20(event){return`${event.unitNo}|${event.startMs}`}
  function durationStatusV20(event){return event.durationMs>ensureDurationStateV20().thresholdMin*60000?'review':'normal'}
  
  async function loadDurationPolygonsV20(){
    const duration=ensureDurationStateV20();if(duration.polygons.length)return duration.polygons;
    duration.loading=true;renderDurationWorkspaceV20();
    try{
      const response=await fetch(V20_PIT_KML);if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=parseKml(await response.text());
      duration.polygons=(data.features||[]).filter(feature=>feature.geometry?.type==='Polygon').map((feature,index)=>({
        id:`PIT-${String(index+1).padStart(2,'0')}`,name:feature.properties?.name||`Pit Stop ${index+1}`,polygon:feature.geometry.coordinates[0]
      }));
    }catch(error){duration.polygons=[];showSpeedNotice(`Polygon Pit Stop gagal dimuat · ${error.message}`)}
    finally{duration.loading=false}
    return duration.polygons;
  }
  
  function findDurationPolygonV20(point,polygons){
    for(const polygon of polygons){
      const bounds=polygonBounds(polygon.polygon);
      if(pointInsideBounds(point,bounds)&&pointInPolygon(point,polygon.polygon))return polygon;
    }
    return null;
  }
  
  function computeDurationEventsV20(){
    const duration=ensureDurationStateV20(),events=[];
    if(!state.fixture||!duration.polygons.length){duration.events=[];return events}
    const start=state.analysisWindow?.startMs??parseLocal(state.start).getTime(),end=state.analysisWindow?.endMs??parseLocal(state.end).getTime();
    const stride=Math.max(1,Math.round(state.interval/2));
    state.fixture.traces.forEach((trace,index)=>{
      const unitNo=state.fixture.unitNos[index];if(!state.selectedUnits.has(unitNo))return;
      const [ts,lons,lats,speeds,statuses]=trace,currentRaw=[];let current=null,lastMs=null;
      const close=exitMs=>{if(current){currentRaw.push({...current,endMs:exitMs});current=null}};
      for(let i=0;i<ts.length;i+=stride){
        const t=Number(ts[i]);if(t<start||t>end)continue;
        const lon=Number(lons[i]),lat=Number(lats[i]);if(![t,lon,lat].every(Number.isFinite))continue;
        const hit=findDurationPolygonV20([lon,lat],duration.polygons);lastMs=t;
        if(hit&&!current)current={polygon:hit.name,startMs:t,lon,lat,entrySpeed:Number(speeds[i]||0),entryStatus:Number(statuses[i]||0)};
        else if(hit&&current&&hit.name!==current.polygon){close(t);current={polygon:hit.name,startMs:t,lon,lat,entrySpeed:Number(speeds[i]||0),entryStatus:Number(statuses[i]||0)}}
        else if(!hit&&current)close(t);
      }
      if(current&&lastMs!==null)close(lastMs);
      const merged=[];
      currentRaw.forEach(event=>{
        const last=merged.at(-1);
        if(last&&last.polygon===event.polygon&&event.startMs-last.endMs<=60000)last.endMs=event.endMs;
        else merged.push({...event});
      });
      merged.forEach(event=>{
        const durationMs=event.endMs-event.startMs;if(durationMs<30000)return;
        events.push({...event,durationMs,unitNo,deviceId:`DEV-${unitNo}`,loader:loaderNameForUnit(unitNo)||'—'});
      });
    });
    events.sort((a,b)=>a.startMs-b.startMs);duration.events=events;duration.loaded=true;return events;
  }
  
  function ensureDurationMapLayersV20(){
    const map=state.mapRoot;if(!map||!state._mapReady)return;
    if(!map.getSource('duration-pit-src')){
      map.addSource('duration-pit-src',{type:'geojson',data:emptyFC()});
      map.addLayer({id:'duration-pit-fill',type:'fill',source:'duration-pit-src',paint:{'fill-color':['case',['>', ['get','reviewCount'],0],'#f79009','#287c94'],'fill-opacity':['interpolate',['linear'],['get','totalMin'],0,.08,60,.32,240,.56]}});
      map.addLayer({id:'duration-pit-line',type:'line',source:'duration-pit-src',paint:{'line-color':['case',['>', ['get','reviewCount'],0],'#b54708','#175f70'],'line-width':2}});
    }
    if(!map.getSource('duration-event-src')){
      map.addSource('duration-event-src',{type:'geojson',data:emptyFC()});
      map.addLayer({id:'duration-event-layer',type:'circle',source:'duration-event-src',paint:{'circle-radius':['interpolate',['linear'],['get','durationMin'],.5,4,15,9,60,15],'circle-color':['case',['==',['get','review'],1],'#f79009','#287c94'],'circle-stroke-color':['case',['==',['get','selected'],1],'#172033','#ffffff'],'circle-stroke-width':['case',['==',['get','selected'],1],3,1.5],'circle-opacity':.9}});
    }
  }
  
  function renderDurationMapV20(){
    ensureDurationMapLayersV20();const duration=ensureDurationStateV20(),byArea=new Map();
    duration.events.forEach(event=>{const row=byArea.get(event.polygon)||{total:0,review:0};row.total+=event.durationMs;if(durationStatusV20(event)==='review')row.review++;byArea.set(event.polygon,row)});
    mapSourceSet('duration-pit-src',{type:'FeatureCollection',features:duration.polygons.map(polygon=>{const row=byArea.get(polygon.name)||{total:0,review:0};return{type:'Feature',properties:{name:polygon.name,totalMin:row.total/60000,reviewCount:row.review},geometry:{type:'Polygon',coordinates:[polygon.polygon]}}})});
    mapSourceSet('duration-event-src',{type:'FeatureCollection',features:duration.events.map(event=>({type:'Feature',properties:{key:durationEventKeyV20(event),unitNo:event.unitNo,polygon:event.polygon,durationMin:event.durationMs/60000,review:durationStatusV20(event)==='review'?1:0,selected:duration.selectedKey===durationEventKeyV20(event)?1:0},geometry:{type:'Point',coordinates:[event.lon,event.lat]}}))});
    ['duration-pit-fill','duration-pit-line','duration-event-layer'].forEach(id=>mapVisibility(id,state.analysisMode==='duration'));
  }
  
  function hideDurationMapV20(){['duration-pit-fill','duration-pit-line','duration-event-layer'].forEach(id=>mapVisibility(id,false))}
  
  function focusDurationEventV20(event){
    if(!event)return;const duration=ensureDurationStateV20();duration.selectedKey=durationEventKeyV20(event);renderDurationWorkspaceV20();renderDurationMapV20();
    state.mapRoot?.easeTo?.({center:[event.lon,event.lat],zoom:17,duration:420});
  }
  
  function renderDurationWorkspaceV20(){
    const duration=ensureDurationStateV20(),events=duration.events,total=events.reduce((sum,event)=>sum+event.durationMs,0),longest=Math.max(0,...events.map(event=>event.durationMs));
    $('durationTotalV20').textContent=fmtDur(total);$('durationEventCountV20').textContent=fmtInt(events.length);$('durationAverageV20').textContent=events.length?fmtDur(total/events.length):'—';$('durationLongestV20').textContent=longest?fmtDur(longest):'—';
    const reviewCount=events.filter(event=>durationStatusV20(event)==='review').length;$('durationReviewCountV20').textContent=fmtInt(reviewCount);
    $('durationContextV20').textContent=`${state.selectedUnits.size} unit · ${duration.polygons.length} polygon · noise <30 dtk diabaikan`;
    const filtered=events.filter(event=>duration.filter==='all'||durationStatusV20(event)==='review');
    $('durationEventListV20').innerHTML=duration.loading?'<div class="duration-empty-v20">Memuat polygon Pit Stop…</div>':filtered.length?filtered.map(event=>{
      const key=durationEventKeyV20(event),review=durationStatusV20(event)==='review';
      return`<button class="duration-event-row-v20 ${review?'review':''} ${duration.selectedKey===key?'selected':''}" type="button" data-duration-event="${escapeGisTreeV19(key)}"><i></i><span><strong>${escapeGisTreeV19(event.unitNo)}</strong><small>${escapeGisTreeV19(event.polygon)} · ${clockWitaV20(event.startMs)}–${clockWitaV20(event.endMs)} · ${PLM_STATUS[event.entryStatus]?.label||`Status ${event.entryStatus}`}</small></span><b>${fmtDur(event.durationMs)}</b></button>`;
    }).join(''):'<div class="duration-empty-v20">Belum ada event dwell pada filter aktif.</div>';
    const start=state.analysisWindow?.startMs??parseLocal(state.start).getTime(),end=state.analysisWindow?.endMs??parseLocal(state.end).getTime(),span=Math.max(1,end-start),byUnit=new Map();
    events.forEach(event=>{if(!byUnit.has(event.unitNo))byUnit.set(event.unitNo,{events:[],total:0});const row=byUnit.get(event.unitNo);row.events.push(event);row.total+=event.durationMs});
    const rows=[...byUnit.entries()].sort((a,b)=>b[1].total-a[1].total);
    $('durationTimelineMetaV20').textContent=`${events.length} event · ${rows.length} unit · total terlama di atas`;$('durationTimelineRangeV20').textContent=`${clockWitaV20(start)}–${clockWitaV20(end)} WITA`;
    $('durationTimelineRowsV20').innerHTML=rows.length?rows.map(([unitNo,row])=>`<div class="duration-timeline-row-v20"><strong>${escapeGisTreeV19(unitNo)}</strong><div class="duration-track-v20">${row.events.map(event=>{const key=durationEventKeyV20(event),left=Math.max(0,Math.min(100,(event.startMs-start)/span*100)),width=Math.max(.4,Math.min(100-left,event.durationMs/span*100));return`<button class="duration-bar-v20 ${durationStatusV20(event)==='review'?'review':''} ${duration.selectedKey===key?'selected':''}" style="left:${left}%;width:${width}%" data-duration-event="${escapeGisTreeV19(key)}" title="${escapeGisTreeV19(event.polygon)} · ${fmtDur(event.durationMs)}"></button>`}).join('')}</div><small>${fmtDur(row.total)}</small></div>`).join(''):'<div class="duration-empty-v20">Timeline menunggu event dwell.</div>';
  }
  
  async function refreshDurationV20(reloadPolygons=false){
    const duration=ensureDurationStateV20();if(reloadPolygons||!duration.polygons.length)await loadDurationPolygonsV20();computeDurationEventsV20();renderDurationWorkspaceV20();refreshMap();renderDurationMapV20();bindDurationMapEventsV20();
  }
  
  const DATALOG_COLUMNS_V20=[
    {key:'timestampiso',label:'Timestamp',type:'datetime',fixed:true},
    {key:'district',label:'District',type:'text',fixed:true},
    {key:'unitno',label:'Unit No',type:'text',fixed:true},
    {key:'unittype',label:'Unit Type',type:'text'},
    {key:'deviceid',label:'Device ID',type:'text'},
    {key:'gpslat',label:'GPS Lat',type:'geo'},
    {key:'gpslong',label:'GPS Long',type:'geo'},
    {key:'gpsspeed',label:'GPS Speed',type:'number'},
    {key:'plmstatus',label:'PLM Status',type:'number'},
    {key:'statusname',label:'Status Name',type:'text'}
  ];
  
  function unitTypeV20(unitNo){
    const value=String(unitNo||'').toUpperCase();
    if(/^DT/.test(value))return'DT';if(/^(AM|ADT)/.test(value))return'AM';if(/^(LD|EX|PC)/.test(value))return'Loading Unit';return'Hauler';
  }
  
  function ensureDataLogStateV20(){
    if(!state.dataLogV20)state.dataLogV20={
      selectedUnits:new Set(),expanded:new Set(['BRCB']),rows:[],loaded:false,view:'table',query:'',treeQuery:'',
      visibleColumns:new Set(DATALOG_COLUMNS_V20.map(column=>column.key)),chartX:'timestampms',chartMetric:'gpsspeed',
      latField:'gpslat',lonField:'gpslong',speedField:'gpsspeed',dotTrace:true,previousTrace:null
    };
    const dataLog=state.dataLogV20;
    if(!(dataLog.selectedUnits instanceof Set))dataLog.selectedUnits=new Set(dataLog.selectedUnits||[]);
    if(!(dataLog.expanded instanceof Set))dataLog.expanded=new Set(dataLog.expanded||['BRCB']);
    if(!(dataLog.visibleColumns instanceof Set))dataLog.visibleColumns=new Set(dataLog.visibleColumns||DATALOG_COLUMNS_V20.map(column=>column.key));
    return dataLog;
  }
  
  function dataLogAvailabilityV20(){return new Map(unitAvailabilityRows().map(unit=>[unit.unitNo,unit]))}
  function dataLogUnitGroupsV20(){
    const groups=new Map(),availability=dataLogAvailabilityV20();
    (state.fixture?.unitNos||[]).forEach(unitNo=>{
      if(!state.selectedUnits.has(unitNo))return;
      const type=unitTypeV20(unitNo);if(!groups.has(type))groups.set(type,[]);
      const status=availability.get(unitNo);groups.get(type).push({unitNo,type,available:status?.coverage!=='none',hours:status?.hoursAvailable||0,expected:status?.hoursExpected||expectedHourSlots()});
    });
    return [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([type,units])=>({type,units:units.sort((a,b)=>a.unitNo.localeCompare(b.unitNo,undefined,{numeric:true}))}));
  }
  
  function renderDataLogTreeV20(){
    const dataLog=ensureDataLogStateV20(),groups=dataLogUnitGroupsV20(),query=dataLog.treeQuery.trim().toLowerCase();
    const units=groups.flatMap(group=>group.units),available=units.filter(unit=>unit.available).length;
    $('datalogTreeBodyV20').innerHTML=`
      <button class="datalog-tree-node-v20 root" type="button" data-datalog-tree-root="BRCB"><span class="caret">${dataLog.expanded.has('BRCB')?'▾':'▸'}</span><strong class="name">BRCB</strong><span class="meta">${available}/${units.length}</span></button>
      ${dataLog.expanded.has('BRCB')?groups.map(group=>{
        const filtered=query?group.units.filter(unit=>`${unit.unitNo} ${group.type}`.toLowerCase().includes(query)):group.units;
        if(query&&!filtered.length)return'';
        const open=query||dataLog.expanded.has(group.type),selected=filtered.filter(unit=>dataLog.selectedUnits.has(unit.unitNo)).length;
        return`<div><button class="datalog-tree-node-v20 type" type="button" data-datalog-tree-type="${escapeGisTreeV19(group.type)}"><span class="caret">${open?'▾':'▸'}</span><input type="checkbox" data-datalog-select-type="${escapeGisTreeV19(group.type)}" ${selected===filtered.length&&filtered.length?'checked':''}><span class="name">${escapeGisTreeV19(group.type)}</span><span class="meta">${selected}/${filtered.length}</span></button>${open?filtered.map(unit=>`<button class="datalog-tree-node-v20 unit ${dataLog.selectedUnits.has(unit.unitNo)?'selected':''}" type="button" data-datalog-tree-unit="${escapeGisTreeV19(unit.unitNo)}"><span class="caret">${dataLog.selectedUnits.has(unit.unitNo)?'✓':'○'}</span><span class="name">${escapeGisTreeV19(unit.unitNo)}</span><span class="meta ${unit.available?'available':'none'}">${unit.available?`${unit.hours} jam`:'no data'}</span></button>`).join(''):''}</div>`;
      }).join(''):''}`;
  }
  
  function generateDataLogRowsV20(){
    const dataLog=ensureDataLogStateV20(),selected=[...dataLog.selectedUnits];
    if(!selected.length){dataLog.rows=[];dataLog.loaded=true;renderDataLogWorkspaceV20();return}
    const start=parseLocal(state.start).getTime(),end=parseLocal(state.end).getTime(),maxRows=6000,perUnit=Math.max(100,Math.floor(maxRows/selected.length)),rows=[];
    selected.forEach(unitNo=>{
      const index=state.fixture.unitNos.indexOf(unitNo);if(index<0)return;
      const [ts,lons,lats,speeds,statuses]=state.fixture.traces[index],indices=[];
      for(let i=0;i<ts.length;i++){const t=Number(ts[i]);if(t>=start&&t<=end)indices.push(i)}
      const step=Math.max(1,Math.ceil(indices.length/perUnit));
      for(let cursor=0;cursor<indices.length;cursor+=step){
        const i=indices[cursor],t=Number(ts[i]),status=Number(statuses[i]||0);
        rows.push({timestampms:t,timestampiso:new Date(t).toISOString(),district:'BRCB',unitno:unitNo,unittype:unitTypeV20(unitNo),deviceid:`DEV-${unitNo}`,gpslat:Number(lats[i]),gpslong:Number(lons[i]),gpsspeed:Number(speeds[i]||0),plmstatus:status,statusname:PLM_STATUS[status]?.label||`Status ${status}`});
      }
    });
    rows.sort((a,b)=>a.timestampms-b.timestampms);dataLog.rows=rows;dataLog.loaded=true;renderDataLogWorkspaceV20();renderDataLogMapV20();
  }
  
  function filteredDataLogRowsV20(){
    const dataLog=ensureDataLogStateV20(),query=dataLog.query.trim().toLowerCase();
    if(!query)return dataLog.rows;
    return dataLog.rows.filter(row=>Object.values(row).some(value=>String(value??'').toLowerCase().includes(query)));
  }
  
  function formatDataLogCellV20(value,column){
    if(value===null||value===undefined||value==='')return'—';
    if(column.type==='datetime')return`${new Date(Number(new Date(value))+8*3600000).toISOString().slice(8,10)}/${new Date(Number(new Date(value))+8*3600000).toISOString().slice(5,7)} ${new Date(Number(new Date(value))+8*3600000).toISOString().slice(11,19)}`;
    if(column.type==='geo')return Number(value).toFixed(6);if(column.type==='number')return Number(value).toLocaleString('id-ID',{maximumFractionDigits:2});return String(value);
  }
  
  function renderDataLogTableV20(){
    const dataLog=ensureDataLogStateV20(),rows=filteredDataLogRowsV20(),columns=DATALOG_COLUMNS_V20.filter(column=>dataLog.visibleColumns.has(column.key));
    $('datalogRowsMetaV20').textContent=dataLog.loaded?`${fmtInt(rows.length)} baris · sample prototype`:'Belum dimuat';
    $('datalogTableViewV20').innerHTML=!dataLog.loaded?'<div class="datalog-empty-v20">Pilih unit lalu tekan <strong>Muat data</strong>.</div>':!rows.length?'<div class="datalog-empty-v20">Tidak ada data pada filter aktif.</div>':`<table class="datalog-table-v20"><thead><tr><th>No.</th>${columns.map(column=>`<th>${escapeGisTreeV19(column.label)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,2500).map((row,index)=>`<tr><td>${index+1}</td>${columns.map(column=>`<td>${escapeGisTreeV19(formatDataLogCellV20(row[column.key],column))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  
  function renderDataLogColumnsV20(){
    const dataLog=ensureDataLogStateV20();$('datalogColumnsListV20').innerHTML=DATALOG_COLUMNS_V20.map(column=>`<label class="datalog-column-row-v20"><input type="checkbox" data-datalog-column="${column.key}" ${dataLog.visibleColumns.has(column.key)?'checked':''} ${column.fixed?'disabled':''}><span>${escapeGisTreeV19(column.label)}${column.fixed?' · fixed':''}</span></label>`).join('');
  }
  
  function syncDataLogFieldOptionsV20(){
    const options=DATALOG_COLUMNS_V20.map(column=>`<option value="${column.key}">${escapeGisTreeV19(column.label)}</option>`).join(''),numeric=DATALOG_COLUMNS_V20.filter(column=>column.type==='number'||column.type==='geo').map(column=>`<option value="${column.key}">${escapeGisTreeV19(column.label)}</option>`).join('');
    $('datalogChartXV20').innerHTML='<option value="timestampms">Timestamp</option>'+options;$('datalogChartMetricV20').innerHTML=numeric;$('datalogLatV20').innerHTML=numeric;$('datalogLonV20').innerHTML=numeric;$('datalogSpeedV20').innerHTML=numeric;
    const dataLog=ensureDataLogStateV20();$('datalogChartXV20').value=dataLog.chartX;$('datalogChartMetricV20').value=dataLog.chartMetric;$('datalogLatV20').value=dataLog.latField;$('datalogLonV20').value=dataLog.lonField;$('datalogSpeedV20').value=dataLog.speedField;$('datalogDotTraceV20').checked=dataLog.dotTrace;
  }
  
  function renderDataLogChartV20(){
    const dataLog=ensureDataLogStateV20(),xValue=row=>dataLog.chartX==='timestampms'?Number(row.timestampms):Number(row[dataLog.chartX]),rows=filteredDataLogRowsV20().filter(row=>Number.isFinite(Number(row[dataLog.chartMetric]))).sort((a,b)=>(xValue(a)||0)-(xValue(b)||0)).slice(0,500);
    const svg=$('datalogChartSvgV20');if(!rows.length){svg.innerHTML='';$('datalogChartLegendV20').textContent='Pilih data dan metric untuk menampilkan chart.';return}
    const values=rows.map(row=>Number(row[dataLog.chartMetric])),min=Math.min(...values),max=Math.max(...values),W=1000,H=360,L=54,R=18,T=20,B=36,x=index=>L+(W-L-R)*(index/Math.max(1,rows.length-1)),y=value=>T+(H-T-B)*(1-(value-min)/(max-min||1));
    const path=values.map((value,index)=>`${index?'L':'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
    svg.innerHTML=`<g>${[0,.25,.5,.75,1].map(f=>`<line x1="${L}" y1="${T+f*(H-T-B)}" x2="${W-R}" y2="${T+f*(H-T-B)}" stroke="#e7eaee"/><text x="${L-7}" y="${T+f*(H-T-B)+3}" text-anchor="end" font-size="10" fill="#98a2b3">${fmt(max-(max-min)*f,1)}</text>`).join('')}</g><path d="${path}" fill="none" stroke="#287c94" stroke-width="3" stroke-linejoin="round"/><line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#cbd5e1"/>`;
    $('datalogChartLegendV20').innerHTML=`<span><b>${escapeGisTreeV19(dataLog.chartMetric)}</b> · ${fmt(min,1)}–${fmt(max,1)} · ${rows.length} sample</span>`;
  }
  
  function ensureDataLogMapLayersV20(){
    const map=state.mapRoot;if(!map||!state._mapReady)return;
    if(!map.getSource('datalog-track-src')){
      map.addSource('datalog-track-src',{type:'geojson',data:emptyFC()});
      map.addLayer({id:'datalog-track-line',type:'line',source:'datalog-track-src',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#287c94','line-width':2,'line-opacity':.75}});
      map.addLayer({id:'datalog-track-point',type:'circle',source:'datalog-track-src',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':3,'circle-color':['interpolate',['linear'],['get','speed'],0,'#ef4444',15,'#f59e0b',25,'#22c55e',35,'#3b82f6'],'circle-opacity':.78,'circle-stroke-color':'#fff','circle-stroke-width':.5}});
    }
  }
  
  function renderDataLogMapV20(){
    ensureDataLogMapLayersV20();const dataLog=ensureDataLogStateV20(),rows=filteredDataLogRowsV20(),byUnit=new Map(),features=[];
    rows.forEach(row=>{const lon=Number(row[dataLog.lonField]),lat=Number(row[dataLog.latField]);if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>90||Math.abs(lon)>180||(lat===0&&lon===0))return;if(!byUnit.has(row.unitno))byUnit.set(row.unitno,[]);byUnit.get(row.unitno).push({point:[lon,lat],speed:Number(row[dataLog.speedField]||0)})});
    byUnit.forEach((points,unitNo)=>{if(points.length>1)features.push({type:'Feature',properties:{unitNo},geometry:{type:'LineString',coordinates:points.map(point=>point.point)}});if(dataLog.dotTrace)points.forEach(point=>features.push({type:'Feature',properties:{unitNo,speed:point.speed},geometry:{type:'Point',coordinates:point.point}}))});
    mapSourceSet('datalog-track-src',{type:'FeatureCollection',features});const visible=state.analysisMode==='datalog'&&dataLog.view==='map';mapVisibility('datalog-track-line',visible);mapVisibility('datalog-track-point',visible&&dataLog.dotTrace);
    if(visible){const coords=[...byUnit.values()].flatMap(points=>points.map(point=>point.point));if(coords.length)fitGisCoordinatesV18(coords,17)}
  }
  
  function hideDataLogMapV20(){mapVisibility('datalog-track-line',false);mapVisibility('datalog-track-point',false)}
  
  function setDataLogViewV20(view){
    const dataLog=ensureDataLogStateV20();dataLog.view=view;
    document.querySelectorAll('[data-datalog-view]').forEach(button=>button.classList.toggle('active',button.dataset.datalogView===view));
    $('datalogTableViewV20').classList.toggle('hidden',view!=='table');$('datalogChartViewV20').classList.toggle('hidden',view!=='chart');$('datalogMapViewV20').classList.toggle('hidden',view!=='map');$('datalogStageV20').classList.toggle('map-view',view==='map');
    if(view==='chart')renderDataLogChartV20();if(view==='map'){refreshMap();renderDataLogMapV20()}else hideDataLogMapV20();
  }
  
  function renderDataLogWorkspaceV20(){renderDataLogTreeV20();renderDataLogTableV20();renderDataLogColumnsV20();syncDataLogFieldOptionsV20();setDataLogViewV20(ensureDataLogStateV20().view)}
  
  function invalidateDataLogV20(){
    const dataLog=ensureDataLogStateV20(),allowed=new Set(state.selectedUnits);dataLog.selectedUnits=new Set([...dataLog.selectedUnits].filter(unit=>allowed.has(unit)));dataLog.rows=[];dataLog.loaded=false;renderDataLogWorkspaceV20();hideDataLogMapV20();
  }
  
  function hideCustomModesV20(){
    $('durationWorkspaceV20').classList.add('hidden');$('dataLogWorkspaceV20').classList.add('hidden');document.body.classList.remove('duration-mode-v20','datalog-mode-v20');hideDurationMapV20();hideDataLogMapV20();
    const dataLog=ensureDataLogStateV20();if(dataLog.previousTrace!==null){state.visible.trace=dataLog.previousTrace;dataLog.previousTrace=null;updateDeckDotTrace()}
  }
  
  const setAnalysisModeBeforeV20=setAnalysisMode;
  setAnalysisMode=async function(mode){
    if(mode!=='duration'&&mode!=='datalog'){hideCustomModesV20();return setAnalysisModeBeforeV20(mode)}
    if(state.analysisMode!=='cycle')await setAnalysisModeBeforeV20('cycle');
    state.analysisMode=mode;document.querySelectorAll('[data-analysis-mode]').forEach(button=>button.classList.toggle('active',button.dataset.analysisMode===mode));
    const dataLog=ensureDataLogStateV20();if(dataLog.previousTrace===null)dataLog.previousTrace=state.visible.trace;state.visible.trace=false;updateDeckDotTrace();
    document.body.classList.toggle('duration-mode-v20',mode==='duration');document.body.classList.toggle('datalog-mode-v20',mode==='datalog');
    $('durationWorkspaceV20').classList.toggle('hidden',mode!=='duration');$('dataLogWorkspaceV20').classList.toggle('hidden',mode!=='datalog');
    document.querySelector('.map-shell')?.classList.remove('speed-mode','gis-mode');$('cycleAnalysisRibbon').classList.add('hidden');$('speedAnalysisRibbon').classList.add('hidden');
    requestAnimationFrame(()=>state.mapRoot?.resize?.());
    if(mode==='duration')await refreshDurationV20();else{hideDurationMapV20();if(!dataLog.selectedUnits.size)dataLog.selectedUnits=new Set(state.selectedUnits);renderDataLogWorkspaceV20();refreshMap()}
  };
  
  const refreshBeforeV20=refresh;
  refresh=function(){if(state.analysisMode==='duration')return refreshDurationV20();if(state.analysisMode==='datalog')return invalidateDataLogV20();return refreshBeforeV20()};
  const fitDataBeforeV20=fitData;
  fitData=function(){
    if(state.analysisMode==='duration'){const coords=ensureDurationStateV20().polygons.flatMap(polygon=>polygon.polygon);if(coords.length)return fitGisCoordinatesV18(coords,16)}
    if(state.analysisMode==='datalog'&&ensureDataLogStateV20().view==='map')return renderDataLogMapV20();
    return fitDataBeforeV20();
  };
  
  function bindAnalysisWorkspaceV20(){
    if(document.body.dataset.analysisV20Bound==='1')return;document.body.dataset.analysisV20Bound='1';
    $('modeDurationBtn').addEventListener('click',()=>setAnalysisMode('duration'));$('modeDatalogBtn').addEventListener('click',()=>setAnalysisMode('datalog'));
    $('durationThresholdV20').addEventListener('change',event=>{ensureDurationStateV20().thresholdMin=Number(event.target.value)||15;renderDurationWorkspaceV20();renderDurationMapV20()});
    document.querySelectorAll('[data-duration-filter]').forEach(button=>button.addEventListener('click',()=>{const duration=ensureDurationStateV20();duration.filter=button.dataset.durationFilter;document.querySelectorAll('[data-duration-filter]').forEach(item=>item.classList.toggle('active',item===button));renderDurationWorkspaceV20()}));
    const durationClick=event=>{const target=event.target.closest('[data-duration-event]');if(!target)return;focusDurationEventV20(ensureDurationStateV20().events.find(item=>durationEventKeyV20(item)===target.dataset.durationEvent))};
    $('durationEventListV20').addEventListener('click',durationClick);$('durationTimelineRowsV20').addEventListener('click',durationClick);
    $('datalogTreeSearchV20').addEventListener('input',event=>{ensureDataLogStateV20().treeQuery=event.target.value;renderDataLogTreeV20()});
    $('datalogTreeBodyV20').addEventListener('click',event=>{
      const dataLog=ensureDataLogStateV20(),root=event.target.closest('[data-datalog-tree-root]'),type=event.target.closest('[data-datalog-tree-type]'),unit=event.target.closest('[data-datalog-tree-unit]'),selectType=event.target.closest('[data-datalog-select-type]');
      if(selectType){event.stopPropagation();const units=dataLogUnitGroupsV20().find(group=>group.type===selectType.dataset.datalogSelectType)?.units.filter(item=>item.available).map(item=>item.unitNo)||[],all=units.length&&units.every(item=>dataLog.selectedUnits.has(item));units.forEach(item=>all?dataLog.selectedUnits.delete(item):dataLog.selectedUnits.add(item));dataLog.loaded=false;dataLog.rows=[]}
      else if(root){dataLog.expanded.has('BRCB')?dataLog.expanded.delete('BRCB'):dataLog.expanded.add('BRCB')}
      else if(type){const key=type.dataset.datalogTreeType;dataLog.expanded.has(key)?dataLog.expanded.delete(key):dataLog.expanded.add(key)}
      else if(unit){const key=unit.dataset.datalogTreeUnit;dataLog.selectedUnits.has(key)?dataLog.selectedUnits.delete(key):dataLog.selectedUnits.add(key);dataLog.loaded=false;dataLog.rows=[]}
      renderDataLogWorkspaceV20();
    });
    $('datalogLoadBtnV20').addEventListener('click',generateDataLogRowsV20);$('datalogSearchV20').addEventListener('input',event=>{ensureDataLogStateV20().query=event.target.value;renderDataLogTableV20();if(ensureDataLogStateV20().view==='chart')renderDataLogChartV20();if(ensureDataLogStateV20().view==='map')renderDataLogMapV20()});
    document.querySelectorAll('[data-datalog-view]').forEach(button=>button.addEventListener('click',()=>setDataLogViewV20(button.dataset.datalogView)));
    $('datalogColumnsBtnV20').addEventListener('click',()=>$('datalogColumnsPanelV20').classList.toggle('hidden'));$('datalogColumnsCloseV20').addEventListener('click',()=>$('datalogColumnsPanelV20').classList.add('hidden'));
    $('datalogColumnsListV20').addEventListener('change',event=>{const key=event.target.dataset.datalogColumn;if(!key)return;event.target.checked?ensureDataLogStateV20().visibleColumns.add(key):ensureDataLogStateV20().visibleColumns.delete(key);renderDataLogTableV20()});
    $('datalogChartXV20').addEventListener('change',event=>{ensureDataLogStateV20().chartX=event.target.value;renderDataLogChartV20()});$('datalogChartMetricV20').addEventListener('change',event=>{ensureDataLogStateV20().chartMetric=event.target.value;renderDataLogChartV20()});
    $('datalogLatV20').addEventListener('change',event=>{ensureDataLogStateV20().latField=event.target.value;renderDataLogMapV20()});$('datalogLonV20').addEventListener('change',event=>{ensureDataLogStateV20().lonField=event.target.value;renderDataLogMapV20()});$('datalogSpeedV20').addEventListener('change',event=>{ensureDataLogStateV20().speedField=event.target.value;renderDataLogMapV20()});$('datalogDotTraceV20').addEventListener('change',event=>{ensureDataLogStateV20().dotTrace=event.target.checked;renderDataLogMapV20()});
    bindDurationMapEventsV20();
  }
  
  function bindDurationMapEventsV20(){
    const map=state.mapRoot;if(!map||map.__durationBoundV20)return;map.__durationBoundV20=true;
    map.on('click','duration-event-layer',event=>{if(state.analysisMode!=='duration'||!event.features?.length)return;const item=ensureDurationStateV20().events.find(candidate=>durationEventKeyV20(candidate)===event.features[0].properties?.key);if(item)focusDurationEventV20(item)});
    map.on('click','duration-pit-fill',event=>{if(state.analysisMode!=='duration'||!event.features?.length)return;const name=event.features[0].properties?.name,events=ensureDurationStateV20().events.filter(item=>item.polygon===name),total=events.reduce((sum,item)=>sum+item.durationMs,0);new maplibregl.Popup({offset:8}).setLngLat(event.lngLat).setHTML(`<strong>${escapeGisTreeV19(name)}</strong><br><span style="font-size:11px">${events.length} event · ${fmtDur(total)}</span>`).addTo(map)});
  }
  
  bindAnalysisWorkspaceV20();
  
  
  /* ===== analysisWorkspaceV21Script ===== */
  
  /* V21 is an additive experiment. V20 remains unchanged and can be reopened as legacy. */
  (function(){
    const V21_EMPTY=()=>({type:'FeatureCollection',features:[]});
    const durationUiV21={query:'',selectedAreas:new Set(),activeDock:'occupancy'};
  
    function waitPaintV21(){return new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)))}
    function showAnalysisLoadingV21(title,text){
      const mask=$('loadingMask');if(!mask)return;
      const heading=mask.querySelector('.title');if(heading)heading.textContent=title;
      if($('loadingText'))$('loadingText').textContent=text;
      mask.classList.remove('hidden');
    }
    function hideAnalysisLoadingV21(){
      const mask=$('loadingMask');mask?.classList.add('hidden');
      const heading=mask?.querySelector('.title');if(heading)heading.textContent='Memuat data Cycle Time';
      if($('loadingText'))$('loadingText').textContent='Membaca fixture BRCB dan layer peta.';
    }
  
    function setupDurationDockV21(){
      const dock=$('analysisDock');if(!dock||dock.dataset.v21Ready==='1')return;
      dock.dataset.v21Ready='1';
      const performance=dock.querySelector('.dock-performance'),trend=dock.querySelector('.dock-trend'),tabs=dock.querySelector('.dock-tabs');
      performance?.insertAdjacentHTML('beforeend','<div id="durationOccupancyDockV21" class="duration-dock-content-v21"></div>');
      trend?.insertAdjacentHTML('beforeend','<div id="durationAreaDockV21" class="duration-dock-content-v21"></div>');
      const trendPanel=document.createElement('div');trendPanel.className='dock-panel dock-duration-trend-v21';trendPanel.innerHTML='<div id="durationTrendDockV21" class="duration-dock-content-v21"></div>';dock.querySelector('.dock-panels')?.appendChild(trendPanel);
      tabs?.insertAdjacentHTML('beforeend','<button class="dock-tab" type="button" data-dock-tab="durationtrend">Trend Duration</button>');
      const extra=dock.querySelector('[data-dock-tab="durationtrend"]');
      extra?.addEventListener('click',()=>activateDurationDockTabV21('durationtrend'));
      dock.querySelectorAll('[data-dock-tab="performance"],[data-dock-tab="trend"]').forEach(button=>button.addEventListener('click',()=>{
        if(state.analysisMode!=='duration')return;
        durationUiV21.activeDock=button.dataset.dockTab==='performance'?'occupancy':'area';
        trendPanel.classList.remove('active');extra?.classList.remove('active');
      }));
      const sidebar=$('durationWorkspaceV20')?.querySelector('.duration-sidebar-v20');
      if(sidebar){
        sidebar.querySelector('.duration-side-head-v20')?.insertAdjacentHTML('beforeend','<span class="mode-scope-chip-v21">Scope: filter Unit global</span>');
        const tabsOld=sidebar.querySelector('.duration-side-tabs-v20');
        if(tabsOld)tabsOld.outerHTML='<div class="duration-tree-tools-v21"><input id="durationTreeSearchV21" type="search" placeholder="Cari area Pit Stop…"><button id="durationAreasAllV21" type="button">Pilih semua</button></div>';
      }
      $('durationTreeSearchV21')?.addEventListener('input',event=>{durationUiV21.query=event.target.value;renderDurationTreeV21()});
      $('durationAreasAllV21')?.addEventListener('click',()=>{durationUiV21.selectedAreas=new Set(ensureDurationStateV20().polygons.map(item=>item.name));renderDurationWorkspaceV20();renderDurationMapV20()});
      $('durationEventListV20')?.addEventListener('change',event=>{
        const key=event.target.dataset.durationArea;if(!key)return;
        event.target.checked?durationUiV21.selectedAreas.add(key):durationUiV21.selectedAreas.delete(key);
        renderDurationWorkspaceV20();renderDurationMapV20();
      });
      dock.addEventListener('click',event=>{
        const item=event.target.closest('[data-duration-event]');
        if(item){focusDurationEventV20(ensureDurationStateV20().events.find(candidate=>durationEventKeyV20(candidate)===item.dataset.durationEvent));return}
        const area=event.target.closest('[data-duration-area-focus]');
        if(area)focusDurationAreaV21(area.dataset.durationAreaFocus);
      });
    }
  
    function activateDurationDockTabV21(name){
      const dock=$('analysisDock');if(!dock)return;durationUiV21.activeDock=name==='durationtrend'?'trend':name==='trend'?'area':'occupancy';
      dock.querySelectorAll('[data-dock-tab]').forEach(tab=>tab.classList.toggle('active',tab.dataset.dockTab===name));
      dock.querySelectorAll('.dock-panel').forEach(panel=>panel.classList.remove('active'));
      const panel=name==='performance'?dock.querySelector('.dock-performance'):name==='trend'?dock.querySelector('.dock-trend'):dock.querySelector('.dock-duration-trend-v21');panel?.classList.add('active');
      window.dispatchEvent(new Event('resize'));
    }
  
    function configureDockV21(mode){
      setupDurationDockV21();const dock=$('analysisDock');if(!dock)return;
      const perf=dock.querySelector('[data-dock-tab="performance"]'),trend=dock.querySelector('[data-dock-tab="trend"]'),extra=dock.querySelector('[data-dock-tab="durationtrend"]'),title=dock.querySelector('.dock-title');
      dock.classList.toggle('duration-dock-v21',mode==='duration');
      if(mode==='duration'){
        if(title)title.textContent='Duration In Pit Analysis';if(perf)perf.textContent='Occupancy';if(trend)trend.textContent='Area';if(extra)extra.textContent='Trend Duration';
        activateDurationDockTabV21(durationUiV21.activeDock==='area'?'trend':durationUiV21.activeDock==='trend'?'durationtrend':'performance');
      }else{
        if(title)title.textContent=mode==='speed'?'Speed Analysis':'Analisa Cycle Time';if(perf)perf.textContent=mode==='speed'?'Segment Performance':'Performance';if(trend)trend.textContent=mode==='speed'?'Trend Speed':'Trend Performa';
        extra?.classList.remove('active');dock.querySelector('.dock-duration-trend-v21')?.classList.remove('active');
      }
    }
  
    function selectedDurationEventsV21(){
      const duration=ensureDurationStateV20();
      if(!durationUiV21.selectedAreas.size&&duration.polygons.length)durationUiV21.selectedAreas=new Set(duration.polygons.map(item=>item.name));
      return duration.events.filter(event=>durationUiV21.selectedAreas.has(event.polygon));
    }
    function renderDurationTreeV21(){
      const duration=ensureDurationStateV20(),query=durationUiV21.query.trim().toLowerCase(),events=duration.events;
      if(!durationUiV21.selectedAreas.size&&duration.polygons.length)durationUiV21.selectedAreas=new Set(duration.polygons.map(item=>item.name));
      const rows=duration.polygons.map(item=>{const list=events.filter(event=>event.polygon===item.name),total=list.reduce((sum,event)=>sum+event.durationMs,0);return{name:item.name,count:list.length,total}}).filter(item=>!query||item.name.toLowerCase().includes(query));
      $('durationContextV20').textContent=`${state.selectedUnits.size} unit · ${durationUiV21.selectedAreas.size}/${duration.polygons.length} area aktif`;
      $('durationEventListV20').innerHTML=`<div class="duration-tree-root-v21">▾ Pit Stop Area <small>· ${rows.length} area</small></div>${rows.length?rows.map(row=>`<label class="duration-tree-row-v21"><input type="checkbox" data-duration-area="${escapeGisTreeV19(row.name)}" ${durationUiV21.selectedAreas.has(row.name)?'checked':''}><strong>${escapeGisTreeV19(row.name)}</strong><small>${row.count} event · ${fmtDur(row.total)}</small></label>`).join(''):'<div class="duration-empty-v20">Area tidak ditemukan.</div>'}`;
    }
    function renderDurationDockV21(){
      /* V23.2: the shared dock is created by mapCentricExploration on
         DOMContentLoaded. A GIS open from Cycle Time may request Pit Stop data
         before the old one-shot V21 setup has created these three hosts. */
      setupDurationDockV21();
      const occupancyHost=$('durationOccupancyDockV21');
      const areaHost=$('durationAreaDockV21');
      const trendHost=$('durationTrendDockV21');
      if(!occupancyHost||!areaHost||!trendHost)return;
      const events=selectedDurationEventsV21(),duration=ensureDurationStateV20(),start=state.analysisWindow?.startMs??parseLocal(state.start).getTime(),end=state.analysisWindow?.endMs??parseLocal(state.end).getTime(),span=Math.max(1,end-start),byUnit=new Map(),byArea=new Map();
      events.forEach(event=>{
        if(!byUnit.has(event.unitNo))byUnit.set(event.unitNo,{events:[],total:0});const unit=byUnit.get(event.unitNo);unit.events.push(event);unit.total+=event.durationMs;
        if(!byArea.has(event.polygon))byArea.set(event.polygon,{events:[],total:0,review:0,units:new Set()});const area=byArea.get(event.polygon);area.events.push(event);area.total+=event.durationMs;area.units.add(event.unitNo);if(durationStatusV20(event)==='review')area.review++;
      });
      const units=[...byUnit.entries()].sort((a,b)=>b[1].total-a[1].total),review=events.filter(event=>durationStatusV20(event)==='review').length;
      occupancyHost.innerHTML=`<header class="duration-dock-head-v21"><strong>Occupancy per Unit</strong><span>${events.length} event · ${units.length} unit</span><small>${clockWitaV20(start)}–${clockWitaV20(end)} WITA</small></header><div class="duration-occupancy-rows-v21">${units.length?units.map(([unitNo,row])=>`<div class="duration-occupancy-row-v21"><strong>${escapeGisTreeV19(unitNo)}</strong><div class="duration-occupancy-track-v21">${row.events.map(event=>{const key=durationEventKeyV20(event),left=Math.max(0,Math.min(100,(event.startMs-start)/span*100)),width=Math.max(.35,Math.min(100-left,event.durationMs/span*100));return`<button class="duration-occupancy-bar-v21 ${durationStatusV20(event)==='review'?'review':''} ${duration.selectedKey===key?'selected':''}" style="left:${left}%;width:${width}%" data-duration-event="${escapeGisTreeV19(key)}" title="${escapeGisTreeV19(event.polygon)} · ${fmtDur(event.durationMs)}"></button>`}).join('')}</div><small>${fmtDur(row.total)}</small></div>`).join(''):'<div class="duration-empty-v20">Belum ada event pada area aktif.</div>'}</div>`;
      const areas=[...byArea.entries()].sort((a,b)=>b[1].total-a[1].total);
      areaHost.innerHTML=`<header class="duration-dock-head-v21"><strong>Area Performance</strong><span>Dwell dan anomali per polygon</span><small>${areas.length} area aktif</small></header><div class="duration-area-grid-v21">${areas.length?areas.map(([name,row])=>`<button type="button" class="duration-area-card-v21" data-duration-area-focus="${escapeGisTreeV19(name)}"><strong>${escapeGisTreeV19(name)}</strong><b>${fmtDur(row.total)}</b><span>${row.events.length} event · ${row.units.size} unit</span><small class="${row.review?'review':''}">${row.review} perlu Review</small></button>`).join(''):'<div class="duration-empty-v20">Pilih area pada hierarchy.</div>'}</div>`;
      const bucketCount=12,buckets=Array.from({length:bucketCount},(_,index)=>({time:start+span*(index+.5)/bucketCount,total:0,review:0}));
      events.forEach(event=>{const index=Math.max(0,Math.min(bucketCount-1,Math.floor((event.startMs-start)/span*bucketCount)));buckets[index].total+=event.durationMs/60000;if(durationStatusV20(event)==='review')buckets[index].review+=event.durationMs/60000});
      const max=Math.max(1,...buckets.map(row=>row.total)),W=1000,H=280,L=42,R=18,T=18,B=34,x=index=>L+(W-L-R)*(index/Math.max(1,bucketCount-1)),y=value=>T+(H-T-B)*(1-value/max),path=key=>buckets.map((row,index)=>`${index?'L':'M'}${x(index).toFixed(1)},${y(row[key]).toFixed(1)}`).join(' ');
      trendHost.innerHTML=`<header class="duration-dock-head-v21"><strong>Trend Duration</strong><span>Akumulasi dwell per interval</span><small>${review} event perlu Review</small></header><div class="duration-trend-wrap-v21"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><g>${[0,.25,.5,.75,1].map(f=>`<line x1="${L}" y1="${T+f*(H-T-B)}" x2="${W-R}" y2="${T+f*(H-T-B)}" stroke="#e7eaee"/><text x="${L-7}" y="${T+f*(H-T-B)+3}" text-anchor="end" font-size="10" fill="#98a2b3">${fmt(max*(1-f),0)}</text>`).join('')}</g><path d="${path('total')}" fill="none" stroke="#287c94" stroke-width="3"/><path d="${path('review')}" fill="none" stroke="#f79009" stroke-width="3"/></svg><div class="duration-trend-legend-v21"><span><i></i>Total dwell (min)</span><span><i class="review"></i>Perlu Review</span></div></div>`;
    }
    function focusDurationAreaV21(name){
      const polygon=ensureDurationStateV20().polygons.find(item=>item.name===name);if(!polygon)return;
      fitGisCoordinatesV18(polygon.polygon,18);
    }
  
    const renderDurationWorkspaceBeforeV21=renderDurationWorkspaceV20;
    renderDurationWorkspaceV20=function(){renderDurationWorkspaceBeforeV21();renderDurationTreeV21();renderDurationDockV21()};
    const renderDurationMapBeforeV21=renderDurationMapV20;
    renderDurationMapV20=function(){
      renderDurationMapBeforeV21();const events=selectedDurationEventsV21(),duration=ensureDurationStateV20(),byArea=new Map();
      events.forEach(event=>{const row=byArea.get(event.polygon)||{total:0,review:0};row.total+=event.durationMs;if(durationStatusV20(event)==='review')row.review++;byArea.set(event.polygon,row)});
      mapSourceSet('duration-pit-src',{type:'FeatureCollection',features:duration.polygons.filter(item=>durationUiV21.selectedAreas.has(item.name)).map(item=>{const row=byArea.get(item.name)||{total:0,review:0};return{type:'Feature',properties:{name:item.name,totalMin:row.total/60000,reviewCount:row.review},geometry:{type:'Polygon',coordinates:[item.polygon]}}})});
      mapSourceSet('duration-event-src',{type:'FeatureCollection',features:events.map(event=>({type:'Feature',properties:{key:durationEventKeyV20(event),unitNo:event.unitNo,polygon:event.polygon,durationMin:event.durationMs/60000,review:durationStatusV20(event)==='review'?1:0,selected:duration.selectedKey===durationEventKeyV20(event)?1:0},geometry:{type:'Point',coordinates:[event.lon,event.lat]}}))});
      const map=state.mapRoot;if(map?.getLayer('duration-event-layer')){
        map.setPaintProperty('duration-event-layer','circle-color','rgba(255,255,255,0.08)');
        map.setPaintProperty('duration-event-layer','circle-stroke-color',['case',['==',['get','review'],1],'#f79009','#287c94']);
        map.setPaintProperty('duration-event-layer','circle-stroke-width',['case',['==',['get','selected'],1],3,2]);
      }
    };
  
    function clearModeVisualsV21(mode){
      document.querySelectorAll('.maplibregl-popup').forEach(node=>node.remove());
      if(mode==='datalog'){
        mapSourceSet('datalog-track-src',V21_EMPTY());hideDataLogMapV20();
      }
      if(mode==='duration'){
        mapSourceSet('duration-event-src',V21_EMPTY());mapSourceSet('duration-pit-src',V21_EMPTY());hideDurationMapV20();ensureDurationStateV20().selectedKey=null;
      }
    }
  
    function dataLogFieldLabelV21(key){return String(key).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/\b\w/g,char=>char.toUpperCase())}
    function inferDataLogColumnsV21(){
      const rows=ensureDataLogStateV20().rows,keys=[],seen=new Set();
      const fallbackRow={timestampms:null,timestampiso:null,district:null,unitno:null,unittype:null,deviceid:null,gpslat:null,gpslong:null,gpsspeed:null,plmstatus:null,statusname:null};
      (rows.length?rows:[fallbackRow]).slice(0,400).forEach(row=>Object.keys(row).forEach(key=>{if(!seen.has(key)){seen.add(key);keys.push(key)}}));
      return keys.map(key=>{
        const values=rows.map(row=>row[key]).filter(value=>value!==null&&value!==undefined&&value!=='').slice(0,60);
        let type='text';if(/timestampiso|datetime|date$/i.test(key))type='datetime';else if(/lat|lon|lng|longitude|latitude/i.test(key))type='geo';else if(values.length&&values.every(value=>typeof value==='number'||(!Number.isNaN(Number(value))&&String(value).trim()!=='')))type='number';
        return{key,label:dataLogFieldLabelV21(key),type,fixed:/^(timestampiso|district|unitno)$/i.test(key)};
      });
    }
    function syncDataLogSchemaV21(){
      const dataLog=ensureDataLogStateV20(),columns=inferDataLogColumnsV21(),signature=columns.map(column=>column.key).join('|');
      if(dataLog.schemaV21!==signature){columns.forEach(column=>dataLog.visibleColumns.add(column.key));dataLog.schemaV21=signature}
      const pick=pattern=>columns.find(column=>pattern.test(column.key))?.key;
      if(!columns.some(column=>column.key===dataLog.latField))dataLog.latField=pick(/gpslat|latitude|(^|_)lat$/i)||columns.find(column=>column.type==='geo')?.key||'';
      if(!columns.some(column=>column.key===dataLog.lonField))dataLog.lonField=pick(/gpslong|longitude|(^|_)(lon|lng)$/i)||columns.find(column=>column.type==='geo'&&column.key!==dataLog.latField)?.key||'';
      if(!columns.some(column=>column.key===dataLog.speedField))dataLog.speedField=pick(/speed/i)||columns.find(column=>column.type==='number')?.key||'';
      if(!columns.some(column=>column.key===dataLog.chartMetric))dataLog.chartMetric=dataLog.speedField||columns.find(column=>column.type==='number')?.key||'';
      if(dataLog.chartX!=='timestampms'&&!columns.some(column=>column.key===dataLog.chartX))dataLog.chartX=pick(/timestamp|time|date/i)||columns[0]?.key||'';
      return columns;
    }
    function enrichDataLogRowsV21(){
      const dataLog=ensureDataLogStateV20();dataLog.rows.forEach((row,index)=>{
        if(row.loader===undefined)row.loader=loaderNameForUnit(row.unitno)||'Unassigned';
        if(row.heading===undefined)row.heading=(index*17)%360;
        if(row.altitude===undefined)row.altitude=Number((66+(index%21)*.7).toFixed(1));
        if(row.satellites===undefined)row.satellites=8+(index%9);
      });
    }
    const renderDataLogTableBeforeV21=renderDataLogTableV20;
    renderDataLogTableV20=function(){
      const dataLog=ensureDataLogStateV20(),rows=filteredDataLogRowsV20(),columns=syncDataLogSchemaV21().filter(column=>dataLog.visibleColumns.has(column.key));
      $('datalogRowsMetaV20').textContent=dataLog.loaded?`${fmtInt(rows.length)} baris · ${columns.length} field aktif`:'Belum dimuat';
      $('datalogTableViewV20').innerHTML=!dataLog.loaded?'<div class="datalog-empty-v20">Pilih unit lalu tekan <strong>Muat data</strong>.</div>':!rows.length?'<div class="datalog-empty-v20">Tidak ada data pada filter aktif.</div>':`<table class="datalog-table-v20"><thead><tr><th>No.</th>${columns.map(column=>`<th>${escapeGisTreeV19(column.label)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,2500).map((row,index)=>`<tr><td>${index+1}</td>${columns.map(column=>`<td>${escapeGisTreeV19(formatDataLogCellV20(row[column.key],column))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    };
    renderDataLogColumnsV20=function(){
      const dataLog=ensureDataLogStateV20(),query=String(dataLog.columnQueryV21||'').trim().toLowerCase();
      $('datalogColumnsListV20').innerHTML=syncDataLogSchemaV21().map(column=>`<label class="datalog-column-row-v20 ${query&&!`${column.label} ${column.key}`.toLowerCase().includes(query)?'hidden-by-search-v21':''}"><input type="checkbox" data-datalog-column="${escapeGisTreeV19(column.key)}" ${dataLog.visibleColumns.has(column.key)?'checked':''} ${column.fixed?'disabled':''}><span>${escapeGisTreeV19(column.label)} <small>· ${escapeGisTreeV19(column.key)}</small>${column.fixed?' · fixed':''}</span></label>`).join('');
    };
    syncDataLogFieldOptionsV20=function(){
      const columns=syncDataLogSchemaV21(),dataLog=ensureDataLogStateV20(),all=columns.map(column=>`<option value="${escapeGisTreeV19(column.key)}">${escapeGisTreeV19(column.label)}</option>`).join(''),numeric=columns.filter(column=>column.type==='number'||column.type==='geo').map(column=>`<option value="${escapeGisTreeV19(column.key)}">${escapeGisTreeV19(column.label)}</option>`).join('');
      $('datalogChartXV20').innerHTML=all;$('datalogChartMetricV20').innerHTML=numeric;$('datalogLatV20').innerHTML=numeric;$('datalogLonV20').innerHTML=numeric;$('datalogSpeedV20').innerHTML=numeric;
      $('datalogChartXV20').value=dataLog.chartX;$('datalogChartMetricV20').value=dataLog.chartMetric;$('datalogLatV20').value=dataLog.latField;$('datalogLonV20').value=dataLog.lonField;$('datalogSpeedV20').value=dataLog.speedField;$('datalogDotTraceV20').checked=dataLog.dotTrace;
    };
  
    const groupsBeforeV21=dataLogUnitGroupsV20;
    dataLogUnitGroupsV20=function(){
      const dataLog=ensureDataLogStateV20();if(!dataLog.groupByV21||dataLog.groupByV21==='unitType')return groupsBeforeV21();
      const groups=new Map(),availability=dataLogAvailabilityV20();
      (state.fixture?.unitNos||[]).filter(unitNo=>state.selectedUnits.has(unitNo)).forEach(unitNo=>{
        const status=availability.get(unitNo),key=dataLog.groupByV21==='loader'?(loaderNameForUnit(unitNo)||'Unassigned'):(status?.coverage==='none'?'No data':'Available');
        if(!groups.has(key))groups.set(key,[]);groups.get(key).push({unitNo,type:key,available:status?.coverage!=='none',hours:status?.hoursAvailable||0,expected:status?.hoursExpected||expectedHourSlots()});
      });
      return[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([type,units])=>({type,units:units.sort((a,b)=>a.unitNo.localeCompare(b.unitNo,undefined,{numeric:true}))}));
    };
  
    function setupDataLogControlsV21(){
      const tree=$('dataLogWorkspaceV20')?.querySelector('.datalog-tree-v20');if(!tree||tree.dataset.v21Ready==='1')return;tree.dataset.v21Ready='1';
      tree.querySelector('.datalog-tree-head-v20')?.insertAdjacentHTML('afterend','<div class="datalog-scope-v21"><label>Group by <select id="datalogGroupByV21"><option value="unitType">Unit Type</option><option value="loader">Loader</option><option value="availability">Availability</option></select></label><button id="datalogResetUnitsV21" type="button">Reset unit</button><span id="datalogScopeMetaV21" class="datalog-scope-meta-v21"></span></div>');
      $('datalogGroupByV21')?.addEventListener('change',event=>{const dataLog=ensureDataLogStateV20();dataLog.groupByV21=event.target.value;dataLog.expanded=new Set(['BRCB']);renderDataLogTreeV20()});
      $('datalogResetUnitsV21')?.addEventListener('click',()=>{const dataLog=ensureDataLogStateV20();dataLog.selectedUnits=new Set(state.selectedUnits);dataLog.rows=[];dataLog.loaded=false;renderDataLogWorkspaceV20();clearModeVisualsV21('datalog')});
      const panel=$('datalogColumnsPanelV20');
      panel?.querySelector('header')?.insertAdjacentHTML('afterend','<div class="datalog-column-search-v21"><input id="datalogColumnSearchV21" type="search" placeholder="Cari nama atau key field…"></div>');
      panel?.insertAdjacentHTML('beforeend','<footer class="datalog-column-actions-v21"><button id="datalogColumnAllV21" type="button">Select all</button><button id="datalogColumnClearV21" type="button">Kosongkan</button><button id="datalogColumnDoneV21" type="button">Selesai</button></footer>');
      $('datalogColumnSearchV21')?.addEventListener('input',event=>{ensureDataLogStateV20().columnQueryV21=event.target.value;renderDataLogColumnsV20()});
      $('datalogColumnAllV21')?.addEventListener('click',()=>{const dataLog=ensureDataLogStateV20();syncDataLogSchemaV21().forEach(column=>dataLog.visibleColumns.add(column.key));renderDataLogColumnsV20();renderDataLogTableV20()});
      $('datalogColumnClearV21')?.addEventListener('click',()=>{const dataLog=ensureDataLogStateV20();dataLog.visibleColumns=new Set(syncDataLogSchemaV21().filter(column=>column.fixed).map(column=>column.key));renderDataLogColumnsV20();renderDataLogTableV20()});
      $('datalogColumnDoneV21')?.addEventListener('click',()=>$('datalogColumnsPanelV20')?.classList.add('hidden'));
      $('datalogColumnsBtnV20')?.addEventListener('click',()=>requestAnimationFrame(positionColumnsV21));
      $('datalogColumnsCloseV20')?.addEventListener('click',()=>$('datalogColumnsPanelV20')?.classList.add('hidden'));
      window.addEventListener('resize',()=>{if(!$('datalogColumnsPanelV20')?.classList.contains('hidden'))positionColumnsV21()});
    }
    function positionColumnsV21(){
      const panel=$('datalogColumnsPanelV20'),button=$('datalogColumnsBtnV20'),shell=document.querySelector('.map-shell');if(!panel||!button||!shell)return;
      const b=button.getBoundingClientRect(),s=shell.getBoundingClientRect();panel.style.left=`${Math.max(8,Math.min(s.width-panel.offsetWidth-8,b.left-s.left))}px`;panel.style.top=`${Math.max(8,b.bottom-s.top+6)}px`;
    }
  
    const renderDataLogTreeBeforeV21=renderDataLogTreeV20;
    renderDataLogTreeV20=function(){
      renderDataLogTreeBeforeV21();const dataLog=ensureDataLogStateV20();
      if($('datalogScopeMetaV21'))$('datalogScopeMetaV21').textContent=`Scope global: ${state.selectedUnits.size} unit · dipilih untuk load: ${dataLog.selectedUnits.size}`;
      if($('datalogGroupByV21'))$('datalogGroupByV21').value=dataLog.groupByV21||'unitType';
    };
    const renderDataLogWorkspaceBeforeV21=renderDataLogWorkspaceV20;
    renderDataLogWorkspaceV20=function(){renderDataLogWorkspaceBeforeV21();renderDataLogColumnsV20();syncDataLogFieldOptionsV20()};
  
    function afterDataLogLoadV21(){
      const dataLog=ensureDataLogStateV20();if(!dataLog.loaded)return;
      enrichDataLogRowsV21();syncDataLogSchemaV21();renderDataLogWorkspaceV20();if(dataLog.view==='map')renderDataLogMapV20();
    }
  
    const setAnalysisModeBeforeV21=setAnalysisMode;
    setAnalysisMode=async function(mode){
      const leaving=state.analysisMode;if(leaving!==mode)clearModeVisualsV21(leaving);
      if(mode==='duration'||mode==='datalog'){showAnalysisLoadingV21(mode==='duration'?'Menyiapkan Duration In Pit':'Menyiapkan Data Log Record',mode==='duration'?'Menghitung dwell polygon dan occupancy telemetry…':'Menyusun hierarchy unit dan schema field…');await waitPaintV21()}
      try{await setAnalysisModeBeforeV21(mode)}finally{configureDockV21(mode);if(mode==='duration'){state.visible.trace=true;updateDeckDotTrace();renderDurationMapV20()}if(mode==='duration'||mode==='datalog')hideAnalysisLoadingV21()}
    };
  
    setupDurationDockV21();setupDataLogControlsV21();configureDockV21(state.analysisMode);
    if(!$('analysisDock'))document.addEventListener('DOMContentLoaded',()=>{
      setupDurationDockV21();
      configureDockV21(state.analysisMode);
    },{once:true});
    $('datalogLoadBtnV20')?.addEventListener('click',()=>{
      showAnalysisLoadingV21('Memuat Data Log Record','Membaca telemetry dan mendeteksi seluruh field…');
      setTimeout(()=>{afterDataLogLoadV21();hideAnalysisLoadingV21()},280);
    },true);
    document.addEventListener('click',event=>{
      const panel=$('datalogColumnsPanelV20'),button=$('datalogColumnsBtnV20');
      if(!panel||panel.classList.contains('hidden')||panel.contains(event.target)||button?.contains(event.target))return;panel.classList.add('hidden');
    });
  })();
  
  
  /* ===== analysisWorkspaceV22Script ===== */
  
  /* V22: runtime repair, shared geometry catalog, interactive Duration evidence and playback. */
  (function(){
    const GEOMETRY_LAYER_SCHEMA_V22={
      speed_corridor:{label:'Speed Corridor',entity:'speed_segment_geometry',geometryType:'Polygon',source:'Auto Suggest + telemetry',lifecycle:'Review Draft → Active',editable:true,persistence:'versioned draft',idStrategy:'R{route}-S{segment}'},
      haul_road:{label:'Haul Road',entity:'haul_road_geometry',geometryType:'LineString + corridor',source:'ROADS_BRCB.kml',lifecycle:'Draft → Published',editable:true,persistence:'versioned config',idStrategy:'ROAD-{sequence}'},
      pit_stop_area:{label:'Pit Stop Area',entity:'operational_area_geometry',geometryType:'Polygon',source:'durasipitstop/pitstops.kml',lifecycle:'Draft → Published',editable:true,persistence:'versioned config',idStrategy:'PIT-{sequence}'},
      district_boundary:{label:'District Boundary',entity:'district_boundary_geometry',geometryType:'Polygon',source:'BOUNDARY_BRCB.kml',lifecycle:'Reference',editable:false,persistence:'master GIS',idStrategy:'site_id'},
      loader_estimate:{label:'Loader Estimate',entity:'derived_loader_area',geometryType:'Polygon',source:'PLM telemetry',lifecycle:'Derived',editable:false,persistence:'recomputed',idStrategy:'loader_id'}
    };
    const STORAGE_KEY_V22='smartd:v3:geometry-catalog:brcb';
    const durationSelectionV22={units:new Set(),events:new Set(),initialized:false};
  
    function geometryStateV22(){
      if(!state.geometryWorkspaceV22)state.geometryWorkspaceV22={sourceMode:'cycle',currentLayer:null,workingDraft:null,catalog:null};
      return state.geometryWorkspaceV22;
    }
    function readGeometryCatalogV22(){
      const geometry=geometryStateV22();if(geometry.catalog)return geometry.catalog;
      let stored=null;try{stored=JSON.parse(localStorage.getItem(STORAGE_KEY_V22)||'null')}catch(_){stored=null}
      geometry.catalog=stored&&stored.schemaVersion===1?stored:{schemaVersion:1,siteId:'BRCB',layers:{}};return geometry.catalog;
    }
    function writeGeometryCatalogV22(){try{localStorage.setItem(STORAGE_KEY_V22,JSON.stringify(readGeometryCatalogV22()));return true}catch(_){return false}}
    function layerRecordV22(type){return readGeometryCatalogV22().layers[type]||null}
    function cloneV22(value){return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}
  
    const loadDurationPolygonsBeforeV22=loadDurationPolygonsV20;
    loadDurationPolygonsV20=async function(){
      await loadDurationPolygonsBeforeV22();const saved=layerRecordV22('pit_stop_area');
      if(saved?.features?.length)ensureDurationStateV20().polygons=saved.features.map((feature,index)=>({id:feature.id||`PIT-${String(index+1).padStart(2,'0')}`,name:feature.name||`Pit Stop ${index+1}`,polygon:cloneV22(feature.coordinates)}));
      return ensureDurationStateV20().polygons;
    };
  
    function baseSegmentV22({id,name,polygon,path,layerType,order=0}){
      const ring=(polygon||[]).map(point=>[...point]);if(ring.length&&JSON.stringify(ring[0])!==JSON.stringify(ring.at(-1)))ring.push([...ring[0]]);
      const line=(path?.length?path:ring.slice(0,-1)).map(point=>[...point]);
      return{id,roadName:name,routeId:layerType,routeLabel:GEOMETRY_LAYER_SCHEMA_V22[layerType]?.label||layerType,routeOrder:0,segmentOrder:order,polygon:ring,path:line,centroid:polygonCentroid(ring),distanceKm:line.length>1?routeLengthMeters(line)/1000:polygonSegmentLengthKm(ring),reviewed:true,geometryEdited:false,coverageConflict:false,lengthIssue:false,conflictWith:[],unitNos:[],units:[],samples:0,change:'Unchanged',layerType};
    }
    function buildPitDraftV22(){
      const record=layerRecordV22('pit_stop_area'),items=ensureDurationStateV20().polygons;
      return{version:`PIT-${record?.version||1}`,createdAt:record?.updatedAt||Date.now(),segments:items.map((item,index)=>baseSegmentV22({id:item.id||`PIT-${String(index+1).padStart(2,'0')}`,name:item.name,polygon:item.polygon,path:item.polygon.slice(0,-1),layerType:'pit_stop_area',order:index})),algorithmMeta:{routes:[],layerType:'pit_stop_area'}};
    }
    function roadFeaturesV22(){
      const record=layerRecordV22('haul_road');if(record?.features?.length)return record.features;
      const roads=(state.roads?.features||[]).flatMap((feature,index)=>{
        const geometry=feature.geometry||{},paths=geometry.type==='LineString'?[geometry.coordinates]:geometry.type==='MultiLineString'?geometry.coordinates:[];
        return paths.filter(path=>path.length>1).map((path,part)=>({id:`ROAD-${String(index+1).padStart(3,'0')}${paths.length>1?`-${part+1}`:''}`,name:feature.properties?.name||`Haul Road ${index+1}`,path}));
      }).slice(0,80);
      if(roads.length)return roads;
      return activeSpeedSegmentsBeforeV22().filter(segment=>(segment.path||[]).length>1).map((segment,index)=>({id:`ROAD-${String(index+1).padStart(3,'0')}`,name:segment.roadName||segment.routeLabel||`Haul Road ${index+1}`,path:cloneV22(segment.path)}));
    }
    function buildHaulRoadDraftV22(){
      const record=layerRecordV22('haul_road'),items=roadFeaturesV22();
      return{version:`ROAD-${record?.version||1}`,createdAt:record?.updatedAt||Date.now(),segments:items.map((item,index)=>baseSegmentV22({id:item.id,name:item.name,polygon:item.coordinates||corridorPolygonFromRoute(item.path,8),path:item.path,layerType:'haul_road',order:index})),algorithmMeta:{routes:[],layerType:'haul_road',corridorWidth:16}};
    }
    function buildCatalogDraftV22(type){return type==='pit_stop_area'?buildPitDraftV22():type==='haul_road'?buildHaulRoadDraftV22():null}
    function isCatalogEditV22(){const type=geometryStateV22().currentLayer;return state.analysisMode==='gis'&&(type==='pit_stop_area'||type==='haul_road')}
  
    const gisDraftBeforeV22=gisDraftV18,activeSpeedSegmentsBeforeV22=activeSpeedSegments;
    gisDraftV18=function(){return isCatalogEditV22()?geometryStateV22().workingDraft:gisDraftBeforeV22()};
    activeSpeedSegments=function(){return isCatalogEditV22()?(geometryStateV22().workingDraft?.segments||[]):activeSpeedSegmentsBeforeV22()};
  
    async function openGeometryWorkspaceV22(type,sourceMode=state.analysisMode){
      const schema=GEOMETRY_LAYER_SCHEMA_V22[type];if(!schema)return;
      if(!schema.editable){showReferenceLayerV22(type);return}
      const currentGeometry=geometryStateV22(),currentGis=state.gisWorkspace;
      if(state.analysisMode==='gis'&&currentGeometry.currentLayer&&currentGeometry.currentLayer!==type&&currentGis?.dirty&&!window.confirm('Perubahan layer saat ini belum disimpan. Pindah layer dan batalkan perubahan?'))return;
      if(state.playback.active)closePlayback();
      if(type==='pit_stop_area')await loadDurationPolygonsV20();
      const geometry=geometryStateV22();geometry.sourceMode=sourceMode==='gis'?(geometry.sourceMode||'cycle'):sourceMode;geometry.currentLayer=type;geometry.workingDraft=buildCatalogDraftV22(type);
      if(!geometry.workingDraft?.segments.length){showSpeedNotice(`${schema.label} belum memiliki geometry yang dapat diedit.`);return}
      state.speedAnalysis.selectedSegments=new Set([geometry.workingDraft.segments[0].id]);
      const gis=ensureGisTreeStateV19();gis.sessionVersion=null;gis.treeInitialized=false;gis.treeQuery='';gis.expandedRoutes=new Set([type]);
      await setAnalysisMode('gis');document.body.classList.add('gis-catalog-mode-v22');
      updateGisChromeV22();renderGisWorkspaceV18();fitGisDraftV18();
    }
    function showReferenceLayerV22(type){
      const map=state.mapRoot;if(type==='district_boundary'){state.visible.boundary=true;mapVisibility('boundary-layer',true);const coords=[];(state.boundary?.features||[]).forEach(feature=>collectCoordinatesV22(feature.geometry?.coordinates,coords));if(coords.length)fitGisCoordinatesV18(coords,16);showSpeedNotice('District Boundary ditampilkan sebagai master GIS read-only pada V22.')}
      else if(type==='loader_estimate'){mapVisibility('loader-layer',true);showSpeedNotice('Loader Estimate adalah derived layer dari telemetry dan tidak diedit manual.')}
    }
    function collectCoordinatesV22(value,out){if(!Array.isArray(value))return;if(value.length>=2&&value.every(Number.isFinite)){out.push(value);return}value.forEach(item=>collectCoordinatesV22(item,out))}
  
    const speedOpenInGisBeforeV22=speedOpenInGis;
    speedOpenInGis=async function(){
      if(state.analysisMode==='duration')return openGeometryWorkspaceV22('pit_stop_area','duration');
      if(state.analysisMode==='speed'&&state.speedAnalysis.draft){const geometry=geometryStateV22();geometry.sourceMode='speed';geometry.currentLayer='speed_corridor';geometry.workingDraft=null;document.body.classList.remove('gis-catalog-mode-v22');return setAnalysisMode('gis')}
      return openGeometryWorkspaceV22('pit_stop_area',state.analysisMode);
    };
  
    function saveCatalogGeometryV22(){
      const geometry=geometryStateV22(),type=geometry.currentLayer,draft=geometry.workingDraft;if(!draft)return;
      const catalog=readGeometryCatalogV22(),previous=catalog.layers[type],version=(Number(previous?.version)||0)+1;
      const features=draft.segments.map(segment=>({id:segment.id,name:segment.roadName||segment.id,coordinates:cloneV22(segment.polygon),path:cloneV22(segment.path||[]),properties:{layerType:type,geometryType:GEOMETRY_LAYER_SCHEMA_V22[type].geometryType}}));
      catalog.layers[type]={layerType:type,version,updatedAt:Date.now(),source:GEOMETRY_LAYER_SCHEMA_V22[type].source,features,history:[...(previous?.history||[]),...(previous?[{version:previous.version,updatedAt:previous.updatedAt,features:previous.features}]:[])].slice(-8)};
      const persisted=writeGeometryCatalogV22();
      if(type==='pit_stop_area')ensureDurationStateV20().polygons=features.map(feature=>({id:feature.id,name:feature.name,polygon:cloneV22(feature.coordinates)}));
      const gis=ensureGisWorkspaceV18State();gis.dirty=false;gis.undo=[];gis.redo=[];
      const returnMode=geometry.sourceMode||'cycle';geometry.currentLayer=null;geometry.workingDraft=null;document.body.classList.remove('gis-catalog-mode-v22');
      setAnalysisMode(returnMode).then(()=>{if(returnMode==='duration')refreshDurationV20();showSpeedNotice(`${GEOMETRY_LAYER_SCHEMA_V22[type].label} v${version} tersimpan${persisted?' sebagai prototype persistent config':' pada sesi ini'}.`) });
    }
    const saveGisGeometryBeforeV22=saveGisGeometryToDraftV18;
    saveGisGeometryToDraftV18=function(){if(isCatalogEditV22())return saveCatalogGeometryV22();return saveGisGeometryBeforeV22()};
    const closeGisBeforeV22=closeGisWithoutSaveV18;
    closeGisWithoutSaveV18=function(){
      if(!isCatalogEditV22())return closeGisBeforeV22();
      const geometry=geometryStateV22(),gis=ensureGisWorkspaceV18State();if(gis.dirty&&!window.confirm('Perubahan geometry belum disimpan. Batalkan perubahan dan kembali?'))return;
      const returnMode=geometry.sourceMode||'cycle';geometry.currentLayer=null;geometry.workingDraft=null;document.body.classList.remove('gis-catalog-mode-v22');setAnalysisMode(returnMode);if(returnMode==='duration')refreshDurationV20();
    };
  
    const renderGisTreeBeforeV22=renderGisLayerTreeV19;
    renderGisLayerTreeV19=function(){
      if(!isCatalogEditV22())return renderGisTreeBeforeV22();
      const tree=$('gisLayerTree'),geometry=geometryStateV22(),schema=GEOMETRY_LAYER_SCHEMA_V22[geometry.currentLayer],query=ensureGisTreeStateV19().treeQuery.trim().toLowerCase(),segments=gisSegmentsV18().filter(segment=>!query||`${segment.id} ${segment.roadName}`.toLowerCase().includes(query)),selected=state.speedAnalysis.selectedSegments;
      tree.innerHTML=`<div class="gis-tree-root"><strong>${escapeGisTreeV19(schema.label)}</strong><span class="gis-tree-count">${fmtInt(segments.length)}</span></div><div>${segments.map(segment=>`<div class="gis-tree-feature-v22 ${selected.has(segment.id)?'selected':''}" data-tree-segment="${escapeGisTreeV19(segment.id)}" role="button" tabindex="0"><i></i><span><strong>${escapeGisTreeV19(segment.roadName||segment.id)}</strong><small>${escapeGisTreeV19(segment.id)} · ${escapeGisTreeV19(schema.geometryType)}</small></span><button type="button" data-tree-rename="${escapeGisTreeV19(segment.id)}" title="Rename">✎</button></div>`).join('')||'<div class="gis-tree-empty">Geometry tidak ditemukan.</div>'}</div>`;
    };
    const renameGisBeforeV22=renameGisSegmentV19;
    renameGisSegmentV19=function(id){
      if(!isCatalogEditV22())return renameGisBeforeV22(id);const segment=gisSegmentByIdV18(id);if(!segment)return;
      const label=geometryStateV22().currentLayer==='pit_stop_area'?'Area Name':'Road Name',value=window.prompt(`${label} untuk ${segment.id}`,segment.roadName||'');if(value===null||value.trim()===(segment.roadName||''))return;
      pushGisUndoV18(`Rename ${segment.id}`);segment.roadName=value.trim();markGisDirtyV18(`${label} ${segment.id} diperbarui`);renderGisWorkspaceV18();
    };
    const showGisPopupBeforeV22=showGisSegmentPopupV18;
    showGisSegmentPopupV18=function(segment,lngLat){
      if(!isCatalogEditV22())return showGisPopupBeforeV22(segment,lngLat);if(!segment||!state.mapRoot)return;
      const schema=GEOMETRY_LAYER_SCHEMA_V22[geometryStateV22().currentLayer],node=document.createElement('div');
      node.innerHTML=`<div class="gis-popup-head"><strong>${escapeGisTreeV19(segment.roadName||segment.id)}</strong><span class="gis-popup-status">${escapeGisTreeV19(schema.label)}</span></div><div class="gis-popup-kv"><span>ID</span><b>${escapeGisTreeV19(segment.id)}</b></div><div class="gis-popup-kv"><span>Geometry</span><b>${escapeGisTreeV19(schema.geometryType)}</b></div><div class="gis-popup-kv"><span>Version</span><b>${escapeGisTreeV19(gisDraftV18()?.version||'—')}</b></div><div class="gis-popup-actions"><button data-popup-fit>Fit</button><button data-popup-rename>Rename</button><button class="primary" data-popup-edit>Edit Geometry</button><button class="danger" data-popup-exclude>Hapus</button></div>`;
      const popup=new maplibregl.Popup({closeButton:true,offset:9,className:'gis-segment-popup'}).setLngLat(lngLat).setDOMContent(node).addTo(state.mapRoot);
      node.querySelector('[data-popup-fit]').addEventListener('click',()=>{selectGisSegmentsV18(new Set([segment.id]),{fit:true});popup.remove()});node.querySelector('[data-popup-rename]').addEventListener('click',()=>{popup.remove();renameGisSegmentV19(segment.id)});node.querySelector('[data-popup-edit]').addEventListener('click',()=>{selectGisSegmentsV18(new Set([segment.id]));setGisToolV18('vertex');popup.remove()});node.querySelector('[data-popup-exclude]').addEventListener('click',()=>{selectGisSegmentsV18(new Set([segment.id]));excludeGisSelectionV18();popup.remove()});
    };
  
    const renderGisToolbarBeforeV22=renderGisToolbarStateV18;
    renderGisToolbarStateV18=function(){renderGisToolbarBeforeV22();if(isCatalogEditV22()){$('gisSplitTool').disabled=true;$('gisMergeTool').disabled=true;$('gisCompareDraftBtn').disabled=true;$('gisCompareTool').disabled=true}};
    const renderGisWorkspaceBeforeV22=renderGisWorkspaceV18;
    renderGisWorkspaceV18=function(){renderGisWorkspaceBeforeV22();updateGisChromeV22();renderGeometryCatalogV22()};
  
    function updateGisChromeV22(){
      if(state.analysisMode!=='gis')return;const geometry=geometryStateV22(),type=geometry.currentLayer;
      const title=$('speedGisHandoffModal')?.querySelector('.gis-command-title strong'),sidebar=$('speedGisHandoffModal')?.querySelector('.gis-sidebar-head>span'),context=$('speedGisHandoffModal')?.querySelector('.gis-sidebar-context');
      if(type&&type!=='speed_corridor'){
        const schema=GEOMETRY_LAYER_SCHEMA_V22[type],record=layerRecordV22(type);if(title)title.textContent=`GIS Workspace · ${schema.label}`;if(sidebar)sidebar.textContent='Geometry Catalog → Layer → Feature';
        $('speedGisHandoffClose').textContent=`← ${geometry.sourceMode==='duration'?'Duration In Pit':geometry.sourceMode==='speed'?'Speed Analysis':'Analysis Workspace'}`;$('speedGisHandoffSimulate').textContent='Save Geometry';$('gisTreeSearch').placeholder=`Cari ${type==='pit_stop_area'?'Area Name':'Road Name'} atau ID…`;
        $('speedGisHandoffMeta').textContent=`${schema.entity} · ${schema.lifecycle} · ${record?`Active v${record.version}`:'Initial fixture'}`;
        if(context){const rows=context.querySelectorAll('div');if(rows[0]){rows[0].querySelector('span').textContent='Layer Type';rows[0].querySelector('strong').textContent=type}if(rows[1]){rows[1].querySelector('span').textContent='Version';$('gisDraftVersion').textContent=record?`v${record.version}`:'Initial'}if(rows[2]){rows[2].querySelector('span').textContent='Selection';$('gisSegmentSelection').textContent=`${state.speedAnalysis.selectedSegments.size} feature`}if(rows[3]){rows[3].querySelector('span').textContent='Persistence';rows[3].querySelector('strong').textContent=schema.persistence}}
      }else{
        if(title)title.textContent='GIS Workspace · Speed Segment Geometry';if(sidebar)sidebar.textContent='Draft, route, dan seluruh segment';$('speedGisHandoffClose').textContent='← Speed Analysis';$('speedGisHandoffSimulate').textContent='Save to Draft';$('gisTreeSearch').placeholder='Cari Segment ID atau Road Name…';
      }
    }
  
    function setupGeometryCatalogV22(){
      $('modeGisBtn').disabled=false;$('modeGisBtn').title='Open shared Geometry Workspace';
      const scroll=$('speedGisHandoffModal')?.querySelector('.gis-layer-scroll');if(scroll&&!$('gisCatalogV22'))scroll.insertAdjacentHTML('afterbegin','<section id="gisCatalogV22" class="gis-catalog-v22"></section><section id="gisSchemaV22" class="gis-schema-v22"></section>');
      const top=$('durationWorkspaceV20')?.querySelector('.duration-topbar-v20');if(top&&!$('durationActionsV22'))top.insertAdjacentHTML('beforeend','<div id="durationActionsV22" class="duration-actions-v22"><button id="durationPlaybackV22" class="btn primary" type="button">▶ Playback</button><button id="durationOpenGisV22" class="btn" type="button">Edit Area in GIS</button></div>');
      const telemetry=$('playbackTelemetry'),divider=telemetry?.querySelector('.playback-telemetry-divider');if(telemetry&&divider&&!$('pbPitWrapV22'))divider.insertAdjacentHTML('beforebegin','<div id="pbPitWrapV22" class="playback-stat playback-pit-stat-v22 hidden"><span class="playback-stat-label">Pit Stop</span><strong id="pbPitStateV22">Outside</strong></div>');
      $('durationOpenGisV22')?.addEventListener('click',()=>openGeometryWorkspaceV22('pit_stop_area','duration'));
      $('durationPlaybackV22')?.addEventListener('click',startDurationPlaybackV22);
      $('gisCatalogV22')?.addEventListener('click',event=>{const row=event.target.closest('[data-geometry-layer]');if(!row)return;const type=row.dataset.geometryLayer,schema=GEOMETRY_LAYER_SCHEMA_V22[type];if(schema.editable)openGeometryWorkspaceV22(type,geometryStateV22().sourceMode);else showReferenceLayerV22(type)});
      renderGeometryCatalogV22();
    }
    function layerCountV22(type){if(type==='speed_corridor')return state.speedAnalysis.draft?.segments?.length||state.speedAnalysis.active?.segments?.length||0;if(type==='pit_stop_area')return ensureDurationStateV20().polygons.length;if(type==='haul_road')return roadFeaturesV22().length;if(type==='district_boundary')return state.boundary?.features?.length||0;return state.assignment?.loaders?.length||0}
    function renderGeometryCatalogV22(){
      const host=$('gisCatalogV22');if(!host)return;const current=geometryStateV22().currentLayer;
      host.innerHTML=`<div class="gis-catalog-head-v22"><strong>Geometry Catalog</strong><small>Site BRCB</small></div>${Object.entries(GEOMETRY_LAYER_SCHEMA_V22).map(([type,schema])=>`<button class="gis-catalog-row-v22 ${current===type?'active':''}" type="button" data-geometry-layer="${type}" ${type==='speed_corridor'&&!state.speedAnalysis.draft?'disabled':''}><i class="${type==='pit_stop_area'?'pit':type==='district_boundary'?'boundary':!schema.editable?'derived':''}"></i><span><strong>${escapeGisTreeV19(schema.label)}</strong><span>${type} · ${schema.geometryType}</span></span><b>${layerCountV22(type)}${schema.editable?' · edit':' · view'}</b></button>`).join('')}`;
      const schema=current?GEOMETRY_LAYER_SCHEMA_V22[current]:GEOMETRY_LAYER_SCHEMA_V22.pit_stop_area;if($('gisSchemaV22'))$('gisSchemaV22').innerHTML=`<strong>Backend geometry contract</strong><code>entity: ${schema.entity}<br>type: ${current||'pit_stop_area'}<br>geometry: ${schema.geometryType}<br>id: ${schema.idStrategy}<br>lifecycle: ${schema.lifecycle}</code><small>${schema.source} · ${schema.persistence}</small>`;
    }
  
    const renderSpeedTopActionsBeforeV22=renderSpeedTopActionsV17;
    renderSpeedTopActionsV17=function(){renderSpeedTopActionsBeforeV22();$('modeGisBtn').disabled=false;$('modeGisBtn').title='Open shared Geometry Workspace'};
  
    function activeDurationAreasV22(){const checked=[...document.querySelectorAll('[data-duration-area]:checked')].map(input=>input.dataset.durationArea);return checked.length?new Set(checked):new Set(ensureDurationStateV20().polygons.map(item=>item.name))}
    function visibleDurationEventsV22(){const areas=activeDurationAreasV22();return ensureDurationStateV20().events.filter(event=>areas.has(event.polygon))}
    function setupDurationSelectionV22(){
      const events=visibleDurationEventsV22(),units=[...new Set(events.map(event=>event.unitNo))];if(!durationSelectionV22.initialized){durationSelectionV22.units=new Set(units);durationSelectionV22.initialized=true}else durationSelectionV22.units=new Set([...durationSelectionV22.units].filter(unit=>units.includes(unit)));
      const host=$('durationOccupancyDockV21');if(!host)return;
      const header=host.querySelector('.duration-dock-head-v21');if(header&&!header.querySelector('[data-duration-unit-all]'))header.insertAdjacentHTML('beforeend','<label class="duration-playback-select-v22"><input type="checkbox" data-duration-unit-all> <span data-duration-unit-summary></span></label>');
      const allInput=header?.querySelector('[data-duration-unit-all]'),summary=header?.querySelector('[data-duration-unit-summary]');if(allInput)allInput.checked=Boolean(units.length&&units.every(unit=>durationSelectionV22.units.has(unit)));if(summary)summary.textContent=`${durationSelectionV22.units.size}/${units.length} untuk Playback`;
      host.querySelectorAll('.duration-occupancy-row-v21').forEach(row=>{const unit=row.querySelector('strong')?.textContent?.trim();if(!unit)return;row.dataset.durationUnit=unit;if(!row.querySelector('[data-duration-unit]'))row.insertAdjacentHTML('afterbegin',`<input type="checkbox" data-duration-unit="${escapeGisTreeV19(unit)}" aria-label="Pilih ${escapeGisTreeV19(unit)} untuk Playback">`);row.querySelector('[data-duration-unit]').checked=durationSelectionV22.units.has(unit)});
      if(host.dataset.selectionBoundV22!=='1'){host.dataset.selectionBoundV22='1';host.addEventListener('change',event=>{const unit=event.target.dataset.durationUnit;if(unit){event.target.checked?durationSelectionV22.units.add(unit):durationSelectionV22.units.delete(unit)}else if(event.target.hasAttribute('data-duration-unit-all')){durationSelectionV22.units=event.target.checked?new Set([...host.querySelectorAll('[data-duration-unit]')].map(input=>input.dataset.durationUnit)):new Set()}setupDurationSelectionV22();syncDurationPlaybackButtonV22()})}
      syncDurationPlaybackButtonV22();
    }
    function syncDurationPlaybackButtonV22(){if($('durationPlaybackV22')){$('durationPlaybackV22').disabled=!durationSelectionV22.units.size;$('durationPlaybackV22').textContent=durationSelectionV22.units.size?`▶ Playback ${durationSelectionV22.units.size} unit`:'▶ Playback'}}
  
    function renderDurationEventGridV22(){
      const host=$('durationAreaDockV21');if(!host)return;try{state.durationGridApiV22?.destroy?.()}catch(_){}state.durationGridApiV22=null;
      const events=visibleDurationEventsV22(),rows=events.map(event=>({id:durationEventKeyV20(event),area:event.polygon,unitNo:event.unitNo,inMs:event.startMs,outMs:event.endMs,durationMs:event.durationMs,status:durationStatusV20(event)==='review'?'Perlu Review':'Normal',event}));
      host.innerHTML=`<header class="duration-dock-head-v21"><strong>Area & Event Evidence</strong><span>${rows.length} dwell event · checklist untuk review</span><small>Klik row untuk fokus map</small></header><div id="durationEventGridV22" class="duration-event-grid-v22"></div>`;
      if(!globalThis.agGrid?.createGrid){$('durationEventGridV22').innerHTML=`<table class="duration-grid-fallback-v22"><thead><tr><th>Area</th><th>Unit</th><th>In</th><th>Out</th><th>Duration</th><th>Status</th></tr></thead><tbody>${rows.map(row=>`<tr data-duration-event="${escapeGisTreeV19(row.id)}"><td>${escapeGisTreeV19(row.area)}</td><td>${escapeGisTreeV19(row.unitNo)}</td><td>${clockWitaV20(row.inMs)}</td><td>${clockWitaV20(row.outMs)}</td><td>${fmtDur(row.durationMs)}</td><td>${row.status}</td></tr>`).join('')}</tbody></table>`;return}
      const base=agGrid.themeQuartz||agGrid.themeBalham||agGrid.themeAlpine,theme=base?.withParams?base.withParams({spacing:5,rowVerticalPaddingScale:.8,headerVerticalPaddingScale:.8,accentColor:'#287c94',backgroundColor:'#fff',foregroundColor:'#172033',headerBackgroundColor:'#f7f9fb',headerTextColor:'#475467',borderColor:'#dfe3e8',rowHoverColor:'#f6fafb',selectedRowBackgroundColor:'#edf7f9',fontSize:12}):base;
      state.durationGridApiV22=agGrid.createGrid($('durationEventGridV22'),{theme,rowData:rows,getRowId:p=>p.data.id,rowHeight:33,headerHeight:35,defaultColDef:{sortable:true,resizable:true,suppressHeaderMenuButton:true},rowSelection:{mode:'multiRow',checkboxes:true,headerCheckbox:true,enableClickSelection:false},selectionColumnDef:{pinned:'left',width:44,minWidth:44,maxWidth:44,resizable:false,sortable:false},columnDefs:[{field:'area',headerName:'Pit Stop Area',minWidth:150,flex:1},{field:'unitNo',headerName:'Unit',width:105},{field:'inMs',headerName:'In',width:90,valueFormatter:p=>clockWitaV20(p.value)},{field:'outMs',headerName:'Out',width:90,valueFormatter:p=>clockWitaV20(p.value)},{field:'durationMs',headerName:'Duration',width:105,valueFormatter:p=>fmtDur(p.value)},{field:'status',headerName:'Review',width:115}],getRowClass:p=>p.data?.status==='Perlu Review'?'duration-review-row':'',onCellClicked:event=>{if(event.column?.getColId?.()==='ag-Grid-SelectionColumn')return;focusDurationEventV20(event.data.event)},onSelectionChanged:event=>{durationSelectionV22.events=new Set(event.api.getSelectedRows().map(row=>row.id));const one=event.api.getSelectedRows()[0]?.event;if(event.api.getSelectedRows().length===1&&one){ensureDurationStateV20().selectedKey=durationEventKeyV20(one);renderDurationMapV20()}}});
      requestAnimationFrame(()=>state.durationGridApiV22?.forEachNode(node=>node.setSelected(durationSelectionV22.events.has(node.data.id),false,'sync-duration')));
    }
  
    function renderDurationTrendV22(){
      const host=$('durationTrendDockV21');if(!host)return;const events=visibleDurationEventsV22(),start=state.analysisWindow?.startMs??parseLocal(state.start).getTime(),end=state.analysisWindow?.endMs??parseLocal(state.end).getTime(),span=Math.max(1,end-start),count=12,buckets=Array.from({length:count},(_,index)=>({start:start+span*index/count,end:start+span*(index+1)/count,total:0,review:0,events:0}));
      events.forEach(event=>{const index=Math.max(0,Math.min(count-1,Math.floor((event.startMs-start)/span*count))),bucket=buckets[index];bucket.total+=event.durationMs/60000;bucket.events++;if(durationStatusV20(event)==='review')bucket.review+=event.durationMs/60000});
      const max=Math.max(1,...buckets.map(row=>row.total)),W=1000,H=300,L=58,R=22,T=20,B=52,x=index=>L+(W-L-R)*(index/Math.max(1,count-1)),y=value=>T+(H-T-B)*(1-value/max),path=key=>buckets.map((row,index)=>`${index?'L':'M'}${x(index).toFixed(1)},${y(row[key]).toFixed(1)}`).join(' '),xTicks=[0,Math.floor((count-1)/2),count-1];
      host.innerHTML=`<header class="duration-dock-head-v21"><strong>Trend Duration</strong><span>X: Waktu WITA · Y: dwell per interval</span><small>Hover untuk detail</small></header><div class="duration-trend-wrap-v22"><svg id="durationTrendSvgV22" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${[0,.25,.5,.75,1].map(f=>`<line x1="${L}" y1="${T+f*(H-T-B)}" x2="${W-R}" y2="${T+f*(H-T-B)}" stroke="#e7eaee"/><text class="duration-trend-axis-v22" x="${L-8}" y="${T+f*(H-T-B)+3}" text-anchor="end">${fmt(max*(1-f),0)}</text>`).join('')}<line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#98a2b3"/>${xTicks.map(index=>`<text class="duration-trend-axis-v22" x="${x(index)}" y="${H-B+18}" text-anchor="middle">${clockWitaV20(buckets[index].start)}</text>`).join('')}<text class="duration-trend-axis-title-v22" x="${(L+W-R)/2}" y="${H-8}" text-anchor="middle">Waktu (WITA)</text><text class="duration-trend-axis-title-v22" x="15" y="${(T+H-B)/2}" text-anchor="middle" transform="rotate(-90 15 ${(T+H-B)/2})">Dwell / interval (menit)</text><path d="${path('total')}" fill="none" stroke="#287c94" stroke-width="3"/><path d="${path('review')}" fill="none" stroke="#f79009" stroke-width="3"/><line id="durationTrendCrossV22" x1="${L}" y1="${T}" x2="${L}" y2="${H-B}" stroke="#667085" stroke-dasharray="3 3" visibility="hidden"/><circle id="durationTrendDotTotalV22" r="5" fill="#287c94" stroke="#fff" stroke-width="2" visibility="hidden"/><circle id="durationTrendDotReviewV22" r="5" fill="#f79009" stroke="#fff" stroke-width="2" visibility="hidden"/></svg><div id="durationTrendTooltipV22" class="duration-trend-tooltip-v22 hidden"></div></div>`;
      const svg=$('durationTrendSvgV22'),tip=$('durationTrendTooltipV22'),wrap=svg?.parentElement;if(!svg||!tip||!wrap)return;
      svg.addEventListener('pointermove',event=>{const rect=svg.getBoundingClientRect(),ratio=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),index=Math.round(ratio*(count-1)),bucket=buckets[index],cx=x(index),totalY=y(bucket.total),reviewY=y(bucket.review);$('durationTrendCrossV22').setAttribute('x1',cx);$('durationTrendCrossV22').setAttribute('x2',cx);$('durationTrendDotTotalV22').setAttribute('cx',cx);$('durationTrendDotTotalV22').setAttribute('cy',totalY);$('durationTrendDotReviewV22').setAttribute('cx',cx);$('durationTrendDotReviewV22').setAttribute('cy',reviewY);['durationTrendCrossV22','durationTrendDotTotalV22','durationTrendDotReviewV22'].forEach(id=>$(id).setAttribute('visibility','visible'));tip.innerHTML=`<strong>${clockWitaV20(bucket.start)}–${clockWitaV20(bucket.end)} WITA</strong><div><span>Total dwell</span><b>${fmt(bucket.total,1)} min</b></div><div><span>Perlu Review</span><b>${fmt(bucket.review,1)} min</b></div><div><span>Event</span><b>${bucket.events}</b></div>`;tip.classList.remove('hidden');tip.style.left=`${Math.min(wrap.clientWidth-175,Math.max(8,event.clientX-wrap.getBoundingClientRect().left+12))}px`;tip.style.top=`${Math.max(8,event.clientY-wrap.getBoundingClientRect().top-52)}px`});
      svg.addEventListener('pointerleave',()=>{tip.classList.add('hidden');['durationTrendCrossV22','durationTrendDotTotalV22','durationTrendDotReviewV22'].forEach(id=>$(id).setAttribute('visibility','hidden'))});
    }
  
    function enhanceDurationV22(){if(state.analysisMode!=='duration')return;setupDurationSelectionV22();renderDurationEventGridV22();renderDurationTrendV22()}
    const renderDurationWorkspaceBeforeV22=renderDurationWorkspaceV20;
    renderDurationWorkspaceV20=function(){renderDurationWorkspaceBeforeV22();enhanceDurationV22()};
  
    function startDurationPlaybackV22(){
      if(!durationSelectionV22.units.size){showSpeedNotice('Pilih minimal satu unit pada Occupancy untuk Playback.');return}
      state.mapSelectedUnits=new Set(durationSelectionV22.units);state.playbackContextV22='duration';startPlayback();
    }
    const syncPlaybackTelemetryBeforeV22=syncPlaybackTelemetry;
    syncPlaybackTelemetry=function(){
      syncPlaybackTelemetryBeforeV22();const wrap=$('pbPitWrapV22');if(!wrap)return;
      if(state.playbackContextV22!=='duration'||!state.playback.active){wrap.classList.add('hidden');return}
      const unit=state.playback.focusedUnit||[...state.mapSelectedUnits][0],sample=unit?playbackSample(unit,state.playback.currentMs):null,hit=sample?findDurationPolygonV20(sample.position,ensureDurationStateV20().polygons):null;wrap.classList.remove('hidden');wrap.classList.toggle('in',Boolean(hit));wrap.classList.toggle('out',!hit);$('pbPitStateV22').textContent=hit?`IN · ${hit.name}`:'OUTSIDE';
    };
    const closePlaybackBeforeV22=closePlayback;
    closePlayback=function(){closePlaybackBeforeV22();state.playbackContextV22=null;$('pbPitWrapV22')?.classList.add('hidden')};
  
    const setAnalysisModeBeforeV22=setAnalysisMode;
    setAnalysisMode=async function(mode){await setAnalysisModeBeforeV22(mode);$('modeGisBtn').disabled=false;$('modeGisBtn').title='Open shared Geometry Workspace';if(mode!=='gis')document.body.classList.remove('gis-catalog-mode-v22');if(mode==='duration')requestAnimationFrame(enhanceDurationV22);if(mode==='gis')updateGisChromeV22();renderGeometryCatalogV22()};
  
    setupGeometryCatalogV22();
    $('playbackClose')?.addEventListener('click',()=>{state.playbackContextV22=null;$('pbPitWrapV22')?.classList.add('hidden')});
  })();
  
  
  /* ===== analysisWorkspaceV23Script ===== */
  
  (function(){
    const surveyV23={file:null,headers:[],rows:[],roles:[],geojson:{type:'FeatureCollection',features:[]},coordinates:[],visible:true,routeCount:0,appliedFilterSignature:null};
    state.surveyReferenceV23=surveyV23;
    const roleOptionsV23=[['x','Posisi X / Longitude'],['y','Posisi Y / Latitude'],['elevation','Elevasi (informasi)'],['code','Kode / informasi'],['ignore','Abaikan']];
    const escapeV23=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const emptyV23=()=>({type:'FeatureCollection',features:[]});
    const surveyFilterSignatureV23=()=>JSON.stringify({
      start:state.start||'',end:state.end||'',interval:Number(state.interval)||0,source:state.source||'',
      loaders:[...(state.selectedLoaders||[])].sort(),units:[...(state.selectedUnits||[])].sort()
    });
    globalThis.markSurveyFilterAppliedV23=()=>{
      if(state.fixture?.traces?.length)surveyV23.appliedFilterSignature=surveyFilterSignatureV23();
    };
  
    function addSurveyUiV23(){
      const actions=$('speedGisHandoffModal')?.querySelector('.gis-command-actions');
      if(actions&&!$('surveyImportBtnV23'))actions.insertAdjacentHTML('afterbegin','<button id="surveyImportBtnV23" class="btn survey-import-btn-v23" type="button">＋ Impor Pembanding</button>');
      const catalog=$('gisCatalogV22'),scroll=$('speedGisHandoffModal')?.querySelector('.gis-layer-scroll');
      if(scroll&&!$('surveyCompareGroupV23')){
        const html=`<section id="surveyCompareGroupV23" class="gis-layer-group survey-compare-group-v23"><div class="gis-layer-group-head"><strong>Perbandingan Jalur</strong><small id="surveyCompareMetaV23">filter aktif</small></div><label class="gis-layer-row-v18 survey-layer-row-v23"><input id="surveyUnitTraceV23" type="checkbox" checked><i class="gis-layer-symbol survey-symbol-device-v23"></i><span class="gis-layer-name">Jejak Unit</span><span></span></label><label class="gis-layer-row-v18 survey-layer-row-v23"><input id="surveyReferenceToggleV23" type="checkbox" disabled><i class="gis-layer-symbol survey-symbol-reference-v23"></i><span id="surveyReferenceNameV23" class="gis-layer-name">Data survei belum diimpor</span><button id="surveyLayerActionV23" class="survey-layer-action-v23" type="button">Impor</button></label></section>`;
        if(catalog)catalog.insertAdjacentHTML('afterend',html);else scroll.insertAdjacentHTML('afterbegin',html);
      }
      const traceRow=document.querySelector('[data-gis-layer="trace"]')?.closest('label');if(traceRow)traceRow.classList.add('hidden');
      const groups=[...document.querySelectorAll('#speedGisHandoffModal .gis-layer-group')];
      groups.forEach(group=>{const title=group.querySelector('.gis-layer-group-head strong');if(title?.textContent==='Evidence')title.textContent='Data Pendukung';if(title?.textContent==='Reference')title.textContent='Peta Dasar'});
      if($('gisSchemaV22'))$('gisSchemaV22').classList.add('hidden');
      const catalogTitle=$('gisCatalogV22')?.querySelector('.gis-catalog-head-v22 strong');if(catalogTitle)catalogTitle.textContent='Layer Geometry';
      const shell=document.querySelector('.map-shell');if(shell&&!$('surveyMapBadgeV23'))shell.insertAdjacentHTML('beforeend','<div id="surveyMapBadgeV23" class="survey-map-badge-v23 hidden"><span><i class="device"></i>Jejak Unit</span><span><i class="survey"></i>Data Survei</span><strong id="surveyMapBadgeNameV23"></strong></div>');
      $('surveyImportBtnV23')?.addEventListener('click',chooseSurveyFileV23);
      $('surveyLayerActionV23')?.addEventListener('click',()=>surveyV23.coordinates.length?removeSurveyLayerV23():chooseSurveyFileV23());
      $('surveyUnitTraceV23')?.addEventListener('change',event=>{const gis=ensureGisWorkspaceV18State();gis.layers.trace=event.target.checked;state.visible.trace=event.target.checked;updateDeckDotTrace()});
      $('surveyReferenceToggleV23')?.addEventListener('change',event=>{surveyV23.visible=event.target.checked;syncSurveyVisibilityV23()});
      $('surveyFileInputV23')?.addEventListener('change',event=>{const file=event.target.files?.[0];event.target.value='';if(file)readSurveyFileV23(file)});
      document.querySelectorAll('[data-survey-close-v23]').forEach(button=>button.addEventListener('click',closeSurveyModalV23));
      $('surveyShowMapV23')?.addEventListener('click',showSurveyOnMapV23);
      $('applyBtn')?.addEventListener('click',globalThis.markSurveyFilterAppliedV23);
      $('resetBtn')?.addEventListener('click',globalThis.markSurveyFilterAppliedV23);
      $('surveyImportModalV23')?.addEventListener('change',event=>{const select=event.target.closest('[data-survey-column-v23]');if(!select)return;const index=Number(select.dataset.surveyColumnV23),role=select.value;if(role!=='ignore')surveyV23.roles=surveyV23.roles.map((item,itemIndex)=>item===role&&itemIndex!==index?'ignore':item);surveyV23.roles[index]=role;renderSurveyMappingV23()});
      document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('surveyImportModalV23')?.classList.contains('hidden'))closeSurveyModalV23()});
      updateSurveySidebarV23();
    }
  
    function chooseSurveyFileV23(){
      if(!surveyV23.appliedFilterSignature){showSpeedNotice('Data Jejak Unit belum siap. Tunggu proses pemuatan selesai.');return}
      if(surveyV23.appliedFilterSignature!==surveyFilterSignatureV23()){showSpeedNotice('Filter berubah. Klik Terapkan agar Jejak Unit diperbarui.');return}
      if(!state.selectedUnits?.size){showSpeedNotice('Pilih minimal satu unit, lalu klik Terapkan.');return}
      $('surveyFileInputV23')?.click();
    }
    function closeSurveyModalV23(){$('surveyImportModalV23')?.classList.add('hidden')}
    function surveyErrorV23(message=''){const node=$('surveyImportErrorV23');if(!node)return;node.textContent=message;node.classList.toggle('hidden',!message)}
    function valueIsNumericV23(value){return value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(String(value).replace(',','.')))}
  
    function parseDelimitedLineV23(line,delimiter){
      const values=[];let current='',quoted=false;
      for(let index=0;index<line.length;index++){const char=line[index];if(char==='"'){if(quoted&&line[index+1]==='"'){current+='"';index++}else quoted=!quoted}else if(char===delimiter&&!quoted){values.push(current.trim());current=''}else current+=char}
      values.push(current.trim());return values;
    }
    function parseTextRowsV23(text){
      const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());if(!lines.length)return[];
      const first=lines[0],delimiter=first.includes('\t')?'\t':first.includes(';')?';':first.includes(',')?',':null;
      return lines.map(line=>delimiter?parseDelimitedLineV23(line,delimiter):line.trim().split(/\s+/));
    }
    function hasHeaderV23(rows){
      if(rows.length<2)return false;const first=rows[0].map(value=>String(value).trim());
      if(first.some(value=>/^(x|y|easting|northing|longitude|latitude|lon|lat|elevasi|elevation|kode|code|label)$/i.test(value)))return true;
      const score=row=>row.length?row.filter(valueIsNumericV23).length/row.length:0,next=rows.slice(1,Math.min(6,rows.length)).reduce((sum,row)=>sum+score(row),0)/Math.max(1,Math.min(5,rows.length-1));
      return score(first)<next-.3;
    }
    function medianV23(values){const sorted=values.slice().sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:NaN}
    function autoRolesV23(headers,rows){
      const roles=Array(headers.length).fill('ignore'),used=new Set();
      headers.forEach((header,index)=>{const key=String(header).toLowerCase();if(/easting|longitude|\blon\b|^x$/.test(key)){roles[index]='x';used.add('x')}else if(/northing|latitude|\blat\b|^y$/.test(key)){roles[index]='y';used.add('y')}else if(/elev|height|\bz\b/.test(key)){roles[index]='elevation';used.add('elevation')}else if(/code|kode|label|name|nama|type/.test(key)){roles[index]='code';used.add('code')}});
      const stats=headers.map((_,index)=>rows.slice(0,250).map(row=>Number(String(row[index]??'').replace(',','.'))).filter(Number.isFinite));
      stats.forEach((values,index)=>{if(roles[index]!=='ignore'||values.length<Math.min(5,Math.max(1,rows.length*.5)))return;const median=Math.abs(medianV23(values));if(!used.has('x')&&median>100){roles[index]='x';used.add('x')}else if(!used.has('y')&&median>100){roles[index]='y';used.add('y')}else if(!used.has('elevation')&&median<10000){roles[index]='elevation';used.add('elevation')}});
      headers.forEach((_,index)=>{if(roles[index]==='ignore'&&!used.has('code')){roles[index]='code';used.add('code')}});return roles;
    }
  
    async function readSurveyFileV23(file){
      surveyErrorV23();$('surveyShowMapV23').disabled=true;$('surveyShowMapV23').textContent='Membaca data…';
      try{
        let rows=[];const extension=(file.name.split('.').pop()||'').toLowerCase();
        if(extension==='xlsx'||extension==='xls'){
          if(!globalThis.XLSX)throw new Error('Pembaca Excel belum tersedia.');const book=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=book.Sheets[book.SheetNames[0]];rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:'',blankrows:false});
        }else rows=parseTextRowsV23(await file.text());
        rows=rows.filter(row=>Array.isArray(row)&&row.some(value=>String(value??'').trim()!==''));if(!rows.length)throw new Error('File tidak berisi data yang dapat dibaca.');
        const width=Math.max(...rows.map(row=>row.length));rows=rows.map(row=>Array.from({length:width},(_,index)=>row[index]??''));const header=hasHeaderV23(rows);
        surveyV23.file=file;surveyV23.headers=header?rows[0].map((value,index)=>String(value||`Kolom ${index+1}`)):Array.from({length:width},(_,index)=>`Kolom ${index+1}`);surveyV23.rows=header?rows.slice(1):rows;surveyV23.roles=autoRolesV23(surveyV23.headers,surveyV23.rows);
        $('surveyFileNameV23').textContent=file.name;$('surveyFileMetaV23').textContent=`${surveyV23.rows.length.toLocaleString('id-ID')} baris · ${width} kolom`;$('surveyFilterContextV23').textContent=`Jejak Unit: ${$('unitLabel')?.textContent||`${state.selectedUnits.size} unit`} · ${$('timeLabel')?.textContent||displayRange(state.start,state.end)}`;
        renderSurveyMappingV23();$('surveyImportModalV23').classList.remove('hidden');
      }catch(error){
        surveyV23.file=null;surveyV23.rows=[];
        if($('surveyFileNameV23'))$('surveyFileNameV23').textContent=file.name;
        if($('surveyFileMetaV23'))$('surveyFileMetaV23').textContent='File belum dapat dibaca';
        if($('surveyFilterContextV23'))$('surveyFilterContextV23').textContent='Pilih file TXT, CSV, atau Excel yang berisi posisi X dan Y.';
        if($('surveyMappingV23'))$('surveyMappingV23').innerHTML='';
        if($('surveyPreviewV23'))$('surveyPreviewV23').innerHTML='';
        surveyErrorV23(error?.message||'File belum dapat dibaca.');$('surveyImportModalV23')?.classList.remove('hidden');
      }
      finally{$('surveyShowMapV23').textContent='Tampilkan di Peta';$('surveyShowMapV23').disabled=!surveyV23.rows.length}
    }
  
    function renderSurveyMappingV23(){
      const mapping=$('surveyMappingV23'),preview=$('surveyPreviewV23');if(!mapping||!preview)return;
      mapping.innerHTML=surveyV23.headers.map((header,index)=>{const samples=surveyV23.rows.slice(0,3).map(row=>row[index]).filter(value=>String(value??'')!=='').join(' · ');return`<label class="survey-mapping-row-v23"><strong>${escapeV23(header)}</strong><span title="${escapeV23(samples)}">${escapeV23(samples||'—')}</span><select data-survey-column-v23="${index}" aria-label="Mapping ${escapeV23(header)}">${roleOptionsV23.map(([value,label])=>`<option value="${value}" ${surveyV23.roles[index]===value?'selected':''}>${label}</option>`).join('')}</select></label>`}).join('');
      const used=surveyV23.roles.map((role,index)=>role==='ignore'?surveyV23.headers[index]:roleOptionsV23.find(item=>item[0]===role)?.[1]||surveyV23.headers[index]);preview.innerHTML=`<thead><tr>${used.map((header,index)=>`<th>${escapeV23(header)}${surveyV23.roles[index]==='ignore'?' · diabaikan':''}</th>`).join('')}</tr></thead><tbody>${surveyV23.rows.slice(0,5).map(row=>`<tr>${surveyV23.headers.map((_,index)=>`<td>${escapeV23(row[index])}</td>`).join('')}</tr>`).join('')}</tbody>`;
      const valid=surveyV23.roles.includes('x')&&surveyV23.roles.includes('y');surveyErrorV23(valid?'':'Tentukan satu kolom Posisi X dan satu kolom Posisi Y.');$('surveyShowMapV23').disabled=!valid;
    }
  
    function utmToLngLatV23(easting,northing,zone=50,northern=true){
      const a=6378137,e=.081819190842622,k0=.9996,e1=(1-Math.sqrt(1-e*e))/(1+Math.sqrt(1-e*e)),x=easting-500000,y=northern?northing:northing-10000000,m=y/k0,mu=m/(a*(1-e*e/4-3*e**4/64-5*e**6/256));
      const j1=3*e1/2-27*e1**3/32,j2=21*e1**2/16-55*e1**4/32,j3=151*e1**3/96,j4=1097*e1**4/512,fp=mu+j1*Math.sin(2*mu)+j2*Math.sin(4*mu)+j3*Math.sin(6*mu)+j4*Math.sin(8*mu),e2=e*e/(1-e*e),c1=e2*Math.cos(fp)**2,t1=Math.tan(fp)**2,n1=a/Math.sqrt(1-e*e*Math.sin(fp)**2),r1=a*(1-e*e)/(1-e*e*Math.sin(fp)**2)**1.5,d=x/(n1*k0);
      const lat=fp-(n1*Math.tan(fp)/r1)*(d*d/2-(5+3*t1+10*c1-4*c1*c1-9*e2)*d**4/24+(61+90*t1+298*c1+45*t1*t1-252*e2-3*c1*c1)*d**6/720),lonDelta=(d-(1+2*t1+c1)*d**3/6+(5-2*c1+28*t1-3*c1*c1+8*e2+24*t1*t1)*d**5/120)/Math.cos(fp),lonOrigin=(zone-1)*6-180+3;
      return[lonOrigin+lonDelta*180/Math.PI,lat*180/Math.PI];
    }
    function toLngLatV23(x,y){return Math.abs(x)<=180&&Math.abs(y)<=90?[x,y]:utmToLngLatV23(x,y,50,true)}
    function sourceDistanceV23(a,b){if(Math.abs(a[0])>180||Math.abs(a[1])>90)return Math.hypot(a[0]-b[0],a[1]-b[1]);const rad=Math.PI/180,lat=(a[1]+b[1])/2*rad,dx=(a[0]-b[0])*111320*Math.cos(lat),dy=(a[1]-b[1])*110540;return Math.hypot(dx,dy)}
    function splitRoutesV23(points){const routes=[];let current=[];points.forEach(point=>{if(current.length&&sourceDistanceV23(current[current.length-1].source,point.source)>120){if(current.length)routes.push(current);current=[]}current.push(point)});if(current.length)routes.push(current);return routes}
  
    function ensureSurveyMapLayersV23(){
      const map=state.mapRoot;if(!map||!state._mapReady)return false;
      if(!map.getSource('survey-reference-src-v23')){
        map.addSource('survey-reference-src-v23',{type:'geojson',data:emptyV23()});
        map.addLayer({id:'survey-reference-casing-v23',type:'line',source:'survey-reference-src-v23',filter:['==',['get','kind'],'line'],paint:{'line-color':'rgba(255,255,255,.96)','line-width':5,'line-opacity':.95}});
        map.addLayer({id:'survey-reference-line-v23',type:'line',source:'survey-reference-src-v23',filter:['==',['get','kind'],'line'],paint:{'line-color':'#7b61a8','line-width':2.6,'line-opacity':.95}});
        map.addLayer({id:'survey-reference-point-v23',type:'circle',source:'survey-reference-src-v23',filter:['==',['get','kind'],'point'],minzoom:13,paint:{'circle-radius':['interpolate',['linear'],['zoom'],13,1.7,18,3.5],'circle-color':'#7b61a8','circle-stroke-color':'#fff','circle-stroke-width':.7,'circle-opacity':.9}});
        map.on('mouseenter','survey-reference-point-v23',()=>{map.getCanvas().style.cursor='pointer'});map.on('mouseleave','survey-reference-point-v23',()=>{map.getCanvas().style.cursor=''});
        map.on('click','survey-reference-point-v23',event=>{if(!event.features?.length)return;const feature=event.features[0],props=feature.properties||{},coordinate=feature.geometry.coordinates.slice();new maplibregl.Popup({offset:7}).setLngLat(coordinate).setHTML(`<strong>Data Survei</strong><br><span style="font-size:11px;color:#667085">${props.code?`Kode ${escapeV23(props.code)} · `:''}${props.elevation!==''?`Elevasi ${escapeV23(props.elevation)} m`:'Posisi pembanding'}</span>`).addTo(map)});
      }
      return true;
    }
  
    function showSurveyOnMapV23(){
      const xIndex=surveyV23.roles.indexOf('x'),yIndex=surveyV23.roles.indexOf('y'),zIndex=surveyV23.roles.indexOf('elevation'),codeIndex=surveyV23.roles.indexOf('code');if(xIndex<0||yIndex<0){surveyErrorV23('Tentukan kolom Posisi X dan Posisi Y.');return}
      const points=surveyV23.rows.map((row,index)=>{const x=Number(String(row[xIndex]??'').replace(',','.')),y=Number(String(row[yIndex]??'').replace(',','.'));if(!Number.isFinite(x)||!Number.isFinite(y))return null;const lngLat=toLngLatV23(x,y);if(!lngLat.every(Number.isFinite))return null;return{index,source:[x,y],lngLat,elevation:zIndex>=0?row[zIndex]:'',code:codeIndex>=0?row[codeIndex]:''}}).filter(Boolean);
      if(points.length<2){surveyErrorV23('Data posisi yang valid belum cukup untuk ditampilkan.');return}
      const routes=splitRoutesV23(points),features=[];routes.filter(route=>route.length>1).forEach((route,index)=>features.push({type:'Feature',properties:{kind:'line',route:index+1},geometry:{type:'LineString',coordinates:route.map(point=>point.lngLat)}}));points.forEach(point=>features.push({type:'Feature',properties:{kind:'point',row:point.index+1,elevation:String(point.elevation??''),code:String(point.code??'')},geometry:{type:'Point',coordinates:point.lngLat}}));
      surveyV23.geojson={type:'FeatureCollection',features};surveyV23.coordinates=points.map(point=>point.lngLat);surveyV23.routeCount=routes.length;surveyV23.visible=true;
      if(!ensureSurveyMapLayersV23()){surveyErrorV23('Peta belum siap. Coba kembali setelah peta selesai dimuat.');return}state.mapRoot.getSource('survey-reference-src-v23').setData(surveyV23.geojson);closeSurveyModalV23();updateSurveySidebarV23();syncSurveyVisibilityV23();fitGisCoordinatesV18(surveyV23.coordinates,15);showSpeedNotice(`${points.length.toLocaleString('id-ID')} titik survei ditampilkan sebagai ${routes.length} jalur pembanding.`)
    }
  
    function syncSurveyVisibilityV23(){
      const visible=state.analysisMode==='gis'&&surveyV23.visible&&surveyV23.coordinates.length>0;['survey-reference-casing-v23','survey-reference-line-v23','survey-reference-point-v23'].forEach(id=>mapVisibility(id,visible));
      $('surveyMapBadgeV23')?.classList.toggle('hidden',!visible);if($('surveyUnitTraceV23'))$('surveyUnitTraceV23').checked=Boolean(ensureGisWorkspaceV18State().layers.trace);if($('surveyReferenceToggleV23'))$('surveyReferenceToggleV23').checked=surveyV23.visible;
    }
    function updateSurveySidebarV23(){
      const ready=surveyV23.coordinates.length>0,name=surveyV23.file?.name||'Data survei belum diimpor';if($('surveyReferenceNameV23')){$('surveyReferenceNameV23').textContent=name;$('surveyReferenceNameV23').title=name}if($('surveyReferenceToggleV23')){$('surveyReferenceToggleV23').disabled=!ready;$('surveyReferenceToggleV23').checked=ready&&surveyV23.visible}if($('surveyLayerActionV23')){$('surveyLayerActionV23').textContent=ready?'Hapus':'Impor';$('surveyLayerActionV23').classList.toggle('remove',ready)}if($('surveyCompareMetaV23'))$('surveyCompareMetaV23').textContent=ready?`${surveyV23.coordinates.length.toLocaleString('id-ID')} titik`:'filter aktif';if($('surveyMapBadgeNameV23'))$('surveyMapBadgeNameV23').textContent=ready?name:'';
    }
    function removeSurveyLayerV23(){surveyV23.file=null;surveyV23.headers=[];surveyV23.rows=[];surveyV23.roles=[];surveyV23.coordinates=[];surveyV23.routeCount=0;surveyV23.geojson=emptyV23();state.mapRoot?.getSource('survey-reference-src-v23')?.setData(surveyV23.geojson);updateSurveySidebarV23();syncSurveyVisibilityV23();showSpeedNotice('Data survei dihapus dari peta.')}
  
    const setAnalysisModeBeforeV23=setAnalysisMode;
    setAnalysisMode=async function(mode){const result=await setAnalysisModeBeforeV23(mode);if(mode==='gis'){addSurveyUiV23();ensureSurveyMapLayersV23();const catalogTitle=$('gisCatalogV22')?.querySelector('.gis-catalog-head-v22 strong');if(catalogTitle)catalogTitle.textContent='Layer Geometry';if($('gisSchemaV22'))$('gisSchemaV22').classList.add('hidden');if($('surveyCompareMetaV23'))$('surveyCompareMetaV23').textContent=surveyV23.coordinates.length?`${surveyV23.coordinates.length.toLocaleString('id-ID')} titik`:$('timeLabel')?.textContent||'filter aktif'}syncSurveyVisibilityV23();return result};
  
    addSurveyUiV23();
  })();

  return () => {
    document.body.classList.remove('gis-workspace-mode','duration-mode-v20','datalog-mode-v20');
  };
}
