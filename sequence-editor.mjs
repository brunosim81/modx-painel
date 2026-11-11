import {curveTypeChoices} from './curve-editor.mjs';
const curveBanks=['Preset','User',...Array.from({length:8},(_,i)=>`Library ${i+1}`)].map((name,i)=>[i,name]);
const multiply=['50%','66%','75%','100%','133%','150%','200%','266%','300%','400%','Common'].map((name,i)=>[i,name]);
// Yamaha MODX+ Data List pp.201–203,210–213. Existing edit buffers only.
export function sequenceAreas(partIndex){return partIndex===null?[{id:'scene',label:'Cenas · comum'},{id:'msseq',label:'Motion Seq · sequências A/D'},{id:'skseq',label:'Super Knob · sequências'}]:[{id:'receive',label:'MIDI · filtros de receção'},{id:'partarp',label:'Arpejos · Part'},{id:'scene',label:'Cenas · Part'},{id:'zone',label:'Zona MIDI'},{id:'msseq',label:'Motion Seq · sequências da Part'}];}
function fields(current,base,defs){
 const block=current.blocks.get(`${base.join(':')}:0`);if(!block)return [];
 return defs.map(([label,offset,min,max,bias=0,width=1,extra={}])=>({label,address:[...base,offset],min:min-bias,max:max-bias,bias,width,...(min===0&&max===1?{choices:[[0,'Off'],[1,'On']]}:{}),...extra,value:extra.bit!==undefined?(block[offset]>>extra.bit)&1:(width===2?block[offset]*128+block[offset+1]:block[offset])-bias}));
}
const bit=(label,offset,bit)=>[label,offset,0,1,0,1,{bit}];
export function sequenceFields(current,partIndex,area,{unit=0,lane=0,seq=0}={}){
 const part=partIndex!==null?current.parts.find(p=>p.index===partIndex):null;
 if(partIndex!==null&&!part)return [];
 if(![unit,lane,seq].every(Number.isInteger)||unit<0||unit>7||lane<0||lane>3||seq<0||seq>7)return [];
 if(area==='receive'&&part){
  const defs=[...['Control Change','Bank Select','Program Change','After Touch','Pitch Bend'].map((n,i)=>bit(`Receber ${n}`,64,i+2)),...Array.from({length:7},(_,i)=>bit(`Receber Assign ${i+2}`,65,i)),...['Volume / Expression','Panorama','Sustain / Sostenuto','Mod Wheel','Foot Controller 1','Foot Controller 2','Assign 1'].map((n,i)=>bit(`Receber ${n}`,66,i)),...['Foot Switch','Breath','Ribbon'].map((n,i)=>bit(`Receber ${n}`,67,i+4)),...['Assign Switch 1','Assign Switch 2','Motion Hold','Motion Trigger'].map((n,i)=>bit(`Receber ${n}`,68,i+3))];
  return fields(current,[49,partIndex],defs).map(f=>({...f,choices:[[0,'Desligado'],[1,'Ligado']]}));
 }
 if(area==='partarp'&&part){
  const defs=[['Arpejo ligado',0,0,1],['Tocar só arpejo',3,0,1],...(part.engine==='DRUM'?[['Fixed SD/BD',4,0,1]]:[]),['Loop',6,0,1],['Hold',7,0,2,0,1,{choices:[[0,'Sync-Off'],[1,'Off'],[2,'On']]}],['Unit multiply',8,0,10,0,1,{choices:multiply}],['Nota mínima',9,0,127],['Nota máxima',10,0,127],['Velocidade mínima',11,1,127],['Velocidade máxima',12,1,127],['Key mode',13,0,4,0,1,{choices:['Sort','Thru','Direct','Sort + Direct','Thru + Direct'].map((name,i)=>[i,name])}],['Velocity mode',14,0,1,0,1,{choices:[[0,'Original'],[1,'Thru']]}],['Mudança do arpejo',15,0,1,0,1,{choices:[[0,'Real-time'],[1,'Measure']]}],['Quantize grid',16,1,7,0,1,{choices:[60,80,120,160,240,320,480].map((ticks,i)=>[i+1,`${ticks} ticks`])}],['Quantize strength %',17,0,100],['Velocity rate %',18,0,200,0,2],['Gate rate %',20,0,200,0,2],['Accent velocity threshold',28,0,127],['Accent start quantize',29,0,1],['Intervalo de oitavas',30,61,67,64],['Oitava de saída',31,54,74,64],['Trigger',32,0,1,0,1,{choices:[[0,'Gate'],[1,'Toggle']]}],['Random SFX',33,0,1],['Random SFX Key On',34,0,1],['Random SFX velocity offset',35,0,127,64]];
  for(let i=0;i<8;i++)defs.push([`Arpejo ${i+1} velocity offset`,36+4*i,28,228,128,2],[`Arpejo ${i+1} gate offset`,38+4*i,28,228,128,2],[`Arpejo ${i+1} som: Preset / User / Library`,69+3*i,0,12543,0,2,{catalog:'arpeggios'}]);
  return fields(current,[49,96+partIndex],defs);
 }
 if(area==='zone'&&part){
  const defs=[['Zona ligada',0,0,1],['Canal MIDI: 0–15 = Ch1–16, 127 Off',1,0,127,0,1,{allowed:[...Array(16).keys(),127],choices:[...Array.from({length:16},(_,i)=>[i,`Ch ${i+1}`]),[127,'Off']]}],['Oitava',2,61,67,64],['Transposição',3,53,75,64],['Nota mínima',4,0,127],['Nota máxima',5,0,127],['Som interno ligado',6,0,1],['MIDI volume',7,0,127],['MIDI panorama',8,0,127,64],['MIDI bank MSB',9,0,127],['MIDI bank LSB',10,0,127],['MIDI program',11,0,127,-1],
   ...[[6,'Pitch Bend'],[4,'Program Change'],[3,'Bank Select'],[2,'Control Change']].map(([b,n])=>bit(`Transmitir ${n}`,12,b)),
   ...Array.from({length:7},(_,i)=>bit(`Transmitir Assign ${i+2}`,13,i)),
   ...['Volume / Expression','Panorama','Sustain / Sostenuto','Mod Wheel','Foot Controller 1','Foot Controller 2','Assign 1'].map((n,i)=>bit(`Transmitir ${n}`,14,i)),bit('Transmitir Foot Switch',15,4),
   ...[[6,'Motion Trigger'],[5,'Motion Hold'],[4,'Assign Switch 2'],[3,'Assign Switch 1']].map(([b,n])=>bit(`Transmitir ${n}`,16,b))];
  return fields(current,[49,80+partIndex],defs);
 }
 if(area==='scene'){
  if(part){
   const defs=[['Mute',0,0,1],['Volume',1,0,127],['Panorama',2,1,127,64],['Reverb send',3,0,127],['Variation send',4,0,127],['Dry level',5,0,127],
    ...['Cutoff offset','Ressonância offset','FEG depth offset','AEG ataque offset','AEG decay offset','AEG sustain offset','AEG release offset'].map((n,i)=>[n,6+i,0,127,64]),
    ['Swing',15,8,248,128,2],['Unit multiply',17,0,10,0,1,{choices:multiply}],['Arp gate rate %',18,0,200,0,2],['Arp velocity rate %',20,0,200,0,2],['MS amplitude offset',22,0,127,64],['MS pulse shape offset · índice',23,14,114,64],['MS smoothness offset',24,0,127,64],['MS random',25,0,127]];
   return fields(current,[54,unit*16+partIndex],defs);
  }
  const o=unit*16;
  return fields(current,[48,76],[['Arpejo selecionado',o+1,0,7,-1],['Motion Seq selecionada',o+2,0,7,-1],['Arpejo master ligado',o+3,0,1],['Motion Seq master ligada',o+4,0,1],...['Arpejo','Motion Seq','Super Knob','Mixing','AEG','Arp/MS FX'].map((n,i)=>[`Memorizar ${n}`,o+5+i,0,1]),['Super Knob valor',o+11,0,127]]);
 }
 if(!['msseq','skseq'].includes(area)||part&&area==='skseq')return [];
 const base=area==='skseq'?[48,96+seq]:part?[50+lane,seq*16+partIndex]:[48,lane*16+seq];
 const block=current.blocks.get(`${base.join(':')}:0`);if(!block)return [];
 const defs=[['Amplitude',0,0,127],['Smoothness',1,0,127],['Ciclo · passos',2,0,15,-1],['Polaridade',3,0,1,0,1,{choices:[[0,'Uni'],[1,'Bi']]}],...Array.from({length:16},(_,i)=>[`Passo ${i+1} valor`,4+i,0,127]),...Array.from({length:16},(_,i)=>[`Passo ${i+1} curva`,20+i,0,1,0,1,{choices:[[0,'A'],[1,'B']]}])];
 for(const [name,o] of [['A',36],['B',43]])defs.push([`Curva ${name} banco: 0 Preset, 1 User, 2–9 Library`,o,0,9,0,1,{curveBank:true,choices:curveBanks,readAfter:Array.from({length:6},(_,i)=>o+1+i)}],[`Curva ${name} tipo`,o+1,0,block[o]===0?17:31,0,1,{choices:curveTypeChoices(block[o]),curveTypeBank:o,readBefore:[o],readAfter:[o+2,o+3,o+4,o+5,o+6]}],[`Curva ${name} parâmetro 1`,o+2,0,127,0,1,{readBefore:[o,o+1]}],[`Curva ${name} parâmetro 2`,o+3,0,127,0,1,{readBefore:[o,o+1]}],[`Curva ${name} shape switch 1`,o+4,0,1],[`Curva ${name} shape switch 2`,o+5,0,1],[`Curva ${name} direção`,o+6,0,1,0,1,{choices:[[0,'Forward'],[1,'Reverse']]}]);
 return fields(current,base,defs);
}
