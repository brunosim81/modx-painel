import {mountLiveTouch,livePageAddresses,readLiveTouchPage,touchActivePerformance} from './live-touch.mjs';
import {mountAppSettings} from './app-settings.mjs';
import {installLanguageSelector} from './i18n.mjs';
const languageControl=installLanguageSelector();
import {mountSupport} from './support.mjs';
const requestedSupport=location.hash==='#apoios';
import {offlineInfo,offlineSummary} from './offline.mjs';
import {validateLocalCatalog,localCatalogKey} from './catalog-storage.mjs';
import {requestMidiAccess,midiReport} from './midi-access.mjs';
import {mountSampleEditor,disposeSamplePreview} from './sample-editor.mjs';
import {searchSongs,localSongs,songTitle} from './song-search.mjs';
import {smartMorphSources,waveformUses} from './touch-functions.mjs';
import {bindDataDial} from './data-dial.mjs';
import {copyUnit} from './unit-copy.mjs';
import {assignState,bindAssign} from './assign-switch.mjs';
import {searchFactory,userArpeggios} from './factory-search.mjs';
import {systemAreas,systemTargets,userSystemFields} from './system-editor.mjs';
import {partAudioAreas,partAudioFields} from './part-audio-editor.mjs';
import {controlAreas,controlFields,controlChoiceField} from './control-editor.mjs';
import {sequenceAreas,sequenceFields} from './sequence-editor.mjs';
import {commonAreas,commonEditorFields} from './common-editor.mjs';
import {commonEffectAreas,partEffectAreas,effectTarget,blockInfo,blockFields} from './effect-blocks.mjs';
import {reverbTypes,reverbInfo,reverbFields} from './effect-editor.mjs';
import {synthesisAreas,synthesisFields,synthesisSections,synthesisSectionFields} from './synthesis.mjs';
import {fieldsFor,checkedEditorValue,editorValue} from './editor.mjs';
import { ModxMidi, bulkMessage, joinBytes, normalizePerformance, decodePerformance, parseMessages } from './protocol.mjs';
import {sameDump,changedView,insertionValue} from './sync.mjs';

import {searchSounds,getSound} from './soundmondo.mjs';
import {wheelChannels,bindWheel} from './wheels.mjs';
import {bindKnob} from './knob.mjs';

