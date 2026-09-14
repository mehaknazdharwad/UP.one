import {createSession,sessionCookie,validCredentials,sameOrigin} from '../../../lib/access';
export async function POST(req:Request) {
 const url=new URL(req.url);
 if(!sameOrigin(req))return new Response('Unauthorized',{status:403});
 if(Number(req.headers.get('content-length'))>4096)return new Response('Invalid request',{status:413});
 try {
  const form=await req.formData();
  if(!validCredentials(String(form.get('username')||''),String(form.get('password')||'')))return new Response(null,{status:303,headers:{Location:'/login?error=1'}});
  return new Response(null,{status:303,headers:{Location:'/','Cache-Control':'no-store','Set-Cookie':`${sessionCookie}=${createSession()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${url.protocol==='https:'?'; Secure':''}`}});
 }catch{return new Response(null,{status:303,headers:{Location:'/login?error=1'}});}
}
