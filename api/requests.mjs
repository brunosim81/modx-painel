import {requestRecord} from '../server/donor-grants.mjs';
export async function handleRequest(req,res,{secret=process.env.DONOR_GRANT_SECRET,storageToken=process.env.BLOB_READ_WRITE_TOKEN,putRecord}={}){
 res.setHeader('Cache-Control','no-store');const origin=req.headers?.origin;
 const allowed=['https://modx-painel.vercel.app','http://localhost:8766','http://127.0.0.1:8766'];
 if(origin&&!allowed.includes(origin))return res.status(403).json({error:'Origem não autorizada.'});
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST');res.setHeader('Access-Control-Allow-Headers','Content-Type');return res.status(204).end();}
 if(!secret||!storageToken)return res.status(503).json({error:'Os pedidos ainda não estão ativos. Não faças um apoio para obter acesso até o serviço estar disponível.'});
 if(req.method==='GET')return res.status(200).json({enabled:true,minimumCents:200,currency:'EUR',verification:'manual',oneRequestPerPayment:true});
 if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
 let record;
 try{const body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!body||Buffer.byteLength(JSON.stringify(body))>12000)throw Error('Pedido demasiado grande.');record=requestRecord(body,secret);}catch(error){return res.status(400).json({error:error.message});}
 try{const put=putRecord??(await import('@vercel/blob')).put;await put(`requests/${record.grantId}.json`,JSON.stringify(record),{access:'private',addRandomSuffix:false,allowOverwrite:false,token:storageToken,contentType:'application/json'});return res.status(201).json({received:true,reference:record.grantId.slice(0,12)});}catch(error){if((error.name==='BlobPathAlreadyExistsError'||error.constructor?.name==='BlobPathAlreadyExistsError'))return res.status(409).json({error:'Este código já foi utilizado. Cada apoio permite um pedido.'});return res.status(503).json({error:'Não foi possível guardar o pedido. Mantém o código e tenta novamente.'});}
}
export default handleRequest;
