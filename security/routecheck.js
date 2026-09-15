/* Renders every route and opens key modals with realistic data, catching any thrown error.
   This exercises code paths that static analysis cannot reach. */
const { JSDOM } = require('jsdom'); const fs=require('fs'); const fdb=require('fake-indexeddb');
let pass=0, fail=0;
const T=(n,c,x)=>{ c?(pass++,console.log('ok   '+n)):(fail++,console.log('BUG  '+n+(x?'  -> '+x:''))); };
(async()=>{
  const dom=new JSDOM(fs.readFileSync('/home/claude/index.html','utf8'),{
    runScripts:'dangerously',resources:'usable',url:'http://localhost/',
    beforeParse(w){
      Object.defineProperty(w,'indexedDB',{value:new fdb.IDBFactory(),configurable:true});
      Object.defineProperty(w,'IDBKeyRange',{value:fdb.IDBKeyRange,configurable:true});
      w.requestAnimationFrame=cb=>setTimeout(cb,0);
      w.matchMedia = w.matchMedia || (()=>({matches:false,addListener(){},removeListener(){}}));
    }});
  const w=dom.window;
  const errs=[]; w.addEventListener('error',e=>errs.push(e.message||String(e.error)));
  await new Promise(r=>w.document.addEventListener('DOMContentLoaded',r));
  await new Promise(r=>setTimeout(r,3000));

  // Seed realistic data, including awkward values that have broken things before.
  w.eval(`
    DB.set('visitors',[
      {id:'V1',type:'visitor',name:"O'Brien <script>",phone:'01711111111',status:'onsite',
       checkIn:new Date().toISOString(),expiry:new Date(Date.now()+3600e3).toISOString(),
       accessLevel:'VISITOR',areaAccess:{office:true,ship:false,shipName:'',walkway:true,outdoorOpen:false,indoor:false,other:false,otherText:''},
       hostName:'Host A',company:'ACME & Co'},
      {id:'V2',type:'visitor',name:'Checked Out',phone:'01722222222',status:'checked_out',
       checkIn:new Date(Date.now()-7200e3).toISOString(),checkOut:new Date(Date.now()-3600e3).toISOString()}
    ]);
    DB.set('staff',[
      {id:'S1',type:'staff',name:'Sec Officer',category:'STAFF',phone:'01733333333',isSecurity:true,gateCode:'ABC1234',supervisor:'Boss'},
      {id:'W1',type:'staff',name:'Worker One',category:'LABOURER',phone:'01744444444',supervisor:'Boss'},
      {id:'W2',type:'staff',name:'Worker Two',category:'LABOURER',phone:'',supervisor:''}
    ]);
    DB.set('staffAttendance',[
      {id:'a1',staffId:'S1',name:'Sec Officer',category:'STAFF',entryType:'work',checkIn:new Date(Date.now()-3600e3).toISOString(),checkOut:null,workedMins:0},
      {id:'a2',staffId:'W1',name:'Worker One',category:'LABOURER',supervisor:'Boss',entryType:'work',checkIn:new Date(Date.now()-1800e3).toISOString(),checkOut:null,workedMins:0}
    ]);
    sessionUnlocked=true; sessionRole='admin'; sessionOfficerName='Tester'; sessionOfficerPhone='01700000000';
  `);

  const routes=['dashboard','monitor','facescan','cctv','directory','history','reports','addstaff','addlabourer','settings','help'];
  for(const r of routes){
    errs.length=0;
    let ok=true, msg='';
    try{ w.eval(`location.hash='#${r}'; renderRoute();`); }catch(e){ ok=false; msg=e.message; }
    await new Promise(res=>setTimeout(res,120));
    if(errs.length){ ok=false; msg=errs[0]; }
    const html=w.document.getElementById('content').innerHTML;
    T('route renders: '+r, ok && html.length>20, msg||('len='+html.length));
  }

  // Settings sub-tabs (admin unlocked)
  for(const tab of ['general','visitor','staff','facescan','cctv','printing','security','backup','offline','audit']){
    let ok=true,msg='';
    errs.length=0;
    try{ w.eval(`settingsTab='${tab}'; location.hash='#settings'; renderRoute();`); }catch(e){ ok=false; msg=e.message; }
    await new Promise(res=>setTimeout(res,80));
    if(errs.length){ ok=false; msg=errs[0]; }
    T('settings tab: '+tab, ok, msg);
  }

  // Sub-tab permutations that have their own render branches
  for(const [state,vals] of [['directoryState',['visitor','staff','labourer']],['historyState',['visitor','staff','labourer']],['monitorState',['all','visitor','staff','labourer']]]){
    for(const v of vals){
      let ok=true,msg=''; errs.length=0;
      const route = state==='directoryState'?'directory':state==='historyState'?'history':'monitor';
      try{ w.eval(`${state}.tab='${v}'; location.hash='#${route}'; renderRoute();`); }catch(e){ ok=false; msg=e.message; }
      await new Promise(res=>setTimeout(res,80));
      if(errs.length){ ok=false; msg=errs[0]; }
      T(route+' tab '+v, ok, msg);
    }
  }
  // Worker supervisor grouping
  let ok=true,msg=''; errs.length=0;
  try{ w.eval(`monitorState.tab='labourer'; monitorState.groupBySupervisor=true; location.hash='#monitor'; renderRoute();`);}catch(e){ok=false;msg=e.message;}
  await new Promise(r=>setTimeout(r,100));
  T('monitor: group by supervisor', ok && !errs.length, msg||errs[0]);

  // Report types
  for(const t of ['daily-visitor','staff-attendance','labourer-attendance','gate-summary','monthly']){
    let o=true,m=''; errs.length=0;
    try{ w.eval(`reportState.type='${t}'; location.hash='#reports'; renderRoute();`); }catch(e){o=false;m=e.message;}
    await new Promise(r=>setTimeout(r,80));
    if(errs.length){o=false;m=errs[0];}
    T('report: '+t, o, m);
  }

  // Builders that produce printable/shareable output
  const builders=[
    ["buildBadgeHtml(DB.get('visitors',[])[0],'VISITOR')",'badge html'],
    ["buildEntryPermitHtml(DB.get('visitors',[])[0],'VISITOR')",'entry permit html'],
    ["buildReceiptPassHtml(DB.get('visitors',[])[0],'VISITOR')",'receipt html'],
    ["buildBadgeHtml(DB.get('staff',[]).find(s=>s.category==='LABOURER'),'STAFF')",'worker badge html'],
    ["shareMessageFor(DB.get('visitors',[])[0],'VISITOR')",'share message visitor'],
    ["shareMessageFor(DB.get('staff',[])[0],'STAFF')",'share message staff'],
    ["buildFullBackupPayload()",'backup payload'],
  ];
  for(const [expr,name] of builders){
    let o=true,m='';
    try{ const r=w.eval(expr); if(!r) {o=false;m='empty';} }catch(e){o=false;m=e.message;}
    T('builds: '+name, o, m);
  }

  // Worker badge must say WORKER, never LABOUR
  const wb = w.eval("buildBadgeHtml(DB.get('staff',[]).find(s=>s.category==='LABOURER'),'STAFF')");
  T('worker badge says WORKER not LABOUR', wb.includes('WORKER') && !/>LABOUR</.test(wb));

  // Escaping: a name containing markup must not inject raw tags into rendered output
  w.eval(`location.hash='#directory'; directoryState.tab='visitor'; renderRoute();`);
  await new Promise(r=>setTimeout(r,120));
  const dirHtml = w.document.getElementById('content').innerHTML;
  T('hostile name is escaped in directory', dirHtml.includes('&lt;script&gt;') || !dirHtml.includes('<script>'));

  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
