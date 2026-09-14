export const statuses = ['New','Assigned','In progress','Resolved','Closed','Reopened','Escalated'] as const;
export const categories = ['Power outage','Transformer','Damaged wire / pole','Streetlight','Voltage fluctuation','Other electrical'] as const;
export const districts = ['Lucknow','Kanpur Nagar','Varanasi','Prayagraj','Agra','Gorakhpur','Meerut','Bareilly'];
export const officers = ['Anil Kumar','Priya Singh','Rajesh Verma','Neha Sharma','Vikram Yadav','Sana Khan'];
// The 15-case demo spans every status and includes repeated category/district pairs.
export const demoIndexes=[0,1,2,3,4,5,10,12,24,25,26,27,28,48,49];
export const demoIds=demoIndexes.map(i=>`UP-EL-${20260001+i}`);
export type Evidence = {id:string;mime:string;name:string};
export type Complaint = {id:string; title:string; category:string; district:string; address:string; latitude?:number|null; longitude?:number|null; citizen:string; priority:string; status:string; officer:string; createdAt:string; updatedAt:string; resolvedAt:string|null; resolution:string; resolutionPhoto?:Evidence|null; history:{at:string; action:string; note:string;photo?:Evidence}[]; version:number};
export const done = (c:Complaint) => ['Resolved','Closed'].includes(c.status);
export const due = (c:Complaint) => new Date(c.createdAt).getTime()+7*86400000;
export const remaining = (c:Complaint) => (due(c)-Date.now())/86400000;
export function seed():Complaint[]{
 const titles=['Power supply interrupted in residential area','Transformer overheating near market','Exposed electrical wire near school','Streetlights not working on main road','Frequent voltage fluctuations','Electrical connection needs inspection'];
 return Array.from({length:84},(_,i)=>{const age=3+(i*7%26)+i%3/3; const createdAt=new Date(Date.now()-age*86400000).toISOString(); const status=i<6?['Escalated','In progress','New','Assigned','Reopened','In progress'][i]:statuses[(i*3+2)%7];const resolvedAt=['Resolved','Closed'].includes(status)?new Date(new Date(createdAt).getTime()+Math.min(age,2+i%8)*86400000).toISOString():null;return {id:`UP-EL-${20260001+i}`,title:titles[i%6],category:categories[i%6],district:districts[(i*3)%8],address:`Ward ${12+i%20}, ${['Gomti Nagar','Civil Lines','Station Road','Indira Nagar'][i%4]}`,citizen:['Aarav Singh','Pooja Gupta','Mohd. Ali','Ritu Verma'][i%4],priority:i%9===0?'Critical':i%3===0?'High':'Normal',status,officer:status==='New'?'':officers[i%6],createdAt,updatedAt:createdAt,resolvedAt,resolution:resolvedAt?'Fault repaired, supply checked and service restored.':'',history:[{at:createdAt,action:'New',note:'Complaint received through citizen portal.'},...(status==='New'?[]:[{at:createdAt,action:status,note:'Routed to the Electrical Department.'}])],version:1};}).filter((_,i)=>demoIndexes.includes(i));
}
export const transitions:Record<string,string[]>={New:['Assigned','Escalated'],Assigned:['In progress','Escalated'],'In progress':['Resolved','Escalated'],Resolved:['Closed','Reopened'],Closed:['Reopened'],Reopened:['Assigned','In progress','Escalated'],Escalated:['Assigned','In progress','Resolved']};
export function recurringGroups(items:Complaint[]){
 const groups=new Map<string,Complaint[]>();
 for(const c of items){const key=c.category+'|'+c.district;groups.set(key,[...(groups.get(key)||[]),c]);}
 return [...groups.values()].filter(g=>g.length>=2);
}


