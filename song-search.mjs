const fold=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
export function songTitle(entry){return String(entry.ficheiro??entry.nome??entry.title??'').replace(/^\d+\s+|^CB\d+\s+/i,'').replace(/\.syx$/i,'').trim();}
export function localSongs(rows,query){const term=fold(query);return rows.filter(e=>(fold(`${songTitle(e)} ${e.sons??''}`).includes(term)||(fold(songTitle(e)).length>=4&&term.includes(fold(songTitle(e))))));}
export function songSearchURL(query){
 const term=String(query).trim().slice(0,180);if(!term)throw Error('Escreve o nome de uma música.');
 const url=new URL('https://musicbrainz.org/ws/2/recording/');url.search=new URLSearchParams({query:`recording:"${term.replace(/[\\"]/g,'\\$&')}"`,fmt:'json',limit:'25'});return url.href;
}
export function songResults(data){
 if(!Array.isArray(data.recordings))throw Error('Resposta de músicas inválida.');const seen=new Set(),rows=[];
 for(const e of data.recordings){if(typeof e.title!=='string'||typeof e.id!=='string')continue;const title=e.title.slice(0,300),artist=(Array.isArray(e['artist-credit'])?e['artist-credit']:[]).map(a=>a.name??a.artist?.name??'').join(' / ').slice(0,300),key=fold(`${title}|${artist}`);if(seen.has(key))continue;seen.add(key);rows.push({id:e.id,title,artist});}
 return rows;
}
let last=0;
export async function searchSongs(query,signal,fetcher=fetch){
 const url=songSearchURL(query),now=Date.now();if(now-last<1200)throw Error('Aguarda um instante antes de voltar a pesquisar.');last=now;
 const response=await fetcher(url,{credentials:'omit',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(response.status===503||response.status===429?'O MusicBrainz está ocupado. Tenta novamente dentro de instantes.':`Pesquisa de músicas indisponível (${response.status}).`);
 const text=await response.text();if(text.length>2000000)throw Error('Resposta de músicas demasiado grande.');return songResults(JSON.parse(text));
}
