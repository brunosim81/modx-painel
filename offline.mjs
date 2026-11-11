export async function offlineInfo(worker,timeout=4000){
 if(!worker)throw Error('A cópia offline ainda não está ativa. Mantém Internet e volta a verificar.');
 return new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('O browser não respondeu à verificação offline.'));},timeout);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();const data=event.data;if(!data||!Array.isArray(data.missing)||!Number.isInteger(data.expected)){reject(Error('Resposta offline inválida.'));return;}resolve(data);};worker.postMessage({type:'offline-info'},[channel.port2]);});
}
export function offlineSummary(info){return info.missing.length?`Cópia incompleta: faltam ${info.missing.length} ficheiros. Volta a abrir com Internet.`:`Cópia offline pronta · ${info.expected} ficheiros · ${info.version.replace('modx-painel-','')}`;}
