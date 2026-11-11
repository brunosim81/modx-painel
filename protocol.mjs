import {requestMidiAccess} from './midi-access.mjs';
import {assignBytes} from './assign-switch.mjs';
import {wheelBytes} from './wheels.mjs';
const MODEL = 7;
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const seven = values => {
  if (!values.length || values.some(n => !Number.isInteger(n) || n < 0 || n > 127)) throw new Error('Valor fora do intervalo MIDI.');
};
export const joinBytes = messages => new Uint8Array(messages.flatMap(m => Array.from(m.bytes ?? m)));
const key = address => address.join(':');
const textLength=(address,aux=false)=>{
 const [hi,mid,offset]=address;
 if(aux)return offset===0&&((hi===0&&mid>=80&&mid<88)||(hi===1&&mid>=0&&mid<32)||(hi===2&&mid===0)||(hi===3&&mid>=0&&mid<16)||([4,5].includes(hi)&&mid>=0&&mid<128))?20:0;
 if(offset===0&&((hi===48&&mid===64)||(hi===49&&mid>=0&&mid<16)))return 20;
 return offset>=0&&offset<=112&&offset%16===0&&((hi===48&&mid===80)||(hi===55&&mid>=0&&mid<16))?16:0;
};
const checkText=(address,values,aux=false)=>{
 seven(values);if(!textLength(address,aux)||values.length!==textLength(address,aux)||values.some(v=>v!==0&&(v<32||v>126)))throw Error('Nome ou destino de texto inválido.');
};

