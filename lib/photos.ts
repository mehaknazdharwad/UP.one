import { env } from 'cloudflare:workers';
export const MAX_PHOTO_BYTES=4*1024*1024;
export function bucket(){const b=(env as unknown as {BUCKET:R2Bucket}).BUCKET;if(!b)throw Error('Photo storage unavailable');return b;}
export function imageType(bytes:Uint8Array){
 if(bytes.length<12)return null;
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export async function boundedForm(req:Request){
 const limit=MAX_PHOTO_BYTES+128*1024;
 if(Number(req.headers.get('content-length'))>limit)throw Error('UPLOAD_TOO_LARGE');
 const reader=req.body?.getReader();if(!reader)throw Error('EMPTY_UPLOAD');
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw Error('UPLOAD_TOO_LARGE');}chunks.push(value);}}finally{reader.releaseLock();}
 const data=new Uint8Array(length);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
 return new Response(data,{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
}
