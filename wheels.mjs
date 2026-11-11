export function wheelChannels(parts, mode, channel, target=null) {
  if(![0,1,2].includes(mode)||!Number.isInteger(channel)||channel<0||channel>15)throw Error('Modo MIDI não reconhecido. Volta a ligar ao MODX.');
  if(target!==null){
    const part=parts.find(p=>p.index===target);
    if(!part) return [];
    return [mode===1 || (mode===2&&part.keyboard) ? channel : part.index];
  }
  const linked=parts.filter(p=>p.keyboard&&p.on);
  return mode===0 ? linked.map(p=>p.index) : linked.length ? [channel] : [];
}
export function wheelBytes(type,value,channels) {
  const max=type==='pitch'?16383:127;
  if(!['pitch','mod'].includes(type)||!Number.isInteger(value)||value<0||value>max||channels.some(c=>!Number.isInteger(c)||c<0||c>15))throw Error('Valor de roda MIDI inválido.');
  return channels.map(c=>type==='pitch'?[224+c,value&127,value>>7]:[176+c,1,value]);
}
export function bindWheel(input,{spring,send,paint}) {
  let frame=null,active=false,channels=null;
  const transmit=value=>{try{channels=send(value,channels);paint(value);}catch(error){input.dispatchEvent(new CustomEvent('wheelerror',{detail:error,bubbles:true}));}};
  const cancelFrame=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;};
  const reset=()=>{
    cancelFrame();
    const shouldReset=active&&spring()!==null;active=false;
    if(shouldReset){const value=spring();input.value=String(value);transmit(value);}
    channels=null;
  };
  input.addEventListener('input',()=>{active=true;paint(Number(input.value));if(frame===null)frame=requestAnimationFrame(()=>{frame=null;transmit(Number(input.value));});});
  input.addEventListener('pointerdown',event=>{if(input.disabled)return;active=true;input.setPointerCapture(event.pointerId);});
  input.addEventListener('pointerup',()=>{if(spring()===null){cancelFrame();transmit(Number(input.value));active=false;channels=null;}else reset();});
  input.addEventListener('pointercancel',reset);
  input.addEventListener('lostpointercapture',reset);
  input.addEventListener('keyup',()=>{if(spring()!==null)reset();});
  input.addEventListener('blur',reset);
  return reset;
}