const $ = id => document.getElementById(id);
const midi = new ModxMidi();
const [data,controlNames,effectCatalog,factoryCatalog]=await Promise.all(['data.json','control-names.json','effect-catalog.json','factory-catalog.json'].map(async file=>{const response=await fetch(file);if(!response.ok)throw Error(`Não foi possível ler ${file}. Confirma que extraíste o pacote completo.`);return response.json();}));
factoryCatalog.arpeggios.push(...userArpeggios);
const state = { view: 'performance', layout: 'performance', knobBank:0, knobMode:'assign', faderBank:0, sceneBank:0, physicalScreen:'live', touchBank:data.band.length?'band':'user1',touchPage:0, current: null, busy: false, connected: false, dirty: false, recoveries:[], partPage: 0, livePage: 1, limit: 80, lastRead: null };
const online={results:[],count:0,page:0,query:'',loading:false,error:'',request:0,controller:null,detailBusy:false};
const unitCopyTarget={part:null,unit:1,exchange:false};
let editorLiveSlot=0,editorDialKey=null,dataDialCancel=()=>{};
let editorPart=null,editorOpen=false,editorArea='part',editorSection='all',editorUnit=0,editorLane=0,editorSeq=0,editorSet=0;
let assignResets=[],assignRecords=[null,null],assignPaint=[null,null];
let wheelResets=[], wheelValues={pitch:8192,mod:0}, wheelTarget=null, modSpring=false;
let autoRead=null, autoTimer=null, dragging=false, pendingRender=false, syncNeeded=false;
const colors = ['#65d7e2', '#9dd8ba', '#edc08c', '#c3b1df', '#91bde5', '#dbaaaf', '#bdcb91', '#9fb4bd'];
const category = ['Piano', 'Piano elétrico / teclas', 'Órgão', 'Guitarra', 'Baixo', 'Cordas', 'Metais', 'Sopros', 'Lead synth', 'Pad / coro', 'Synth', 'Percussão afinada', 'Bateria', 'Efeitos', 'Som musical', 'Híbrido', 'Sem categoria'];
const html = (tag, attrs = {}, content = '') => {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else if (name === 'class') node.className = value;
    else if (name === 'disabled') node.disabled = value;
    else node.setAttribute(name, value);
  }
  node.textContent = content;
  return node;
};
function notice(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); }
function connected() { return state.connected && midi.confirmed && !state.busy; }
function note(number) { return ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][number % 12] + (Math.floor(number / 12) - 2); }
function reference(entry, live = false) {
  return live ? { msb: 62, lsb: entry.pagina - 1, program: entry.posicao - 1, liveBank: 8, expectedName: entry.nome }
    : { msb: entry.msb ?? entry.bank_msb, lsb: entry.lsb ?? entry.bank_lsb, program: entry.program, expectedName: entry.name ?? entry.nome };
}
function readStatus() {
  $('connection-status').textContent = state.connected ? 'MODX ligado por USB' : 'Sem ligação';
  $('connection-status').classList.toggle('online', state.connected);
  $('connect').textContent = state.connected ? 'Desligar' : 'Ligar ao MODX';
  $('connect').disabled = state.busy;
  $('dirty').hidden = !state.dirty;
  $('save-previous').hidden = !state.recoveries.length;
  $('save-previous').textContent = `Guardar edição anterior (${state.recoveries.length})`;
  $('read-state').textContent = state.current && state.lastRead ? `${state.connected ? (syncNeeded?'AGUARDA PAUSA ·':'MIDI ·') : 'ÚLTIMA LEITURA ·'} ${state.lastRead.toLocaleTimeString('pt-PT')}` : 'SEM LEITURA DO TECLADO';
  $('footer-state').textContent = state.busy ? 'A comunicar com o Yamaha…' : state.connected ? 'Alterações na memória de edição · Store no teclado para guardar' : 'Biblioteca local · liga o Yamaha para enviar alterações';
  if(!connected())document.querySelectorAll('[data-assign-switch]').forEach(n=>n.disabled=true);
  document.querySelectorAll('[data-hardware]').forEach(n => n.disabled = !connected());
  $('refresh').disabled=state.busy||!!autoRead||!state.connected||midi.output?.state!=='connected';
}
function accept(current) { state.current = current; state.lastRead = new Date(); }
function scheduleAuto(delay=1400) {
  clearTimeout(autoTimer);
  if(state.connected&&syncNeeded) autoTimer=setTimeout(autoSync,delay);
}
async function autoSync() {
  if(!state.connected||!syncNeeded) return;
  if(state.busy || autoRead || document.hidden || dragging || !midi.quietForBulk() || $('unsaved').open) {scheduleAuto();return;}
  syncNeeded=false;
  const previous=state.current, previousDump=midi.lastDump, wasConfirmed=midi.confirmed;
  autoRead=(async()=>{
    try {
      const current=await midi.readPerformance();
      if(state.layout==='physical'&&state.physicalScreen==='live')await midi.readLiveSetBank();
      const changed=!sameDump(previousDump,midi.lastDump);
      if(changed && previous && previous.name!==current.name) {
        if(state.dirty && previousDump) state.recoveries.push({name:previous.name,bytes:previousDump.slice()});
        state.dirty=false;state.partPage=0;
        notice(`O teclado mudou para «${current.name}».${state.recoveries.length ? ' Podes guardar a edição anterior no computador.' : ''}`);
      }
      accept(current);
      if((changed||!wasConfirmed) && dragging) pendingRender=true;
      if((changed||!wasConfirmed) && !dragging) {
        const nextView=changedView(previous,current);
        if(nextView) view(nextView);
        render();
      } else readStatus();
    } catch(error) {
      if(state.connected) {state.connected=false;notice(error.message,true);render();}
    }
  })();
  readStatus();await autoRead;autoRead=null;readStatus();scheduleAuto();
}
async function run(fn, success) {
  if (state.busy) return;
  const focus = document.activeElement?.id;
  state.busy = true; render();
  try { if(autoRead) await autoRead;await fn(); if (success) notice(success); }
  catch (error) {
    if (midi.current && midi.confirmed) accept(midi.current);
    if (!midi.confirmed) state.connected = false;
    const message = error.name === 'NotAllowedError' ? 'A autorização MIDI foi recusada. Permite o acesso ao MODX nas permissões desta app no MIDIWeb/Chrome.' : error.message;
    notice(message, true);
  } finally {
    state.busy = false; render();
    if (focus) $(focus)?.focus({ preventScroll: true });
    scheduleAuto();
  }
}
async function edit(address, value, readBefore=[], readAfter=[], asText=false) {
  if (!connected()) return;
  const expectedName=state.current?.name;
  await run(async () => {
    if(state.current?.name!==expectedName) throw new Error('O teclado mudou de Performance. Confirma o som aberto antes de editar.');
    for(const fresh of readBefore)accept(await midi.readParameter(fresh.slice(0,3),fresh[3]??null));
    const next = typeof value === 'function' ? value(state.current) : value;
    state.dirty = true; accept(await (asText?midi.writeTextParameter(address,next):midi.writeParameter(address,Array.isArray(next)?next:[next])));
    for(const fresh of readAfter)accept(await midi.readParameter(fresh.slice(0,3),fresh[3]??null));
  }, 'Valor confirmado pelo MODX. A edição ainda não está guardada permanentemente.');
}
function range(id, label, value, min, max, onChange, vertical = false, disabled = false) {
  const wrap = html('label', { class: vertical ? 'fader' : 'control', for: id });
  const output = html('output', { for: id }, String(value));
  if (!vertical) {
    const head = html('span', { class: 'control-head' }); head.append(html('span', {}, label), output); wrap.append(head);
  }
  const input = html('input', { id, type: 'range', min, max, value, 'aria-label': label, disabled: disabled || !connected() });
  input.addEventListener('input', () => output.textContent = input.value);
  input.addEventListener('change', () => onChange(Number(input.value)));
  wrap.append(input);
  if (vertical) wrap.append(output);
  return wrap;
}
function toggle(id, label, value, callback, disabled = false) {
  return html('button', { id, 'aria-label': label, 'aria-pressed': String(value), disabled: disabled || !connected(), onclick: () => callback(!value) }, label);
}
function renderPerformance() {
  const p = state.current;
  $('performance-name').textContent = p?.name || 'O teu teclado, à mão.';
  $('performance-description').textContent = p ? `${p.parts.length} ${p.parts.length === 1 ? 'Part' : 'Parts'} · Cena ${p.scene + 1} · ${state.connected ? 'Som lido do Yamaha' : 'Última leitura, sem ligação'}` : 'Lê a Performance aberta para trabalhar nas suas Parts, cenas e efeitos.';
  $('global-controls').replaceChildren();
  if (p) $('global-controls').append(range('main-volume', 'Volume geral', p.volume, 0, 127, v => edit([48, 64, 56], v)), range('main-pan', 'Panorama', p.pan, 1, 127, v => edit([48, 64, 31], v)));
  $('engine-summary').textContent=p ? [...new Set(p.parts.map(n=>n.engine))].join(' + ') : 'SEM LEITURA';
  $('assignable-knobs').replaceChildren(...Array.from({length:8},(_,i)=>{
    const knob=p?.knobs[i], label=html('label',{class:'knob',for:`knob-${i}`});
    label.append(html('span',{class:'knob-name'},knob?.name || `Assign ${i+1}`));
    const face=html('span',{class:'knob-face',style:`--angle:${-135+(knob?.value ?? 0)*270/127}deg`});
    const out=html('output',{for:`knob-${i}`},knob ? String(knob.value) : '—');
    face.append(html('span',{class:'knob-pointer'}),out);label.append(face);
    const input=html('input',{type:'range',id:`knob-${i}`,min:0,max:127,value:knob?.value??0,'aria-label':`Common Assign ${i+1}: ${knob?.name || ''}`,disabled:!knob || !connected()});
    input.addEventListener('input',()=>{out.textContent=input.value;face.style.setProperty('--angle',`${-135+Number(input.value)*270/127}deg`);});
    input.addEventListener('change',()=>edit([48,64,83+i],Number(input.value)));
    label.append(input);return label;
  }));
  $('scenes').replaceChildren(...Array.from({ length: 8 }, (_, i) => html('button', { id: `scene-${i}`, 'aria-label': `Cena ${i + 1}`, 'aria-pressed': String(p?.scene === i), disabled: !connected() || !midi.sceneCC, onclick: () => run(async () => { state.dirty = true; accept(await midi.selectScene(i));syncNeeded=true; }, `Cena ${i + 1} confirmada pelo MODX.`) }, String(i + 1))));
  $('parts-first').setAttribute('aria-pressed', String(state.partPage === 0));
  $('parts-second').setAttribute('aria-pressed', String(state.partPage === 1));
  const cards = [];
  for (let index = state.partPage * 8; index < state.partPage * 8 + 8; index++) {
    const part = p?.parts.find(n => n.index === index);
    const card = html('article', { class: `part${part ? '' : ' empty'}`, style: `--part-color:${colors[index % 8]}` });
    const top = html('div', { class: 'part-top' }); top.append(html('strong', {}, String(index + 1).padStart(2, '0')), html('span', {}, part?.engine || 'LIVRE')); card.append(top);
    card.append(html('h3', {}, part?.name || 'Sem Part'), html('p', { class: 'key-range' }, part ? `${note(part.low)} → ${note(part.high)}` : ''));
    if (part) {
      card.append(range(`part-volume-${index}`, `Volume da Part ${index + 1}: ${part.name}`, part.volume, 0, 127, v => edit([49, index, 36], v), true));
      const buttons = html('div', { class: 'part-buttons' });
      const mute = toggle(`part-mute-${index}`, 'MUTE', part.mute, v => edit([49, index, 24], Number(v))); mute.classList.toggle('muted-on', part.mute);
      mute.setAttribute('aria-label', `Silenciar Part ${index + 1}`);
      const keyboard = toggle(`part-keyboard-${index}`, 'TECLAS', part.keyboard, v => edit([49, index, 23], Number(v)), index > 7);
      keyboard.setAttribute('aria-label', `Controlo pelo teclado, Part ${index + 1}`);
      buttons.append(mute, keyboard,html('button',{onclick:()=>openEditor(index)},'Editar Part')); card.append(buttons, html('p', { class: 'part-pan' }, category[part.category] || 'Som da Performance'));
    }
    cards.push(card);
  }
  $('parts').replaceChildren(...cards);
}
function renderLive() {
  const term = $('live-filter').value.trim().toLocaleLowerCase('pt-PT');
  document.querySelectorAll('[data-page]').forEach(n => n.setAttribute('aria-pressed', String(Number(n.dataset.page) === state.livePage)));
  const entries = data.band.filter(e => term ? `${e.nome} ${e.ficheiro}`.toLocaleLowerCase('pt-PT').includes(term) : e.pagina === state.livePage);
  $('live-grid').replaceChildren(...entries.map(e => {
    const button = html('button', { class: `live-slot${e.silencioso ? ' silent' : ''}${state.current?.name === e.nome ? ' active' : ''}`, disabled: state.busy || !state.connected, onclick: () => choose(e, true) });
    const number = html('span', { class: 'slot-number' }); number.append(html('span', {}, String(e.numero).padStart(2, '0')), html('span', {}, e.silencioso ? 'VISCOUNT' : `${e.partes} ${e.partes === 1 ? 'PART' : 'PARTS'}`));
    button.append(number, html('strong', {}, e.ficheiro.slice(3, -4)), html('small', {}, e.sons));
    return button;
  }));
  if (!entries.length) $('live-grid').append(html('p', { class: 'empty-state' }, data.band.length?'Nenhum tema encontrado.':'Importa o teu catálogo local em iPad / diagnóstico USB. O repertório privado não é publicado online.'));
}
function renderEffects() {
  const p = state.current;
  const panels = [];
  for (const [name, effect, mid, offset] of [['Reverb', p?.reverb, 65, 70], ['Variation', p?.variation, 66, 71]]) {
    const panel = html('article', { class: 'effect-panel' });
    const top = html('div', { class: 'effect-top' }); top.append(html('h2', {}, name));
    if (effect) top.append(toggle(`fx-${mid}-switch`, effect.enabled ? 'Ligado' : 'Desligado', effect.enabled, v => edit([48, mid, offset], Number(v))));
    panel.append(top);
    if (effect) panel.append(range(`fx-${mid}-volume`, 'Retorno do efeito', effect.volume, 0, 127, v => edit([48, mid, 68], v)));
    else panel.append(html('p', { class: 'muted' }, 'Disponível depois de ler a Performance.'));
    panels.push(panel);
  }
  $('effects-global').replaceChildren(...panels);
  const rows = (p?.parts ?? []).map(part => {
    const tr = html('tr');
    const title = html('td', {}, `${part.index + 1}. ${part.name}`); title.append(html('small', {}, category[part.category] || 'Part')); tr.append(title);
    for (const [type, label, offset] of [['reverb', 'Envio Reverb', 41], ['variation', 'Envio Variation', 42]]) {
      const td = html('td'),field=fieldsFor(p,part.index).find(f=>f.address[2]===offset);if(field?.readOnly)td.title=field.disabledReason;td.append(range(`${type}-${part.index}`, `${label} Part ${part.index + 1}`, part[type], 0, 127, v => edit([49, part.index, offset], latest=>editorValue(latest,field,v),[[49,part.index,63,1]]),false,!field||field.readOnly));tr.append(td);
    }
    for (const [bit, name] of [[1, 'A'], [2, 'B']]) {
      const td = html('td'), active = !!(part.insertion & bit);
      const button = toggle(`insert-${name}-${part.index}`, active ? `${name} ligada` : `${name} desligada`, active, v => edit([49, part.index, 38], latest => insertionValue(latest, part.index, bit, v)), !part.insertionAssigned);
      button.setAttribute('aria-label', `Inserção ${name} da Part ${part.index + 1}`); td.append(button);
      if (!part.insertionAssigned) td.append(html('small', {}, 'Sem atribuição'));
      tr.append(td);
    }
    return tr;
  });
  $('effects-parts').replaceChildren(...rows);
}
const songs={rows:[],loading:false,error:'',request:0,controller:null};
async function searchMusic(){
 const query=$('sound-filter').value.trim();songs.controller?.abort();const controller=new AbortController(),id=++songs.request;songs.controller=controller;songs.loading=true;songs.error='';renderSearch();
 try{const rows=await searchSongs(query,controller.signal);if(id===songs.request)songs.rows=rows;}catch(e){if(id===songs.request&&e.name!=='AbortError')songs.error=e.name==='TypeError'?'Não foi possível contactar o MusicBrainz. Confirma a Internet.':e.message;}finally{if(id===songs.request){songs.loading=false;renderSearch();}}
}
function findSongSounds(title){$('sound-filter').value=title;$('sound-source').value='soundmondo';onlineSearch();}
function renderSongs(){
 $('results-title').textContent='Músicas e sons';$('results-count').textContent='Repertório local + MusicBrainz';$('online-query').textContent=songs.loading?'A pesquisar…':'Pesquisar músicas';$('online-query').disabled=songs.loading;
 const rows=[];
 for(const entry of localSongs(data.band,$('sound-filter').value)){
  const row=html('article',{class:'sound-row'}),copy=html('div');copy.append(html('h3',{},songTitle(entry)),html('p',{},`${entry.sons} · indicação do teu repertório`));
  row.append(copy,html('button',{disabled:!connected(),onclick:()=>choose(entry,true)},'Abrir som do repertório'),html('button',{onclick:()=>findSongSounds(songTitle(entry))},'Procurar variantes'));rows.push(row);
 }
 for(const entry of songs.rows){const row=html('article',{class:'sound-row'}),copy=html('div');copy.append(html('h3',{},entry.title),html('p',{},`${entry.artist} · MusicBrainz`));row.append(copy,html('button',{onclick:()=>findSongSounds(entry.title)},'Encontrar sons para esta música'));rows.push(row);}
 if(songs.error)rows.unshift(html('p',{role:'alert',class:'online-error'},songs.error));
 rows.unshift(html('p',{},'Pesquisa títulos e encontra Performances no Soundmondo sem sair da app. Os metadados da música não identificam os efeitos da gravação. Para criar uma variante, escolhe um som, lê o MODX e edita os efeitos abaixo.'));
 rows.push(html('button',{disabled:!state.current,onclick:()=>{openEditor(null);editorArea='reverb';renderEditor();}},state.current?`Criar variante de efeitos · ${state.current.name}`:'Lê um som para editar os seus efeitos'));
 $('sound-results').replaceChildren(...rows);
}
function renderSearch() {
  const source = $('sound-source').value, term = $('sound-filter').value.trim().toLocaleLowerCase('pt-PT');
  $('online-query').hidden=!['soundmondo','songs'].includes(source);
  if(source==='songs'){renderSongs();return;}
  if(source==='soundmondo'){renderOnline();return;}
  const entries = data[source].filter(e => `${e.name ?? e.nome} ${e.label ?? ''} ${e.sons ?? ''}`.toLocaleLowerCase('pt-PT').includes(term));
  $('results-title').textContent = source === 'user1' ? 'Os teus sons · User 1' : source === 'band' ? 'Repertório local' : 'Presets de fábrica';
  $('results-count').textContent = `${entries.length} ${entries.length === 1 ? 'som' : 'sons'}`;
  const rows = entries.slice(0, state.limit).map(e => {
    const row = html('article', { class: 'sound-row' }), copy = html('div');
    copy.append(html('h3', {}, e.name ?? e.nome));
    const detail = source === 'user1' ? `Posição ${e.slot} · ${e.parts.length} Parts${e.label ? ` · ${e.label}` : ''}${e.external_wave_banks.length ? ' · usa biblioteca instalada' : ''}` : source === 'band' ? e.sons : 'Som interno do MODX6+';
    copy.append(html('p', {}, detail));
    const button = html('button', { disabled: !connected(), onclick: () => choose(e, source === 'band') }, 'Abrir no teclado');
    row.append(copy, button); return row;
  });
  if (!rows.length) rows.push(html('p', { class: 'empty-state' }, 'Não encontrei esse nome na biblioteca local. Experimenta a pesquisa online.'));
  if (entries.length > state.limit) rows.push(html('button', { class: 'load-more', onclick: () => { state.limit += 80; renderSearch(); } }, 'Mostrar mais sons'));
  $('sound-results').replaceChildren(...rows);
}
async function onlineSearch(page=1) {
  const query=page===1?$('sound-filter').value.trim():online.query;
  online.controller?.abort();const controller=new AbortController(),request=++online.request;
  online.controller=controller;online.inspection=null;online.loading=true;online.error='';renderSearch();
  try {
    const result=await searchSounds(query,page,controller.signal);
    if(request!==online.request)return;
    online.results=page===1?result.results:[...online.results,...result.results];online.count=result.count;online.page=page;online.query=query;
  } catch(error){if(request===online.request&&error.name!=='AbortError')online.error=error.name==='TimeoutError'?'O Soundmondo demorou a responder. Tenta novamente.':error.message;}
  finally{if(request===online.request){online.loading=false;renderSearch();}}
}
async function onlineSound(entry,experiment) {
  if(online.detailBusy)return;online.detailBusy=true;renderSearch();
  try {
    const sound=await getSound(entry.id);
    if(experiment==='inspect'){const current=decodePerformance(parseMessages(sound.bytes)),summary=html('section',{class:'sound-inspection'});summary.append(html('h3',{},current.name));for(const part of current.parts)summary.append(html('p',{},`Part ${part.index+1} · ${part.name} · ${part.engine}`));summary.append(html('p',{},`Reverb: ${reverbTypes[reverbInfo(current)?.index]?.[0]??'Algoritmo não catalogado'}`));for(const target of [{label:'Variation',...effectTarget(null,'variation')},...current.parts.flatMap(p=>['insA','insB'].map(area=>({label:`Part ${p.index+1} · ${area}`, ...effectTarget(p.index,area)})))]){const info=blockInfo(current,effectCatalog,target);if(info)summary.append(html('p',{},`${target.label}: ${info.types[info.index]?.name??'Algoritmo não catalogado'}`));}online.inspection=summary;}
    else if(experiment){if(!connected())throw Error('Liga e lê o MODX antes de experimentar um som.');await audition(sound.bytes);}
    else {downloadSnapshot(sound.bytes,sound.name,false);notice('Performance validada e enviada para as transferências do browser.');}
  } catch(error){notice(error.name==='TimeoutError'?'O Soundmondo demorou a responder.':error.message,true);}
  finally{online.detailBusy=false;renderSearch();}
}
function renderOnline() {
  $('results-title').textContent='Soundmondo · MODX / MODX+';
  $('results-count').textContent=online.loading?'A pesquisar…':online.page?`${online.count} sons${online.query?` · «${online.query}»`:''}`:'Pesquisa direta';
  $('online-query').textContent=online.loading?'A pesquisar…':'Pesquisar Soundmondo';$('online-query').disabled=online.loading;
  const rows=online.results.map(entry=>{
    const row=html('article',{class:'sound-row online-sound-row'}),copy=html('div');
    copy.append(html('h3',{},entry.name),html('p',{},`${entry.author} · ${entry.instrument} · Soundmondo`));
    const details=html('details');details.append(html('summary',{},'Descrição'),html('p',{},entry.description||'O autor não forneceu uma descrição.'));copy.append(details);
    const actions=html('div',{class:'online-sound-actions'});
    actions.append(html('button',{disabled:online.detailBusy,onclick:()=>onlineSound(entry,'inspect')},'Ver Parts e efeitos'),html('button',{disabled:online.detailBusy,onclick:()=>onlineSound(entry,false)},'Descarregar .syx'),html('button',{disabled:online.detailBusy||!connected(),onclick:()=>onlineSound(entry,true)},'Experimentar no MODX'));
    row.append(copy,actions);return row;
  });
  if(online.inspection)rows.unshift(online.inspection);
  if(online.error)rows.unshift(html('p',{class:'online-error',role:'alert'},`${online.error} Tenta novamente sem sair da app.`));
  if(!rows.length)rows.push(html('p',{class:'empty-state'},online.page?'Não encontrei sons para esta pesquisa.':'Escreve um timbre ou tema e escolhe Pesquisar Soundmondo. Os resultados aparecem aqui, sem sair da app.'));
  if(online.results.length<online.count)rows.push(html('button',{disabled:online.loading,onclick:()=>onlineSearch(online.page+1)},'Mostrar mais 25 sons'));
  rows.push(html('p',{class:'muted online-limit'},'Dados públicos consultados a pedido. O download valida uma Performance MODX. Amostras de bibliotecas externas não estão incluídas. Experimentar substitui apenas a memória de edição, após confirmação.'));
  $('sound-results').replaceChildren(...rows);
}
async function audition(input) {
  const bytes=normalizePerformance(input),imported=decodePerformance(parseMessages(bytes));
  if(!await canReplace())return;
  if(!confirm(`Experimentar «${imported.name}» no teclado? Vai substituir o som na memória de edição. Os sons guardados não são alterados.`))return;
  await run(async()=>{state.dirty=true;accept(await midi.sendPerformance(bytes));view('performance');},'Som recebido na memória de edição. Usa Store no teclado se o quiseres guardar.');
}
function renderPhysical() {
  const p=state.current, panel=$('physical-panel');
  wheelResets.forEach(reset=>reset());wheelResets=[];assignResets.forEach(reset=>reset());assignResets=[];assignPaint=[null,null];
  const unavailable=label=>html('button',{disabled:true,title:'Sem comando USB validado nesta versão','aria-label':`${label}: indisponível por USB`},label);
  const group=title=>{const n=html('div',{class:'hardware-group'});n.append(html('h2',{},title));return n;};
  const banks=(key,labels)=>{
    const n=html('div',{class:'hardware-banks'});
    labels.forEach((label,i)=>n.append(html('button',{'aria-pressed':String(state[key]===i),onclick:()=>{state[key]=i;renderPhysical();}},label)));
    return n;
  };
  const wheels=group('MODX');wheels.classList.add('hardware-wheels');
  const target=html('select',{'aria-label':'Destino dos controlos MIDI',class:'wheel-target',disabled:state.busy});
  target.append(html('option',{value:''},'Parts com teclas'));
  for(const part of p?.parts??[])target.append(html('option',{value:String(part.index)},`Part ${part.index+1}`));
  target.value=wheelTarget===null?'':String(wheelTarget);target.addEventListener('change',()=>{wheelResets.forEach(reset=>reset());assignResets.forEach(reset=>reset());wheelTarget=target.value===''?null:Number(target.value);renderPhysical();});wheels.append(target);
  for(const [type,label,min,max,step] of [['pitch','Pitch bend',0,16383,128],['mod','Modulação',0,127,1]]) {
    const wrap=html('label',{class:'wheel-control',for:`wheel-${type}`});
    const output=html('output',{for:`wheel-${type}`},type==='pitch'?'0':String(wheelValues.mod));
    const input=html('input',{id:`wheel-${type}`,type:'range',min,max,step,value:wheelValues[type],'aria-label':label,disabled:!connected()||!(p&&wheelChannels(p.parts,midi.ioMode,midi.ioChannel,wheelTarget).length)});
    const paint=value=>{wheelValues[type]=value;output.textContent=String(type==='pitch'?value-8192:value);input.style.setProperty('--wheel-position',String((value-min)/(max-min)));};
    const reset=bindWheel(input,{spring:()=>type==='pitch'?8192:modSpring?0:null,paint,send:(value,channels)=>{
      if(state.current?.name!==p?.name && !(type==='pitch'&&value===8192) && !(type==='mod'&&value===0))throw Error('O teclado mudou de som. Confirma o destino das rodas.');
      const destinations=channels??wheelChannels(p.parts,midi.ioMode,midi.ioChannel,wheelTarget);
      if(!destinations.length)throw Error('Escolhe uma Part para as rodas.');
      midi.sendWheel(type,value,destinations);return destinations;
    }});wheelResets.push(reset);paint(wheelValues[type]);
    wrap.append(html('span',{},label),input,output);wheels.append(wrap);
  }
  const springLabel=html('label',{class:'wheel-spring'}),springInput=html('input',{type:'checkbox','aria-label':'Mola virtual na modulação'});springInput.checked=modSpring;
  springInput.addEventListener('change',()=>{wheelResets.forEach(reset=>reset());modSpring=springInput.checked;});springLabel.append(springInput,html('span',{},'Mola virtual na modulação'));wheels.append(springLabel);
  for(let index=0;index<2;index++){
    const common=p?.blocks.get('48:64:0'),cc=common?.[71+index],mode=common?.[61+index],key=JSON.stringify([p?.name,cc,mode]);
    if(assignRecords[index]?.key!==key)assignRecords[index]={key,values:new Map()};
    const record=assignRecords[index],routes=connected()&&p?wheelChannels(p.parts,midi.ioMode,midi.ioChannel,wheelTarget):[];
    const button=html('button',{'data-assign-switch':index,disabled:!connected()||!cc||!routes.length||![0,1].includes(mode)},`Assign ${index+1}`);
    const paint=()=>{const status=assignState(record.values,routes);button.setAttribute('aria-pressed',status.value===null?'mixed':String(status.value));button.dataset.stateSource=status.source;button.title=!cc?'Define um CC para este Assign em Editar parâmetros.':`CC ${cc} · ${mode===0?'momentâneo':'fixo'} · ${status.source==='received'?'estado recebido por MIDI':status.source==='sent'?'último comando enviado por MIDI':'estado ainda não recebido'}`;};
    assignPaint[index]=paint;paint();
    assignResets.push(bindAssign(button,{momentary:()=>mode===0,initial:assignState(record.values,routes).value,read:()=>assignState(record.values,routes).value,paint,send:(value,route)=>{
      if(value&&(state.current?.name!==p?.name||midi.current?.blocks.get('48:64:0')?.[71+index]!==cc))throw Error('O teclado mudou de som ou de CC. Confirma o Assign antes de o premir.');
      const channels=route??routes;midi.sendAssign(cc,value,channels);for(const channel of channels)record.values.set(channel,{value,source:'sent'});notice(`Assign ${index+1}: ${value?'ligado':'desligado'} enviado por MIDI.`);return channels;
    }}));wheels.append(button);
  }
  for(const [label,delta] of [['Octave −',-1],['Octave +',1]])wheels.append(html('button',{disabled:!connected(),onclick:()=>run(async()=>{const settings=await midi.readAux([0,0,0]);const next=Math.max(61,Math.min(67,settings[8]+delta));await midi.writeAux([0,0,8],[next]);},'Oitava confirmada pelo Yamaha.')},label));
  const controls=group('Knobs');controls.classList.add('hardware-controls');
  const mode=html('div',{class:'hardware-banks'});
  for(const [key,label] of [['assign','Assign'],['volume','Volumes · PWA']])mode.append(html('button',{'aria-pressed':String(state.knobMode===key),onclick:()=>{state.knobMode=key;state.knobBank=0;renderPhysical();}},label));
  controls.append(mode,banks('knobBank',state.knobMode==='assign'?['1–4','5–8']:['1–4','5–8','9–12','13–16']));
  const knobs=html('div',{class:'hardware-knobs'});
  for(let i=state.knobBank*4;i<state.knobBank*4+4;i++) {
    const volume=state.knobMode==='volume',part=p?.parts.find(n=>n.index===i),k=volume?(part?{name:`Volume ${i+1}`,value:part.volume}:null):p?.knobs[i];
    const wrap=html('div',{class:'hardware-knob'}),id=`physical-knob-${i}`,label=k?.name||`${volume?'Part':'Assign'} ${i+1}`;
    const art=html('span',{id:`knob-touch-${i}`,class:'knob-art',role:'slider',tabindex:k&&connected()?'0':'-1','aria-label':label,'aria-valuemin':0,'aria-valuemax':127,'aria-valuenow':k?.value??0,'aria-disabled':String(!k||!connected()),title:'Arrasta para cima ou para a direita para aumentar'});
    const image=html('img',{class:'dial-image',src:'assets/modx-knob.png',alt:'',draggable:'false',style:`transform:rotate(${-135+(k?.value??0)*270/127}deg)`});art.append(image);
    const commit=v=>{if(state.current?.name!==p?.name){notice('O teclado mudou de som. Volta a confirmar o controlo.',true);render();return;}return edit(volume?[49,i,36]:[48,64,83+i],v);};
    const slider=range(id,label,k?.value??0,0,127,commit,false,!k),input=slider.querySelector('input');
    bindKnob(art,input,value=>{image.style.transform=`rotate(${-135+value*270/127}deg)`;slider.querySelector('output').textContent=String(value);},commit);
    wrap.append(art,slider);knobs.append(wrap);
  }
  controls.append(knobs,html('h2',{},'Volume das Parts'),banks('faderBank',['1–4','5–8','9–12','13–16']));
  const faders=html('div',{class:'hardware-faders'});
  for(let i=state.faderBank*4;i<state.faderBank*4+4;i++) {
    const part=p?.parts.find(n=>n.index===i),wrap=html('div',{class:'hardware-fader'});
    wrap.append(html('span',{},`Part ${i+1}`),range(`physical-fader-${i}`,`Volume Part ${i+1}`,part?.volume??0,0,127,v=>edit([49,i,36],v),true,!part),html('span',{class:'muted'},part?.name||'Livre'));faders.append(wrap);
  }
  const sceneBank=html('div',{class:'hardware-banks'});sceneBank.append(html('button',{'aria-label':`Alternar banco de cenas, atual ${state.sceneBank?'5 a 8':'1 a 4'}`,onclick:()=>{state.sceneBank=1-state.sceneBank;renderPhysical();}},state.sceneBank?'5–8':'1–4'));
  controls.append(faders,html('h2',{},'Scene'),sceneBank);
  const scenes=html('div',{class:'hardware-scenes'});
  for(let i=state.sceneBank*4;i<state.sceneBank*4+4;i++)scenes.append(html('button',{'aria-pressed':String(p?.scene===i),disabled:!connected()||!midi.sceneCC,onclick:()=>run(async()=>{state.dirty=true;accept(await midi.selectScene(i));syncNeeded=true;},`Cena ${i+1} confirmada pelo MODX.`)},String(i+1)));
  controls.append(scenes);
  const superGroup=group('Super Knob');superGroup.classList.add('hardware-super');
  const superArt=html('span',{id:'super-knob-touch',class:'knob-art super-knob-touch',role:'slider',tabindex:connected()&&p?.superKnob!=null?'0':'-1','aria-label':'Super Knob','aria-valuemin':0,'aria-valuemax':127,'aria-valuenow':p?.superKnob??0,'aria-disabled':String(!connected()||p?.superKnob==null)});
  const superImage=html('img',{class:'dial-image',src:'assets/modx-knob.png',alt:'',draggable:'false',style:`transform:rotate(${-135+(p?.superKnob??0)*270/127}deg)`});superArt.append(superImage);
  const superCommit=value=>{if(state.current?.name!==p?.name){notice('O teclado mudou de som. Confirma o Super Knob.',true);render();return;}return edit([48,75,0],value);};
  const superRange=range('super-knob-value','Valor',p?.superKnob??0,0,127,superCommit,false,p?.superKnob==null);
  bindKnob(superArt,superRange.querySelector('input'),value=>{superImage.style.transform=`rotate(${-135+value*270/127}deg)`;superRange.querySelector('output').textContent=String(value);},superCommit);
  superGroup.append(superArt,superRange,toggle('physical-motion',p?.motion?'Motion Seq ligada':'Motion Seq desligada',!!p?.motion,value=>edit([48,72,0],Number(value)),p?.motion==null),html('button',{onclick:()=>{openEditor(null);editorArea='transport';renderEditor();}},'Transporte MIDI · PWA'));
  const screen=group(state.physicalScreen==='live'?'User 1 · biblioteca local':state.physicalScreen==='functions'?'Funções / Edit':'Performance / Home');screen.classList.add('hardware-screen');
  const screenBody=html('div',{class:'hardware-screen-body',tabindex:0,'aria-label':'Conteúdo do ecrã touch'});
  const tiles=html('div',{class:`hardware-tiles ${state.physicalScreen==='live'?'live-tiles':''}`});
  if(state.physicalScreen==='functions') {
    const destination=html('select',{'aria-label':'Destino das funções do touch'});
    destination.append(html('option',{value:''},'Performance · Geral'));
    for(const part of p?.parts??[])destination.append(html('option',{value:part.index},`Part ${part.index+1} · ${part.name}`));
    const list=html('div',{class:'hardware-function-list'});
    const paint=()=>{const part=destination.value===''?null:Number(destination.value);list.replaceChildren();
      for(const area of [{id:'part',label:'Geral'},...editorAreas(p,part)])list.append(html('button',{onclick:()=>{openEditor(part);editorArea=area.id;renderEditor();}},area.label));
    };
    destination.addEventListener('change',paint);paint();
    screenBody.append(destination,list,html('p',{},'Smart Morph e Waveform estão nos separadores do touch. A aprendizagem do mapa e a edição de amostras continuam no teclado.'));
  } else if(state.physicalScreen==='morph') {
    screen.querySelector('h2').textContent='Smart Morph · preparação';
    screenBody.append(html('p',{},'Fontes FM-X nas Parts 9–16; o resultado do mapa fica na Part 1. Os ficheiros disponíveis não expõem um mapa editável nem comandos Learn/Play validados. Não é uma simulação do mapa.'));
    const sources=smartMorphSources(p),result=p?.parts.find(part=>part.index===0);screenBody.append(html('p',{},`${sources.filter(source=>source.eligible).length} fontes FM-X elegíveis · Part 1: ${result?.engine??'sem leitura'}. A presença de um mapa não é identificada por esta lista.`));
    const workflow=html('details');workflow.append(html('summary',{},'Como criar o mapa no teclado'),html('p',{},'Home → Smart Morph → Edit: escolhe duas ou mais fontes FM-X nas Parts 9–16 e usa Learn. Em Play, toca no mapa para mudar a Part 1. Em Super Knob, define Link, Start e End. Job permite carregar ou apagar dados Smart Morph. Estes comandos ainda não são enviados pela PWA.'));screenBody.append(workflow,html('button',{onclick:()=>{$('sound-source').value='presets';$('sound-filter').value='Morph';renderSearch();view('search');}},'Pesquisar Performances Morph de fábrica'));
    const list=html('div',{class:'hardware-function-list'});
    for(const source of smartMorphSources(p))list.append(html('button',{disabled:!source.engine,onclick:()=>openEditor(source.index)},`Part ${source.index+1} · ${source.name} · ${source.eligible?'FM-X elegível':source.engine?'motor incompatível':'livre'}`));
    screenBody.append(list);
  } else if(state.physicalScreen==='waveform') {
    screen.querySelector('h2').textContent='Waveform · referências e edição';
    screenBody.append(html('button',{onclick:()=>{openEditor(null);editorArea='sample';renderEditor();}},'Abrir editor de amostras WAV'));
    screenBody.append(html('p',{},'Escolhe um Element ou tecla para editar banco, waveform e afinação no editor. Não inclui importação de áudio, loops ou keybanks de amostras User.'));
    const list=html('div',{class:'hardware-function-list'});
    for(const row of waveformUses(p))list.append(html('button',{onclick:()=>{openEditor(row.part);editorArea=row.engine==='DRUM'?'drum':'osc';editorUnit=row.unit;renderEditor();}},`Part ${row.part+1} · ${row.engine==='DRUM'?`Tecla ${row.unit+21}`:`Element ${row.unit+1}${row.active?'':' (Off)'}`} · banco ${row.bank} / ${row.number}`));
    if(!list.children.length)list.append(html('p',{},'Sem referências AWM2 ou Drum nesta leitura. FM-X não usa waveforms de amostras.'));
    screenBody.append(list);
  } else if(state.physicalScreen==='live') {
    state.touchRender=renderPhysical;
    mountLiveTouch({html,body:screenBody,screen,state,data,midi,current:p,connected,choose,
      changeBank:bank=>run(async()=>{await midi.selectLiveSetBank(bank);state.touchBank='hardware';state.touchPage=0;await readLiveTouchPage(midi,0);},'Banco confirmado pelo MODX.'),
      readPage:()=>run(async()=>{await readLiveTouchPage(midi,state.touchPage);state.touchBank='hardware';},'Página Live Set lida do MODX.'),
      selectSlot:async(slot,entry)=>{if(!connected()||!await canReplace())return;const page=state.touchPage,bank=midi.liveSetBank;await run(async()=>{if(bank===null||await midi.readLiveSetBank()!==bank)throw Error('O banco Live Set mudou. Volta a ler a página.');const address=livePageAddresses(page)[slot+2],cached=midi.auxBlocks.get(address.join(':'))?.slice();await midi.readAux(address);const currentEntry=midi.auxBlocks.get(address.join(':'));if(!cached||!currentEntry||!sameDump(cached,currentEntry)||currentEntry[25]!==1)throw Error('Posição sem leitura válida.');accept(await midi.selectPerformance({msb:62,lsb:page,program:slot}));state.dirty=false;},'Performance chamada e lida do teclado.');},
      editPage:()=>{openEditor(null);editorArea='liveSet';editorUnit=state.touchPage;renderEditor();},search:()=>view('search')});
  } else {
    for(let i=0;i<8;i++){const part=p?.parts.find(n=>n.index===i),tile=html('div',{class:'hardware-tile'});if(part){tile.setAttribute('role','button');tile.tabIndex=0;tile.addEventListener('click',()=>openEditor(i));tile.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openEditor(i);}});}tile.append(html('strong',{},`${i+1}. ${part?.name||'Livre'}`),html('span',{},part?`${part.engine} · ${part.volume}`:'Sem Part'));tiles.append(tile);}
  }
  if(state.physicalScreen==='home')screenBody.append(tiles);
  if(p&&state.physicalScreen==='home')screenBody.append(range('physical-volume','Volume da Performance',p.volume,0,127,v=>edit([48,64,56],v)));
  const shortcuts=html('div',{class:'hardware-touch-tabs','aria-label':'Páginas do touch'});
  for(const [key,label] of [['home','Home'],['live','Live Set'],['functions','Funções'],['morph','Smart Morph'],['waveform','Waveform']])shortcuts.append(html('button',{'aria-pressed':String(state.physicalScreen===key),onclick:()=>{state.physicalScreen=key;renderPhysical();}},label));
  screen.append(shortcuts,screenBody);
  if(state.physicalScreen!=='live')screen.append(touchActivePerformance(html,p,()=>view('search')));
  const nav=group('Navegação na PWA');nav.classList.add('hardware-nav');
  for(const [label,target] of [['Home','home'],['Live Set','live'],['Funções','functions']])nav.append(html('button',{'aria-pressed':String(state.physicalScreen===target),onclick:()=>{state.physicalScreen=target;renderPhysical();}},label));
  nav.append(html('button',{onclick:()=>view('search'),title:'Abrir pesquisa de sons na PWA'},'Category'),html('button',{onclick:()=>{openEditor(null);editorArea='reverb';renderEditor();}},'Efeitos'));
  nav.append(html('button',{onclick:()=>{if(!editorOpen||!$('editor-data-dial'))openEditor(editorPart);const dial=$('editor-data-dial');dial?.closest('.editor-dial-tools')?.scrollIntoView({block:'nearest'});dial?.focus();}},'Data dial'),html('button',{onclick:()=>{openEditor(null);editorArea='system';renderEditor();}},'Utility'),html('button',{onclick:()=>openEditor(null)},'Edit'),unavailable('Store'),unavailable('Shift'));
  panel.replaceChildren(wheels,controls,superGroup,screen,nav);
}
function render() { renderEditor(); renderPhysical(); readStatus(); renderPerformance(); renderLive(); renderEffects(); renderSearch(); }
function view(name) {
  if(name==='performance') name=state.layout;
  state.view = name;
  document.querySelectorAll('.view').forEach(n => n.hidden = n.id !== `view-${name}`);
  document.querySelectorAll('[data-view]').forEach(n => { const active = n.dataset.view === (name==='physical'?'performance':name); n.classList.toggle('active', active); n.setAttribute('aria-current', active ? 'page' : 'false'); });
  $('layout-performance').setAttribute('aria-pressed',String(state.layout==='performance'));
  $('layout-physical').setAttribute('aria-pressed',String(state.layout==='physical'));
  document.body.classList.toggle('physical-layout',name==='physical');
  history.replaceState(null, '', `#${name}`);
}
function downloadSnapshot(bytes=midi.lastDump,name=state.current?.name,clearDirty=true) {
  if (!bytes) throw new Error('Lê uma Performance antes de guardar uma cópia.');
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a = html('a', { href: url, download: `${(name || 'MODX').replace(/[^\p{L}\p{N} _.-]/gu, '')}.syx` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  if(clearDirty) state.dirty = false;
}
async function canReplace() {
  if (!state.dirty) return true;
  const dialog = $('unsaved'); dialog.returnValue = 'cancel';
  const answer = new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
  dialog.showModal();
  const choice = await answer;
  if (choice === 'save') downloadSnapshot();
  if (choice === 'discard') state.dirty = false;
  return choice !== 'cancel';
}
async function choose(entry, live = false) {
  if (!connected() || !await canReplace()) return;
  await run(async () => {
    accept(await midi.selectPerformance(reference(entry, live)));
    state.dirty = false; state.partPage = 0; view('performance');
  }, 'Performance chamada e lida do teclado.');
}
for(const layout of ['performance','physical']) $('layout-'+layout).addEventListener('click',()=>{state.layout=layout;view('performance');render();});
$('connect').addEventListener('click', () => {
  if (state.connected) {
    wheelResets.forEach(reset=>reset());assignResets.forEach(reset=>reset());midi.disconnect(); state.connected = false; render(); notice('Ligação terminada. O som no Yamaha mantém-se.'); return;
  }
  run(async () => { accept(await midi.connect()); state.connected = true;await midi.readLiveSetBank(); }, 'MODX identificado. O painel mostra os dados recebidos do teclado.');
});
$('refresh').addEventListener('click', () => run(async () => accept(await midi.readPerformance()), 'Leitura atualizada.'));
$('save').addEventListener('click', () => { try { downloadSnapshot(); render(); notice('Cópia enviada para as transferências do browser. Confirma que guardaste o ficheiro.'); } catch (error) { notice(error.message, true); } });
$('save-previous').addEventListener('click',()=>{
  const previous=state.recoveries[0];
  if(!previous)return;
  downloadSnapshot(previous.bytes,previous.name,false);state.recoveries.shift();render();
  notice('A edição anterior foi enviada para as transferências do browser.');
});
$('import').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async () => {
  const file = $('file').files[0]; $('file').value = '';
  if (!file || !connected()) return;
  try {
    if (file.size > 2_000_000) throw new Error('O ficheiro excede o tamanho permitido para uma Performance.');
    await audition(new Uint8Array(await file.arrayBuffer()));
  } catch (error) { notice(error.message, true); }
});
document.querySelectorAll('[data-view]').forEach(n => n.addEventListener('click', () => view(n.dataset.view)));
document.querySelectorAll('[data-page]').forEach(n => n.addEventListener('click', () => { state.livePage = Number(n.dataset.page); renderLive(); }));
$('parts-first').addEventListener('click', () => { state.partPage = 0; renderPerformance(); });
$('parts-second').addEventListener('click', () => { state.partPage = 1; renderPerformance(); });
$('live-filter').addEventListener('input', renderLive);
$('sound-filter').addEventListener('input', () => { state.limit = 80; renderSearch(); });
$('sound-source').addEventListener('change', () => { state.limit = 80; renderSearch(); });
$('online-query').addEventListener('click',()=>$('sound-source').value==='songs'?searchMusic():onlineSearch());
$('sound-filter').addEventListener('keydown',event=>{if(event.key==='Enter'&&['soundmondo','songs'].includes($('sound-source').value)){event.preventDefault();$('sound-source').value==='songs'?searchMusic():onlineSearch();}});
midi.addEventListener('disconnect', () => { state.connected = false; render(); notice('A ligação ao MODX foi interrompida. Volta a ligar antes de enviar alterações.', true); });
const clearAssignState=()=>{assignRecords.forEach(r=>r?.values.clear());assignPaint.forEach(paint=>paint?.());};
midi.addEventListener('selection',clearAssignState);
midi.addEventListener('changed',()=>{if(state.connected){if(!midi.confirmed)clearAssignState();syncNeeded=true;scheduleAuto(300);if(!midi.confirmed)render();else readStatus();}});
midi.addEventListener('updated',()=>{if(!state.connected)return;const previous=state.current;accept(midi.current);if(dragging)pendingRender=true;else{const next=changedView(previous,state.current);if(next)view(next);render();}});
const pointerGestures=new Set(),keyGestures=new Set();
function finishDrag(){dragging=false;if(pendingRender){pendingRender=false;render();}scheduleAuto(200);}
function finishGesture(){dragging=pointerGestures.size>0||keyGestures.size>0;if(!dragging)finishDrag();}
function cancelGestures(){dataDialCancel();wheelResets.forEach(reset=>reset());assignResets.forEach(reset=>reset());pointerGestures.clear();keyGestures.clear();finishDrag();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGestures();else scheduleAuto(100);});
window.addEventListener('blur',cancelGestures);
window.addEventListener('pagehide',cancelGestures);
document.addEventListener('assignerror',event=>notice(event.detail.message,true));
document.addEventListener('wheelerror',event=>notice(event.detail.message,true));
midi.addEventListener('wheel',event=>{const {type,value}=event.detail;wheelValues[type]=value;const input=$('wheel-'+type);if(input&&!dragging){input.value=String(value);input.style.setProperty('--wheel-position',String(value/(type==='pitch'?16383:127)));const out=input.parentElement.querySelector('output');out.textContent=String(type==='pitch'?value-8192:value);}});
document.addEventListener('pointerdown',event=>{if(event.target.matches('input[type="range"]') || event.target.closest('.knob-art') || event.target.closest('[data-assign-switch]')){pointerGestures.add(event.pointerId);dragging=true;}});
document.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)&&event.target.closest('[data-assign-switch]')&&!event.target.disabled){keyGestures.add(event.code||event.key);dragging=true;}});
document.addEventListener('keyup',event=>{if(keyGestures.delete(event.code||event.key))finishGesture();});
for(const eventName of ['pointerup','pointercancel'])document.addEventListener(eventName,event=>{pointerGestures.delete(event.pointerId);finishGesture();});
window.addEventListener('beforeunload', event => { if (state.dirty || state.recoveries.length) { event.preventDefault(); event.returnValue = ''; } });
document.querySelectorAll('[data-fullscreen]').forEach(button=>button.addEventListener('click',async()=>{
  try{
    if(document.fullscreenElement){await document.exitFullscreen();return;}
    if(!document.documentElement.requestFullscreen)throw Error('Usa a opção de ecrã inteiro do navegador e roda o dispositivo.');
    await document.documentElement.requestFullscreen();
    try{await screen.orientation?.lock?.('landscape');}catch{/* Some browsers require the device to be rotated manually. */}
  }catch(error){notice(error.message,true);}
}));
document.addEventListener('fullscreenchange',()=>document.querySelectorAll('[data-fullscreen]').forEach(button=>button.setAttribute('aria-pressed',String(!!document.fullscreenElement))));
let installPrompt;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = false; });
$('install').addEventListener('click', async () => { if (installPrompt) { await installPrompt.prompt(); installPrompt = null; $('install').hidden = true; } });

