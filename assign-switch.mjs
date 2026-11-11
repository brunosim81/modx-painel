// Yamaha MODX+ Data List p.197: Assign switch CC and Momentary/Latch modes.
export function assignBytes(cc,pressed,channels){
 if(!Number.isInteger(cc)||cc<1||cc>95||typeof pressed!=='boolean'||!Array.isArray(channels)||!channels.length||channels.some(c=>!Number.isInteger(c)||c<0||c>15))throw Error('Destino ou CC de Assign inválido.');
 return [...new Set(channels)].map(c=>[176+c,cc,pressed?127:0]);
}
export function assignState(values,channels){
 const states=channels.map(c=>values.get(c));
 if(!states.length||states.some(s=>!s)||states.some(s=>s.value!==states[0].value))return {value:null,source:'unknown'};
 return {value:states[0].value,source:states.every(s=>s.source==='received')?'received':'sent'};
}
export function bindAssign(button,{momentary,initial,read,send,paint}){
 let value=initial,held=false,route=null,pulse=null,pointer=null;
 const transmit=next=>{try{route=send(next,route);value=next;paint(next);}catch(error){button.dispatchEvent(new CustomEvent('assignerror',{detail:error,bubbles:true}));}};
 const reset=()=>{pointer=null;if(pulse!==null){clearTimeout(pulse);pulse=null;}if(held){held=false;transmit(false);}route=null;};
 const toggle=()=>{route=null;transmit((read?read():value)===true?false:true);route=null;};
 const down=()=>{if(button.disabled||held)return;held=true;transmit(true);};
 button.addEventListener('pointerdown',event=>{if(button.disabled||(momentary()&&held))return;event.preventDefault();button.focus();if(momentary()){pointer=event.pointerId;button.setPointerCapture?.(event.pointerId);down();}else toggle();});
 const endPointer=event=>{if(pointer===event.pointerId)reset();};
 button.addEventListener('pointerup',endPointer);button.addEventListener('pointercancel',endPointer);button.addEventListener('lostpointercapture',endPointer);button.addEventListener('blur',()=>{if(pointer===null)reset();});
 button.addEventListener('keydown',event=>{if(button.disabled||![' ','Enter'].includes(event.key))return;if(!momentary()){if(event.repeat)event.preventDefault();return;}event.preventDefault();if(!event.repeat)down();});
 button.addEventListener('keyup',event=>{if([' ','Enter'].includes(event.key)&&held){event.preventDefault();reset();}});
 button.addEventListener('click',event=>{
  if(button.disabled)return;
  if(!momentary()){if(!(event.detail>0))toggle();}
  else if(event.detail===0&&!held){down();pulse=setTimeout(reset,120);}
 });
 return reset;
}
