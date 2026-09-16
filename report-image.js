(function attachBiometrReport(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BiometrReport = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createBiometrReport() {
  "use strict";

  const COLORS = Object.freeze({
    efectiva:"#2f8b35", retardo:"#e0aa00", "pase-salida":"#e56f18", "salida-anticipada":"#e56f18",
    "omision-entrada":"#2f80d0", "omision-salida":"#7a4fc2", justificada:"#5668c9", incapacidad:"#b14aa0",
    permiso:"#5668c9", convenio:"#009fa3", vacaciones:"#8a5b35", falta:"#d62828", pendiente:"#75827e",
    festivo:"#2b8f83", "fuera-horario":"#555f5c", green:"#08745a", dark:"#063d34", ink:"#17201e",
    muted:"#60706c", line:"#bdc9c5"
  });

  const LEGEND = Object.freeze([
    ["efectiva","En tolerancia","Entrada y salida dentro del horario"],
    ["retardo","Pase de entrada","Entrada posterior a la tolerancia"],
    ["pase-salida","Pase de salida","Salida posterior a la tolerancia"],
    ["omision-entrada","Omisión de entrada","Sin entrada, pero sí con salida"],
    ["omision-salida","Omisión de salida","Con entrada, pero sin salida"],
    ["permiso","Permiso","Permiso o incidencia justificada"],
    ["incapacidad","Incapacidad","Guardia justificada por incapacidad"],
    ["convenio","Convenio","Guardia cubierta mediante convenio"],
    ["vacaciones","Vacaciones","Día correspondiente a vacaciones"],
    ["festivo","Festivo o descanso","Día festivo o descanso programado"],
    ["falta","Falta real","Sin entrada ni salida"]
  ]);

  const ILLUSTRATIONS = Object.freeze({
    logo:"assets/biometrimss-logo-transparent-v1.png",
    states:"assets/8F8128EE-95A3-40A1-9F22-F895C79C4976.png"
  });
  const STATUS_ART_CROPS = Object.freeze({
    tolerancia:[15,493,263,210], "pase-entrada":[286,493,263,210], "pase-salida":[550,493,263,210],
    "omision-entrada":[813,493,263,210], "omision-salida":[15,750,263,210], permiso:[286,750,263,210],
    incapacidad:[550,750,263,210], convenio:[813,750,263,210], vacaciones:[15,1021,263,210],
    festivo:[286,1021,263,210], falta:[550,1021,263,210]
  });
  const REPORT_SIZE = Object.freeze({ width:1080, height:1920, aspectRatio:"9:16" });

  function dateLabel(value, logic, includeDay=false) {
    const date=logic.parseDateKey(value); if(!date) return value||"—";
    if(!includeDay) return new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"}).format(date);
    const d=new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"short"}).format(date).replace(".","");
    const w=new Intl.DateTimeFormat("es-MX",{weekday:"short"}).format(date).replace(".","");
    return `${d} (${w.charAt(0).toUpperCase()}${w.slice(1)})`;
  }
  function timeLabel(value){ if(!value)return"—"; const d=new Date(value); return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("es-MX",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(d); }
  function exitDateLabel(record,logic){ if(record.exitAt){const d=new Date(record.exitAt);if(!Number.isNaN(d.getTime()))return dateLabel(logic.formatDateKey(d),logic,true);} return dateLabel(logic.formatDateKey(logic.addDays(record.shiftDate,1)),logic,true); }
  function visualStatus(status){ return status==="justificada"?"permiso":status; }
  function statusArtKey(status){
    status=visualStatus(status);
    if(status==="efectiva")return"tolerancia";
    if(["retardo","fuera-horario"].includes(status))return"pase-entrada";
    if(["pase-salida","salida-anticipada"].includes(status))return"pase-salida";
    if(status==="pendiente")return"festivo";
    return STATUS_ART_CROPS[status]?status:"tolerancia";
  }
  function broadStatus(status,hasExit){ status=visualStatus(status); if(["efectiva","retardo","omision-entrada"].includes(status)&&hasExit)return"EN TOLERANCIA"; const m={falta:"FALTA REAL","omision-salida":"SIN SALIDA","pase-salida":"FUERA DE TOLERANCIA","salida-anticipada":"SALIDA ANTICIPADA","fuera-horario":"FUERA DE HORARIO",permiso:"PERMISO"}; return m[status]||status.toUpperCase(); }

  function buildReportModel(records,settings,start,end,logic,nowValue){
    const config=logic.normalizeSettings(settings);
    const rows=logic.scheduledEvaluations(records,start,end,config,nowValue).map(({record,evaluation})=>{
      const raw=evaluation.status, status=visualStatus(raw), notes=String(record.notes||"").trim();
      let label=raw==="justificada"?"Permiso":evaluation.label;
      return {date:dateLabel(record.shiftDate,logic,true),entry:timeLabel(record.entryAt),exitDate:exitDateLabel(record,logic),exit:timeLabel(record.exitAt),status,rawStatus:raw,statusLabel:broadStatus(raw,Boolean(record.exitAt)),typeLabel:notes?`${label.toUpperCase()} · ${notes}`:label.toUpperCase()};
    });
    const metricRows=rows.map(r=>({...r,status:r.rawStatus||r.status}));
    const metrics=logic.summarizeReportEvaluations(metricRows);
    const summary={...metrics.summary}; summary.permiso=(summary.permiso||0)+(summary.justificada||0); delete summary.justificada;
    return {profile:{name:config.name||"Sin nombre registrado",employeeId:config.employeeId||"Sin matrícula",unit:config.unit||"Sin unidad registrada"},schedule:config,period:`${dateLabel(start,logic)} al ${dateLabel(end,logic)}`,start,end,rows,summary,incidentCount:metrics.incidentCount,attendanceEligible:metrics.attendanceEligible,attendanceRate:metrics.attendanceRate};
  }

  function roundedRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function text(ctx,v,x,y,o={}){ctx.fillStyle=o.color||COLORS.ink;ctx.font=`${o.weight||500} ${o.size||24}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;ctx.textAlign=o.align||"left";ctx.textBaseline=o.baseline||"alphabetic";ctx.fillText(String(v),x,y,o.maxWidth);}
  function line(ctx,x1,y1,x2,y2,c=COLORS.line,w=2){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function tint(hex,a){const v=hex.replace("#","");return`rgba(${parseInt(v.slice(0,2),16)},${parseInt(v.slice(2,4),16)},${parseInt(v.slice(4,6),16)},${a})`;}
  function drawContain(ctx,img,x,y,w,h){if(!img)return;const s=Math.min(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
  function loadIllustrations(){return Promise.all(Object.entries(ILLUSTRATIONS).map(([k,src])=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve([k,i]);i.onerror=()=>resolve([k,null]);i.src=src;}))).then(Object.fromEntries);}
  function drawStatusArt(ctx,img,status,x,y,w,h){
    if(!img){drawAvatar(ctx,status,x,y,w,h);return;}
    const crop=STATUS_ART_CROPS[statusArtKey(status)];
    ctx.save();roundedRect(ctx,x,y,w,h,Math.min(14,w*.2));ctx.clip();
    ctx.drawImage(img,crop[0],crop[1],crop[2],crop[3],x,y,w,h);
    ctx.restore();
  }

  function loadStatusSheet(){
    return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("No se pudo cargar la lámina de avatares."));img.src=ILLUSTRATIONS.states;});
  }

  async function renderStatusAvatarBlob(status,size=96){
    if(typeof document==="undefined")throw new Error("Se necesita un navegador para dibujar el avatar.");
    const canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;
    drawStatusArt(canvas.getContext("2d"),await loadStatusSheet(),status,0,0,size,size);
    return canvasToBlob(canvas);
  }

  function drawSymbol(ctx,status,x,y,r=16){status=visualStatus(status);const c=COLORS[status]||COLORS.muted;ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=Math.max(2,r*.22);ctx.lineCap="round";ctx.beginPath();if(status==="efectiva"){ctx.moveTo(x-r*.45,y);ctx.lineTo(x-r*.08,y+r*.38);ctx.lineTo(x+r*.55,y-r*.45);}else if(status==="falta"){ctx.moveTo(x-r*.4,y-r*.4);ctx.lineTo(x+r*.4,y+r*.4);ctx.moveTo(x+r*.4,y-r*.4);ctx.lineTo(x-r*.4,y+r*.4);}else if(["omision-entrada","omision-salida"].includes(status)){text(ctx,"?",x,y+r*.1,{size:r*1.35,weight:900,color:"#fff",align:"center",baseline:"middle"});return;}else{ctx.moveTo(x-r*.42,y);ctx.lineTo(x+r*.42,y);}ctx.stroke();}

  function drawAvatar(ctx,status,x,y,w,h){
    status=visualStatus(status); const c=COLORS[status]||COLORS.green; ctx.save();
    const cx=x+w*.48, headY=y+h*.39, headR=Math.min(w,h)*.19;
    ctx.fillStyle=tint(c,.13);roundedRect(ctx,x,y,w,h,16);ctx.fill();
    ctx.fillStyle=status==="falta"?"#e7e7e7":"#ffffff";roundedRect(ctx,cx-headR*1.18,headY+headR*.72,headR*2.36,h*.43,headR*.45);ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle="#d99a72";ctx.fillRect(cx-headR*.24,headY+headR*.55,headR*.48,headR*.38);
    ctx.fillStyle=status==="incapacidad"?"#d6b19a":"#e3ad86";ctx.beginPath();ctx.arc(cx,headY,headR,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#24211f";ctx.beginPath();ctx.arc(cx,headY-headR*.28,headR*.92,Math.PI,Math.PI*2);ctx.fill();
    ctx.fillStyle="#352b27";ctx.beginPath();ctx.arc(cx,headY+headR*.28,headR*.72,0,Math.PI);ctx.fill();
    ctx.strokeStyle="#171717";ctx.lineWidth=3;ctx.strokeRect(cx-headR*.72,headY-headR*.12,headR*.58,headR*.35);ctx.strokeRect(cx+headR*.14,headY-headR*.12,headR*.58,headR*.35);line(ctx,cx-headR*.14,headY+headR*.03,cx+headR*.14,headY+headR*.03,"#171717",3);
    ctx.fillStyle="#30231d";ctx.beginPath();ctx.arc(cx-headR*.42,headY+headR*.02,2.8,0,Math.PI*2);ctx.arc(cx+headR*.42,headY+headR*.02,2.8,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#6d3428";ctx.lineWidth=2.5;ctx.beginPath();if(status==="falta"||status==="incapacidad"){ctx.arc(cx,headY+headR*.58,headR*.22,Math.PI,Math.PI*2);}else{ctx.arc(cx,headY+headR*.38,headR*.25,0,Math.PI);}ctx.stroke();
    ctx.fillStyle=COLORS.green;ctx.beginPath();ctx.arc(cx,headY+headR*1.35,headR*.17,0,Math.PI*2);ctx.fill();text(ctx,"B",cx,headY+headR*1.38,{size:headR*.19,weight:900,color:"#fff",align:"center",baseline:"middle"});
    if(["omision-entrada","omision-salida"].includes(status)){text(ctx,"?",x+w*.14,y+h*.25,{size:Math.min(w,h)*.23,weight:900,color:c,align:"center"});text(ctx,"?",x+w*.84,y+h*.18,{size:Math.min(w,h)*.16,weight:900,color:c,align:"center"});}
    if(status==="falta")text(ctx,"!",x+w*.82,y+h*.24,{size:Math.min(w,h)*.22,weight:900,color:c,align:"center"});
    if(status==="incapacidad"){line(ctx,x+w*.75,y+h*.62,x+w*.75,y+h*.84,c,5);line(ctx,x+w*.66,y+h*.73,x+w*.84,y+h*.73,c,5);}
    if(status==="permiso"){ctx.fillStyle=c;roundedRect(ctx,x+w*.68,y+h*.62,w*.2,h*.2,5);ctx.fill();text(ctx,"P",x+w*.78,y+h*.73,{size:h*.1,weight:900,color:"#fff",align:"center",baseline:"middle"});}
    if(status==="convenio")text(ctx,"✓",x+w*.79,y+h*.75,{size:Math.min(w,h)*.18,weight:900,color:c,align:"center"});
    if(status==="festivo")text(ctx,"★",x+w*.8,y+h*.24,{size:Math.min(w,h)*.16,weight:900,color:c,align:"center"});
    if(status==="efectiva")text(ctx,"✓",x+w*.8,y+h*.24,{size:Math.min(w,h)*.17,weight:900,color:c,align:"center"});
    ctx.restore();
  }

  function monthTheme(start){
    const m=Number(String(start||"").slice(5,7));
    if(m===9)return{label:"VIVA MÉXICO · VIVA BIOMETRIMSS",colors:["#08745a","#ffffff","#b5222b"],icon:"★"};
    if(m===10)return{label:"OCTUBRE · HALLOWEEN BIOMETRIMSS",colors:["#e87518","#2b1838","#111111"],icon:"☾"};
    if(m===11)return{label:"NOVIEMBRE · DÍA DE MUERTOS",colors:["#7a2a78","#ff8b00","#3d153f"],icon:"✿"};
    if(m===12)return{label:"DICIEMBRE · BIOMETRIMSS",colors:["#08745a","#b5222b","#d6ad3b"],icon:"★"};
    if(m===1)return{label:"AÑO NUEVO · BIOMETRIMSS",colors:["#08745a","#d6ad3b","#f5f5f5"],icon:"✦"};
    return{label:"BIOMETRIMSS · TU CONTROL, TU TIEMPO",colors:[COLORS.green,"#dcebe6",COLORS.dark],icon:"●"};
  }
  function drawThemeRibbon(ctx,theme,x,y,w){ctx.save();ctx.fillStyle="#f7faf9";roundedRect(ctx,x,y,w,38,10);ctx.fill();const sw=w*.18;theme.colors.forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(x+i*sw,y,sw,5);});text(ctx,`${theme.icon}  ${theme.label}`,x+w/2,y+24,{size:15,weight:900,color:COLORS.dark,align:"center"});ctx.restore();}

  function drawPortraitHeader(ctx,model,images,width,margin){
    const theme=monthTheme(model.start); const logoW=108;
    if(images.logo) drawContain(ctx,images.logo,margin,20,logoW,125); else {ctx.fillStyle=COLORS.green;roundedRect(ctx,margin,28,82,82,15);ctx.fill();text(ctx,"IMSS",margin+41,78,{size:19,weight:900,color:"#fff",align:"center"});}
    text(ctx,"REPORTE DE GUARDIAS · BIOMÉTRICO",width/2,48,{size:27,weight:900,align:"center"});
    text(ctx,model.profile.name.toUpperCase(),width/2,86,{size:29,weight:900,color:COLORS.green,align:"center",maxWidth:720});
    text(ctx,`Matrícula: ${model.profile.employeeId}`,width/2,116,{size:18,weight:750,color:COLORS.muted,align:"center"});
    text(ctx,model.profile.unit,width/2,142,{size:16,weight:650,color:COLORS.muted,align:"center",maxWidth:720});
    drawStatusArt(ctx,images.states,"efectiva",width-margin-118,18,118,135);
    drawThemeRibbon(ctx,theme,margin,154,width-margin*2);
    const y=202,cardW=width-margin*2;ctx.fillStyle="#f5faf8";roundedRect(ctx,margin,y,cardW,100,14);ctx.fill();line(ctx,width/2,y+12,width/2,y+88,"#d7e3df",2);
    text(ctx,"PERIODO",margin+24,y+28,{size:15,weight:900,color:COLORS.green});text(ctx,model.period,margin+24,y+58,{size:20,weight:850});text(ctx,"TURNO 3 · NOCTURNO",margin+24,y+84,{size:15,weight:850,color:COLORS.green});text(ctx,`${model.schedule.startTime} a ${model.schedule.exitTime}`,margin+245,y+84,{size:16,weight:800});
    text(ctx,`ENTRADA ${model.schedule.startTime}`,width/2+24,y+31,{size:16,weight:850,color:COLORS.green});text(ctx,`Límite ${model.schedule.entryTolerance}`,width-margin-24,y+31,{size:16,weight:750,align:"right"});text(ctx,`SALIDA ${model.schedule.exitTime}`,width/2+24,y+70,{size:16,weight:850,color:COLORS.green});text(ctx,`Límite ${model.schedule.exitTolerance}`,width-margin-24,y+70,{size:16,weight:750,align:"right"});
  }

  function drawPortraitTable(ctx,model,x,y,width,rowHeight){
    const columns=[0,145,275,425,555,755,width],headers=["GUARDIA","ENTRADA","SALIDA","HORA","ESTATUS","TIPO"],hh=58;ctx.fillStyle=COLORS.dark;ctx.fillRect(x,y,width,hh);headers.forEach((h,i)=>text(ctx,h,x+(columns[i]+columns[i+1])/2,y+hh/2,{size:14,weight:900,color:"#fff",align:"center",baseline:"middle"}));
    const rows=model.rows.length?model.rows:[{date:"—",entry:"—",exitDate:"—",exit:"—",status:"pendiente",statusLabel:"SIN REGISTROS",typeLabel:"SIN REGISTROS"}],regular=Math.max(12,Math.min(17,rowHeight*.31)),ss=Math.max(10,Math.min(13,rowHeight*.24));
    rows.forEach((r,i)=>{const top=y+hh+i*rowHeight,c=COLORS[r.status]||COLORS.muted,avatarSize=Math.max(16,Math.min(30,rowHeight-4));ctx.fillStyle=i%2?"#fafcfb":"#fff";ctx.fillRect(x,top,width,rowHeight);ctx.fillStyle=tint(c,.1);ctx.fillRect(x+columns[4],top,width-columns[4],rowHeight);[r.date,r.entry,r.exitDate,r.exit].forEach((v,col)=>text(ctx,v,x+(columns[col]+columns[col+1])/2,top+rowHeight/2,{size:regular,weight:750,color:v==="—"?"#ba2323":COLORS.ink,align:"center",baseline:"middle"}));drawStatusArt(ctx,images.states,r.status,x+columns[4]+5,top+(rowHeight-avatarSize)/2,avatarSize,avatarSize);text(ctx,r.statusLabel,x+columns[4]+40,top+rowHeight/2,{size:ss,weight:900,color:c,baseline:"middle",maxWidth:columns[5]-columns[4]-44});drawSymbol(ctx,r.status,x+columns[5]+18,top+rowHeight/2,Math.max(8,Math.min(11,rowHeight*.2)));text(ctx,r.typeLabel,x+columns[5]+36,top+rowHeight/2,{size:ss,weight:900,color:c,baseline:"middle",maxWidth:columns[6]-columns[5]-42});line(ctx,x,top+rowHeight,x+width,top+rowHeight);});columns.forEach(o=>line(ctx,x+o,y,x+o,y+hh+rows.length*rowHeight));ctx.strokeStyle=COLORS.dark;ctx.lineWidth=3;ctx.strokeRect(x,y,width,hh+rows.length*rowHeight);return y+hh+rows.length*rowHeight;
  }

  function drawPortraitLegend(ctx,model,images,x,y,width,height){
    const gap=10,cols=3,rows=Math.ceil(LEGEND.length/cols),cw=(width-gap*(cols-1))/cols,ch=Math.max(58,(height-gap*(rows-1))/rows);
    LEGEND.forEach(([status,label,detail],i)=>{const col=i%cols,row=Math.floor(i/cols),left=x+col*(cw+gap),top=y+row*(ch+gap),c=COLORS[status];ctx.fillStyle=tint(c,.1);roundedRect(ctx,left,top,cw,ch,12);ctx.fill();ctx.strokeStyle=tint(c,.35);ctx.lineWidth=2;ctx.stroke();drawStatusArt(ctx,images.states,status,left+5,top+5,72,ch-10);const copyX=left+84;text(ctx,label.toUpperCase(),copyX,top+ch/2-10,{size:13,weight:900,color:c,maxWidth:cw-122});text(ctx,detail,copyX,top+ch/2+13,{size:10.5,weight:650,color:COLORS.ink,maxWidth:cw-94});ctx.fillStyle=c;ctx.beginPath();ctx.arc(left+cw-20,top+21,14,0,Math.PI*2);ctx.fill();text(ctx,model.summary[status]||0,left+cw-20,top+21,{size:13,weight:900,color:"#fff",align:"center",baseline:"middle"});});
  }
  function drawPortraitSummary(ctx,model,x,y,width){const cards=[["TOTAL GUARDIAS",model.rows.length],["EFECTIVAS",model.summary.efectiva||0],["INCIDENCIAS",model.incidentCount],["ASISTENCIA REAL",`${model.attendanceRate}%`]],cw=width/cards.length;ctx.fillStyle=COLORS.dark;roundedRect(ctx,x,y,width,92,12);ctx.fill();cards.forEach(([l,v],i)=>{const c=x+cw*i+cw/2;if(i)line(ctx,x+cw*i,y+15,x+cw*i,y+77,"rgba(255,255,255,.25)",2);text(ctx,l,c,y+30,{size:13,weight:850,color:"#d8ede7",align:"center"});text(ctx,v,c,y+68,{size:29,weight:900,color:"#fff",align:"center"});});}

  async function renderReport(records,settings,start,end,logic){
    if(typeof document==="undefined")throw new Error("Se necesita un navegador para dibujar el informe.");
    const [model,images]=[buildReportModel(records,settings,start,end,logic),await loadIllustrations()];const {width,height}=REPORT_SIZE,margin=36,contentY=318,tableW=width-margin*2,rowCount=Math.max(model.rows.length,1),rowH=Math.max(22,Math.min(64,Math.floor(790/rowCount)));const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);drawPortraitHeader(ctx,model,images,width,margin);const tableBottom=drawPortraitTable(ctx,model,margin,contentY,tableW,rowH);const legendY=tableBottom+16,reserved=218,legendH=Math.max(300,Math.min(500,height-legendY-reserved));drawPortraitLegend(ctx,model,images,margin,legendY,tableW,legendH);const summaryY=legendY+legendH+14;drawPortraitSummary(ctx,model,margin,summaryY,tableW);const noteY=summaryY+106;ctx.fillStyle="#f5faf8";roundedRect(ctx,margin,noteY,tableW,54,10);ctx.fill();text(ctx,"NOTA:",margin+18,noteY+28,{size:14,weight:900,color:COLORS.green,baseline:"middle"});text(ctx,`Guardia completa: entrada hasta ${model.schedule.entryTolerance} y salida al día siguiente hasta ${model.schedule.exitTolerance}.`,margin+72,noteY+28,{size:14,weight:700,baseline:"middle",maxWidth:tableW-90});text(ctx,"Documento personal de consulta · Generado por BIOMETRIMSS · Formato 9:16",width-margin,height-22,{size:13,color:COLORS.muted,align:"right"});return canvas;
  }
  function canvasToBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("No se pudo crear la imagen.")),"image/png",1));}
  return {COLORS,LEGEND,REPORT_SIZE,STATUS_ART_CROPS,statusArtKey,renderStatusAvatarBlob,buildReportModel,canvasToBlob,renderReport};
}));
