import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
function equal(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());}
export function validCredentials(user:string,password:string) {
 const secret=process.env.UP_DASHBOARD_PASSWORD;
 if(!secret) return false;
 const supplied=`${user}:${password}`;
 const expected=`${process.env.UP_DASHBOARD_USER || 'mehaknazd-1657'}:${secret}`;
 return equal(supplied,expected);
}
export const sessionCookie='up_session';
function signature(value:string){return createHmac('sha256',process.env.UP_DASHBOARD_PASSWORD || '').update(value).digest('base64url');}
export function createSession(){const expiry=String(Date.now()+8*60*60*1000);return `${expiry}.${signature(expiry)}`;}
export function vercelAuthorized(req:Request) {
 if(!process.env.UP_DASHBOARD_PASSWORD)return false;
 const token=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1) || '';
 const [expiry,signed,...rest]=token.split('.');
 return !rest.length && /^\d+$/.test(expiry || '') && Number(expiry)>Date.now() && Number(expiry)<=Date.now()+8*60*60*1000 && !!signed && equal(signed,signature(expiry));
}
export function authorized(req:Request){
 if(process.env.VERCEL || process.env.UP_DASHBOARD_PASSWORD) return vercelAuthorized(req);
 const local=['localhost','127.0.0.1'].includes(new URL(req.url).hostname);
 return local || !!(req.headers.get('oai-authenticated-user-id')&&req.headers.get('oai-authenticated-user-email'));
}
export function actor(req:Request) { return process.env.VERCEL || process.env.UP_DASHBOARD_PASSWORD ? (process.env.UP_DASHBOARD_USER || 'mehaknazd-1657') : req.headers.get('oai-authenticated-user-email') || 'Local department head'; }
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(!origin)return true;const url=new URL(req.url);return origin===`${url.protocol}//${req.headers.get('host') || url.host}`;}
export function allowed(req:Request){return authorized(req)&&sameOrigin(req);}
