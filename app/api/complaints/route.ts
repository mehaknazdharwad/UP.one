import { database } from '../../../lib/db';
import { categories, districts, officers, seed, transitions, type Complaint } from '../../../lib/domain';
import { z } from 'zod';

const newComplaint = z.object({title:z.string().trim().min(1).max(500),category:z.enum(categories),district:z.string().refine(x=>districts.includes(x)),address:z.string().trim().min(1).max(500),citizen:z.string().trim().min(1).max(500),priority:z.enum(['Critical','High','Normal'])});
const update = z.object({id:z.string(),version:z.number().int(),status:z.string(),officer:z.string().refine(x=>['',...officers].includes(x)),note:z.string().trim().min(1).max(2000)});
function authorized(req:Request){
 const url=new URL(req.url);
 const local=['localhost','127.0.0.1'].includes(url.hostname);
 // Hosted access is restricted to the owner by the Sites dispatch access policy.
 return local || !!(req.headers.get('oai-authenticated-user-id')&&req.headers.get('oai-authenticated-user-email'));
}
function allowed(req:Request){return authorized(req)&&(!req.headers.get('origin')||new URL(req.url).origin===req.headers.get('origin'));}
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function GET(req:Request){
 if(!authorized(req))return fail('Sign in to access complaints. / शिकायतें देखने के लिए साइन इन करें।',401);
 try{const result=await database().prepare('SELECT payload FROM complaints ORDER BY id DESC').all<{payload:string}>();return Response.json({complaints:result.results.map(r=>JSON.parse(r.payload))},{headers:{'Cache-Control':'no-store'}});}
 catch(e){console.error(e);return fail('Unable to load complaints. Please retry. / शिकायतें लोड नहीं हुईं। पुनः प्रयास करें।',503);}
}
export async function POST(req:Request){
 if(!allowed(req))return fail('Unauthorized / अनुमति नहीं है',403);
 try{
  const body=await req.json();const db=database();
  if(body&&typeof body==='object'&&'action' in body&&body.action==='seed'){
   await db.batch(seed().map(c=>db.prepare('INSERT OR IGNORE INTO complaints (id,payload,version) VALUES (?,?,1)').bind(c.id,JSON.stringify(c))));return Response.json({ok:true});
  }
  const parsed=newComplaint.safeParse(body);if(!parsed.success)return fail('Please provide valid complaint details. / सही शिकायत विवरण भरें।');
  const now=new Date().toISOString();const c:Complaint={...parsed.data,id:`UP-EL-${crypto.randomUUID().slice(0,8).toUpperCase()}`,status:'New',officer:'',createdAt:now,updatedAt:now,resolvedAt:null,resolution:'',history:[{at:now,action:'New',note:'Complaint received and routed to the Electrical Department.'}],version:1};
  await db.prepare('INSERT INTO complaints (id,payload,version) VALUES (?,?,1)').bind(c.id,JSON.stringify(c)).run();return Response.json(c,{status:201});
 }catch(e){console.error(e);return fail('Unable to save. Please retry. / सहेजा नहीं गया। पुनः प्रयास करें।',503);}
}
export async function PATCH(req:Request){
 if(!allowed(req))return fail('Unauthorized / अनुमति नहीं है',403);
 try{
  const parsed=update.safeParse(await req.json());if(!parsed.success)return fail('Choose valid details and enter an activity note. / सही विवरण और गतिविधि नोट भरें।');
  const body=parsed.data,db=database();const row=await db.prepare('SELECT payload,version FROM complaints WHERE id=?').bind(body.id).first<{payload:string;version:number}>();
  if(!row)return fail('Complaint not found. / शिकायत नहीं मिली।',404);
  if(row.version!==body.version)return fail('This complaint changed. Reload before saving. / शिकायत बदल गई है। पुनः लोड करें।',409);
  const c:Complaint=JSON.parse(row.payload),oldOfficer=c.officer;
  if(!(body.status===c.status||transitions[c.status].includes(body.status)))return fail('Invalid status transition. / अमान्य स्थिति परिवर्तन।');
  if(body.status!=='New'&&!body.officer)return fail('Assign an officer first. / पहले अधिकारी नियुक्त करें।');
  if(body.status==='New'&&body.officer)return fail('Select Assigned when assigning an officer. / अधिकारी नियुक्त करते समय नियुक्त स्थिति चुनें।');
  const now=new Date().toISOString(),previousStatus=c.status;c.status=body.status;c.officer=body.officer;c.updatedAt=now;c.version++;
  if(body.status==='Resolved'&&previousStatus!=='Resolved'){c.resolvedAt=now;c.resolution=body.note;}
  if(body.status==='Reopened'&&previousStatus!=='Reopened'){c.resolvedAt=null;c.resolution='';}
  const actor=req.headers.get('oai-authenticated-user-email')||'Local department head';
  c.history.push({at:now,action:body.status,note:body.note+(body.officer!==oldOfficer?` Officer: ${body.officer}.`:'')+` (${actor})`});
  const result=await db.prepare('UPDATE complaints SET payload=?,version=? WHERE id=? AND version=?').bind(JSON.stringify(c),c.version,c.id,row.version).run();
  if(!result.meta.changes)return fail('This complaint changed. Reload before saving. / शिकायत बदल गई है। पुनः लोड करें।',409);
  return Response.json(c);
 }catch(e){console.error(e);return fail('Unable to save. Please retry. / सहेजा नहीं गया। पुनः प्रयास करें।',503);}
}
