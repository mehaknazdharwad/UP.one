import assert from 'node:assert/strict';
const origin=process.argv[2];if(!origin)throw Error('Pass the exact local preview URL');
async function call(method,body){const r=await fetch(origin+'/api/complaints',{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
assert.equal((await fetch(origin)).status,200);
assert.equal((await call('POST',{action:'seed'})).status,200);
const first=await call('GET');assert.equal(first.status,200);assert.ok(first.data.complaints.length>=84);
await call('POST',{action:'seed'});assert.equal((await call('GET')).data.complaints.length,first.data.complaints.length);
assert.equal((await call('POST',{title:' '})).status,400);
assert.equal((await call('POST',{title:'Invalid coordinates',category:'Transformer',district:'Lucknow',address:'Demo address',citizen:'Test',priority:'High',latitude:26})).status,400);
const created=await call('POST',{title:'Workflow verification',category:'Transformer',district:'Lucknow',address:'Demo test address',citizen:'Test citizen',priority:'High',latitude:26.8467,longitude:80.9462});assert.equal(created.status,201);let c=created.data;const createdAt=c.createdAt;
assert.equal((await call('PATCH',{id:c.id,version:c.version,status:'Closed',officer:'Anil Kumar',note:'Invalid shortcut'})).status,400);
assert.equal((await call('PATCH',{id:c.id,version:c.version,status:'Assigned',officer:'',note:'Missing officer'})).status,400);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
let firstPhoto;
for(const status of ['Assigned','In progress','Resolved','Closed','Reopened','In progress','Resolved','Closed']){
 const prev=c;const payload={id:c.id,version:c.version,status,officer:'Anil Kumar',note:'Verified '+status};let r;
 if(status==='Resolved'){
  assert.equal((await call('PATCH',payload)).status,400);
  const form=new FormData();for(const [k,v] of Object.entries(payload))form.set(k,String(v));
  form.set('photo',new Blob(['not an image'],{type:'image/png'}),'invalid.png');
  assert.equal((await fetch(origin+'/api/complaints',{method:'PATCH',body:form})).status,400);
  form.set('photo',new Blob([png],{type:'image/png'}),'test-repair.png');
  const res=await fetch(origin+'/api/complaints',{method:'PATCH',body:form});r={status:res.status,data:await res.json()};
 }else r=await call('PATCH',payload);
 assert.equal(r.status,200);c=r.data;assert.equal(c.status,status);assert.equal(c.createdAt,createdAt);assert.equal(c.history.length,prev.history.length+1);assert.equal(c.latitude,26.8467);
 if(status==='Reopened')assert.equal(c.resolvedAt,null);
 if(status==='Resolved'){assert.ok(c.resolvedAt&&c.resolution&&c.resolutionPhoto);firstPhoto??=c.resolutionPhoto.id;const res=await fetch(origin+`/api/complaints/photo?complaint=${c.id}&photo=${c.resolutionPhoto.id}`);assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await res.arrayBuffer()),png);}
 if(status==='Reopened'){assert.equal(c.resolutionPhoto,null);assert.equal((await fetch(origin+`/api/complaints/photo?complaint=${c.id}&photo=${firstPhoto}`)).status,200);}
 assert.equal((await call('PATCH',{id:c.id,version:prev.version,status,officer:'Anil Kumar',note:'Stale update'})).status,409);
}
const persisted=(await call('GET')).data.complaints.find(x=>x.id===c.id);assert.equal(persisted.version,c.version);assert.equal(persisted.history.length,9);
const cross=await fetch(origin+'/api/complaints',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:JSON.stringify({action:'seed'})});assert.equal(cross.status,403);
assert.equal((await fetch(origin+`/api/complaints/photo?complaint=${c.id}&photo=unknown`)).status,404);
assert.equal((await fetch(origin+`/api/complaints/photo?complaint=UP-EL-20260001&photo=${firstPhoto}`)).status,404);
const edited=await call('PATCH',{id:c.id,version:c.version,status:c.status,officer:c.officer,note:'Corrected site location',address:'Ward 18, repaired transformer near school',district:'Kanpur Nagar',latitude:26.4499,longitude:80.3319});
assert.equal(edited.status,200);assert.equal(edited.data.district,'Kanpur Nagar');assert.equal(edited.data.latitude,26.4499);assert.ok(edited.data.history.at(-1).note.includes('Ward 18'));assert.equal(edited.data.resolutionPhoto.id,c.resolutionPhoto.id);
console.log('PASS: lifecycle, required resolution image, file validation, photo retrieval, evidence retained after reopening, location validation/persistence, concurrency, history and cross-origin protection.');
