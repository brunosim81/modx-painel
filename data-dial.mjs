export function dialValue(target,start,steps){
 if(!target||target.disabled||!Number.isFinite(start)||!Number.isInteger(steps))return null;
 if(target.values){
  const values=target.values;if(!values.length)return null;
  const index=values.indexOf(start);
  if(index<0&&steps===0)return start;
  if(index>=0)return values[Math.max(0,Math.min(values.length-1,index+steps))];
  const candidates=values.filter(v=>steps>0?v>start:v<start).sort((a,b)=>a-b);
  return steps>0?candidates[0]??null:candidates.at(-1)??null;
 }
 if(!Number.isInteger(start)||!Number.isInteger(target.min)||!Number.isInteger(target.max)||target.min>target.max)return null;
 return Math.max(target.min,Math.min(target.max,start+steps));
}
export function bindDataDial(node,getTarget,paint){
 let gesture=null;
 const preview=(target,value)=>{if(value!==null){target.preview(value);paint();}};
 const finish=cancel=>{
  if(!gesture)return;const saved=gesture;gesture=null;node.classList.remove('turning');
  if(node.hasPointerCapture(saved.id))node.releasePointerCapture(saved.id);
  const target=getTarget();
  if(cancel){saved.target.preview(saved.start);paint();return;}
  if(!target||target.disabled||target.key!==saved.target.key)return;
  if(target.value!==saved.start)target.commit();
 };
 node.addEventListener('pointerdown',event=>{
  const target=getTarget();if(gesture||event.button!==0||dialValue(target,target?.value,0)===null)return;
  event.preventDefault();gesture={id:event.pointerId,x:event.clientX,y:event.clientY,start:target.value,target};
  node.setPointerCapture(event.pointerId);node.focus();node.classList.add('turning');
 });
 node.addEventListener('pointermove',event=>{
  if(gesture?.id!==event.pointerId)return;const target=getTarget();
  if(!target||target.disabled||target.key!==gesture.target.key){finish(true);return;}
  preview(target,dialValue(target,gesture.start,Math.round(((event.clientX-gesture.x)-(event.clientY-gesture.y))/8)));
 });
 node.addEventListener('pointerup',event=>{if(gesture?.id===event.pointerId)finish(false);});
 for(const name of ['pointercancel','lostpointercapture'])node.addEventListener(name,event=>{if(gesture?.id===event.pointerId)finish(true);});
 node.addEventListener('keydown',event=>{
  if(event.key==='Escape'){if(gesture){event.preventDefault();finish(true);}return;}
  if(gesture)return;const step={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1,PageUp:10,PageDown:-10}[event.key];
  if(step===undefined)return;const target=getTarget(),value=dialValue(target,target?.value,step);if(value===null)return;
  event.preventDefault();if(value!==target.value){preview(target,value);target.commit();}
 });
 return ()=>finish(true);
}
