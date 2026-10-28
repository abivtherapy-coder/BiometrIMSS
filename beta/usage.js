'use strict';
(()=>{
 const script=document.currentScript,app=script.dataset.app,endpoint=script.dataset.endpoint||'/api/analytics',prefix='usage:'+app+':';
 const storage={get(k){try{return localStorage.getItem(prefix+k)}catch{return null}},set(k,v){try{localStorage.setItem(prefix+k,v);return true}catch{return false}}};
 let enabled=storage.get('disabled')!=='true'&&navigator.doNotTrack!=='1'&&navigator.globalPrivacyControl!==true;
 const notice=document.createElement('div');notice.style.cssText='margin:16px;padding:12px;border:1px solid #cbd5da;border-radius:12px;font:14px/1.5 system-ui;background:#fff;color:#263d35';
 notice.innerHTML='<label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" aria-label="Permitir estadísticas de uso"><span>Estadísticas de uso: pantallas, funciones y tiempo activo mediante un ID aleatorio. No enviamos tu nombre, matrícula, nickname ni contenido de registros. Puedes desactivarlas aquí.</span></label>';
 const rating=document.createElement('select');rating.setAttribute('aria-label','Valorar esta app');rating.innerHTML='<option value="">Valorar la app (opcional)</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'">'+n+' de 5 estrellas</option>').join('');rating.style.cssText='margin-top:10px;padding:10px;min-height:44px';notice.append(rating);rating.addEventListener('change',()=>{if(enabled&&rating.value){emit('app_rating',{rating:Number(rating.value)});flush()}});
 const checkbox=notice.querySelector('input');checkbox.checked=enabled;document.querySelector('main').append(notice);
 const uuid=()=>crypto.randomUUID();
 let distinct=storage.get('id'),fresh=!distinct;if(!distinct){distinct=uuid();storage.set('id',distinct)}
 let session=uuid(),lastActivity=Date.now(),lastTick=Date.now(),active=0,current='',queue=[],busy=false,started=false;
 const screenIds=new Set([...document.querySelectorAll('.tool[id],[data-view]')].map(e=>e.dataset.view||e.id));
 const buttonIds=new Set([...document.querySelectorAll('button[id],form[id]')].map(e=>e.id));
 const screen=()=>{const el=document.querySelector('.view.is-active[data-view]');const value=el?.dataset.view||document.documentElement.dataset.view||'home';return screenIds.has(value)?value:'home'};
 function emit(event,properties={}){if(!enabled)return;queue.push({event,distinct_id:app+':'+distinct,session_id:session,screen:current||screen(),...properties});if(queue.length>100)queue.shift();if(queue.length>=10)flush()}
 async function flush(){if(!enabled||busy||!queue.length||navigator.onLine===false)return;busy=true;const batch=queue.splice(0,25);try{const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({app,events:batch}),keepalive:true});if(!r.ok)throw Error('send')}catch{queue.unshift(...batch);queue=queue.slice(-100)}finally{busy=false}}
 function tick(){const now=Date.now(),dt=Math.max(0,Math.min(15000,now-lastTick));lastTick=now;if(enabled&&!document.hidden&&now-lastActivity<60000)active+=dt/1000}
 function time(){tick();if(active>=1){emit('active_time',{seconds:Math.round(active*10)/10});active=0}}
 function navigate(){const next=screen();if(next===current)return;time();current=next;emit('page_view')}
 function start(){if(started||!enabled)return;started=true;current=screen();emit('app_session_started');if(fresh){emit('new_browser');fresh=false}emit('page_view');flush()}
 for(const type of ['pointerdown','keydown','scroll','touchstart'])addEventListener(type,()=>{if(Date.now()-lastActivity>1800000){time();session=uuid();emit('app_session_started')}lastActivity=Date.now()},{passive:true});
 document.addEventListener('click',event=>{const el=event.target.closest('button,[data-open],[data-tab]');if(!el)return;const value=el.dataset.open||el.dataset.tab||el.id;if(screenIds.has(value)||buttonIds.has(value))emit('feature_used',{feature:value});queueMicrotask(navigate)});
 document.addEventListener('submit',event=>{if(buttonIds.has(event.target.id))emit('feature_used',{feature:event.target.id})});
 new MutationObserver(navigate).observe(document.querySelector('main'),{subtree:true,attributes:true,attributeFilter:['class','hidden']});
 new MutationObserver(navigate).observe(document.documentElement,{attributes:true,attributeFilter:['data-view']});
 addEventListener('hashchange',navigate);addEventListener('online',flush);
 document.addEventListener('visibilitychange',()=>{time();flush();lastTick=Date.now();if(!document.hidden)lastActivity=Date.now()});
 addEventListener('pagehide',()=>{time();flush()});
 checkbox.addEventListener('change',()=>{enabled=checkbox.checked;storage.set('disabled',String(!enabled));if(!enabled){queue=[];active=0}else{lastActivity=lastTick=Date.now();started=false;start()}});
 setInterval(()=>{tick();if(active>=15){emit('active_time',{seconds:Math.round(active*10)/10});active=0}flush()},15000);
 window.AppUsage={capture(event,feature){if(event==='action_completed'&&(buttonIds.has(feature)||['record_saved','entry_saved','exit_saved','area_report_saved','report_saved','care','notes','priority'].includes(feature)))emit(event,{feature})}};
 start();
})();
