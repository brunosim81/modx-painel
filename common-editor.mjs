// Yamaha MODX+ Data List pp.199–200.
export const commonAreas=[{id:'transport',label:'Transporte MIDI · sequenciador'},{id:'commonTone',label:'Performance · envelopes, filtro e tempo'},{id:'meq',label:'Master EQ · cinco bandas'},{id:'arp',label:'Arpejo · comum'},{id:'motion',label:'Motion Seq · comum'}];
export function commonEditorFields(current,area){
 const config={
  commonTone:{mid:64,fields:[...['AEG ataque','AEG decay','AEG sustain','AEG release','FEG ataque','FEG decay'].map((name,i)=>[`${name} offset`,33+i,0,127,64]),...['FEG release','FEG profundidade','Cutoff','Ressonância'].map((name,i)=>[`${name} offset`,40+i,0,127,64]),['Tempo BPM',44,5,300,0,2],['Swing offset',91,8,248,128,2],['Unit Multiply',93,0,9,0,1,{choices:['50%','66%','75%','100%','133%','150%','200%','266%','300%','400%'].map((label,i)=>[i,label])}],['Knobs · função',28,0,4,0,1,{choices:['Tone','EG/FX','EQ','ARP/MS','Assign'].map((label,i)=>[i,label])}],['Sliders · função',29,0,1,0,1,{choices:[[0,'Part'],[1,'Element']]}]]},
  meq:{mid:69,fields:[...['Low','Low Mid','Mid','High Mid','High'].flatMap((band,i)=>{
   const o=i*4;return [[`${band} ganho dB`,o,52,76,64],[`${band} frequência · índice`,o+1,i===0?4:i===4?28:14,i===0?40:i===4?58:54],[`${band} Q · índice`,o+2,1,120],...([0,4].includes(i)?[[`${band} Shelf / Peak`,o+3,0,1]]:[])];
  }),['Master EQ ligado',20,0,1]]},
  arp:{mid:71,fields:[['Arpejo selecionado',0,0,7,-1],['Arpejo master ligado',3,0,1],['Sync quantize',4,0,7,0,1,{choices:['Off','60 ticks','80 ticks','120 ticks','160 ticks','240 ticks','320 ticks','480 ticks'].map((name,i)=>[i,name])}],['Gate time offset',7,28,228,128,2],['Velocidade offset',9,28,228,128,2]]},
  motion:{mid:72,fields:[['Motion Seq master ligada',0,0,1],['Sequência',1,0,7,-1],['Amplitude offset',2,0,127,64],['Pulse shape offset · índice',3,14,114,64],['Smoothness offset',4,0,127,64],['Random offset',5,0,127,64]]},
 }[area];
 if(!config)return [];
 const block=current.blocks.get(`48:${config.mid}:0`);if(!block)return [];
 return config.fields.filter(f=>!((area==='meq')&&[2,18].includes(f[1])&&block[f[1]+1]===0)).map(([label,offset,min,max,bias=0,width=1,extra={}])=>({label,address:[48,config.mid,offset],min:min-bias,max:max-bias,bias,width,...(min===0&&max===1?{choices:[[0,'Off'],[1,'On']]}:{}),...extra,...(area==='meq'?([3,19].includes(offset)?{choices:[[0,'Shelf'],[1,'Peak']],readAfter:[offset-1]}:[2,18].includes(offset)?{readBefore:[offset+1]}:{}):{}),value:(width===2?block[offset]*128+block[offset+1]:block[offset])-bias}));
}
