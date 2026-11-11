// Yamaha MODX+ Data List pp.194–195. System data is separate from Performances.
export const systemAreas=[{id:'liveSet',label:'Live Set · banco aberto no teclado',count:16},{id:'system',label:'Utility · teclado e MIDI'},{id:'seqsystem',label:'Utility · metrónomo e sincronização'},{id:'tuning',label:'Utility · microafinação User',count:8},{id:'curve',label:'Utility · curvas User',count:32}];
export function systemFields(blocks,area){
 const mid=area==='system'?0:area==='seqsystem'?5:null;if(mid===null)return [];
 const block=blocks.get(`0:${mid}:0`);if(!block)return [];
 const defs=mid===0?[
 ['Volume MIDI geral',0,0,127],['Transposição do gerador',1,40,88,64],['Afinação · décimos de cent',2,0,2047,1024,4,{encoding:'nibbles'}],['Controller reset: Hold / Reset',6,0,1],['Transposição do teclado',7,53,75,64],['Oitava do teclado',8,61,67,64],['Local Control',9,0,1],['Som do touch',12,0,1],['Ganho L/R: -6 / 0 / +6 / +12 dB',13,0,3],['Ganho USB Main: -6 / 0 / +6 / +12 dB',15,0,3],['Ganho USB individual: -6 / 0 / +6 / +12 dB',16,0,3],['Velocity curve: Normal / Soft / Hard / Wide / Fixed',17,0,4],['Velocity fixa',18,1,127],['Bank Select RX/TX',20,0,1],['Program Change RX/TX',21,0,1],['Foot Switch função · índice',22,0,102],['Super Knob CC · 0 Off',23,0,95],['MIDI IN/OUT: DIN / USB · alterar no Yamaha',24,0,1,0,1,{readOnly:true}],['Scene CC · 0 Off',25,0,95],['Audition lock',29,0,1],['Ao ligar: Performance / Live Set',30,0,1],['Bulk intervalo · unidades de50 ms',31,0,18],['Live Set banco inicial · índice',32,0,16],['Live Set página inicial',33,0,15,-1],['Live Set slot inicial',34,0,15,-1],['Entrada A/D: Mic / Line',36,0,1],['LED Half Glow: Off / 1/4 / 1/2',38,0,2],['Direct Monitor',39,0,1],['Arpejo MIDI Out',40,0,1],['MIDI Thru',41,0,1],['MIDI I/O: Multi / Single / Hybrid',48,0,2],['MIDI I/O canal',49,0,15,-1],['Pedal sustain: FC3A Half / FC3A / FC4A–FC5',59,0,2],
 ]:[['Saída do metrónomo',1,0,73,0,1,{allowed:[0,9,10,11,12,66,67,68,69,70,71,72,73],choices:[[0,'Main L&R'],...Array.from({length:4},(_,i)=>[9+i,`USB ${i*2+1}&${i*2+2}`]),...Array.from({length:8},(_,i)=>[66+i,`USB ${i+1}`])]}],['Metrónomo: Off / Rec / Rec+Play / Always',0,0,3],['Volume do metrónomo',2,0,127],['Tipo do metrónomo',3,0,9,-1],['Beat: 16th / 8th / 4th / 2nd / Whole',4,0,4],['Count-in · compassos, 0 Off',5,0,8],['Transmitir sequencer control',7,0,1],['Receber sequencer control',8,0,1],['Song Event Chase: Off / PC / PC+PB+Ctrl',9,0,2],['MIDI sync: Internal / MIDI / A/D',11,0,2],['MIDI clock out',12,0,1]];
 const names=mid===0?{6:['Hold','Reset'],13:['-6 dB','0 dB','+6 dB','+12 dB'],15:['-6 dB','0 dB','+6 dB','+12 dB'],16:['-6 dB','0 dB','+6 dB','+12 dB'],17:['Normal','Soft','Hard','Wide','Fixed'],22:['Off',...Array.from({length:95},(_,i)=>`CC ${i+1}`),'Arpejo On/Off','Motion Seq On/Off','Play/Stop','Live Set +','Live Set −','Octave reset','Tap Tempo'],24:['MIDI DIN','USB'],30:['Performance','Live Set'],36:['Mic','Line'],38:['Off','1/4','1/2'],48:['Multi','Single','Hybrid'],59:['FC3A · Half On','FC3A · Half Off','FC4A / FC5']}:{0:['Off','Rec','Rec/Play','Always'],4:['16th','8th','4th','2nd','Whole'],9:['Off','Program Change','PC + Pitch Bend + Control'],11:['Internal','MIDI','A/D In']};
 return defs.map(([label,offset,min,max,bias=0,width=1,extra={}])=>({label,address:[0,mid,offset],min:min-bias,max:max-bias,bias,width,...(min===0&&max===1?{choices:[[0,'Off'],[1,'On']]}:{}),...extra,...(names[offset]?{choices:names[offset].map((label,i)=>[i,label])}:{}),value:(extra.encoding==='nibbles'?(block[offset+1]<<8)+(block[offset+2]<<4)+block[offset+3]:width===2?block[offset]*128+block[offset+1]:block[offset])-bias}));
}

