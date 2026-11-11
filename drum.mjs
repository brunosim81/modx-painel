import {waveformBanks} from './factory-search.mjs';
// Yamaha MODX+ Data List p.219. Key index 0..72 corresponds to C0..C6.
const definitions=[
 ['Tecla ativa',0,0,1],['Receber Note Off',3,0,1],['Key Assign: Single / Multi',4,0,1],['Alternate group: 0 desligado',5,0,127],
 ['Panorama',8,1,127,64],['Pan aleatório',9,0,127],['Pan alternado',10,0,127,64],['Envio Reverb',11,0,127],['Envio Variation',12,0,127],['Ligação: Thru / Ins A / Ins B',14,0,2],
 ['Nível',16,0,127],['Nível velocidade',17,0,127,64],['AEG ataque',19,0,127],['AEG decay 1',20,0,127],['AEG decay 2: 127 Hold',21,0,127],['AEG nível decay 1',25,0,127],['Coarse tune',28,16,112,64],['Fine tune',29,0,127,64],['Pitch velocidade',30,0,127,64],
 ['LPF cutoff',32,0,255,0,2],['LPF velocidade',34,0,127,64],['LPF ressonância',35,0,127],['HPF cutoff',37,0,255,0,2],['EQ tipo',39,0,5],['EQ Q (índice)',40,0,31],['EQ 1 frequência (índice)',41,0,255,0,2],['EQ 1 ganho (índice)',43,32,96,64],['EQ 2 frequência (índice)',44,131,241,0,2],['EQ 2 ganho (índice)',46,32,96,64],
];
export const drumOutputs=[0,9,10,11,12,66,67,68,69,70,71,72,73];
// Reference Manual pp.176–177: key sends require Thru and effective Main L&R.
export function drumKeyRouting(current,partIndex,key){
 const part=current.parts.find(p=>p.index===partIndex),data=current.blocks.get(`${80+partIndex}:${key}:0`),parent=current.blocks.get(`49:${partIndex}:0`);
 if(part?.engine!=='DRUM'||!data||!parent)return {send:false,output:false};
 const thru=data[14]===0,route=parent[63];
 return {send:thru&&(route===0||(route===127&&data[15]===0)),output:thru&&route===127};
}
export function drumFields(current,partIndex,key=0){
 const part=current.parts.find(p=>p.index===partIndex);
 if(part?.engine!=='DRUM'||!Number.isInteger(key)||key<0||key>72)return [];
 const base=[80+partIndex,key],block=current.blocks.get(`${base[0]}:${base[1]}:0`);
 if(!block||block.length<47)return [];
 const routing=drumKeyRouting(current,partIndex,key);
 const active=definitions.filter(f=>{const offset=f[1],eq=block[39];return offset===40?eq===1:[41,43].includes(offset)?eq<=1:[44,46].includes(offset)?eq===0:true;});
 const fields=[...active,['Waveform do banco atual',6,1,block[1]===0?6347:2048,0,2],['Saída: 0 Main, 9–12 USB stereo, 66–73 USB mono',15,0,73]].map(([label,offset,min,max,bias=0,width=1])=>({label,address:[...base,offset],min:min-bias,max:max-bias,bias,width,...([11,12,15].includes(offset)?{drumRouting:offset===15?'output':'send',readOnly:!routing[offset===15?'output':'send'],readBefore:offset===15?[14]:[14,15],readBeforeAddresses:[[49,partIndex,63,1]],disabledReason:offset===15?'A saída individual requer saída Drum na Part e ligação Thru nesta tecla.':'O envio requer ligação Thru e saída Main L&R efetiva.'}:{}),...(min===0&&max===1?{choices:[[0,'Off'],[1,'On']]}:{}),...(offset===14?{readAfter:[11,12,15]}:offset===15?{readAfter:[11,12]}:{}),...(offset===39?{readAfter:[40,[41,2],43,[44,2],46]}:offset>=40&&offset<=46?{readBefore:[39]}:{}),value:(width===2?block[offset]*128+block[offset+1]:block[offset])-bias,...(offset===39?{choices:[[0,'2-band'],[1,'Parametric EQ'],[2,'Boost +6 dB'],[3,'Boost +12 dB'],[4,'Boost +18 dB'],[5,'Thru']]}:offset===4?{choices:[[0,'Single'],[1,'Multi']]}:offset===14?{choices:[[0,'Thru'],[1,'Inserção A'],[2,'Inserção B']]}:offset===15?{allowed:drumOutputs,choices:drumOutputs.map(id=>[id,id===0?'Main L&R':id<66?`USB ${(id-9)*2+1}&${(id-9)*2+2}`:`USB ${id-65}`])}:offset===6&&block[1]===0?{catalog:'waveforms'}:{})}));
 return [{label:'Banco da waveform',address:[...base,1],min:0,max:9,bias:0,width:1,value:block[1],choices:waveformBanks,waveBankOffset:6},...fields];
}
