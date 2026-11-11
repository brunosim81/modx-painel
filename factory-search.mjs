const fold=value=>String(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
export const userArpeggios=Array.from({length:2304},(_,i)=>{const bank=Math.floor(i/256),slot=i%256+1,name=bank===0?'User':`Library ${bank}`;return [10240+i,`${name} · slot ${slot}`,name];});
export function searchFactory(rows,query,{min=0,max=16383,value,limit=60}={}){
 const needle=fold(query).trim().slice(0,128),terms=needle.split(/\s+/).filter(Boolean),numeric=/^\d+$/.test(needle),result=[];
 for(const row of rows){
  if(row[0]<min||row[0]>max)continue;
  if(!terms.length||(numeric?row[0]===Number(needle):terms.every(t=>fold(`${row[1]} ${row[2]||''}`).includes(t))))result.push(row);
  if(result.length>=limit)break;
 }
 const current=rows.find(r=>r[0]===value);
 if(current&&value>=min&&value<=max&&!result.some(r=>r[0]===value))result.unshift(current);
 return result;
}
export const waveformBanks=Array.from({length:10},(_,i)=>[i,i===0?'Preset':i===1?'User':`Library ${i-1}`]);
