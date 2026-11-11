// Yamaha Reference Manual pp.94–100: sources are FM-X Parts 9–16; the result is Part 1.
export function smartMorphSources(current){
 return Array.from({length:8},(_,i)=>{const part=current?.parts.find(p=>p.index===i+8);return {index:i+8,name:part?.name??'Livre',engine:part?.engine??null,eligible:part?.engine==='FM-X'};});
}
export function waveformUses(current){
 const rows=[];
 for(const part of current?.parts??[]){
  if(!['AWM2','DRUM'].includes(part.engine))continue;
  for(let unit=0;unit<(part.engine==='DRUM'?73:8);unit++){
   const drum=part.engine==='DRUM',address=drum?[80+part.index,unit,0]:[65,part.index+unit*16,0],block=current.blocks.get(address.join(':')),offset=drum?6:3;
   if(!block||block.length<=offset+1)continue;
   rows.push({part:part.index,unit,engine:part.engine,bank:block[1],number:block[offset]*128+block[offset+1],active:drum?null:!!block[0]});
  }
 }
 return rows;
}
