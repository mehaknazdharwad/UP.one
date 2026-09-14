export function authorized(req:Request){
 const local=['localhost','127.0.0.1'].includes(new URL(req.url).hostname);
 return local || !!(req.headers.get('oai-authenticated-user-id')&&req.headers.get('oai-authenticated-user-email'));
}
export function allowed(req:Request){return authorized(req)&&(!req.headers.get('origin')||new URL(req.url).origin===req.headers.get('origin'));}