if(location.hash==='#physical')state.layout='physical';
view(['performance', 'physical', 'live', 'effects', 'search'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'performance');
render();

function transportText(){
 const status=midi.transportState;if(!status)return 'Estado do transporte desconhecido';
 return `Último comando: ${{start:'Iniciar',continue:'Continuar',stop:'Parar'}[status.command]} · ${status.source==='received'?'recebido do Yamaha':'enviado por MIDI'}`;
}
function renderTransport(panel){
 panel.append(html('p',{class:'muted'},'Controla o sequenciador com os comandos MIDI Start, Continue e Stop. Para iniciar ou continuar, Receive Sequencer Control deve estar ligado no Yamaha.'));
 const actions=html('div',{class:'actions'});
 for(const [command,label] of [['start','Iniciar'],['continue','Continuar'],['stop','Parar']])actions.append(html('button',{disabled:command==='stop'?!midi.output||midi.output.state!=='connected':!connected(),onclick:async()=>{
  if(command==='stop'){try{await midi.sendTransport(command);notice('Parar enviado por MIDI.');}catch(error){notice(error.message,true);}}
  else await run(()=>midi.sendTransport(command),'Comando enviado por MIDI. O estado não é confirmado por leitura.');
 }},label));
 panel.append(actions,html('p',{id:'transport-status',role:'status','aria-live':'polite',class:'muted'},transportText()),html('button',{onclick:()=>{editorArea='seqsystem';editorUnit=0;renderEditor();}},'Definições de sincronização'));
}
midi.addEventListener('transport',()=>{const status=$('transport-status');if(status)status.textContent=transportText();});
function renderUnitCopy(panel,current){
 const part=current.parts.find(p=>p.index===editorPart),count=part.engine==='DRUM'?73:8,label=part.engine==='DRUM'?'Tecla':part.engine==='FM-X'?'Operador':'Element';
 const unitName=unit=>part.engine==='DRUM'?note(unit+24):`${label} ${unit+1}`;
 const parts=current.parts.filter(p=>p.engine===part.engine);
 if(!parts.some(p=>p.index===unitCopyTarget.part))unitCopyTarget.part=part.index;
 if(unitCopyTarget.unit>=count)unitCopyTarget.unit=1;
 const fields=html('div',{class:'editor-fields'});
 const units=(name,value,change)=>{const select=html('select',{'aria-label':name,disabled:!connected()});for(let i=0;i<count;i++)select.append(html('option',{value:i},unitName(i)));select.value=String(value);select.addEventListener('change',()=>change(Number(select.value)));const wrap=html('label',{},name);wrap.append(select);fields.append(wrap);return select;};
 const source=units('Unidade de origem',editorUnit,value=>{editorUnit=value;});
 const targetPart=html('select',{'aria-label':'Part de destino',disabled:!connected()});for(const p of parts)targetPart.append(html('option',{value:p.index},`Part ${p.index+1} · ${p.name}`));targetPart.value=String(unitCopyTarget.part);targetPart.addEventListener('change',()=>{unitCopyTarget.part=Number(targetPart.value);});const wrap=html('label',{},'Part de destino');wrap.append(targetPart);fields.append(wrap);
 const target=units('Unidade de destino',unitCopyTarget.unit,value=>{unitCopyTarget.unit=value;});
 const operation=html('select',{'aria-label':'Operação',disabled:!connected()});operation.append(html('option',{value:'copy'},'Copiar'),html('option',{value:'exchange'},'Trocar'));operation.value=unitCopyTarget.exchange?'exchange':'copy';operation.addEventListener('change',()=>{unitCopyTarget.exchange=operation.value==='exchange';});const mode=html('label',{},'Operação');mode.append(operation);fields.append(mode);
 panel.append(html('p',{class:'muted'},'Copia os dados de síntese da unidade. As atribuições comuns dos controladores continuam na respetiva Part. A versão anterior fica disponível para recuperação. Usa esta operação numa pausa, sem teclas ou sustain.'),fields);
 panel.append(html('button',{disabled:!connected(),onclick:async()=>{
  if(!connected())return;
  try{
   const from={part:part.index,unit:Number(source.value)},to={part:Number(targetPart.value),unit:Number(target.value)},exchange=operation.value==='exchange',reference=midi.lastDump?.slice();
   if(!reference)throw Error('Lê a Performance antes de copiar.');
   const bytes=copyUnit(reference,from,to,exchange),verb=exchange?'Trocar':'Copiar';
   if(!confirm(`${verb} ${unitName(from.unit)} da Part ${from.part+1} ${exchange?'com':'para'} ${unitName(to.unit)} da Part ${to.part+1}? A operação altera a memória de edição. Store continua no teclado.`))return;
   await run(async()=>{
    if(!midi.quietForBulk())throw Error('Larga as teclas e o sustain e aguarda uma pausa antes de copiar.');
    state.recoveries.push({name:state.current.name,bytes:reference.slice()});downloadSnapshot(reference,`${state.current.name}-antes-${exchange?'troca':'copia'}`,false);
    accept(await midi.readPerformance());
    if(!sameDump(normalizePerformance(reference),normalizePerformance(midi.lastDump)))throw Error('A Performance mudou entretanto. Revê a leitura e volta a preparar a operação.');
    if(!midi.quietForBulk())throw Error('Foram recebidas notas. Repete a operação numa pausa.');
    state.dirty=true;accept(await midi.sendPerformance(bytes));
   },'Operação confirmada pela leitura completa. Usa Store no teclado para guardar.');
  }catch(error){notice(error.message,true);}
 }},'Aplicar operação'));
}
function editorAreas(current,part){
 if(!current)return [];
 return part===null?[{id:'reverb',label:'Reverb · algoritmo e parâmetros'},...commonEffectAreas,...commonAreas,...sequenceAreas(null),...controlAreas(null),...partAudioAreas(current,null),...systemAreas]:[...partAudioAreas(current,part),...controlAreas(part),...sequenceAreas(part),...synthesisAreas(current.parts.find(p=>p.index===part)),...partEffectAreas];
}
function openEditor(part){editorDialKey=null;editorPart=part;editorSection='all';editorArea='part';editorUnit=0;editorOpen=true;renderEditor();$('parameter-editor').scrollIntoView({block:'nearest'});}
function renderEditor(){
 disposeSamplePreview();
 dataDialCancel();dataDialCancel=()=>{};
 const panel=$('parameter-editor');if(!panel)return;panel.hidden=!editorOpen;if(!editorOpen)return;
 const current=state.current;
 const head=html('div',{class:'editor-heading'});head.append(html('h2',{},editorArea==='sample'?'Preparar amostra WAV':'Editar no MODX'),html('button',{onclick:()=>{editorOpen=false;renderEditor();}},'Fechar editor'));
 const select=html('select',{'aria-label':'Área a editar'});select.append(html('option',{value:'common'},'Performance · Geral'));
 for(const part of current?.parts??[])select.append(html('option',{value:part.index},`Part ${part.index+1} · ${part.name}`));
 select.value=editorPart===null?'common':String(editorPart);select.addEventListener('change',()=>{editorPart=select.value==='common'?null:Number(select.value);editorArea='part';editorUnit=0;renderEditor();});
 panel.replaceChildren(head,select);
 const samples=html('button',{onclick:()=>{editorPart=null;editorArea='sample';renderEditor();}},'Amostras WAV · editor local');panel.append(samples);
 if(editorArea==='sample'){mountSampleEditor(panel,{html,notice});return;}
 if(!current){panel.append(html('p',{},'Liga e lê o MODX para abrir os parâmetros reais.'));return;}
 panel.append(html('p',{class:'muted'},'As alterações são confirmadas pelo teclado. Para guardar permanentemente, usa Store no MODX.'));
 if(editorPart!==null&&!current.parts.some(p=>p.index===editorPart)){editorPart=null;editorArea='part';editorUnit=0;}
 const areas=editorAreas(current,editorPart);
 if(editorArea!=='part'&&!areas.some(a=>a.id===editorArea)){editorArea='part';editorUnit=0;}
 const areaSelect=html('select',{'aria-label':'Secção da Part'});areaSelect.append(html('option',{value:'part'},editorPart===null?'Geral':'Part · Geral'));
 for(const area of areas)areaSelect.append(html('option',{value:area.id},area.label));
 areaSelect.value=editorArea;areaSelect.addEventListener('change',()=>{editorArea=areaSelect.value;editorSection='all';editorUnit=0;renderEditor();});panel.append(areaSelect);
 const functions=synthesisSections(editorArea);
 if(functions.length){
  if(editorSection!=='all'&&!functions.some(f=>f.id===editorSection))editorSection='all';
  const pages=html('select',{'aria-label':'Função de síntese'});
  pages.append(html('option',{value:'all'},'Todas as funções desta área'));
  for(const entry of functions)pages.append(html('option',{value:entry.id},entry.label));
  pages.value=editorSection;pages.addEventListener('change',()=>{editorSection=pages.value;renderEditor();});panel.append(pages);
 }
 if(editorArea==='transport'){renderTransport(panel);return;}
 if(editorArea==='unitCopy'){renderUnitCopy(panel,current);return;}
 if(editorPart!==null&&(['part','partarp','zone'].includes(editorArea)||(editorArea==='osc'&&['all','oscTune'].includes(editorSection))))panel.append(html('p',{class:'muted'},'Nos limites de nota e velocidade, um valor inicial acima do final seleciona duas zonas exteriores.'));
 if(editorArea==='assign'){const sets=html('select',{'aria-label':'Atribuição de controlador'});for(let i=0;i<16;i++)sets.append(html('option',{value:i},`Atribuição ${i+1}`));sets.value=String(editorSet);sets.addEventListener('change',()=>{editorSet=Number(sets.value);renderEditor();});panel.append(sets);}
 if(editorArea==='laneSettings'){const lanes=html('select',{'aria-label':'Lane a configurar'});for(let i=0;i<4;i++)lanes.append(html('option',{value:i},`Lane ${i+1}`));lanes.value=String(editorLane);lanes.addEventListener('change',()=>{editorLane=Number(lanes.value);renderEditor();});panel.append(lanes);}
 if(editorArea==='scene'){const scenes=html('select',{'aria-label':'Cena a editar'});for(let i=0;i<8;i++)scenes.append(html('option',{value:i},`Cena ${i+1}`));scenes.value=String(editorUnit);scenes.addEventListener('change',()=>{editorUnit=Number(scenes.value);renderEditor();});panel.append(scenes);}
 if(['msseq','skseq'].includes(editorArea)){for(const [key,count,label] of [['lane',4,'Lane'],['seq',8,'Sequência']]){if(key==='lane'&&editorArea==='skseq')continue;const choice=html('select',{'aria-label':label});for(let i=0;i<count;i++)choice.append(html('option',{value:i},`${label} ${i+1}`));choice.value=String(key==='lane'?editorLane:editorSeq);choice.addEventListener('change',()=>{if(key==='lane')editorLane=Number(choice.value);else editorSeq=Number(choice.value);renderEditor();});panel.append(choice);}}
 if(['osc','filter','op','drum','routes'].includes(editorArea)){
  const operatorUnit=editorArea==='op'||(editorArea==='routes'&&current.parts.find(p=>p.index===editorPart)?.engine==='FM-X');
  const units=html('select',{'aria-label':editorArea==='drum'?'Tecla de bateria':operatorUnit?'Operador':'Elemento'});
  for(let i=0;i<(editorArea==='drum'?73:8);i++)units.append(html('option',{value:i},editorArea==='drum'?`${note(i+24)} · MIDI ${i+24}`:`${operatorUnit?'Operador':'Elemento'} ${i+1}`));
  units.value=String(editorUnit);units.addEventListener('change',()=>{editorUnit=Number(units.value);renderEditor();});panel.append(units);
 }
 const fields=html('div',{class:'editor-fields'});
 if(editorArea==='reverb'){
  const type=html('select',{'aria-label':'Algoritmo Reverb',disabled:!connected()});
  reverbTypes.forEach(([name],i)=>type.append(html('option',{value:i},name)));type.value=String(reverbInfo(current)?.index??-1);
  const applyType=html('button',{disabled:!connected(),onclick:()=>{
   if(!confirm('Mudar o algoritmo altera o efeito e pode inicializar os seus parâmetros. Continuar?'))return;
   const selected=reverbTypes[Number(type.value)];if(!selected)return;
   if(!midi.quietForBulk()){notice('Muda o algoritmo numa pausa, depois de largar as teclas e o sustain.',true);return;}
   run(async()=>{state.dirty=true;await midi.writeParameter([48,65,0],selected.slice(1));accept(await midi.readPerformance());},'Algoritmo Reverb confirmado e parâmetros relidos.');
  }},'Mudar algoritmo');panel.append(type,applyType);
 }
 const target=effectTarget(editorPart,editorArea);
 if(target){
  const info=blockInfo(current,effectCatalog,target);
  if(info){
   const chooser=html('select',{'aria-label':'Algoritmo do efeito',disabled:!connected()});
   info.types.forEach((t,i)=>chooser.append(html('option',{value:i},t.name)));chooser.value=String(info.index);
   panel.append(chooser,html('button',{disabled:!connected(),onclick:()=>{
    const selected=info.types[Number(chooser.value)];if(!selected)return;
    if(!confirm('Mudar o algoritmo pode inicializar os seus parâmetros. Continuar?'))return;
    if(!midi.quietForBulk()){notice('Muda o algoritmo numa pausa, depois de largar as teclas e o sustain.',true);return;}
    run(async()=>{state.dirty=true;await midi.writeParameter([...target.base,0],[selected.msb,selected.lsb]);accept(await midi.readPerformance());},'Algoritmo confirmado e parâmetros relidos.');
   }},'Mudar algoritmo'));
   panel.append(html('p',{class:'muted'},'Parâmetros mapeados da tabela Yamaha. Valores e opções das tabelas Yamaha 1–64 apresentados com nomes e unidades. Os restantes valores continuam identificados como índices.'));
  }
 }
 const utility=editorPart===null&&systemAreas.some(a=>a.id===editorArea);
 if(utility){
  const targets=systemTargets(editorArea,editorUnit,editorLiveSlot),count=systemAreas.find(a=>a.id===editorArea)?.count;
  if(count){const tables=html('select',{'aria-label':editorArea==='liveSet'?'Página Live Set':'Tabela User'});for(let i=0;i<count;i++)tables.append(html('option',{value:i},editorArea==='liveSet'?`Página ${i+1}`:`User ${i+1}`));tables.value=String(editorUnit);tables.addEventListener('change',()=>{editorUnit=Number(tables.value);renderEditor();});panel.append(tables);}
  if(editorArea==='liveSet'){const slots=html('select',{'aria-label':'Posição Live Set'});for(let i=0;i<16;i++)slots.append(html('option',{value:i},`Posição ${i+1}`));slots.value=String(editorLiveSlot);slots.addEventListener('change',()=>{editorLiveSlot=Number(slots.value);renderEditor();});panel.append(slots,html('p',{class:'muted'},'Abre o banco pretendido no teclado e usa Ler Live Set. Só os bancos User confirmados podem ser editados. Guarda uma cópia antes de editar.'));
  }
  if(editorArea==='liveSet')panel.append(html('p',{class:'muted'},midi.liveSetBank===null?'Banco Live Set por identificar':midi.liveSetBank===0?'Banco Preset · só leitura':midi.liveSetBank<=8?`Banco User ${midi.liveSetBank} confirmado`:`Banco Library ${midi.liveSetBank-8} · só leitura`));
  panel.append(html('p',{class:'muted'},editorArea==='liveSet'?'Os dados Live Set são separados da cópia da Performance.':'Definições globais do Yamaha. São separadas da Performance e podem afetar o áudio e o encaminhamento MIDI.'));
  panel.append(html('button',{disabled:!connected(),onclick:()=>run(async()=>{if(editorArea==='liveSet')await midi.readLiveSetBank();for(const address of targets)await midi.readAux(address);},'Utility lida do Yamaha.')},editorArea==='liveSet'?'Ler Live Set':'Ler Utility'));
  const stored=targets.length&&targets.every(a=>midi.auxBlocks.has(a.join(':')));
  if(stored)panel.append(html('button',{onclick:()=>downloadSnapshot(joinBytes(targets.map(a=>bulkMessage(a,midi.auxBlocks.get(a.join(':'))))),`MODX-Utility-${editorArea}-${editorUnit+1}`,false)},editorArea==='liveSet'?'Guardar cópia Live Set .syx':'Guardar cópia Utility .syx'));
 }
 const expectedLiveBank=midi.liveSetBank;
 const utilityFields=utility?userSystemFields(midi.auxBlocks,editorArea,editorUnit,editorLiveSlot).map(f=>editorArea==='liveSet'&&!(Number.isInteger(expectedLiveBank)&&expectedLiveBank>=1&&expectedLiveBank<=8)?{...f,readOnly:true}:f):[];
 const fieldCurrent=utility?{blocks:midi.auxBlocks}:current;
 const liveContext=utility&&editorArea==='liveSet'?systemTargets(editorArea,editorUnit,editorLiveSlot).map(address=>({address,bytes:midi.auxBlocks.get(address.join(':'))?.slice()})):null;
 const audioFields=partAudioFields(current,editorPart,editorArea);
 const assignmentFields=controlFields(current,editorPart,editorArea,{lane:editorLane,set:editorSet});
 const advancedFields=sequenceFields(current,editorPart,editorArea,{unit:editorUnit,lane:editorLane,seq:editorSeq});
 const commonFields=editorPart===null?commonEditorFields(current,editorArea):[];
 const available=utility?utilityFields:audioFields.length?audioFields:assignmentFields.length?assignmentFields:advancedFields.length?advancedFields:commonFields.length?commonFields:target?blockFields(current,effectCatalog,target):editorArea==='part'?fieldsFor(current,editorPart):editorArea==='reverb'?reverbFields(current,effectCatalog):synthesisSectionFields(synthesisFields(current,editorPart,editorArea,editorUnit),editorArea,editorSection);
 const dialEntries=[];let paintDataDial=()=>{};
 for(const original of available){
  const field=controlChoiceField(original,editorPart===null?'COMMON':current.parts.find(p=>p.index===editorPart)?.engine,controlNames);
  const expectedBlock=fieldCurrent.blocks.get(`${field.address[0]}:${field.address[1]}:0`)?.slice();
  const label=html('label',field.disabledReason?{title:field.disabledReason}:{},field.label),input=field.choiceNames||field.choices||field.catalog?html('select',{disabled:!connected()||field.readOnly,'aria-label':field.label}):html('input',{type:field.text?'text':'number',...(field.text?{maxlength:field.text}:{min:field.min,max:field.max,step:1}),value:field.value,disabled:!connected()||field.readOnly,'aria-label':field.label});
  if(field.choiceNames){for(let i=field.min;i<=field.max;i++){if(field.allowed&&!field.allowed.includes(i))continue;const name=controlNames[field.choiceNames]?.[String(i)];input.append(html('option',{value:i,disabled:name?.toLowerCase()==='reserved'},`${i} · ${name||'Não identificado na lista'}`));}if(field.allowed&&!field.allowed.includes(field.value))input.append(html('option',{value:field.value,disabled:true},`${field.value} · valor atual indisponível neste motor`));input.value=String(field.value);} 
  let lookup;
  if(field.choices){for(const [value,name] of field.choices)input.append(html('option',{value},name));if(!field.choices.some(([value])=>value===field.value))input.append(html('option',{value:field.value,disabled:true},`${field.value} · valor atual fora da lista`));input.value=String(field.value);}
  if(field.catalog){
   lookup=html('input',{type:'search',placeholder:'Pesquisar nome, categoria ou número','aria-label':`Pesquisar ${field.label}`,disabled:!connected()});
   const fill=()=>{const value=input.value===''?field.value:Number(input.value),rows=searchFactory(factoryCatalog[field.catalog],lookup.value,{...field,value});input.replaceChildren(...rows.map(([id,name,category])=>html('option',{value:id},`${id} · ${name}${category?' · '+category:''}`)));if(!rows.some(r=>r[0]===value))input.prepend(html('option',{value,disabled:true},`${value} · valor atual`));input.value=String(value);};
   fill();lookup.addEventListener('input',fill);
  }
  const apply=html('button',{disabled:!connected()||field.readOnly,onclick:async()=>{try{if(input.value===''||!input.checkValidity())throw Error(field.text?'Escreve um nome sem acentos.':'Introduz um valor inteiro dentro do intervalo apresentado.');const requested=field.text?input.value:Number(input.value);if(utility){await run(async()=>{if(liveContext){const bank=await midi.readLiveSetBank();if(bank!==expectedLiveBank||bank<1||bank>8)throw Error('O banco Live Set mudou ou não é User. Usa Ler Live Set e revê os dados.');for(const entry of liveContext)await midi.readAux(entry.address);for(const entry of liveContext){const now=midi.auxBlocks.get(entry.address.join(':'));if(!entry.bytes||!now||entry.bytes.length!==now.length||entry.bytes.some((v,i)=>v!==now[i]))throw Error('O banco, página ou posição Live Set mudou. Revê a leitura e volta a aplicar.');}}else await midi.readAux([field.address[0],field.address[1],0]);const bytes=checkedEditorValue({blocks:midi.auxBlocks},field,requested,expectedBlock);if(field.text)await midi.writeAuxText(field.address,bytes);else await midi.writeAux(field.address,Array.isArray(bytes)?bytes:[bytes]);},'Definição Utility confirmada pelo Yamaha.');}else {
    const base=field.address.slice(0,2),offset=field.address[2];
    const before=[...(field.bit!==undefined?[[...field.address,1]]:field.waveBankOffset!==undefined?[[...base,field.waveBankOffset,2]]:field.curveBank?[[...base,offset+1,1]]:[]),...(field.readBefore??[]).map(n=>[...base,...(Array.isArray(n)?n:[n,1])]),...(field.readBeforeAddresses??[])];
    const after=field.waveBankOffset!==undefined?[[...base,field.waveBankOffset,2]]:(field.readAfter??(field.curveBank?[offset+1,offset+2,offset+3]:[])).map(n=>[...base,...(Array.isArray(n)?n:[n,1])]);
    await edit(field.address,latest=>checkedEditorValue(latest,field,requested,expectedBlock),before,after,!!field.text);
   }}catch(error){notice(error.message,true);}}},'Aplicar');
  if(!field.text&&!field.readOnly){
   const entry={key:field.address.join(':')+':'+(field.bit??''),label:field.label,allowed:field.allowed,input,apply};dialEntries.push(entry);
   input.addEventListener('focus',()=>{editorDialKey=entry.key;paintDataDial();});
   for(const name of ['input','change'])input.addEventListener(name,()=>{if(editorDialKey===entry.key)paintDataDial();});
  }
  if(lookup)label.append(lookup);label.append(input,apply);
  const explanation=(field.readOnly&&field.disabledReason)||field.help;
  if(explanation){const id='field-help-'+field.address.join('-')+'-'+(field.bit??0);input.setAttribute('aria-describedby',id);label.append(html('small',{id,class:'field-help'},explanation));}
  fields.append(label);
 }
 if(dialEntries.length){
  if(!dialEntries.some(e=>e.key===editorDialKey))editorDialKey=dialEntries[0].key;
  const tools=html('div',{class:'editor-dial-tools'}),dial=html('div',{id:'editor-data-dial',class:'knob-art',role:'slider',tabindex:0,'aria-label':'Data dial do parâmetro selecionado'});
  const image=html('img',{class:'dial-image',src:'assets/modx-knob.png',alt:'',draggable:'false'});dial.append(image);
  const controls=html('div',{class:'editor-dial-controls'}),select=html('select',{'aria-label':'Parâmetro do Data dial'}),output=html('output',{'aria-live':'polite'});
  for(const entry of dialEntries)select.append(html('option',{value:entry.key},entry.label));
  const getTarget=()=>{const entry=dialEntries.find(e=>e.key===editorDialKey);if(!entry)return null;const {input,apply}=entry;
   return {key:entry.key,value:input.value===''?NaN:Number(input.value),min:Number(input.min),max:Number(input.max),values:input.tagName==='SELECT'?[...input.options].filter(o=>!o.disabled).map(o=>Number(o.value)):entry.allowed??null,disabled:!input.isConnected||input.disabled||apply.disabled||input.value===''||(input.tagName==='SELECT'&&![...input.options].some(o=>!o.disabled)),
    preview:value=>{input.value=String(value);},commit:()=>apply.click()};
  };
  paintDataDial=()=>{const target=getTarget(),entry=dialEntries.find(e=>e.key===editorDialKey);if(!target||!entry)return;
   select.value=editorDialKey;const index=target.values?target.values.indexOf(target.value):target.value-target.min,span=target.values?target.values.length-1:target.max-target.min;
   image.style.transform=`rotate(${-135+270*Math.max(0,Math.min(1,span&&Number.isFinite(index)?index/span:0))}deg)`;
   const text=entry.input.tagName==='SELECT'?entry.input.selectedOptions[0]?.textContent:entry.input.value;output.textContent=text??'';
   dial.setAttribute('aria-disabled',String(target.disabled));dial.setAttribute('aria-valuemin',String(target.values?0:target.min));dial.setAttribute('aria-valuemax',String(target.values?Math.max(0,span):target.max));if(Number.isFinite(target.value))dial.setAttribute('aria-valuenow',String(target.values?Math.max(0,index):target.value));else dial.removeAttribute('aria-valuenow');dial.setAttribute('aria-valuetext',`${entry.label}: ${text??''}`);select.disabled=state.busy;
  };
  select.addEventListener('change',()=>{dataDialCancel();editorDialKey=select.value;paintDataDial();});
  controls.append(select,output,html('small',{},'Arrasta para ajustar; largar aplica. Setas: 1 passo · Page Up/Down: 10. O dial percorre as opções apresentadas.'));
  tools.append(dial,controls);panel.append(tools);dataDialCancel=bindDataDial(dial,getTarget,()=>paintDataDial());
  panel.append(fields);paintDataDial();
 }else panel.append(fields);
}
const parameterPanel=html('section',{id:'parameter-editor','aria-label':'Editor de parâmetros',hidden:'',class:'parameter-editor'});
document.querySelector('main').insertBefore(parameterPanel,document.querySelector('main footer'));
const openEditorButton=html('button',{onclick:()=>openEditor(null)},'Editar parâmetros');
document.querySelector('.layout-switch').append(openEditorButton);

document.querySelector('#view-effects .heading').append(html('button',{onclick:()=>{openEditor(null);editorArea='reverb';renderEditor();}},'Editar Reverb'));

midi.addEventListener('live-navigation',()=>{if(Number.isInteger(midi.liveSetBank)||Number.isInteger(midi.liveSetPage))state.touchBank='hardware';if(Number.isInteger(midi.liveSetPage))state.touchPage=midi.liveSetPage;if(!state.busy&&!dragging)renderPhysical();});
midi.addEventListener('settings',()=>{if(dragging)pendingRender=true;else render();});

fetch('build.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(build=>{if(build?.id&&$('build-version'))$('build-version').textContent=`MODX · ${build.id}`;}).catch(()=>{});

window.dispatchEvent(new Event('modx-ready'));

midi.addEventListener('assign',event=>{
 if(!state.connected)return;
 const {index,channel,value}=event.detail,common=midi.current?.blocks.get('48:64:0'),record=assignRecords[index];
 if(!record||record.key!==JSON.stringify([midi.current?.name,common?.[71+index],common?.[61+index]]))return;
 record.values.set(channel,{value,source:'received'});assignPaint[index]?.();
});

const ipadHelp=html('details',{class:'ipad-help'});ipadHelp.append(html('summary',{},'iPad / diagnóstico USB'));
const instructions=html('div');instructions.append(html('p',{},'Abre esta página no MIDIWeb Browser. Liga o iPad à porta USB TO HOST do MODX com um cabo de dados. No teclado: Utility → Settings → MIDI I/O → MIDI IN/OUT = USB.'));
const report=html('pre',{class:'midi-report',role:'status','aria-live':'polite'},'O diagnóstico só pede acesso MIDI e lista portas. Não envia comandos ao teclado.');
instructions.append(html('button',{onclick:async event=>{const button=event.currentTarget;button.disabled=true;try{const access=state.connected&&midi.access?midi.access:await requestMidiAccess(),result=midiReport(access);report.textContent=`Web MIDI disponível\nSysEx: ${result.sysex}\nContexto: ${globalThis.isSecureContext?'seguro':'HTTP local · ponte MIDIWeb necessária'}\nEntradas: ${result.inputs.map(p=>`${p.name} (${p.state})`).join(', ')||'nenhuma'}\nSaídas: ${result.outputs.map(p=>`${p.name} (${p.state})`).join(', ')||'nenhuma'}\nLeitura confirmada do MODX: ${state.connected&&midi.confirmed?'sim':'não'}\nÚltima leitura: ${state.lastRead?.toLocaleTimeString('pt-PT')??'nenhuma'}`;}catch(e){report.textContent=e.message;}finally{button.disabled=false;}}},'Verificar MIDI / SysEx'),report);
instructions.append(html('p',{},'Teste: 1. Ligar ao MODX e confirmar o nome da Performance. 2. Mudar um volume de Part um ponto na PWA e repor o original, sem Store. Aguardar «Valor confirmado pelo MODX» nas duas operações. 3. Mudar esse volume no teclado e verificar as duas vistas; se não chegar uma mensagem MIDI, usar Ler teclado.'));
instructions.append(html('p',{},'O Wi-Fi serve os ficheiros da app; o MIDI usa o cabo USB do iPad. Em HTTPS não precisas de servidor no Mac/PC. Em HTTP local, mantém o servidor aberto e não contes com offline PWA padrão. No MIDIWeb podes usar Open Site as App para ecrã inteiro. A compatibilidade física ainda precisa deste teste.'));
ipadHelp.append(instructions);document.querySelector('.layout-switch').after(ipadHelp);

const catalogLabel=html('label',{},'Importar biblioteca local · apenas neste browser');const catalogInput=html('input',{type:'file',accept:'.json,application/json','aria-label':'Importar biblioteca local'});catalogLabel.append(catalogInput);instructions.append(catalogLabel,html('p',{},'O ficheiro contém o teu repertório e as referências User 1. Não é enviado ao servidor, não contém amostras e não altera o MODX. Fica guardado neste browser. Limpar os dados do browser apaga esta cópia.'));
catalogInput.addEventListener('change',async()=>{const file=catalogInput.files[0];if(!file)return;try{if(file.size>500000)throw Error('Limite do catálogo: 500 kB.');const raw=await file.text(),catalog=validateLocalCatalog(JSON.parse(raw));localStorage.setItem(localCatalogKey,raw);Object.assign(data,catalog);render();notice('Biblioteca importada neste browser. Não foi enviado nenhum comando ao MODX.');}catch(e){notice(`Não foi possível importar: ${e.message}`,true);}finally{catalogInput.value='';}});
try{const saved=localStorage.getItem(localCatalogKey);if(saved)Object.assign(data,validateLocalCatalog(JSON.parse(saved)));}catch{/* A corrupt or unavailable browser store must not replace the bundled catalog. */}
render();

const offlinePanel=html('details',{class:'ipad-help'});offlinePanel.append(html('summary',{},'Offline / atualizações'));const offlineBody=html('div'),offlineStatus=html('p',{role:'status','aria-live':'polite'},'A verificar a cópia offline…');offlineBody.append(offlineStatus);offlinePanel.append(offlineBody);ipadHelp.after(offlinePanel);
let offlineRegistration=null,reloadForUpdate=false;
async function checkOffline(){if(offlineRegistration?.waiting){offlineStatus.textContent='Aplica a atualização disponível para preparar esta versão offline.';return null;}try{const info=await offlineInfo(offlineRegistration?.active);offlineStatus.textContent=offlineSummary(info);return info;}catch(e){offlineStatus.textContent=e.message;return null;}}
const prepareOffline=html('button',{onclick:async()=>{prepareOffline.disabled=true;try{const info=await checkOffline();if(!info||info.missing.length)return;const persistent=await navigator.storage?.persist?.();offlineStatus.textContent+=persistent?' · armazenamento persistente autorizado.':' · o sistema pode limpar a cache; mantém uma cópia da biblioteca em Ficheiros.';}catch(e){offlineStatus.textContent=e.message;}finally{prepareOffline.disabled=false;}}},'Verificar / preparar offline');
const updateApp=html('button',{hidden:'',onclick:async()=>{if(state.connected||state.busy){notice('Termina a ligação USB antes de atualizar a app.',true);return;}if(!await canReplace())return;reloadForUpdate=true;offlineRegistration?.waiting?.postMessage({type:'activate-update'});}},'Aplicar atualização');
offlineBody.append(prepareOffline,updateApp,html('p',{},'Com Internet, espera por «Cópia offline pronta», importa a biblioteca local e guarda este endereço no MIDIWeb. Para testar, desliga Wi-Fi/dados móveis mantendo o USB, fecha e volta a abrir esta página no MIDIWeb. Confirma ambas as vistas, a biblioteca e a leitura do MODX. A pesquisa online fica indisponível. O modo offline do próprio MIDIWeb pode ser necessário se o browser não disponibilizar cache PWA.'));
offlineBody.append(html('button',{onclick:()=>{try{const raw=JSON.stringify({format:'MODX-Painel-local-catalog',version:1,band:data.band,user1:data.user1});validateLocalCatalog(JSON.parse(raw));const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),link=html('a',{href:url,download:'MODX-biblioteca-local.json'});link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){notice(e.message,true);}}},'Guardar cópia da biblioteca local'));
if(globalThis.isSecureContext&&'serviceWorker' in navigator){navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloadForUpdate)location.reload();});navigator.serviceWorker.getRegistration().then(async existing=>{const registration=existing??await navigator.serviceWorker.register('sw.js');offlineRegistration=registration;const showUpdate=()=>{if(registration.waiting){updateApp.hidden=false;offlineStatus.textContent='Atualização disponível. Aplica-a numa pausa, depois de desligar o MIDI.';}};showUpdate();const watch=()=>registration.installing?.addEventListener('statechange',()=>{if(registration.waiting)showUpdate();else if(registration.active)checkOffline();});registration.addEventListener('updatefound',watch);watch();if(existing)registration.update().catch(()=>{});if(registration.active&&!registration.waiting)checkOffline();else if(!registration.waiting)offlineStatus.textContent='A guardar os ficheiros da app. Mantém esta página aberta com Internet.';}).catch(()=>{offlineStatus.textContent='Este browser não conseguiu preparar a cache PWA. Usa a função offline do MIDIWeb e confirma com Wi-Fi desligado.';});}else offlineStatus.textContent='Cache PWA indisponível neste contexto. Abre o endereço HTTPS no MIDIWeb e verifica o suporte offline do browser.';

mountSupport(offlinePanel,{html,notice,open:requestedSupport});

mountAppSettings({html,ipadHelp,offlinePanel,openSupport:requestedSupport});