export function bulkMessage(address, data = []) {
  if (address.length !== 3) throw new Error('Endereço inválido.');
  seven([...address, ...data]);
  const payload = [MODEL, ...address, ...data], size = payload.length;
  if (size > 16383) throw new Error('Mensagem demasiado grande.');
  return new Uint8Array([240, 67, 0, 127, 28, size >> 7, size & 127, ...payload, (-payload.reduce((s, n) => s + n, 0)) & 127, 247]);
}
export function parameterMessage(address, values) {
  if (address.length !== 3) throw new Error('Endereço inválido.');
  seven([...address, ...values]);
  return new Uint8Array([240, 67, 16, 127, 28, MODEL, ...address, ...values, 247]);
}
export function parseMessages(input) {
  if (!input?.length || input.length > 2_000_000) throw new Error('Ficheiro vazio ou demasiado grande.');
  const result = []; let message = null;
  for (const byte of input) {
    if (byte >= 248) continue;
    if (byte === 240) {
      if (message) throw new Error('Mensagem incompleta.');
      message = [byte]; continue;
    }
    if (!message) throw new Error('Dados fora de uma mensagem SysEx.');
    if (byte !== 247 && byte > 127) throw new Error('Mensagem MIDI inválida.');
    message.push(byte);
    if (byte !== 247) continue;
    const b = new Uint8Array(message);
    if (b.length < 13 || b[1] !== 67 || b[2] > 15 || b[3] !== 127 || b[4] !== 28 || b[7] !== MODEL) throw new Error('Este ficheiro não é uma Performance MODX.');
    if (b.length !== ((b[5] << 7) | b[6]) + 9 || b.slice(7, -1).reduce((s, n) => s + n, 0) % 128) throw new Error('Falha de integridade: tamanho ou checksum incorreto.');
    result.push({ bytes: b, address: Array.from(b.slice(8, 11)), data: b.slice(11, -2) });
    message = null;
  }
  if (message) throw new Error('Mensagem truncada ou incompleta.');
  if (!result.length) throw new Error('Nenhuma mensagem válida.');
  return result;
}
export function normalizePerformance(input) {
  const messages = parseMessages(input);
  const headers = messages.filter(m => m.address[0] === 14), footers = messages.filter(m => m.address[0] === 15);
  if (headers.length !== 1 || footers.length !== 1) throw new Error('Importa uma única Performance completa.');
  const first = messages[0], last = messages.at(-1);
  if (first !== headers[0] || last !== footers[0] || first.address[1] !== last.address[1] || first.address[2] !== last.address[2]) throw new Error('Performance sem cabeçalho e fecho completos.');
  if (first.address[1] > 79) throw new Error('Este bloco não é uma Performance.');
  const allowed = a => (a[0] === 0 && a[1] === 127 && a[2] === 0) || (a[0] >= 48 && a[0] <= 56) || [65, 66, 72, 73].includes(a[0]) || (a[0] >= 80 && a[0] <= 95);
  const seen = new Set();
  for (const m of messages.slice(1, -1)) {
    if (!allowed(m.address)) throw new Error('Bloco de sistema ou destino não permitido na Performance.');
    if (seen.has(key(m.address))) throw new Error('Bloco duplicado na Performance.');
    seen.add(key(m.address));
  }
  validateFullPerformance(messages);
  return joinBytes(messages.map((m, i) => i === 0 ? bulkMessage([14, 37, 0]) : i === messages.length - 1 ? bulkMessage([15, 37, 0]) : m));
}
const text = bytes => new TextDecoder().decode(bytes).replace(/\0.*$/s, '').trimEnd();
export function decodePerformance(messages) {
  const blocks = new Map(messages.map(m => [key(m.address), m.data]));
  const common = blocks.get('48:64:0');
  if (!common || common.length !== 94) throw new Error('Dados comuns da Performance incompletos.');
  const parts = [];
  for (let index = 0; index < 16; index++) {
    const p = blocks.get(`49:${index}:0`);
    if (!p) continue;
    if (p.length < 68) throw new Error('Part incompleta.');
    parts.push({ index, name: text(p.slice(0, 20)), engine: blocks.has(`72:${index}:0`) ? 'FM-X' : blocks.has(`${80+index}:0:0`) ? 'DRUM' : 'AWM2', category: p[20], on: !!p[22], keyboard: !!p[23], mute: !!p[24],
      insertionAssigned: !!p[25], low: p[30], high: p[31], volume: p[36], pan: p[37], insertion: p[38], reverb: p[41], variation: p[42] });
  }
  if (!parts.length) throw new Error('Performance sem Parts.');
  const rb = blocks.get('48:65:0'), vb = blocks.get('48:66:0');
  const knobNames = blocks.get('48:80:0');
  const knobs = Array.from({length:8}, (_,i) => ({name:knobNames ? text(knobNames.slice(i*16,i*16+16)) || `Assign ${i+1}` : `Assign ${i+1}`, value:common[83+i]}));
  return { name: text(common.slice(0, 20)), volume: common[56], pan: common[31], parts, blocks, knobs,
    scene: blocks.get('48:76:0')?.[0] ?? 0,
    superKnob: blocks.get('48:75:0')?.[0] ?? null,
    motion: blocks.has('48:72:0') ? !!blocks.get('48:72:0')[0] : null,
    reverb: rb?.length >= 71 ? { volume: rb[68], enabled: !!rb[70] } : null,
    variation: vb?.length >= 72 ? { volume: vb[68], enabled: !!vb[71] } : null };
}

