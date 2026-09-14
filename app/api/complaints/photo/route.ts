import { authorized } from '../../../../lib/access';
import { database } from '../../../../lib/db';
import { bucket } from '../../../../lib/photos';
import type { Complaint } from '../../../../lib/domain';
export async function GET(req:Request){
 if(!authorized(req))return new Response('Unauthorized',{status:401});
 const q=new URL(req.url).searchParams,id=q.get('complaint'),photo=q.get('photo');
 if(!id||!photo)return new Response('Not found',{status:404});
 try{
  const row=await database().prepare('SELECT payload FROM complaints WHERE id=?').bind(id).first<{payload:string}>();
  if(!row)return new Response('Not found',{status:404});
  const c:Complaint=JSON.parse(row.payload);const evidence=c.history.find(h=>h.photo?.id===photo)?.photo;
  if(!evidence)return new Response('Not found',{status:404});
  const object=await bucket().get(`resolution/${id}/${evidence.id}`);
  if(!object)return new Response('Photo unavailable',{status:404});
  return new Response(object.body,{headers:{'Content-Type':evidence.mime,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});
 }catch(e){console.error(e);return new Response('Photo unavailable. Please retry.',{status:503});}
}
