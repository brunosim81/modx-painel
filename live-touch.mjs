const text=bytes=>String.fromCharCode(...bytes).replace(/\0/g,'').trim();
export function livePageAddresses(page){
 if(!Number.isInteger(page)||page<0||page>15)throw Error('Página Live Set inválida.');
 return [[2,0,0],[3,page,0],...Array.from({length:16},(_,slot)=>[page<8?4:5,(page%8)*16+slot,0])];
}
export async function readLiveTouchPage(midi,page){
 const addresses=livePageAddresses(page),bank=await midi.readLiveSetBank();
 for(const a of addresses)midi.auxBlocks.delete(a.join(':'));
 try{for(const a of addresses){if(midi.quietForBulk&&!midi.quietForBulk())throw Error('Lê o Live Set numa pausa, depois de soltar as teclas e o sustain.');await midi.readAux(a);}if(await midi.readLiveSetBank()!==bank)throw Error('O banco mudou durante a leitura. Volta a ler a página.');}
 catch(error){for(const a of addresses)midi.auxBlocks.delete(a.join(':'));throw error;}
}
export function hardwareLivePage(blocks,page){
 const addresses=livePageAddresses(page),bank=blocks.get('2:0:0'),heading=blocks.get(`3:${page}:0`);
 return {bank:bank?.length===20?text(bank):'',name:heading?.length===20?text(heading):'',slots:addresses.slice(2).map((a,index)=>{
  const b=blocks.get(a.join(':'));if(!b||b.length!==26)return null;
  return {slot:index+1,label:text(b.slice(0,20)),msb:b[21],lsb:b[22],program:b[23],volume:b[24],active:b[25]===1};
 })};
}
export function catalogLivePage(entries,page,band=false){
 livePageAddresses(page);
 return Array.from({length:16},(_,i)=>entries.find(e=>(band?e.pagina:e.page)===page+1&&(band?e.posicao:e.slot)===i+1)??null);
}
export function mountLiveTouch({html,body,screen,state,data,midi,current,connected,choose,readPage,changeBank,selectSlot,editPage,search}){
 screen.classList.add('live-touch-screen');
 const hardware=state.touchBank==='hardware',band=state.touchBank==='band',page=state.touchPage;
 const decoded=hardwareLivePage(midi.auxBlocks,page),local=hardware?[]:catalogLivePage(band?data.band:data.user1,page,band);
 const toolbar=html('div',{class:'touch-bank-page'}),bank=html('select',{'aria-label':'Banco Live Set'});
 for(const [value,label] of [['band','Cão de Bila · local'],['user1','User 1 · local'],['hardware','Banco aberto no MODX']])bank.append(html('option',value==='band'?{value,translate:'no'}:{value},value==='hardware'&&decoded.bank?decoded.bank+' · USB':label));
 for(let i=0;i<=16;i++)bank.append(html('option',{value:`usb:${i}`,disabled:!connected()},`${i===0?'Preset':i<=8?`User ${i}`:`Library ${i-8}`} · USB`));
 bank.disabled=state.busy;bank.value=hardware&&Number.isInteger(midi.liveSetBank)?`usb:${midi.liveSetBank}`:state.touchBank;bank.onchange=()=>{if(bank.value.startsWith('usb:')){changeBank(Number(bank.value.slice(4)));return;}state.touchBank=bank.value;state.touchPage=0;state.touchRender();};
 const pages=html('select',{'aria-label':'Página Live Set'});
 for(let i=0;i<16;i++)pages.append(html('option',{value:i},`${String(i*16+1).padStart(2,'0')}–${(i+1)*16}${i===page&&hardware&&decoded.name?' · '+decoded.name:''}`));
 pages.disabled=state.busy;pages.value=String(page);pages.onchange=()=>{state.touchPage=Number(pages.value);state.touchRender();};
 const bankLabel=html('label',{},'Bank'),pageLabel=html('label',{},hardware&&midi.liveSetPage===page?'Page · MIDI':'Page · app');bankLabel.append(bank);pageLabel.append(pages);toolbar.append(bankLabel,pageLabel,html('button',{disabled:!connected(),onclick:readPage,title:'Ler a página do banco aberto no teclado'},'Ler'),html('button',{disabled:!hardware||!connected(),onclick:editPage,title:'Editar a página lida do MODX'},'Edit'));body.append(toolbar);
 const context=html('p',{class:'touch-context',role:'status'},hardware?`${decoded.bank||'Banco por ler'} · ${midi.liveSetBank===null?'sem banco confirmado':`MIDI ${midi.liveSetBank}`} · USB`:'Biblioteca local · não altera a página no Yamaha');body.append(context);
 const grid=html('div',{class:'touch-live-grid','aria-label':'Live Set · 16 posições'});
 for(let i=0;i<16;i++){
  const entry=hardware?decoded.slots[i]:local[i],name=hardware?null:entry?.name??entry?.nome;
  const label=hardware?entry?.label:band?entry?.nome:entry?.label||entry?.name;
  const active=!!current&&!!name&&current.name===name;
  const tile=html('button',{class:'touch-live-slot',disabled:!connected()||!entry||(hardware&&!entry.active),'aria-pressed':String(active),'aria-label':`${i+1}. ${label||'Livre'}`,title:label||'Livre',onclick:()=>hardware?selectSlot(i,entry):choose(entry)},'');
  tile.append(html('strong',label?{translate:'no'}:{},label||'Livre'),html('span',name?{translate:'no'}:{},name|| (hardware&&entry?`MSB ${entry.msb} · LSB ${entry.lsb} · ${entry.program+1}`:'')));
  grid.append(tile);
 }
 body.append(grid);
 body.append(touchActivePerformance(html,current,search));
}
export function touchActivePerformance(html,current,search){
 const footer=html('div',{class:'touch-active-performance'}),active=html('div');active.append(html('strong',current?{translate:'no'}:{},current?.name||'Sem leitura do teclado'),html('span',{},current?`${[...new Set(current.parts.map(p=>p.engine))].join(' + ')} · ${current.parts.length} Parts`:'Performance ativa · USB'));footer.append(html('button',{onclick:search},'Category Search'),active);return footer;
}
