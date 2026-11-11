export function dragValue(start, dx, dy) {
  return Math.max(0, Math.min(127, Math.round(start + (dx - dy) * .65)));
}
export function bindKnob(node, input, preview, commit) {
  let gesture=null;
  const show=value=>{input.value=String(value);node.setAttribute('aria-valuenow',String(value));preview(value);};
  node.addEventListener('pointerdown',event=>{
    if(event.button!==0 || input.disabled)return;
    event.preventDefault();
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,start:Number(input.value)};
    node.setPointerCapture(event.pointerId);node.focus();node.classList.add('turning');
  });
  node.addEventListener('pointermove',event=>{
    if(gesture?.id===event.pointerId)show(dragValue(gesture.start,event.clientX-gesture.x,event.clientY-gesture.y));
  });
  const finish=(event,cancel)=>{
    if(gesture?.id!==event.pointerId)return;
    const start=gesture.start,value=Number(input.value);gesture=null;node.classList.remove('turning');
    if(node.hasPointerCapture(event.pointerId))node.releasePointerCapture(event.pointerId);
    if(cancel)show(start);else if(value!==start)commit(value);
  };
  node.addEventListener('pointerup',e=>finish(e,false));
  node.addEventListener('pointercancel',e=>finish(e,true));
  node.addEventListener('lostpointercapture',e=>finish(e,true));
  node.addEventListener('keydown',event=>{
    if(input.disabled)return;
    const old=Number(input.value),values={ArrowUp:old+1,ArrowRight:old+1,ArrowDown:old-1,ArrowLeft:old-1,PageUp:old+10,PageDown:old-10,Home:0,End:127};
    if(!(event.key in values))return;
    event.preventDefault();const value=Math.max(0,Math.min(127,values[event.key]));show(value);if(old!==value)commit(value);
  });
  input.addEventListener('input',()=>show(Number(input.value)));
}
