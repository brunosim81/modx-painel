import {normalizePerformance,parseMessages,decodePerformance,bulkMessage,joinBytes} from './protocol.mjs';
// Copy only documented synthesis blocks; Part-common controller assignments stay in their Part.
export function copyUnit(input,source,target,exchange=false){
 if(typeof exchange!=='boolean')throw Error('Operação de cópia inválida.');
 const messages=parseMessages(normalizePerformance(input)),current=decodePerformance(messages);
 const locate=selection=>{
  if(!selection||!Number.isInteger(selection.part)||!Number.isInteger(selection.unit))throw Error('Escolhe uma Part e uma unidade válidas.');
  const part=current.parts.find(p=>p.index===selection.part),unit=selection.unit;
  if(!part||unit<0||unit>=(part.engine==='DRUM'?73:8))throw Error('Unidade fora do intervalo desta Part.');
  const addresses=part.engine==='AWM2'?[[65,unit*16+part.index,103],[66,unit*16+part.index,70]]:part.engine==='FM-X'?[[73,unit*16+part.index,47]]:[[80+part.index,unit,47]];
  return {engine:part.engine,blocks:addresses.map(([hi,mid,size])=>{const address=[hi,mid,0],data=current.blocks.get(address.join(':'));if(!data||data.length!==size)throw Error('Dados da unidade incompletos ou de formato não reconhecido.');return {address,data};})};
 };
 const from=locate(source),to=locate(target);
 if(from.engine!==to.engine)throw Error('Só podes copiar entre Parts do mesmo motor de síntese.');
 if(source.part===target.part&&source.unit===target.unit)throw Error('Escolhe uma unidade de destino diferente.');
 const changes=new Map();
 from.blocks.forEach((block,i)=>{changes.set(to.blocks[i].address.join(':'),block.data);if(exchange)changes.set(block.address.join(':'),to.blocks[i].data);});
 return normalizePerformance(joinBytes(messages.map(m=>changes.has(m.address.join(':'))?bulkMessage(m.address,changes.get(m.address.join(':'))):m)));
}
