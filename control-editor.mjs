import {curveTypeChoices} from './curve-editor.mjs';
const curveBanks=['Preset','User',...Array.from({length:8},(_,i)=>`Library ${i+1}`)].map((name,i)=>[i,name]);
// Yamaha MODX+ Data List pp.200–206,208–209,215–216.
export function controlAreas(partIndex){return [{id:'assign',label:'Atribuições de controladores'},{id:'laneSettings',label:'Motion Seq · definições das lanes'},...(partIndex===null?[{id:'superSettings',label:'Super Knob · ligações'},{id:'superLane',label:'Super Knob · definições da lane'}]:[])];}
export function controlFields(current,partIndex,area,{lane=0,set=0}={}){
 if(partIndex!==null&&!current.parts.some(p=>p.index===partIndex))return [];
 if(!Number.isInteger(lane)||lane<0||lane>3||!Number.isInteger(set)||set<0||set>15)return [];
 let base,defs;
 if(area==='assign'){
  base=partIndex===null?[48,set<13?81:82]:[56,partIndex+(set<13?0:16)];
  const offset=(set<13?set:set-13)*9,block=current.blocks.get(`${base.join(':')}:0`);if(!block)return [];
  const bank=block[offset+3],source=block[offset],destination=block[offset+1]*128+block[offset+2],linked=partIndex===null&&destination>=124&&destination<=251;
  defs=[['Origem · índice Yamaha',offset,0,39,0,1,partIndex===null?{allowed:linked?[8,9,10,11,12,13,14,15]:[8,9,10,11,12,13,14,15,...Array.from({length:22},(_,i)=>i+18)],readBefore:[[offset+1,2]],readAfter:[[offset+1,2],offset+3,offset+4,offset+5,offset+6,offset+7,offset+8]}:{}],['Destino · índice Yamaha',offset+1,0,partIndex===null?251:115,0,2,partIndex===null?{...(source>=8&&source<=15?{}:{allowed:Array.from({length:124},(_,i)=>i)}),readBefore:[offset],readAfter:[offset,offset+3,offset+4,offset+5,offset+6,offset+7,offset+8]}:{}],['Curva banco: 0 Preset, 1 User, 2–9 Library',offset+3,0,9,0,1,{curveBank:true,choices:curveBanks,readOnly:linked,...(partIndex===null?{readBefore:[[offset+1,2]]}:{})}],['Curva tipo',offset+4,0,bank===0?17:31,0,1,{choices:curveTypeChoices(bank),curveTypeBank:offset+3,readBefore:[offset+3,...(partIndex===null?[[offset+1,2]]:[])],readAfter:[offset+5,offset+6],readOnly:linked}],...(bank===0?[['Curva parâmetro 1',offset+5,0,127,0,1,{presetCurveBank:offset+3,readBefore:[offset+3]}],['Curva parâmetro 2',offset+6,0,127,0,1,{presetCurveBank:offset+3,readBefore:[offset+3]}]]:[]),['Curva polaridade',offset+7,0,1,0,1,{choices:[[0,'Uni'],[1,'Bi']]}],['Curva ratio',offset+8,0,127,64,1,{readOnly:linked,...(partIndex===null?{readBefore:[[offset+1,2]]}:{})}]];
 }else if(area==='superSettings'&&partIndex===null){
  base=[48,75];defs=[['Super Knob valor',0,0,127],...Array.from({length:8},(_,i)=>[[`Assign ${i+1} valor mínimo`,1+i*2,0,127],[`Assign ${i+1} valor máximo`,2+i*2,0,127],[`Assign ${i+1} independente`,19+i,0,1]]).flat(),['LED pattern',17,0,17,0,1,{choices:['Type 1','Type 2-1','Type 2-2','Type 3-1','Type 3-2','Type 4-1','Type 4-2','Type 5-1','Type 5-2','Type 6','Type 7-1','Type 7-2','Type 8-1','Type 8-2','Type 9','Type 10','Type 11','Off'].map((name,i)=>[i,name])}],['Sync Part',18,0,15,-1,1,{choices:Array.from({length:16},(_,i)=>[i+1,`Part ${i+1}`])}],['Motion Seq random',27,0,127]];
 }else if(['laneSettings','superLane'].includes(area)){
  if(area==='superLane'&&partIndex!==null)return [];
  base=area==='superLane'?[48,74]:partIndex===null?[48,73]:[49,16+partIndex];
  const offset=area==='superLane'?0:lane*16,block=current.blocks.get(`${base.join(':')}:0`);if(!block)return [];
  const sync=block[offset+3];
  defs=[['Lane ligada',offset,0,1],['FX receive',offset+1,0,1],['Trigger receive',offset+2,0,1],['Sync',offset+3,0,area==='superLane'||lane===0?3:4,0,1,{choices:['Off','Tempo','Beat','Arp','Lane 1'].slice(0,area==='superLane'||lane===0?4:5).map((name,i)=>[i,name]),readAfter:[offset+4,offset+5,offset+6]}],...(sync===0?[['Velocidade',offset+4,0,127,0,1,{readBefore:[offset+3]}]]:[['Unit multiply',offset+5,0,partIndex===null?17:18,0,1,{readBefore:[offset+3],choices:['50%','66%','75%','100%','133%','150%','200%','266%','300%','400%','600%','800%','1200%','1600%','2400%','3200%','6400%','Common',...(partIndex===null?[]:['Arp'])].map((name,i)=>[i,name])}]]),...(sync===3?[]:[['Key On Reset',offset+6,0,2,0,1,{readBefore:[offset+3],choices:[[0,'Off'],[1,'Each-On'],[2,'1st-On']]}]]),['Loop',offset+7,0,1],['Velocidade mínima',offset+8,1,127],['Velocidade máxima',offset+9,1,127]];
 }else return [];
 const block=current.blocks.get(`${base.join(':')}:0`);if(!block)return [];
 return defs.map(([label,offset,min,max,bias=0,width=1,extra={}])=>({label,address:[...base,offset],min:min-bias,max:max-bias,bias,width,...(min===0&&max===1?{choices:[[0,'Off'],[1,'On']]}:{}),...extra,...(area==='assign'&&offset%9===0?{choiceNames:'sources'}:area==='assign'&&offset%9===1?{choiceNames:partIndex===null?'commonDestinations':'partDestinations'}:{}),value:(width===2?block[offset]*128+block[offset+1]:block[offset])-bias}));
}

export function controlChoiceField(field,engine,catalog){
 const compatibility=catalog.compatibility?.[field.choiceNames];
 if(!compatibility)return field;
 const allowed=Object.keys(compatibility).map(Number).filter(id=>id>=field.min&&id<=field.max&&compatibility[id].includes(engine)&&(!field.allowed||field.allowed.includes(id)));
 return {...field,allowed};
}
