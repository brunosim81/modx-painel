// Yamaha MODX+ Data List pp.144,146,197–198. Parameter values are table indices.
export const reverbTypes=[['OFF',0,0],['HD HALL',1,3],['REV-X HALL',1,0],['R3 HALL',1,1],['SPX HALL',1,2],['HD ROOM',1,19],['REV-X ROOM',1,16],['R3 ROOM',1,17],['SPX ROOM',1,18],['HD PLATE',1,33],['R3 PLATE',1,32],['SPX STAGE',1,48],['SPACE SIMULATOR',1,64]];
const base=[[1,'Reverb Time',0,69],[2,'Diffusion',0,10],[3,'Initial Delay',0,127],[4,'HPF Cutoff Frequency',0,52],[5,'LPF Cutoff Frequency',34,60]];
const tail=[[11,'Reverb Delay',0,127],[12,'Density',0,4],[13,'ER/Rev Balance',1,127],[14,'Feedback High Damp',1,10],[15,'Feedback Level',1,127]];
const hd=[[1,'Reverb Time',0,69],[2,'Room Size',0,4],[3,'Initial Delay',0,127],[4,'High Damp Frequency',34,60],[6,'High Ratio',0,10],[13,'EQ Low Frequency',1,34],[14,'EQ Low Gain',52,76],[15,'EQ High Frequency',28,59],[16,'EQ High Gain',52,76]];
const revx=[...base,[6,'Room Size',0,31],[7,'High Ratio',1,10],[8,'Low Ratio',1,14],[9,'Decay',0,63]];
export function reverbInfo(current){
 const block=current.blocks.get('48:65:0');
 if(!block)return null;
 const index=reverbTypes.findIndex(t=>t[1]===block[0]&&t[2]===block[1]);
 return {index,name:index<0?'Tipo não reconhecido':reverbTypes[index][0],block};
}
export function reverbFields(current,catalog=[]){
 const info=reverbInfo(current);if(!info)return [];
 const {index,block}=info;
 const metadata=catalog.find(t=>t.msb===block[0]&&t.lsb===block[1]&&Object.hasOwn(t.blocks,'reverb'));
 let definitions=[];
 if([1,5].includes(index))definitions=hd;
 else if(index===9)definitions=hd.map(p=>p[0]===2?[2,'Plate Type',0,2]:p);
 else if([2,6].includes(index))definitions=revx;
 else if([3,4,7,8,10,11].includes(index))definitions=[...base,...tail];
 else if(index===12)definitions=[...base,[6,'Width',0,104],[7,'Height',0,104],[8,'Depth',0,104],[9,'Wall Vary',0,30],...tail,[16,'Space Type',0,1]];
 return [...definitions.map(([n,label,min,max])=>{const offset=3+(n-1)*2,choices=metadata?.parameters.find(p=>p.number===n)?.choices;return {label:choices?label:`${label} · índice Yamaha`,...(choices?{choices}:{}),address:[48,65,offset],min,max,bias:0,width:2,value:block[offset]*128+block[offset+1]};}),
 {label:'Retorno Reverb',address:[48,65,68],min:0,max:127,bias:0,value:block[68]},
 {label:'Panorama Reverb',address:[48,65,69],min:-63,max:63,bias:64,value:block[69]-64},
 {label:'Reverb ligado',address:[48,65,70],min:0,max:1,bias:0,value:block[70]}];
}
