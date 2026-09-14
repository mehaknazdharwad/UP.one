'use client';
import { useState } from 'react';
import { categories,recurringGroups,type Complaint } from '../lib/domain';
export function RecurringPie({items,t,onSelect}:{items:Complaint[];t:(s:string)=>string;onSelect:(category:string)=>void}){
 const [focused,setFocused]=useState<string|null>(null);
 const groups=recurringGroups(items);
 const colors=['#b95619','#557560','#d7a96b','#778fa2','#8d7694','#989a88'];
 const slices=categories.map((category,i)=>({category,count:groups.filter(g=>g[0].category===category).reduce((n,g)=>n+g.length,0),color:colors[i]})).filter(s=>s.count>0);
 const total=slices.reduce((n,s)=>n+s.count,0);let angle=-Math.PI/2;
 const point=(a:number)=>`${110+86*Math.cos(a)},${110+86*Math.sin(a)}`;
 return <section className="panel recurring-panel"><div className="panel-heading"><div><h2>{t('Recurring issues')}</h2><p>{t('Same issue, same district · two or more reports')}</p></div><span className="count">{total} {t('complaints')}</span></div>{!total?<div className="chart-empty"><strong>{t('No recurring patterns yet')}</strong><p>{t('A category must appear at least twice in the same district.')}</p></div>:<><div className="pie-content"><svg className="recurring-pie" viewBox="0 0 220 220" role="img" aria-label={t('Recurring issues')+': '+slices.map(s=>`${t(s.category)} ${s.count}`).join(', ')}>{slices.map(s=>{const start=angle;angle+=s.count/total*Math.PI*2;const end=angle;const path=s.count===total?'':`M110,110 L${point(start)} A86,86 0 ${end-start>Math.PI?1:0},1 ${point(end)} Z`;return <g key={s.category} style={{opacity:focused&&focused!==s.category?0.55:1}}>{s.count===total?<circle cx="110" cy="110" r="86" fill={s.color}/>:<path d={path} fill={s.color} stroke="white" strokeWidth="2"/>}<title>{t(s.category)}: {s.count} ({Math.round(s.count/total*100)}%)</title></g>})}</svg><div className="pie-legend">{slices.map(s=><button type="button" key={s.category} onClick={()=>onSelect(s.category)} onMouseEnter={()=>setFocused(s.category)} onMouseLeave={()=>setFocused(null)} onFocus={()=>setFocused(s.category)} onBlur={()=>setFocused(null)}><i style={{background:s.color}}/><span>{t(s.category)}</span><strong>{s.count}</strong><small>{Math.round(s.count/total*100)}%</small></button>)}</div></div><p className="chart-method">{t('Includes all complaints in each recurring group. Select a category to review its cases.')}</p></>}</section>;
}

