// Yamaha MODX+ Data List pp.200,203,207–208,210; EQ indices also p.158.
export function partAudioAreas(current,partIndex){
 if(partIndex===null)return [{id:'audioAD',label:'Entrada A/D · volume e encaminhamento'},{id:'audioUSB',label:'Entrada USB · volume e encaminhamento'},{id:'audition',label:'Frase Audition'},{id:'followerAD',label:'Envelope Follower · entrada A/D'},{id:'followerMaster',label:'Envelope Follower · Master'}];
 const part=current.parts.find(p=>p.index===partIndex);
 return part?[{id:'partPitch',label:'Afinação · portamento'},{id:'partOutput',label:'Saída da Part · encaminhamento'},{id:'partEQ',label:'EQ da Part'},{id:'partOffsets',label:'Envelopes · offsets e Assign'},{id:'followerPart',label:'Envelope Follower · Part'},...(part.engine==='DRUM'?[]:[{id:'partLFO',label:'LFO da Part · User LFO'}])]:[];
}
const tuningNames=['Equal Temperament','Pure Major','Pure Minor','Werckmeister','Kirnberger','Vallotti & Young','1/4 shift','1/4 tone','1/8 tone','Indian','Arabic 1','Arabic 2','Arabic 3',...Array.from({length:8},(_,i)=>`User ${i+1}`),...Array.from({length:64},(_,i)=>`Library · índice ${21+i}`)].map((name,i)=>[i,name]);
const eqTypes=['Thru','LPF','HPF','Low Shelf','High Shelf','Peak/Dip'].map((name,i)=>[i,name]);
const eq=(start)=>Array.from({length:2},(_,i)=>{const o=start+i*5;return [[`EQ ${i+1} tipo`,o,0,5,0,1,{choices:eqTypes,readAfter:[[o+1,2],[o+3,1],[o+4,1]]}],[`EQ ${i+1} frequência · índice`,o+1,48,244,0,2],[`EQ ${i+1} ganho · índice`,o+3,40,88,64],[`EQ ${i+1} Q · índice`,o+4,1,120]];}).flat();
const follower=start=>[['Ganho',start,16,112,64,1,{choices:Array.from({length:97},(_,i)=>[i-48,`${(i-48)/2} dB`])}],['Ataque · índice Yamaha',start+1,0,19],['Release · índice Yamaha',start+2,0,15]];
const outputs=[0,9,10,11,12,66,67,68,69,70,71,72,73,125];
export function partAudioFields(current,partIndex,area){
 const part=current.parts.find(p=>p.index===partIndex);let base,defs;
 if(partIndex===null&&['followerAD','followerMaster'].includes(area)){
  base=[48,area==='followerAD'?78:70];defs=follower(area==='followerAD'?8:68);
 }else if(part&&area==='followerPart'){
  base=[49,partIndex];defs=follower(46);
 }else if(partIndex===null&&['audioAD','audioUSB'].includes(area)){
  base=[48,area==='audioAD'?78:79];defs=[['Modo: L Mono / R Mono / L+R Mono / Stereo',0,0,3],['Volume',1,0,127],['Panorama',2,1,127,64],['Reverb send',3,0,127],['Variation send',4,0,127],['Dry level',7,0,127],['Saída: Main / USB / Off · índice',22,0,125,0,1,{allowed:outputs}]];
  if(area==='audioAD')defs.push(['Inserção: A→B / B→A',5,1,2],['Inserções: 0 Off, 1 A, 2 B, 3 A+B',6,0,3],['Envelope follower ganho',8,16,112,64],['Envelope follower ataque',9,0,19],['Envelope follower release',10,0,15],...eq(11),['EQ output gain · índice',21,40,88,64],['Motion Seq ligada',23,0,1],['Motion Seq random',27,0,127]);
 }else if(partIndex===null&&area==='audition'){base=[48,77];defs=[['Frase Audition',0,1,1090,0,2],['Transposição',2,40,88,64],['Velocity offset',3,0,127,64]];
 }else if(part&&area==='partPitch'){
  base=[49,partIndex];defs=[['Detune · décimos de Hz',39,0,255,128,2,{encoding:'nibblePair'}],...(part.engine==='DRUM'?[]:[['Portamento ligado',49,0,1],['Portamento tempo',50,0,127],['Portamento modo',51,0,1,0,1,{choices:[[0,'Fingered'],[1,'Full-time']]}],['Portamento tempo modo',52,0,3,0,1,{choices:[[0,'Rate 1'],[1,'Time 1'],[2,'Rate 2'],[3,'Time 2']]}],['Microafinação',55,0,84,0,2,{choices:tuningNames}],['Microafinação raiz',57,0,11,0,1,{choices:['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map((name,i)=>[i,name])}]])];
 }else if(part&&area==='partOutput'){
  const choices=outputs.map(id=>[id,id===0?'Main L&R':id===125?'Off':id<66?`USB ${(id-9)*2+1}&${(id-9)*2+2}`:`USB ${id-65}`]);choices.push([127,part.engine==='DRUM'?'Saídas de cada tecla':'Main L&R (127)']);
  base=[49,partIndex];defs=[['Saída da Part',63,0,127,0,1,{allowed:choices.map(([id])=>id),choices}],...(part.engine==='DRUM'?[['Inserções para Reverb',60,0,127],['Inserções para Variation',61,0,127]]:[])];
 }else if(part&&area==='partEQ'){
  base=[49,partIndex];defs=[['3-band Low frequência · índice',83,0,255,0,2],['3-band Low ganho · índice',85,32,96,64],['3-band Mid frequência · índice',87,0,255,0,2],['3-band Mid ganho · índice',89,32,96,64],['3-band Mid Q · índice',90,0,31],['3-band High frequência · índice',91,131,255,0,2],['3-band High ganho · índice',93,32,96,64],...eq(95),['2-band output gain · índice',105,40,88,64]];
 }else if(part&&area==='partOffsets'){
  base=[49,partIndex];defs=[['Element panorama ligado',69,0,1],['AEG ataque offset',70,0,127,64],['AEG decay offset',71,0,127,64],...(part.engine==='DRUM'?[]:['AEG sustain','AEG release','FEG ataque','FEG decay','FEG sustain','FEG release','FEG profundidade'].map((n,i)=>[`${n} offset`,72+i,0,127,64])),['Cutoff offset',80,0,127,64],['Ressonância offset',81,0,127,64],...Array.from({length:8},(_,i)=>[`Assign ${i+1} valor`,106+i,0,127]),['Swing',114,8,248,128,2],['Motion Seq Part ligada',116,0,1],['Motion Seq amplitude offset',117,0,127,64],['Motion Seq pulse shape offset · índice',118,14,114,64],['Motion Seq smoothness offset',119,0,127,64],['Motion Seq random',120,0,127]];
 }else if(part&&part.engine!=='DRUM'&&area==='partLFO'){
  base=[49,64+partIndex];const block=current.blocks.get(`${base.join(':')}:0`);if(!block)return [];
  defs=[['Fase · índice',0,0,5],['Forma · índice',1,0,12],...(block[4]===0?[['Velocidade',2,0,63]]:[['Tempo speed · índice',3,5,24]]),['Tempo sync',4,0,1],['Delay',5,0,127],['Fade in',6,0,127],['Hold: 127 infinito',7,0,127],['Fade out',8,0,127],['Key On Reset: Off / Each / First',9,0,2],['Loop: 0 ligado, 1 desligado',10,0,1],...Array.from({length:3},(_,i)=>[[`Destino ${i+1} · LFO`,11+i*3,0,69,0,1,{choiceNames:'lfoDestinations'}],[`Profundidade ${i+1}`,12+i*3,0,127]]).flat(),...(block[1]===12?[['User LFO ciclo · índice',20,0,6],['User LFO slope · índice',21,0,3],...Array.from({length:16},(_,i)=>[`User LFO passo ${i+1}`,22+i,0,127,64])]:[]),...(block[4]===0?[['LFO random speed depth',38,0,127]]:[])];
 }else return [];
 const block=current.blocks.get(`${base.join(':')}:0`);if(!block)return [];
 const active=defs.filter(f=>{
  if(area!=='partEQ')return true;
  for(const start of [95,100]){
   if(f[1]===start+1)return [1,2,3,4,5].includes(block[start]);
   if(f[1]===start+3)return [3,4,5].includes(block[start]);
   if(f[1]===start+4)return block[start]===5;
  }
  return true;
 });
 const audioNames=['audioAD','audioUSB'].includes(area)?{0:['L Mono','R Mono','L + R Mono','Stereo'],5:['A → B','B → A'],6:['Off','Inserção A','Inserção B','A + B']}:{};
 const lfoNames=area==='partLFO'?{
  0:['0°','90°','120°','180°','240°','270°'],
  1:['Triangle','Triangle+','Saw Up','Saw Down','Squ1/4','Squ1/3','Square','Squ2/3','Squ3/4','Trapezoid','S/H1','S/H2','User'],
  3:['16th','8th/3','16th.','8th','4th/3','8th.','4th','2th/3','4th.','2nd','Whole/3','2nd.','4th×4','4th×5','4th×6','4th×7','4th×8','4th×16','4th×32','4th×64'],
  4:['Off','On'],9:['Off','Each-On','1st-On'],10:['On','Off'],
  20:['2 steps','3 steps','4 steps','6 steps','8 steps','12 steps','16 steps'],21:['Off','Up','Down','Up & Down'],
 }:{};
 return active.map(([label,offset,min,max,bias=0,width=1,extra={}])=>({label,address:[...base,offset],min:min-bias,max:max-bias,bias,width,...(min===0&&max===1?{choices:[[0,'Off'],[1,'On']]}:{}),...extra,...(audioNames[offset]?{choices:audioNames[offset].map((name,i)=>[i+(offset===5?1:0),name])}:{}),...(lfoNames[offset]?{label:label.replace(' · índice',''),choices:lfoNames[offset].map((name,i)=>[i+(offset===3?5:0),name])}:{}),...(area==='partLFO'?(offset===1?{readAfter:Array.from({length:18},(_,i)=>20+i)}:offset===4?{readAfter:[2,3,38]}:[2,3,38].includes(offset)?{readBefore:[4]}:offset>=20&&offset<=37?{readBefore:[1]}:{}):{}),value:(extra.encoding==='nibblePair'?block[offset]*16+block[offset+1]:width===2?block[offset]*128+block[offset+1]:block[offset])-bias}));
}
