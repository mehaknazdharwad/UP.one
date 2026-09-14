import {sessionCookie,sameOrigin} from '../../../lib/access';
export async function POST(req:Request) {
 const url=new URL(req.url);
 if(!sameOrigin(req))return new Response('Unauthorized',{status:403});
 const target=process.env.VERCEL || process.env.UP_DASHBOARD_PASSWORD ? '/login' : '/signout-with-chatgpt?return_to=%2F';
 return new Response(null,{status:303,headers:{Location:target,'Cache-Control':'no-store','Set-Cookie':`${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${url.protocol==='https:'?'; Secure':''}`}});
}
