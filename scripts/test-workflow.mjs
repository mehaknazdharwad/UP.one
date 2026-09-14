import assert from 'node:assert/strict';
const origin=process.argv[2];if(!origin)throw Error('Pass the exact local preview URL');
async function call(method,body){const r=await fetch(origin+'/api/complaints',{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
assert.equal((await fetch(origin)).status,200);
assert.equal((await call('POST',{action:'seed'})).status,200);
const first=await call('GET');assert.equal(first.status,200);assert.ok(first.data.complaints.length>=84);
await call('POST',{action:'seed'});assert.equal((await call('GET')).data.complaints.length,first.data.complaints.length);
assert.equal((await call('POST',{title:' '})).status,400);
const created=await call('POST',{title:'Workflow verification',category:'Transformer',district:'Lucknow',address:'Demo test address',citizen:'Test citizen',priority:'High'});assert.equal(created.status,201);let c=created.data;const createdAt=c.createdAt;
assert.equal((await call('PATCH',{id:c.id,version:c.version,status:'Closed',officer:'Anil Kumar',note:'Invalid shortcut'})).status,400);
assert.equal((await call('PATCH',{id:c.id,version:c.version,status:'Assigned',officer:'',note:'Missing officer'})).status,400);
for(const status of ['Assigned','In progress','Resolved','Closed','Reopened','In progress','Resolved','Closed']){
 const prev=c;const r=await call('PATCH',{id:c.id,version:c.version,status,officer:'Anil Kumar',note:'Verified '+status});assert.equal(r.status,200);c=r.data;assert.equal(c.status,status);assert.equal(c.createdAt,createdAt);assert.equal(c.history.length,prev.history.length+1);
 if(status==='Reopened')assert.equal(c.resolvedAt,null);
 if(status==='Resolved')assert.ok(c.resolvedAt&&c.resolution);
 assert.equal((await call('PATCH',{id:c.id,version:prev.version,status,officer:'Anil Kumar',note:'Stale update'})).status,409);
}
const persisted=(await call('GET')).data.complaints.find(x=>x.id===c.id);assert.equal(persisted.version,c.version);assert.equal(persisted.history.length,9);
const cross=await fetch(origin+'/api/complaints',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:JSON.stringify({action:'seed'})});assert.equal(cross.status,403);
console.log('PASS: page, database persistence, idempotent sample load, validation, transitions, officer requirement, resolution, reopening, audit history, conflict protection and cross-origin rejection.');
