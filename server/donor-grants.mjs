import {createHmac,timingSafeEqual} from 'node:crypto';
export function euroCents(value){if(!/^\d{1,5}(?:[.,]\d{1,2})?$/.test(String(value)))throw Error('Valor EUR inválido.');const [a,b='']=String(value).replace(',','.').split('.');return Number(a)*100+Number(b.padEnd(2,'0'));}
export function issueGrant({receipt,amount,currency='EUR',confirmed},secret,now=Date.now()){
 if(!secret||secret.length<32)throw Error('Segredo privado não configurado.');if(confirmed!=='CONFIRMADO')throw Error('Confirma primeiro o pagamento no PayPal.');
 const cents=euroCents(amount);if(currency!=='EUR'||cents<200)throw Error('É necessário um apoio confirmado de pelo menos 2 EUR.');
 if(!/^[A-Z0-9-]{8,64}$/i.test(receipt))throw Error('Referência de pagamento inválida.');
 const id=createHmac('sha256',secret).update(receipt.toUpperCase()).digest('hex'),payload=Buffer.from(JSON.stringify({v:1,id,cents,currency,expires:Math.floor(now/1000)+90*86400})).toString('base64url');
 return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
}
export function verifyGrant(token,secret,now=Date.now()){
 if(!secret||typeof token!=='string'||token.length>700||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))throw Error('Código inválido.');const parts=token.split('.');if(parts.length!==2)throw Error('Código inválido.');
 const expected=createHmac('sha256',secret).update(parts[0]).digest(),actual=Buffer.from(parts[1],'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('Código inválido.');
 const data=JSON.parse(Buffer.from(parts[0],'base64url').toString());if(data.v!==1||!/^[a-f0-9]{64}$/.test(data.id)||!Number.isInteger(data.cents)||data.cents<200||data.currency!=='EUR'||!Number.isInteger(data.expires)||data.expires<Math.floor(now/1000))throw Error('Código expirado ou sem apoio elegível.');return data;
}
export function requestRecord(body,secret,now=Date.now()){
 const grant=verifyGrant(body.code,secret,now);if(typeof body.title!=='string'||body.title.trim().length<8||body.title.length>120||typeof body.detail!=='string'||body.detail.trim().length<20||body.detail.length>5000||typeof body.email!=='string'||body.email.length>254||!/^\S+@\S+\.\S+$/.test(body.email))throw Error('Preenche título, descrição e email válidos.');
 return {grantId:grant.id,amountCents:grant.cents,currency:'EUR',title:body.title.trim(),detail:body.detail.trim(),email:body.email.trim(),createdAt:new Date(now).toISOString(),status:'received'};
}
