import { get, put, del, BlobError, BlobPreconditionFailedError } from '@vercel/blob';
import { seed, type Complaint } from './domain';
import type { ComplaintStore } from './complaint-store';

// A small demonstration dataset, stored privately with conditional writes.
// Consistent reads and ETags prevent concurrent saves from losing changes.
const prefix = process.env.UP_STORAGE_PREFIX || 'dashboard';
const key = `${prefix}/complaints.json`;
async function read() {
 const result = await get(key, {access:'private', useCache:false, headers:{'Accept-Encoding':'identity'}});
 if (!result) return null;
 return {items: await new Response(result.stream).json() as Complaint[], etag:result.blob.etag};
}
async function current() {
 const existing = await read();
 if (existing) return existing;
 try { await put(key, JSON.stringify(seed()), {access:'private', addRandomSuffix:false, allowOverwrite:false, contentType:'application/json'}); }
 catch (error) { if (!await read()) throw error; }
 const initialized = await read();
 if (!initialized) throw Error('Unable to initialize complaints');
 return initialized;
}
async function change(update:(items:Complaint[]) => boolean) {
 for (let attempt=0; attempt<4; attempt++) {
  const state = await current();
  if (!update(state.items)) return false;
  try {
   await put(key, JSON.stringify(state.items), {access:'private', addRandomSuffix:false, allowOverwrite:true, ifMatch:state.etag, contentType:'application/json'});
   return true;
  } catch (error) {
   const conflict=error instanceof BlobPreconditionFailedError || (error instanceof BlobError && error.message.includes('conditional request cannot succeed due to a conflicting operation'));
   if (!conflict) throw error;
   await new Promise(resolve=>setTimeout(resolve,50*2**attempt));
  }
 }
 throw Error('Concurrent update; please retry');
}
const store: ComplaintStore = {
 async list() { return (await current()).items.sort((a,b) => b.id.localeCompare(a.id)); },
 async find(id) { return (await current()).items.find(c => c.id === id) || null; },
 async insert(c) { await change(items => { if(items.some(item => item.id===c.id)) throw Error('Duplicate complaint'); items.push(c); return true; }); },
 async save(c, version) { return change(items => {const index=items.findIndex(item => item.id===c.id && item.version===version); if(index<0)return false;items[index]=c;return true;}); },
 async seed() { await current(); },
 async curate() { return 0; }
};

export const env = {
 UP_STORE:store,
 BUCKET:{
  async put(path:string, bytes:Uint8Array, options:{httpMetadata:{contentType:string}}) {
   await put(`${prefix}/${path}`, Buffer.from(bytes), {access:'private',addRandomSuffix:false,contentType:options.httpMetadata.contentType});
  },
  async get(path:string) { const value=await get(`${prefix}/${path}`,{access:'private',useCache:false});return value ? {body:value.stream} : null; },
  async delete(path:string) { await del(`${prefix}/${path}`); }
 }
};