export function systemTargets(area,unit=0,slot=0){
 if(area==='liveSet')return Number.isInteger(unit)&&unit>=0&&unit<16&&Number.isInteger(slot)&&slot>=0&&slot<16?[[2,0,0],[3,unit,0],[unit<8?4:5,(unit%8)*16+slot,0]]:[];
 if(area==='system')return [[0,0,0]];if(area==='seqsystem')return [[0,5,0]];
 if(!Number.isInteger(unit)||unit<0)return [];
 if(area==='tuning'&&unit<8)return [[0,48+unit,0],[0,80+unit,0]];
 if(area==='curve'&&unit<32)return [[1,unit,0]];return [];
}
export function userSystemFields(blocks,area,unit=0,slot=0){
 const targets=systemTargets(area,unit,slot);if(!targets.length)return [];
 const text=bytes=>new TextDecoder().decode(bytes).replace(/\0.*$/s,'').trimEnd();
 if(area==='liveSet'){
  if(!targets.every(a=>blocks.has(a.join(':'))))return [];
  const names=targets.map((a,i)=>({label:['Nome do banco Live Set · sem acentos','Nome da página · sem acentos','Nome da posição · sem acentos'][i],address:a,text:20,value:text(blocks.get(a.join(':')).slice(0,20))})),base=targets[2].slice(0,2),data=blocks.get(targets[2].join(':'));
  const defs=[['Cor',20,0,15,0,{choices:['Black','Red','Yellow','Green','Blue','Azure','Pink','Orange','Purple','Sakura','Cream','Lime','Aqua','Beige','Mint','Lilac'].map((name,i)=>[i,name])}],['Performance banco MSB',21,0,127],['Performance banco LSB',22,0,127],['Performance número',23,0,127,-1],['Volume da posição',24,0,127],['Posição ativa',25,0,1,0,{choices:[[0,'Desligada'],[1,'Ligada']]}]];
  return [...names,...defs.map(([label,offset,min,max,bias=0,extra={}])=>({label,address:[...base,offset],min:min-bias,max:max-bias,bias,width:1,...extra,value:data[offset]-bias}))];
 }
 if(area==='tuning'){
  const data=blocks.get(`0:${48+unit}:0`),name=blocks.get(`0:${80+unit}:0`);
  if(!data||!name)return [];
  return [{label:'Nome da microafinação · sem acentos',address:[0,80+unit,0],text:20,value:text(name)},...['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map((n,i)=>({label:`${n} · cents`,address:[0,48+unit,i*2],min:-99,max:99,bias:128,width:2,value:data[i*2]*128+data[i*2+1]-128}))];
 }
 if(area==='curve'){
  const data=blocks.get(`1:${unit}:0`);if(!data)return [];
  return [{label:'Nome da curva · sem acentos',address:[1,unit,0],text:20,value:text(data.slice(0,20))},{label:'Modo: Linear / Step',choices:[[0,'Linear'],[1,'Step']],address:[1,unit,36],min:0,max:1,bias:0,width:1,value:data[36]},...Array.from({length:7},(_,i)=>({label:`Ponto ${i+2} entrada`,address:[1,unit,21+i],min:i+1,max:121+i,bias:0,width:1,value:data[21+i],readOnly:i===6&&data[36]===0,curveInput:true})),...Array.from({length:8},(_,i)=>({label:`Ponto ${i+1} saída`,address:[1,unit,28+i],min:0,max:127,bias:0,width:1,value:data[28+i]}))];
 }
 return systemFields(blocks,area);
}
