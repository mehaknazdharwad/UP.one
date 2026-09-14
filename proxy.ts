import { NextResponse, type NextRequest } from 'next/server';
import { vercelAuthorized } from './lib/access';

export function proxy(req:NextRequest) {
 if(!process.env.VERCEL && !process.env.UP_DASHBOARD_PASSWORD) return NextResponse.next();
 if(['/login','/api/login','/api/logout'].includes(req.nextUrl.pathname)) return NextResponse.next();
 if(vercelAuthorized(req)) {const response=NextResponse.next();response.headers.set('Cache-Control','private, no-store');return response;}
 if(req.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({error:'Sign in to access complaints. / शिकायतें देखने के लिए साइन इन करें।'},{status:401,headers:{'Cache-Control':'no-store'}});
 return NextResponse.redirect(new URL('/login',req.url));
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.svg|fonts/).*)']};
