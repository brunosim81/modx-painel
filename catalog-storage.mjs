const text=(value,max)=>typeof value==='string'&&value.length<=max;
const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
export function validateLocalCatalog(value){
 if(value?.format!=='MODX-Painel-local-catalog'||value.version!==1||!Array.isArray(value.band)||!Array.isArray(value.user1)||value.band.length>256||value.user1.length>16)throw Error('Escolhe uma biblioteca local exportada pelo MODX Painel.');
 for(const e of value.band)if(!text(e.nome,200)||!text(e.ficheiro,240)||!text(e.sons,3000)||!integer(e.pagina,1,16)||!integer(e.posicao,1,16)||!integer(e.numero,1,256)||!integer(e.partes,0,16))throw Error('Entrada do repertório inválida.');
 for(const e of value.user1)if(!text(e.name,200)||!integer(e.slot,1,16)||!integer(e.msb,0,127)||!integer(e.lsb,0,127)||!integer(e.program,0,127)||!Array.isArray(e.parts)||e.parts.length>16||!Array.isArray(e.external_wave_banks)||e.external_wave_banks.length>8)throw Error('Entrada User 1 inválida.');
 return {band:value.band,user1:value.user1};
}
export const localCatalogKey='modx-local-catalog-v1';
