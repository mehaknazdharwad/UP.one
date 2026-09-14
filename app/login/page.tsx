'use client';
import {useEffect,useState} from 'react';
export default function Login(){
 const [hindi,setHindi]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{setHindi(localStorage.getItem('up-language')==='hi');setError(new URLSearchParams(location.search).has('error'));},[]);
 const t=(en:string,hi:string)=>hindi?hi:en;
 return <main className="login-screen"><section className="login-card"><div className="login-brand">UP<span>.one</span></div><p>{t('Electrical Department · Uttar Pradesh','विद्युत विभाग · उत्तर प्रदेश')}</p><h1>{t('Welcome back','स्वागत है')}</h1><p>{t('Sign in to manage department complaints.','विभाग की शिकायतों के प्रबंधन के लिए साइन इन करें।')}</p><form action="/api/login" method="post"><label>{t('Username','उपयोगकर्ता नाम')}<input name="username" autoComplete="username" required maxLength={200}/></label><label>{t('Password','पासवर्ड')}<input name="password" type="password" autoComplete="current-password" required maxLength={200}/></label>{error&&<p className="form-error" role="alert">{t('Check your username and password.','उपयोगकर्ता नाम और पासवर्ड जाँचें।')}</p>}<button className="button primary" type="submit">{t('Sign in','साइन इन करें')}</button></form><button className="text-button" onClick={()=>{setHindi(!hindi);localStorage.setItem('up-language',hindi?'en':'hi');}}>{hindi?'English':'हिन्दी'}</button></section></main>;
}
