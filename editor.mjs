import {drumKeyRouting} from './drum.mjs';
// Yamaha MODX+ Data List, MIDI tables Performance Common and Performance Part.
export const commonFields = [
 ['Volume',56,0,127],['Panorama',31,1,127],['Portamento · offset de tempo',57,0,127,64],['Portamento',58,0,1],['Volume USB monitor',59,0,127],
 ['Ribbon CC · 0 Off',67,0,95],['Breath CC · 0 Off',68,0,95],['Foot Controller 1 CC · 96 Super Knob',69,0,96],['Foot Controller 2 CC · 96 Super Knob',70,0,96],['Assign Switch 1 CC · 0 Off',71,0,95],['Assign Switch 2 CC · 0 Off',72,0,95],['Motion Hold CC · 0 Off',73,0,95],['Motion Trigger CC · 0 Off',74,0,95],...Array.from({length:8},(_,i)=>[`Assign ${i+1} CC · 0 Off`,75+i,0,95]),
 ['Assign Switch 1: momentâneo / fixo',61,0,1],['Assign Switch 2: momentâneo / fixo',62,0,1],['Motion Hold: momentâneo / fixo',63,0,1],
];
export const partFields = [
 ['Part ativa',22,0,1],['Controlo pelo teclado',23,0,1],['Mute',24,0,1],['Inserções atribuídas',25,0,1],
 ['Velocidade mínima',28,1,127],['Velocidade máxima',29,1,127],['Nota mínima',30,0,127],['Nota máxima',31,0,127],
 ['Pitch bend superior',32,16,88,64],['Pitch bend inferior',33,16,88,64],['Sensibilidade à velocidade',34,0,127],['Offset de velocidade',35,0,127],
 ['Volume',36,0,127],['Panorama',37,1,127,64],['Inserções A/B: 0 nenhuma, 1 A, 2 B, 3 ambas',38,0,3],
 ['Envio Reverb',41,0,127],['Envio Variation',42,0,127],['Nível seco',44,0,127],['Transposição',45,40,88,64,'normal'],
 ['Envelope follower: ganho',46,16,112,64],['Envelope follower: ataque',47,0,19],['Envelope follower: release',48,0,15],
 ['Key Assign: Single / Multi',53,0,1,0,'normal'],['Mono / Poly',54,0,1,0,'normal'],['Raiz microafinação',57,0,11,0,'normal'],
 ['Legato slope',58,0,7,0,'awm'],['Inserções: paralelo / A→B / B→A',59,0,2],
];
export function fieldsFor(current,partIndex=null){
 const part=current.parts.find(p=>p.index===partIndex);
 if(partIndex!==null&&!part)return [];
 const base=part?[49,part.index]:[48,64],block=current.blocks.get(`${base[0]}:${base[1]}:0`);
 if(!block)return [];
 const modes=part?{38:['Off','Inserção A','Inserção B','A + B'],53:['Single','Multi'],54:['Mono','Poly'],57:['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],59:['Parallel','A → B','B → A']}:{61:['Momentary','Latch'],62:['Momentary','Latch'],63:['Momentary','Latch']};
 const result=(part?partFields:commonFields).filter(f=>block&&f[1]<block.length&&!(f[1]===23&&part.index>7)&&(!f[5]||(f[5]==='normal'?part.engine!=='DRUM':part.engine==='AWM2'))).map(([label,offset,min,max,bias=0])=>({label,address:[...base,offset],min:min-bias,max:max-bias,bias,...(min===0&&max===1?{choices:[[0,'Off'],[1,'On']]}:{}),...(modes[offset]?{choices:modes[offset].map((name,i)=>[i-bias,name]).filter(([id])=>!(part?.engine==='FM-X'&&offset===59&&id===0))}:{}),value:block[offset]-bias,...(part&&[41,42,44].includes(offset)?{systemSend:true,readBefore:[63],readOnly:![0,127].includes(block[63]),disabledReason:'Disponível apenas com saída Main L&R ou encaminhamento Drum.'}:{})}));
 const text=bytes=>new TextDecoder().decode(bytes).replace(/\0.*$/s,'').trimEnd();
 const names=[{label:part?'Nome da Part · sem acentos':'Nome da Performance · sem acentos',address:[...base,0],text:20,value:text(block.slice(0,20))}];
 const knobBase=part?[55,part.index]:[48,80],knobs=current.blocks.get(`${knobBase.join(':')}:0`);
 if(knobs)for(let i=0;i<8;i++)names.push({label:`Assign ${i+1} nome · sem acentos`,address:[...knobBase,i*16],text:16,value:text(knobs.slice(i*16,i*16+16))});
 const categories=part?[{label:'Categoria principal',address:[...base,20],min:0,max:16,bias:0,width:1,value:block[20],choices:['Piano','Keyboard','Organ','Guitar','Bass','Strings','Brass','Woodwind','Syn Lead','Pad/Choir','Syn Comp','Chromatic Perc','Drum / Perc','Sound FX','Musical FX','Ethnic','No Assign'].map((label,i)=>[i,label])},{label:'Subcategoria · índice Yamaha',address:[...base,21],min:0,max:7,bias:0,width:1,value:block[21]}]:[];
 return [...names,...categories,...result];
}

export function editorValue(current,field,value){
 if(field.text){
  if(typeof value!=='string'||!value.trim()||value.length>field.text||[...value].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)>126))throw Error(`Usa até ${field.text} caracteres sem acentos.`);
  return [...value].map(c=>c.charCodeAt(0)).concat(Array(field.text-value.length).fill(0));
 }
 if(!Number.isInteger(value)||value<field.min||value>field.max||(field.allowed&&!field.allowed.includes(value)))throw Error('Valor fora do intervalo deste parâmetro.');
 let raw=value+field.bias;const [hi,mid,offset]=field.address,block=current.blocks.get(`${hi}:${mid}:0`);
 if(!block)throw Error('Este bloco já não está disponível. Volta a ler o teclado.');
 if(field.drumRouting&&!drumKeyRouting(current,hi-80,mid)[field.drumRouting])throw Error(field.disabledReason);
 if(hi===65&&offset===48&&block[38]!==1)throw Error('Ativa Half Damper antes de editar o seu tempo.');
 if(hi===73&&[4,5].includes(offset)){
  if(![0,1].includes(block[3]))throw Error('O modo de frequência do operador não é reconhecido.');
  const max=offset===4?(block[3]===1?21:31):(block[3]===0?99:127);
  if(raw>max)throw Error('Valor fora do intervalo do modo de frequência atual.');
 }
 if(field.systemSend&&![0,127].includes(block[63]))throw Error(field.disabledReason);
 if(field.waveBankOffset!==undefined&&raw!==0&&(block[field.waveBankOffset]*128+block[field.waveBankOffset+1])>2048)throw Error('Escolhe primeiro uma waveform até 2048 antes de mudar para User ou Library.');
 if(field.curveInput&&((offset>20&&raw<=block[offset-1])||(offset<27&&raw>=block[offset+1])))throw Error('As entradas dos pontos da curva têm de ficar por ordem crescente.');
 if(hi===1&&offset===36&&raw===0&&block[27]!==127)throw Error('Define primeiro a entrada do último ponto como 127 para usar Linear.');
 if(field.presetCurveBank!==undefined&&block[field.presetCurveBank]!==0)throw Error('Os parâmetros da curva só estão disponíveis no banco Preset.');
 if(field.curveTypeBank!==undefined&&block[field.curveTypeBank]===0&&raw>17)throw Error('As curvas Preset usam os tipos 0–17.');
 if(hi===48&&[81,82].includes(mid)){
  const start=Math.floor(offset/9)*9,relative=offset-start,destination=block[start+1]*128+block[start+2],linked=destination>=124&&destination<=251;
  if(relative===0&&linked&&(raw<8||raw>15))throw Error('Um Assign da Part só pode receber um Assign Knob comum.');
  if(relative===1&&raw>=124&&(block[start]<8||block[start]>15))throw Error('Escolhe primeiro um Assign Knob comum como origem.');
  if(linked&&[3,4,8].includes(relative))throw Error('Curva e ratio não são editáveis nesta ligação entre Assign Knobs.');
 }
 if(field.curveBank&&raw===0&&block[offset+1]>17)throw Error('Escolhe primeiro uma curva Preset entre 0 e 17.');
 if(((hi===48&&[73,74].includes(mid))||(hi===49&&mid>=16&&mid<32))){const laneStart=Math.floor(offset/16)*16;if((offset===laneStart+8&&raw>block[laneStart+9])||(offset===laneStart+9&&raw<block[laneStart+8]))throw Error('O limite mínimo não pode ultrapassar o máximo.');}
 if(field.bit!==undefined)raw=(block[offset]&~(1<<field.bit))|(raw<<field.bit);

 if(hi===49&&mid<16){
  if(offset===59&&current.parts.find(p=>p.index===mid)?.engine==='FM-X'&&raw===0)throw Error('FM-X não permite inserções em paralelo.');
 }
 if(hi===65||hi===66||hi===72){
  // AWM Elements allow reversed note/velocity limits to select two outer zones (Reference Manual p.170).
  const start=hi===65?59:hi===66?36:46;
  if(offset>=start&&offset<start+4&&((offset>start&&raw<=block[offset-1])||(offset<start+3&&raw>=block[offset+1])))throw Error('Os quatro breakpoints têm de ficar por ordem crescente.');
 }
 if(field.readOnly)throw Error('Este parâmetro é alterado no teclado.');
 if(field.encoding==='nibblePair')return [raw>>4,raw&15];
 if(field.encoding==='nibbles')return [0,(raw>>8)&7,(raw>>4)&15,raw&15];
 return field.width===2?[raw>>7,raw&127]:raw;
}
export function checkedEditorValue(current,field,value,expected){
 const block=current.blocks.get(`${field.address[0]}:${field.address[1]}:0`);
 if(!block||!expected||block.length!==expected.length||block.some((v,i)=>v!==expected[i]))throw Error('Esta área mudou no teclado. Revê os valores recebidos e volta a aplicar.');
 return editorValue(current,field,value);
}