function validateFullPerformance(messages) {
  const performance = decodePerformance(messages), blocks = performance.blocks;
  const requireBlock = (address, size, label) => {
    if ((blocks.get(key(address))?.length ?? 0) < size) throw new Error(`Performance incompleta: faltam dados de ${label}.`);
  };
  const commonSizes = [94,71,72,68,68,21,72,13,6,64,15,28,128,4,28,23,128,117,27];
  commonSizes.forEach((size, i) => requireBlock([48,64+i,0], size, 'síntese e efeitos comuns'));
  for (let lane=0; lane<4; lane++) for (let seq=0; seq<8; seq++) requireBlock([48,lane*16+seq,0],50,'sequências comuns');
  for (let seq=0;seq<8;seq++) requireBlock([48,96+seq,0],50,'sequências do Super Knob');
  for (const { index:p } of performance.parts) {
    const label = `síntese e efeitos da Part ${p+1}`;
    [121,64,68,68,39,17,92].forEach((size,g) => requireBlock([49,g*16+p,0],size,label));
    requireBlock([55,p,0],128,label);requireBlock([56,p,0],117,label);requireBlock([56,16+p,0],27,label);
    for(let scene=0;scene<8;scene++) requireBlock([54,scene*16+p,0],26,label);
    for(let lane=50;lane<=53;lane++) for(let seq=0;seq<8;seq++) requireBlock([lane,seq*16+p,0],50,label);
    if (blocks.has(key([72,p,0]))) {
      requireBlock([72,p,0],86,label);
      for(let op=0;op<8;op++) requireBlock([73,op*16+p,0],47,label);
    } else if (blocks.has(key([65,p,0]))) {
      for(let element=0;element<8;element++) { requireBlock([65,element*16+p,0],103,label);requireBlock([66,element*16+p,0],70,label); }
    } else {
      for(let drum=0;drum<73;drum++) requireBlock([80+p,drum,0],47,label);
    }
  }
  return performance;
}

