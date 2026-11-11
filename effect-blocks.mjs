// Yamaha MODX+ Data List pp.144–158,198–200,209–210.
export const commonEffectAreas=[{id:'variation',label:'Variation'},{id:'master',label:'Master FX'},{id:'adA',label:'Entrada A/D · inserção A'},{id:'adB',label:'Entrada A/D · inserção B'}];
export const partEffectAreas=[{id:'insA',label:'Inserção A'},{id:'insB',label:'Inserção B'}];
export function effectTarget(partIndex,area){
 const common={variation:[48,66,'variation'],master:[48,70,'master'],adA:[48,67,'ad'],adB:[48,68,'ad']};
 if(partIndex===null&&common[area]){const [hi,mid,kind]=common[area];return {base:[hi,mid],kind};}
 if(Number.isInteger(partIndex)&&partIndex>=0&&partIndex<16&&['insA','insB'].includes(area))return {base:[49,partIndex+(area==='insA'?32:48)],kind:'insert'};
 return null;
}
export function blockTypes(catalog,target){return target?catalog.filter(t=>Object.hasOwn(t.blocks,target.kind)):[];}
export function blockInfo(current,catalog,target){
 if(!target)return null;
 const block=current.blocks.get(`${target.base.join(':')}:0`);if(!block)return null;
 const types=blockTypes(catalog,target),index=types.findIndex(t=>t.msb===block[0]&&t.lsb===block[1]);
 return {block,types,index,type:types[index]??null};
}
export function blockFields(current,catalog,target){
 const info=blockInfo(current,catalog,target);if(!info)return [];
 const {type,block}=info;
 const result=(type?.parameters??[]).filter(p=>p.number>=1&&p.number<=24&&!(target.kind==='variation'&&type.name==='UNI COMP DOWN'&&p.number===15)).map(p=>{
  const offset=3+(p.number-1)*2;
  return {label:p.choices?p.name:`${p.name} · índice Yamaha`,...(p.choices?{choices:p.choices}:{}),address:[...target.base,offset],min:p.min,max:p.max,bias:0,width:2,value:block[offset]*128+block[offset+1]};
 });
 const field=(label,offset,min,max,bias=0,allowed)=>({label,address:[...target.base,offset],min:min-bias,max:max-bias,bias,value:block[offset]-bias,...(allowed?{allowed}: {})});
 if(target.kind==='variation')result.push(field('Retorno Variation',68,0,127),field('Panorama Variation',69,1,127,64),field('Variation para Reverb',70,0,127),field('Variation ligada',71,0,1));
 else{
  result.push(field('Sidechain: 0–15 Parts, 16 A/D, 17 Master, 127 Off',67,0,127,0,[...Array(18).keys(),127]));
  if(target.kind==='master')result.push(field('Envelope follower: ganho',68,16,112,64),field('Envelope follower: ataque',69,0,19),field('Envelope follower: release',70,0,15),field('Master FX ligado',71,0,1));
 }
 return result;
}
