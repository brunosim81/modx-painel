// Local audio preparation; no undocumented sample-transfer SysEx is emitted.
export function readWav(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<44||buffer.byteLength>64*1024*1024)throw Error('Escolhe um WAV PCM até 64 MB.');
 const v=new DataView(buffer),tag=o=>String.fromCharCode(...new Uint8Array(buffer,o,4));
 if(tag(0)!=='RIFF'||tag(8)!=='WAVE'||v.getUint32(4,true)+8!==buffer.byteLength)throw Error('Cabeçalho WAV inválido ou incompleto.');
 let fmt,data;
 for(let p=12;p+8<=buffer.byteLength;){const size=v.getUint32(p+4,true),end=p+8+size;if(end>buffer.byteLength)throw Error('Bloco WAV incompleto.');const id=tag(p);if(id==='fmt '){if(fmt||size<16)throw Error('Formato WAV inválido.');fmt={code:v.getUint16(p+8,true),channels:v.getUint16(p+10,true),rate:v.getUint32(p+12,true),byteRate:v.getUint32(p+16,true),align:v.getUint16(p+20,true),bits:v.getUint16(p+22,true)};}if(id==='data'){if(data)throw Error('Mais de um bloco de áudio.');data={start:p+8,size};}p=end+(size%2);}
 if(!fmt||!data||fmt.code!==1||![1,2].includes(fmt.channels)||![16,24].includes(fmt.bits)||fmt.rate!==44100||fmt.align!==fmt.channels*fmt.bits/8||fmt.byteRate!==fmt.rate*fmt.align||!data.size||data.size%fmt.align)throw Error('Usa WAV PCM 16/24 bits, mono/stereo, 44,1 kHz.');
 const frames=data.size/fmt.align,channels=Array.from({length:fmt.channels},()=>new Float32Array(frames));
 for(let i=0;i<frames;i++)for(let c=0;c<fmt.channels;c++){const p=data.start+i*fmt.align+c*fmt.bits/8;let n=fmt.bits===16?v.getInt16(p,true):v.getUint8(p)|(v.getUint8(p+1)<<8)|(v.getInt8(p+2)<<16);channels[c][i]=n/(fmt.bits===16?32768:8388608);}
 return {rate:fmt.rate,channels,frames};
}
export function editWav(audio,{start=0,end=audio.frames,gain=1,normalize=false}={}){
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>audio.frames||end<=start||!Number.isFinite(gain)||gain<0||gain>4)throw Error('Recorte ou ganho inválido.');
 let peak=0;for(const c of audio.channels)for(let i=start;i<end;i++)peak=Math.max(peak,Math.abs(c[i]));
 const multiplier=gain*(normalize&&peak?0.98/peak:1),channels=audio.channels.map(c=>Float32Array.from(c.subarray(start,end),n=>Math.max(-1,Math.min(1,n*multiplier))));
 return {rate:audio.rate,channels,frames:end-start};
}
export function writeWav(audio){
 const size=audio.frames*audio.channels.length*2,buffer=new ArrayBuffer(44+size),v=new DataView(buffer),tag=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
 tag(0,'RIFF');v.setUint32(4,36+size,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,audio.channels.length,true);v.setUint32(24,audio.rate,true);v.setUint32(28,audio.rate*audio.channels.length*2,true);v.setUint16(32,audio.channels.length*2,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,size,true);
 for(let i=0;i<audio.frames;i++)audio.channels.forEach((c,j)=>{const n=Math.max(-1,Math.min(1,c[i]));v.setInt16(44+(i*audio.channels.length+j)*2,Math.round(n*(n<0?32768:32767)),true);});return buffer;
}
export function keybankProject(input){
 const limits={noteLow:[1,127],noteHigh:[1,127],velocityLow:[1,127],velocityHigh:[1,127],root:[0,127],volume:[0,255],pan:[-63,63],coarse:[-64,63],fine:[-64,63]};
 for(const [key,[min,max]] of Object.entries(limits))if(!Number.isInteger(input[key])||input[key]<min||input[key]>max)throw Error(`Valor inválido: ${key}.`);
 if(input.noteLow>input.noteHigh||input.velocityLow>input.velocityHigh)throw Error('Os limites do keybank têm de ficar por ordem crescente.');
 return {format:'MODX-Painel-keybank-project',version:1,native:false,...Object.fromEntries(Object.keys(limits).map(k=>[k,input[k]]))};
}
let source=null,name='',previewURL=null,previewAudio=null,draft={};
export function disposeSamplePreview(){previewAudio?.pause();previewAudio=null;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;}
export function mountSampleEditor(panel,{html,notice}){
 panel.append(html('p',{},'Preparação local de amostras. Exporta WAV e uma ficha de Keybank; não escreve amostras no MODX nem cria ficheiros X8U. O original fica intacto.'));
 const file=html('input',{type:'file',accept:'.wav,audio/wav','aria-label':'Abrir amostra WAV'});
 file.addEventListener('change',async()=>{const chosen=file.files[0];if(!chosen)return;try{if(chosen.size>64*1024*1024)throw Error('Limite: 64 MB.');const next=readWav(await chosen.arrayBuffer());source=next;draft={};name=chosen.name.replace(/\.wav$/i,'');draw();}catch(e){notice(e.message,true);}});panel.append(file);
 const body=html('div',{class:'sample-workspace'});panel.append(body);
 const save=(blob,filename)=>{const url=URL.createObjectURL(blob),a=html('a',{href:url,download:filename});a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
 const draw=()=>{if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}body.replaceChildren();if(!source)return;
  body.append(html('p',{},`${name} · ${source.channels.length===2?'Stereo':'Mono'} · ${source.rate} Hz · ${(source.frames/source.rate).toFixed(3)} s`));
  const canvas=html('canvas',{width:800,height:120,'aria-label':'Amplitude da amostra',role:'img'});body.append(canvas);const ctx=canvas.getContext('2d');ctx.fillStyle='#101820';ctx.fillRect(0,0,800,120);ctx.strokeStyle='#78cfff';ctx.beginPath();
  for(let x=0;x<800;x++){let low=0,high=0;const from=Math.floor(x*source.frames/800),to=Math.max(from+1,Math.floor((x+1)*source.frames/800));for(let i=from;i<Math.min(to,source.frames);i++){low=Math.min(low,source.channels[0][i]);high=Math.max(high,source.channels[0][i]);}ctx.moveTo(x,60-low*55);ctx.lineTo(x,60-high*55);}ctx.stroke();
  const fields=html('div',{class:'editor-fields'}),values={};
  const number=(key,label,value,min,max,step=1)=>{const input=html('input',{type:'number',value:draft[key]??value,min,max,step,'aria-label':label}),wrap=html('label');wrap.append(html('span',{},label),input);fields.append(wrap);values[key]=input;input.addEventListener('input',()=>{draft[key]=input.value;});};
  number('start','Início · amostra',0,0,source.frames-1);number('end','Fim exclusivo · amostra',source.frames,1,source.frames);number('gain','Ganho ×',1,0,4,0.01);
  const norm=html('input',{type:'checkbox','aria-label':'Normalizar a 98%'}),normLabel=html('label');norm.checked=!!draft.normalize;norm.addEventListener('change',()=>{draft.normalize=norm.checked;});normLabel.append(norm,html('span',{},'Normalizar a 98%'));fields.append(normLabel);
  for(const [key,label,value,min,max] of [['noteLow','Nota mínima · MIDI',1,1,127],['noteHigh','Nota máxima · MIDI',127,1,127],['velocityLow','Velocidade mínima',1,1,127],['velocityHigh','Velocidade máxima',127,1,127],['root','Center Note · MIDI',60,0,127],['volume','Volume Keybank',127,0,255],['pan','Pan Keybank',0,-63,63],['coarse','Tune Coarse',0,-64,63],['fine','Tune Fine',0,-64,63]])number(key,label,value,min,max);
  body.append(fields,html('p',{},'Os parâmetros de Keybank ficam na ficha JSON para aplicação no teclado. Não são aplicados à pré-escuta ou gravados no WAV. O WAV exportado contém apenas recorte, ganho e normalização; não inclui loops.'));
  const audio=html('audio',{controls:true,'aria-label':'Pré-escuta do recorte'});body.append(audio);previewAudio=audio;
  const render=()=>editWav(source,{start:Number(values.start.value),end:Number(values.end.value),gain:Number(values.gain.value),normalize:norm.checked});
  const action=(label,fn)=>html('button',{onclick:()=>{try{fn();}catch(e){notice(e.message,true);}}},label);
  body.append(action('Preparar pré-escuta',()=>{const buffer=writeWav(render());audio.pause();if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));audio.src=previewURL;}),action('Exportar WAV',()=>save(new Blob([writeWav(render())],{type:'audio/wav'}),`${name}-edit.wav`)),action('Guardar ficha Keybank',()=>{const project=keybankProject(Object.fromEntries(Object.entries(values).map(([k,v])=>[k,Number(v.value)])));save(new Blob([JSON.stringify({...project,sample:`${name}-edit.wav`},null,2)],{type:'application/json'}),`${name}-keybank.json`);}),html('p',{},'No MODX: Edit → Part AWM2 → Element → Osc/Tune → Edit Waveform → Add Keybank. Seleciona o WAV na pen. Aplica os parâmetros da ficha no ecrã Edit Waveform.'));
 };draw();
}