export class ModxMidi extends EventTarget {
  constructor() { super(); this.access = null; this.input = null; this.output = null; this.pending = null; this.lastDump = null; this.transportState=null; this.liveSetBank=null;this.liveSetPage=null;this.liveSelectChannels=new Map(); this.auxBlocks=new Map();this.sceneCC = null; this.confirmed = false; this.activeNotes=new Set();this.sustain=new Set();this.lastNote=0; }
  notify(type) { this.dispatchEvent(new Event(type)); }
  async connect() {
    this.disconnect();
    this.access = await requestMidiAccess();
    const choose = ports => {
      const modx = [...ports.values()].filter(p => /MODX/i.test(p.name) && p.state === 'connected');
      const first = modx.filter(p => /(?:port(?:a)?|midi|-)\s*1(?:\b|$)/i.test(p.name));
      if (first.length === 1) return first[0];
      if (modx.length === 1) return modx[0];
      throw new Error('Não encontrei uma única porta MODX 1. Liga o Yamaha por USB e confirma MIDI IN/OUT = USB.');
    };
    try {
      this.input = choose(this.access.inputs); this.output = choose(this.access.outputs);
      await this.input.open(); await this.output.open();
      this.input.onmidimessage = event => this.receive(event.data);
      this.access.onstatechange = () => {
        if (this.input?.state !== 'connected' || this.output?.state !== 'connected') { this.disconnect(); this.notify('disconnect'); }
      };
      this.auxBlocks.clear();
      const settings = await this.readAux([0,0,0]);
      if (settings.length < 26) throw new Error('Resposta de configuração incompleta.');
      this.sceneCC = settings[25] || null;
      this.ioMode=settings[48];this.ioChannel=settings[49];
      const current = await this.readPerformance();
      this.confirmed = true; return current;
    } catch (error) { this.disconnect(); throw error; }
  }
  disconnect() {
    this.confirmed = false;this.transportState=null;this.liveSetPage=null;this.liveSelectChannels.clear();this.updateLiveSetBank(null);this.activeNotes.clear();this.sustain.clear();
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error('Ligação MIDI terminada.')); this.pending = null; }
    if (this.input) { this.input.onmidimessage = null; this.input.close().catch(() => {}); }
    if (this.output) this.output.close().catch(() => {});
    if (this.access) this.access.onstatechange = null;
    this.input = this.output = null;
  }
  receive(bytes) {
    if(bytes.length===1&&[250,251,252].includes(bytes[0])){this.transportState={command:({250:'start',251:'continue',252:'stop'})[bytes[0]],source:'received'};this.dispatchEvent(new CustomEvent('transport',{detail:this.transportState}));return;}
    if (bytes[0] >= 248) return;
    const kind=bytes[0]&240,channel=bytes[0]&15;
    if(kind===176&&bytes.length===3&&bytes[1]===0)this.liveSelectChannels.set(channel,{msb:bytes[2],lsb:null});
    if(kind===176&&bytes.length===3&&bytes[1]===32){const bank=this.liveSelectChannels.get(channel);if(bank)bank.lsb=bytes[2];}
    if(kind===192&&bytes.length===2){const bank=this.liveSelectChannels.get(channel);if(bank?.msb===62&&Number.isInteger(bank.lsb)&&bank.lsb>=0&&bank.lsb<16&&bytes[1]<16){this.liveSetPage=bank.lsb;this.notify('live-navigation');}else this.liveSetPage=null;}
    if(this.confirmed&&kind===176&&bytes.length===3&&bytes[2]<=127){
      const common=this.current?.blocks?.get('48:64:0');
      for(let index=0;index<2;index++)if(common?.[71+index]>0&&common[71+index]===bytes[1]){this.dispatchEvent(new CustomEvent('assign',{detail:{index,channel,value:bytes[2]>=64}}));}
    }
    if(kind===144 || kind===128){const note=`${channel}:${bytes[1]}`;if(kind===144&&bytes[2]>0)this.activeNotes.add(note);else this.activeNotes.delete(note);this.lastNote=Date.now();return;}
    if(kind===176&&bytes[1]===64){if(bytes[2]>=64)this.sustain.add(channel);else this.sustain.delete(channel);this.lastNote=Date.now();return;}
    if(kind===176&&[120,123].includes(bytes[1])){for(const n of this.activeNotes)if(n.startsWith(channel+':'))this.activeNotes.delete(n);this.sustain.delete(channel);this.lastNote=Date.now();return;}
    if(bytes[0]===240&&bytes[1]===67&&(bytes[2]&240)===16&&bytes[3]===127&&bytes[4]===28&&bytes[5]===MODEL&&bytes.at(-1)===247){
      try{
        const address=Array.from(bytes.slice(6,9)),data=bytes.slice(9,-1);seven([...address,...data]);
        if(this.pending?.parameter&&key(address)===key(this.pending.address)){this.finish([{address,data}]);return;}
        if(key(address)==='9:0:0'){this.updateLiveSetBank(data.length===1?data[0]:null);this.notify('settings');return;}
        if(this.confirmed&&this.patchAux(address,data)){this.notify('settings');return;}
        if(this.confirmed&&this.patch(address,data)){this.notify('updated');return;}
      }catch{this.notify('changed');return;}
    }
    if((bytes[0]&240)===224 || ((bytes[0]&240)===176&&bytes[1]===1)) {
      const type=(bytes[0]&240)===224?'pitch':'mod',value=type==='pitch'?bytes[1]+128*bytes[2]:bytes[2];
      this.dispatchEvent(new CustomEvent('wheel',{detail:{type,value,channel:bytes[0]&15}}));return;
    }
    if (!(bytes[0] === 240 && bytes[1] === 67 && bytes[2] <= 15)) {
      const type=bytes[0]&240;
      if(type===192){this.confirmed=false;this.notify('changed');}
      else if (!this.pending && (type===176 || bytes[0]===240)) this.notify('changed');
      return;
    }
    try {
      const messages = parseMessages(bytes), p = this.pending;
      if (!p) return;
      for (const m of messages) {
        if (key(m.address) === key(p.address)) {
          if (!p.group) { this.finish([m]); return; }
          p.started = true; p.messages = [m]; continue;
        }
        if (!p.started) continue;
        p.messages.push(m);
        if (m.address[0] === 15 && m.address[1] === p.address[1] && m.address[2] === p.address[2]) { this.finish(p.messages); return; }
      }
    } catch (error) {
      if (this.pending) { const p = this.pending; clearTimeout(p.timer); this.pending = null; this.confirmed = false; this.notify('disconnect'); p.reject(error); }
    }
  }
  finish(messages) { const p = this.pending; clearTimeout(p.timer); this.pending = null; p.resolve(messages); }
  requestBulk(address, parameter=false) {
    if (!this.input || !this.output || this.output.state !== 'connected') return Promise.reject(new Error('O MODX está desligado.'));
    if (this.pending) return Promise.reject(new Error('Aguarda a leitura em curso.'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending = null; this.confirmed = false; this.notify('disconnect'); reject(new Error('O MODX não respondeu. Confirma o cabo e volta a ligar no painel.')); }, 6500);
      this.pending = { address, parameter, resolve, reject, timer, group: !parameter&&address[0] === 14, started: false, messages: [] };
      try { this.output.send([240, 67, parameter?48:32, 127, 28, MODEL, ...address, 247]); }
      catch (error) { clearTimeout(timer); this.pending = null; this.confirmed = false; this.notify('disconnect'); reject(error); }
    });
  }
  updateLiveSetBank(bank){
    const next=Number.isInteger(bank)&&bank>=0&&bank<=16?bank:null;
    if(next!==this.liveSetBank||next===null)for(const name of this.auxBlocks.keys())if(Number(name.split(':')[0])>=2&&Number(name.split(':')[0])<=5)this.auxBlocks.delete(name);
    const changed=next!==this.liveSetBank;this.liveSetBank=next;if(changed){this.liveSetPage=null;this.notify('live-navigation');}
  }
  async selectLiveSetBank(bank){
    this.ready();if(!Number.isInteger(bank)||bank<0||bank>16)throw Error('Banco Live Set inválido.');
    if(!this.quietForBulk())throw Error('Muda de banco numa pausa, depois de soltar as teclas e o sustain.');
    if(await this.readLiveSetBank()===bank)return bank;
    this.ready();this.updateLiveSetBank(null);this.output.send(parameterMessage([9,0,0],[bank]));await sleep(80);
    if(await this.readLiveSetBank()!==bank)throw Error('O MODX não confirmou o banco pedido.');
    return bank;
  }
  async readLiveSetBank(){
    this.ready();
    try{
      const address=[9,0,0],messages=await this.requestBulk(address,true),reply=messages[0];
      if(messages.length!==1||key(reply.address)!==key(address)||reply.data.length!==1||!Number.isInteger(reply.data[0])||reply.data[0]<0||reply.data[0]>16)throw Error('O MODX não identificou um banco Live Set válido.');
      this.updateLiveSetBank(reply.data[0]);return this.liveSetBank;
    }catch(error){this.updateLiveSetBank(null);throw error;}
  }
  patchAux(address,values){
    seven([...address,...values]);
    const name=key([address[0],address[1],0]),block=this.auxBlocks.get(name);
    if(!block||address[2]+values.length>block.length)return false;
    const next=block.slice();next.set(values,address[2]);this.auxBlocks.set(name,next);
    if(name==='0:0:0'){this.sceneCC=next[25]||null;this.ioMode=next[48];this.ioChannel=next[49];}
    return true;
  }
  async readAux(address){
    const size=address[0]===0&&address[1]===0?60:address[0]===0&&address[1]===5?22:address[0]===0&&address[1]>=48&&address[1]<=55?24:address[0]===0&&address[1]>=80&&address[1]<=87?20:address[0]===1&&address[1]>=0&&address[1]<32?37:address[0]===2&&address[1]===0?20:address[0]===3&&address[1]>=0&&address[1]<16?20:[4,5].includes(address[0])&&address[1]>=0&&address[1]<128?26:0;
    if(!size||address[2]!==0)throw Error('Bloco Utility não autorizado.');
    const messages=await this.requestBulk(address);
    if(messages.length!==1||key(messages[0].address)!==key(address)||messages[0].data.length!==size){this.auxBlocks.delete(key(address));throw Error('Resposta Utility incompleta.');}
    const block=messages[0].data.slice();this.auxBlocks.set(key(address),block);
    this.patchAux(address,block);return block;
  }
  async writeAux(address,values){
    this.ready();seven([...address,...values]);
    if(address[0]>=2&&address[0]<=5){
      const expected=this.liveSetBank;
      if(!(Number.isInteger(expected)&&expected>=1&&expected<=8))throw Error('Lê e confirma um banco Live Set User antes de editar.');
      if(await this.readLiveSetBank()!==expected)throw Error('O banco Live Set mudou. Lê e revê os dados antes de editar.');
    }
    const block=this.auxBlocks.get(key([address[0],address[1],0]));
    if(!block||address[2]+values.length>block.length)throw Error('Lê esta área Utility antes de editar.');
    if(address[0]===0&&address[1]===0&&address[2]<=24&&address[2]+values.length>24)throw Error('Muda MIDI IN/OUT no teclado para preservar a ligação USB.');
    this.output.send(parameterMessage(address,values));await sleep(150);
    const reply=await this.requestBulk(address,true);
    if(reply.length!==1||key(reply[0].address)!==key(address)||reply[0].data.length!==values.length||!this.patchAux(address,reply[0].data)){this.confirmed=false;this.notify('disconnect');throw Error('Confirmação Utility incompleta.');}
    if(values.some((v,i)=>reply[0].data[i]!==v))throw Error('O Yamaha devolveu outro valor Utility. O painel mostra a leitura recebida.');
    return this.auxBlocks;
  }
  async readPerformance() {
    try {
      const messages = await this.requestBulk([14, 37, 0]);
      const current = validateFullPerformance(messages);
      this.lastDump = joinBytes(messages); this.current = current;this.confirmed=true;
      return current;
    } catch (error) { this.confirmed = false; this.notify('disconnect'); throw error; }
  }
  quietForBulk(now=Date.now()){return !this.activeNotes.size&&!this.sustain.size&&now-this.lastNote>=1500;}
  patch(address,values,whole=false){
    seven([...address,...values]);
    if(!this.lastDump)return false;
    const messages=parseMessages(this.lastDump),block=messages.find(m=>m.address[0]===address[0]&&m.address[1]===address[1]&&m.address[2]===0);
    if(!block || address[2]+values.length>block.data.length || (whole&&values.length!==block.data.length))return false;
    block.data.set(values,address[2]);block.bytes=bulkMessage(block.address,block.data);
    const current=validateFullPerformance(messages);
    this.lastDump=joinBytes(messages);this.current=current;return true;
  }
  async readParameter(address,expectedLength=null){
    try{
      const messages=await this.requestBulk(address,true);
      if(messages.length!==1||key(messages[0].address)!==key(address)||(expectedLength!==null&&messages[0].data.length!==expectedLength)||!this.patch(address,messages[0].data))throw Error('Parâmetro de confirmação inválido. Volta a ler o teclado numa pausa.');
      return this.current;
    }catch(error){this.confirmed=false;this.notify('disconnect');throw error;}
  }
  ready() {
    if (!this.confirmed || !this.output || this.output.state !== 'connected') {
      this.confirmed = false; this.notify('disconnect');
      throw new Error('Liga e lê o MODX antes de enviar alterações.');
    }
  }
  sendAssign(cc,pressed,channels){
    if(pressed)this.ready();else if(!this.output||this.output.state!=='connected')throw Error('O MODX está desligado.');
    for(const message of assignBytes(cc,pressed,channels))this.output.send(message);
    if(cc===64){for(const channel of channels){if(pressed)this.sustain.add(channel);else this.sustain.delete(channel);}this.lastNote=Date.now();}
    if(cc===1)this.dispatchEvent(new CustomEvent('wheel',{detail:{type:'mod',value:pressed?127:0,channel:channels.at(-1)}}));
    const knobCCs=this.current?.blocks?.get('48:64:0')?.slice(75,83)??[];
    if([5,7,10,65,71,72,73,74,75,76,77,78,84,91,93].includes(cc)||Array.from(knobCCs).includes(cc))this.notify('changed');
  }
  sendWheel(type,value,channels){if((type==='pitch'&&value===8192)||(type==='mod'&&value===0)){if(!this.output||this.output.state!=='connected')throw Error('O MODX está desligado.');}else this.ready();for(const message of wheelBytes(type,value,channels))this.output.send(message);}
  async writeParameter(address, values) {
    this.ready(); this.output.send(parameterMessage(address, values));
    await sleep(150);
    const current = await this.readParameter(address,values.length);
    const block = current.blocks.get(key([address[0], address[1], 0]));
    if (!block || values.some((v, i) => block[address[2] + i] !== v)) throw new Error('O teclado não confirmou o valor pedido. O painel mostra a leitura recebida.');
    return current;
  }
  async writeTextParameter(address,values){
    this.ready();checkText(address,values);
    let current=this.current;
    for(let i=0;i<values.length;i++)current=await this.writeParameter([address[0],address[1],address[2]+i],[values[i]]);
    return current;
  }
  async writeAuxText(address,values){
    this.ready();checkText(address,values,true);
    for(let i=0;i<values.length;i++)await this.writeAux([address[0],address[1],address[2]+i],[values[i]]);
    return this.auxBlocks;
  }
  async selectPerformance(reference) {
    this.ready(); seven([reference.msb, reference.lsb, reference.program]);
    if (reference.liveBank) {
      this.updateLiveSetBank(null);this.output.send(parameterMessage([9, 0, 0], [reference.liveBank])); await sleep(80);
    }
    this.output.send([176, 0, reference.msb, 176, 32, reference.lsb, 192, reference.program]);this.notify('selection');
    await sleep(230);
    const current = await this.readPerformance();
    if (reference.expectedName && current.name !== reference.expectedName) throw new Error(`O teclado abriu «${current.name}»; a seleção pedida não foi confirmada.`);
    return current;
  }
  async sendTransport(command){
    if(!['start','continue','stop'].includes(command))throw Error('Comando de transporte inválido.');
    const byte=({start:250,continue:251,stop:252})[command];
    if(command!=='stop'){
      this.ready();const settings=await this.readAux([0,5,0]);
      if(settings[8]!==1)throw Error('Ativa Receber sequencer control nas definições de sincronização do Yamaha.');
      this.ready();
    }else if(!this.output||this.output.state!=='connected')throw Error('O MODX está desligado.');
    this.output.send([byte]);this.transportState={command,source:'sent'};
    this.dispatchEvent(new CustomEvent('transport',{detail:this.transportState}));
  }
  async selectScene(index) {
    this.ready();
    if (!Number.isInteger(index) || index < 0 || index > 7 || !this.sceneCC) throw new Error('Confirma Scene CC nas definições MIDI do teclado.');
    this.output.send([176, this.sceneCC, index * 16]); await sleep(150);
    const current = await this.readParameter([48,76,0],1);
    if (current.scene !== index) throw new Error('A mudança de cena não foi confirmada pelo teclado.');
    return current;
  }
  async sendPerformance(input) {
    this.ready();
    const bytes = normalizePerformance(input);this.notify('selection');
    for (const m of parseMessages(bytes)) { this.output.send(m.bytes); await sleep(18); }
    await sleep(200);
    const current = await this.readPerformance();
    for(const m of parseMessages(bytes).slice(1,-1)) {
      const got = current.blocks.get(key(m.address));
      if(!got || got.length!==m.data.length || m.data.some((v,i)=>got[i]!==v)) throw new Error('O teclado não confirmou todos os blocos do som importado. Lê e verifica a Performance antes de a guardar.');
    }
    return current;
  }
}
