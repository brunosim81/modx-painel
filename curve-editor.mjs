// MODX+ Reference Manual pp.50,132,140,206; Data List curve IDs 0..17 / 0..31.
const preset=['Standard','Sigmoid','Threshold','Bell','Dogleg','FM','AM','M','Discrete Saw','Smooth Saw','Triangle','Square','Trapezoid','Tilt Sine','Bounce','Resonance','Sequence','Hold'];
export function curveTypeChoices(bank){
 if(!Number.isInteger(bank)||bank<0||bank>9)return [];
 return (bank===0?preset:Array.from({length:32},(_,i)=>bank===1?`User ${i+1}`:`Library ${bank-1} · curva ${i+1}`)).map((name,i)=>[i,name]);
}
