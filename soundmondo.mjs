import {normalizePerformance} from './protocol.mjs';
const API='https://backend.soundmondo.yamahasynth.com/api/v1/voices/';
export function searchURL(query,page=1){
 if(!Number.isInteger(page)||page<1||page>100000)throw Error('Página inválida.');
 const url=new URL(API);
 for(const [k,v] of [['page',String(page)],['page_size','25'],['private','False'],['reface','MODX'],['reface','MODXPLUS'],['search',String(query).slice(0,200)],['trashed','False'],['user','']])url.searchParams.append(k,v);
 return url.href;
}
async function json(url,signal,fetcher=fetch){
 const deadline=AbortSignal.timeout(15000);
 let r;try{r=await fetcher(url,{credentials:'omit',signal:signal?AbortSignal.any([signal,deadline]):deadline});}catch(error){if(error.name==='TypeError')throw Error('Não foi possível contactar o Soundmondo. Confirma a ligação à Internet e tenta novamente.');throw error;}
 if(!r.ok)throw Error(r.status===429?'O Soundmondo pediu uma pausa. Tenta novamente dentro de instantes.':`Soundmondo indisponível (${r.status}).`);
 const text=await r.text();if(text.length>2000000)throw Error('Resposta do Soundmondo demasiado grande.');return JSON.parse(text);
}
export async function searchSounds(query,page=1,signal,fetcher=fetch){
 const j=await json(searchURL(query,page),signal,fetcher);
 if(!Array.isArray(j.results)||!Number.isInteger(j.count)||j.count<0)throw Error('Resposta de pesquisa inválida.');
 return {count:j.count,results:j.results.filter(e=>['MODX','MODXPLUS'].includes(e.reface)&&Number.isSafeInteger(e.id)&&e.id>0).map(e=>({id:e.id,name:String(e.name||'Sem nome').slice(0,512),author:String(e.user_full_name||'Autor no Soundmondo').slice(0,200),description:String(e.description||'').slice(0,3000),instrument:e.reface,url:`https://soundmondo.yamahasynth.com/voices/${e.id}`}))};
}
export function soundBytes(detail){
 if(!['MODX','MODXPLUS'].includes(detail.reface))throw Error('Este som precisa de conversão no Soundmondo antes de ser importado no MODX+.');
 const messages=detail.data?.sysex;
 if(!Array.isArray(messages)||!messages.length||messages.length>5000)throw Error('O Soundmondo não forneceu uma Performance MIDI. Escolhe outra Performance compatível.');
 const bytes=[];
 for(const message of messages){
  if(!message||typeof message!=='object')throw Error('Mensagem MIDI inválida.');
  const keys=Object.keys(message);
  if(keys.length>20000||keys.some((k,i)=>k!==String(i)))throw Error('Ordem dos dados MIDI inválida.');
  for(const key of keys){const v=message[key];if(!Number.isInteger(v)||v<0||v>255)throw Error('Byte MIDI inválido.');bytes.push(v);}
  if(bytes.length>2000000)throw Error('Performance demasiado grande.');
 }
 return normalizePerformance(Uint8Array.from(bytes));
}
export async function getSound(id,signal,fetcher=fetch){
 if(!Number.isSafeInteger(id)||id<1)throw Error('Identificador de som inválido.');
 const j=await json(`${API}${id}/`,signal,fetcher);
 return {name:String(j.name||'Soundmondo').slice(0,512),description:String(j.description||'').slice(0,5000),bytes:soundBytes(j)};
}
