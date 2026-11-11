export async function requestMidiAccess(nav=globalThis.navigator){
 if(typeof nav?.requestMIDIAccess!=='function')throw Error('Este browser não disponibiliza Web MIDI. No iPad abre a app no MIDIWeb Browser; no Mac/Windows usa Chrome. Em HTTP local é necessária a ponte MIDI nativa do MIDIWeb.');
 let access;
 try{access=await nav.requestMIDIAccess({sysex:true});}catch(error){
  if(['NotAllowedError','SecurityError'].includes(error.name))throw Error('Autoriza MIDI e SysEx para esta app no MIDIWeb/Chrome. Se o browser bloquear o endereço HTTP local, será necessária uma origem HTTPS.');
  throw error;
 }
 if(access.sysexEnabled===false)throw Error('O browser não autorizou SysEx. Ativa essa permissão antes de ler ou editar o MODX.');
 return access;
}
export function midiReport(access){
 const ports=map=>[...(map?.values()??[])].map(p=>({name:String(p.name??'Sem nome'),state:p.state??'desconhecido'}));
 return {sysex:access?.sysexEnabled===true?'autorizado':access?.sysexEnabled===false?'recusado':'não indicado pelo browser',inputs:ports(access?.inputs),outputs:ports(access?.outputs)};
}
