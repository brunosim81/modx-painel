import {waveformBanks} from './factory-search.mjs';
import {drumFields} from './drum.mjs';
// Yamaha MODX+ Data List pp.217–220. Multi-byte values use 7-bit MSB/LSB.
const delayNotes=['16th','8th/3','16th.','8th','4th/3','8th.','4th','2nd/3','4th.','2nd','Whole/3','2nd.','4th×4','4th×5','4th×6','4th×7','4th×8'];
const noteName=n=>['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][n%12]+(Math.floor(n/12)-2);
const eg=(prefix,offset,names,max=127,bias=0,width=1)=>names.map((name,i)=>[`${prefix} ${name}`,offset+i*width,0,max,bias,width]);
const awmOsc=[
 ['Elemento ativo',0,0,1],['Grupo',2,0,7,-1],['Panorama',8,1,127,64],['Pan aleatório',9,0,127],['Pan alternado',10,0,127,64],['Pan key scaling',11,0,127,64],['XA Control',12,0,7],
 ['Nota mínima',13,0,127],['Nota máxima',14,0,127],['Velocidade mínima',15,1,127],['Velocidade máxima',16,1,127],['Velocity crossfade',17,0,127],['Key On Delay',18,0,127],['Delay tempo sync',19,0,1],['Ligação: Thru / Ins A / Ins B',23,0,2],['Delay duração de nota',37,5,21],['Half damper',38,0,1],
 ['Nível',40,0,127],['Sensibilidade de nível à velocidade',41,0,127,64],['Offset de velocidade',42,0,127],['Curva de velocidade',43,0,4],
 ['AEG ataque',45,0,127],['AEG decay 1',46,0,127],['AEG decay 2',47,0,127],['Half damper tempo',48,0,127],['AEG release',49,0,127],
 ...eg('AEG nível',50,['inicial','ataque','decay 1','decay 2']),['AEG segmento de velocidade',55,0,4],['AEG sensibilidade à velocidade',56,0,127,64],['AEG key follow',57,0,127,64],['AEG nota central',58,0,127],
 ...[0,1,2,3].map(i=>[`Level breakpoint ${i+1}`,59+i,i,124+i]),...eg('Level scaling offset',63,['1','2','3','4'],255,128,2),
 ['Level key follow',71,0,127,64],['AEG release key follow',72,0,127],['Coarse tune',73,16,112,64],['Fine tune',74,0,127,64],['Pitch velocity',75,0,127,64],['Pitch aleatório',77,0,127],['Pitch key follow (índice)',78,0,127],['Pitch nota central',79,0,127],['Fine tune key follow',80,0,127,64],
 ...eg('PEG tempo',81,['hold','ataque','decay 1','decay 2','release']),...eg('PEG nível',86,['hold','ataque','decay 1','decay 2','release'],255,128,2),['PEG profundidade',96,0,127,64],['PEG segmento de velocidade',97,0,4],['PEG tempo velocidade',98,0,127,64],['PEG nível velocidade',99,0,127,64],['PEG curva',100,0,4],['PEG key follow',101,0,127,64],['PEG nota central',102,0,127],
];
const filter=(offset=0)=>[
 ['Filtro tipo (índice Yamaha)',offset,0,21],['Cutoff',offset+1,0,255,0,2],['Cutoff velocidade',offset+3,0,127,64],['Ressonância',offset+5,0,127],['Ressonância velocidade',offset+6,0,127,64],['HPF cutoff',offset+7,0,255,0,2],['Distância Dual',offset+10,0,255,128,2],['Ganho do filtro',offset+12,0,255,0,2],
 ...eg('FEG tempo',offset+14,['hold','ataque','decay 1','decay 2','release']),...eg('FEG nível',offset+19,['hold','ataque','decay 1','decay 2','release'],255,128,2),['FEG profundidade',offset+29,0,127,64],['FEG segmento de velocidade',offset+30,0,4],['FEG tempo velocidade',offset+31,0,127,64],['FEG nível velocidade',offset+32,0,127,64],['FEG curva',offset+33,0,4],['FEG key follow',offset+34,0,127,64],['FEG nota central',offset+35,0,127],
 ...[0,1,2,3].map(i=>[`Filter breakpoint ${i+1}`,offset+36+i,i,124+i]),...eg('Filter scaling offset',offset+40,['1','2','3','4'],255,128,2),['Cutoff key follow (índice)',offset+48,0,127],['HPF key follow (índice)',offset+49,0,127],
];
const awmFilter=[...filter(),['EQ tipo',50,0,5],['EQ Q (índice)',51,0,31],['EQ 1 frequência (índice)',52,0,255,0,2],['EQ 1 ganho (índice)',54,32,96,64],['EQ 2 frequência (índice)',55,131,241,0,2],['EQ 2 ganho (índice)',57,32,96,64],['LFO Saw / Triangle / Square',58,0,2],['LFO key reset',59,0,1],['LFO delay',60,0,127],['LFO velocidade',61,0,63],['LFO amplitude',62,0,127],['LFO pitch',63,0,127],['LFO filtro',64,0,127],['LFO fade in',65,0,127],['Part LFO fase',66,0,5],...eg('Part LFO destino',67,['1','2','3'])];
// FM filter layout has a shorter gap before Distance than the AWM table.
const fmFilter=filter().filter(f=>f[1]<36).map(f=>{const c=[...f];c[1]+=11-(f[1]>=10?2:f[1]>=5?1:0);return c;}).concat([['Cutoff key follow (índice)',45,0,127],...[0,1,2,3].map(i=>[`Filter breakpoint ${i+1}`,46+i,i,124+i]),...eg('Filter scaling offset',50,['1','2','3','4'],255,128,2),['HPF key follow (índice)',58,0,127]]);
const fmCommon=[['Pan aleatório',0,0,127],['Pan alternado',1,0,127,64],['Pan scaling',2,0,127,64],['Key On Delay',3,0,127],['Delay tempo sync',4,0,1],['Delay duração de nota',5,5,21],['Pitch velocity',6,0,127,64],['Pitch aleatório',7,0,127],['Pitch key follow (índice)',8,0,127],['Pitch nota central',9,0,127],...fmFilter,
 ...eg('PEG nível',59,['inicial','ataque','decay 1','decay 2','release'],100,50),...eg('PEG tempo',64,['ataque','decay 1','decay 2','release'],99),['PEG nível velocidade',68,0,7],['PEG profundidade: 8 / 2 / 1 / 0.5 oct',69,0,3],['PEG key follow',70,0,7],['LFO 2 forma',71,0,5],['LFO 2 velocidade',72,0,99],['LFO 2 fase',73,0,3],['LFO 2 delay',74,0,99],['LFO 2 key reset',75,0,1],['LFO 2 pitch',76,0,99],['LFO 2 amplitude',77,0,99],['LFO 2 filtro',78,0,99],['Algoritmo',79,0,87,-1],['Feedback',80,0,7]];
const operator=[['Oscilador key reset',1,0,1],['Frequência Ratio / Fixed',3,0,1],['Coarse tune',4,0,31],['Fine tune',5,0,127],['Detune',6,0,30,15],['Pitch key follow',7,0,99],['Pitch velocity',8,0,14,7],['Spectral form',9,0,6],['Spectral skirt',10,0,7],['Spectral resonance',11,0,99],['PEG nível inicial',12,0,100,50],['PEG nível ataque',13,0,100,50],['PEG ataque',14,0,99],['PEG decay',15,0,99],...eg('AEG nível',16,['ataque','decay 1','decay 2','release'],99),...eg('AEG tempo',20,['ataque','decay 1','decay 2','release','hold'],99),['AEG key follow',25,0,7],['Nível do operador',26,0,99],['Level breakpoint',27,0,99],['Level scaling low',28,0,99],['Level scaling high',29,0,99],['Level curva low',30,0,3],['Level curva high',31,0,3],['Level velocity',32,0,14,7],['LFO 2 pitch offset',33,0,7],['LFO 2 amplitude offset',34,0,7],['Pitch controller',35,0,14,7],['Level controller',36,0,14,7]];
export function synthesisAreas(part){
 if(part?.engine==='DRUM')return [{id:'drum',label:'Bateria · editar tecla'},{id:'unitCopy',label:'Copiar / trocar tecla'}];
 if(part?.engine==='AWM2')return [{id:'osc',label:'Oscilador · amplitude · pitch'},{id:'filter',label:'Filtro · EQ · LFO'},{id:'routes',label:'Controladores · ativação por Element'},{id:'unitCopy',label:'Copiar / trocar Element'}];
 if(part?.engine==='FM-X')return [{id:'fm',label:'FM-X · filtro · algoritmo'},{id:'op',label:'Operador FM-X'},{id:'routes',label:'Controladores · ativação por operador'},{id:'unitCopy',label:'Copiar / trocar operador'}];
 return [];
}
export function synthesisFields(current,partIndex,area,unit=0){
 if(area==='drum')return drumFields(current,partIndex,unit);
 const part=current.parts.find(p=>p.index===partIndex);
 if(!part||!Number.isInteger(unit)||unit<0||unit>7||!synthesisAreas(part).some(a=>a.id===area))return [];
 if(area==='routes'){
  // pp.217,220: two reserved bytes, then 2+7+7 controller switch bits.
  const hi=part.engine==='AWM2'?65:73,mid=partIndex+unit*16,block=current.blocks.get(`${hi}:${mid}:0`);
  if(!block)return [];
  const start=part.engine==='AWM2'?25:37;
  const flag=(label,offset,bit)=>({label,address:[hi,mid,offset],min:0,max:1,bias:0,width:1,bit,choices:[[0,'Desligado'],[1,'Ligado']],value:(block[offset]>>bit)&1});
  return [...Array.from({length:16},(_,i)=>flag(`Atribuição ${i+1} neste ${part.engine==='AWM2'?'Element':'operador'}`,start+4-Math.floor(i/7),i%7)),...(part.engine==='AWM2'?Array.from({length:3},(_,i)=>flag(`Part LFO · destino ${i+1} neste Element`,36,i)):[])];
 }
 const hi={osc:65,filter:66,fm:72,op:73}[area],mid=partIndex+(area==='fm'?0:unit*16),block=current.blocks.get(`${hi}:${mid}:0`);
 if(!block)return [];
 const defs={osc:awmOsc,filter:awmFilter,fm:fmCommon,op:operator}[area];
 const active=defs.filter(f=>{const offset=f[1];if(area==='osc')return offset===18?block[19]===0:offset===37?block[19]===1:offset===48?block[38]===1:true;if(area==='fm')return offset===3?block[4]===0:offset===5?block[4]===1:true;if(area==='op'){if([7,8].includes(offset))return block[3]===1;if(offset===10)return block[9]!==0;if(offset===11)return [5,6].includes(block[9]);}if(area==='filter'){const eq=block[50];return offset===51?eq===1:[52,54].includes(offset)?eq<=1:[55,57].includes(offset)?eq===0:true;}return true;});
 const segments=['Attack','Attack + Decay','Decay','Attack + Release','All'];
 const names={osc:{37:delayNotes,12:['Normal','Legato','Key Off','Cycle','Random','Assign SW Off','Assign SW 1 On','Assign SW 2 On'],23:['Thru','Inserção A','Inserção B'],55:segments,97:segments},filter:{30:segments,50:['2-band','Parametric EQ','Boost +6 dB','Boost +12 dB','Boost +18 dB','Thru'],58:['Saw','Triangle','Square'],66:['0°','90°','120°','180°','240°','270°']},fm:{5:delayNotes,39:segments,69:['8 oct','2 oct','1 oct','0.5 oct'],71:['Triangle','Saw Down','Saw Up','Square','Sine','S/H'],73:['0°','90°','180°','270°']},op:{3:['Ratio','Fixed'],9:['Sine','All 1','All 2','Odd 1','Odd 2','Res 1','Res 2'],30:['−Linear','−Exp','+Exp','+Linear'],31:['−Linear','−Exp','+Exp','+Linear']}}[area]??{};
 const limits=area==='op'?{4:block[3]===1?21:31,5:block[3]===0?99:127}:{};
 const dependencies={osc:{19:[18,37],38:[48]},filter:{50:[51,[52,2],54,[55,2],57]},fm:{4:[3,5]},op:{3:[4,5,7,8],9:[10,11]}}[area]??{};
 const fields=active.map(([label,offset,min,max,bias=0,width=1])=>({label,address:[hi,mid,offset],min:min-bias,max:(limits[offset]??max)-bias,bias,width,...(min===0&&max===1?{choices:[[0,'Off'],[1,'On']]}:{}),...(names[offset]?{choices:names[offset].map((name,i)=>[i+min-bias,name])}:{}),...(/nota central|^Nota (mínima|máxima)$|^(Level|Filter) breakpoint/i.test(label)?{choices:Array.from({length:max-min+1},(_,i)=>[min+i-bias,noteName(min+i+(area==='op'&&offset===27?21:0))])}:{}),...(area==='op'&&[4,5].includes(offset)?{help:[0,1].includes(block[3])?`Modo ${block[3]===1?'Fixed':'Ratio'}: 0–${limits[offset]}.`:'Modo de frequência desconhecido; escolhe Ratio ou Fixed.'}:{}),...(dependencies[offset]?{readAfter:dependencies[offset]}:{}),readBefore:Object.entries(dependencies).filter(([,targets])=>targets.some(t=>(Array.isArray(t)?t[0]:t)===offset)).map(([source])=>Number(source)),value:(width===2?block[offset]*128+block[offset+1]:block[offset])-bias}));
 if(area==='osc')fields.unshift({label:'Banco da waveform',address:[hi,mid,1],min:0,max:9,bias:0,width:1,value:block[1],choices:waveformBanks,waveBankOffset:3},{label:`Waveform · banco ${block[1]} (0 Preset, 1 User, 2–9 Library)`,address:[hi,mid,3],min:1,max:block[1]===0?6347:2048,bias:0,width:2,catalog:block[1]===0?'waveforms':null,value:block[3]*128+block[4]});
 return fields;
}

// Function pages follow the Reference Manual; ranges select existing fields, never new MIDI addresses.
const sections={
 osc:[['oscTune','Osc / Tune',[[0,7],[12,37],[73,80]]],['ampLevel','Amplitude · Level / Pan',[[8,11],[40,44],[71,71]]],['ampEG','Amplitude · Amp EG',[[38,38],[45,58],[72,72]]],['ampScale','Amplitude · Scale',[[59,70]]],['pitchEG','Pitch EG',[[81,102]]]],
 filter:[['filterType','Filter · Type',[[0,13],[48,49]]],['filterEG','Filter EG',[[14,35]]],['filterScale','Filter · Scale',[[36,47]]],['elementEQ','Element EQ',[[50,57]]],['elementLFO','Element LFO',[[58,69]]]],
 fm:[['fmPan','Pan',[[0,2]]],['fmTune','Osc / Tune · Algorithm',[[3,10],[79,80]]],['filterType','Filter · Type',[[11,22],[45,45],[58,58]]],['filterEG','Filter EG',[[23,44]]],['filterScale','Filter · Scale',[[46,57]]],['pitchEG','Pitch EG',[[59,70]]],['fmLFO','LFO 2',[[71,78]]]],
 op:[['opOsc','Oscillator',[[0,11]]],['opPitch','Pitch EG',[[12,15]]],['opEG','Amplitude · EG',[[16,25]]],['opLevel','Level · Scale',[[26,32]]],['opMod','Modulation',[[33,36]]]],
 drum:[['drumTune','Osc / Tune',[[0,7],[28,31]]],['drumLevel','Level / Pan · Routing',[[8,18]]],['drumEG','Amplitude · EG',[[19,27]]],['drumFilter','Filter',[[32,38]]],['drumEQ','Drum Key EQ',[[39,46]]]],
};
export function synthesisSections(area){return (sections[area]??[]).map(([id,label])=>({id,label}));}
export function synthesisSectionFields(fields,area,section){
 if(section==='all')return fields;
 const ranges=sections[area]?.find(([id])=>id===section)?.[2];
 return ranges?fields.filter(f=>ranges.some(([min,max])=>f.address[2]>=min&&f.address[2]<=max)):[];
}
