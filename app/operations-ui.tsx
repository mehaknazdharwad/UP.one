'use client';
import { ChevronRight } from 'lucide-react';
import { done, due, type Complaint } from '../lib/domain';
import { DAY, slaState, trendBins } from '../lib/operations';
import { locale, type Language, type Translate } from '../lib/i18n';
export function Status({ value, t }: {
    value: string;
    t: Translate;
}) {
    return <span className={'status status-' + value.toLowerCase().replaceAll(' ', '-')}>{t(value)}</span>;
}
export function Sla({ c, now, t }: {
    c: Complaint;
    now: number;
    t: Translate;
}) {
    const state = slaState(c, now), left = due(c) - now, hours = Math.ceil(Math.abs(left) / 3600000);
    const label = done(c) ? t(state === 'met' ? 'SLA met' : state === 'late' ? 'Resolved late' : 'Unknown') : hours < 1 && left > 0 ? t('Less than 1 hour left') : hours < 48 ? `${Math.max(1, hours)} ${t(left <= 0 ? 'hours overdue' : 'hours left')}` : `${Math.ceil(Math.abs(left) / DAY)} ${t(left <= 0 ? 'days overdue' : 'days left')}`;
    return <span className={'sla sla-' + state}>{label}</span>;
}
export function ComplaintTable({ rows, t, now, onOpen }: {
    rows: Complaint[];
    t: Translate;
    now: number;
    onOpen: (c: Complaint) => void;
}) {
    if (!rows.length)
        return <div className="empty compact"><h3>{t('No matching complaints')}</h3><p>{t('Try changing your filters.')}</p></div>;
    return <div className="table-scroll"><table className="complaint-table"><caption className="sr-only">{t('Complaints')}</caption><thead><tr>{['Complaint', 'District', 'Priority', 'Status', 'Assigned officer', 'SLA status', 'Actions'].map(s => <th scope="col" key={s}>{s === 'Actions' ? <span className="sr-only">{t(s)}</span> : t(s)}</th>)}</tr></thead><tbody>{rows.map(c => <tr key={c.id}>
  <td><button className="case-link" onClick={() => onOpen(c)}><small>{c.id}</small><strong>{t(c.title)}</strong></button></td>
  <td data-label={t('District')}>{t(c.district)}</td><td data-label={t('Priority')}><span className={'severity ' + c.priority.toLowerCase()}>{t(c.priority)}</span></td>
  <td data-label={t('Status')}><Status value={c.status} t={t}/></td><td data-label={t('Assigned officer')}>{c.officer || <button className="text-button" onClick={() => onOpen(c)}>{t('Assign officer')}</button>}</td>
  <td data-label={t('SLA status')}><Sla c={c} now={now} t={t}/></td><td><button className="icon-button" aria-label={`${t('Open complaint')} ${c.id}`} onClick={() => onOpen(c)}><ChevronRight size={18}/></button></td>
 </tr>)}</tbody></table></div>;
}
export function Trend({ items, t, language, now }: {
    items: Complaint[];
    t: Translate;
    language: Language;
    now: number;
}) {
    const bins = trendBins(items, now), max = Math.max(4, Math.ceil(Math.max(...bins.flatMap(b => [b.reported, b.resolved])) / 4) * 4);
    const label = (start: number) => new Date(start).toLocaleDateString(locale(language), { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
    const points = (key: 'reported' | 'resolved') => bins.map((b, i) => `${45 + i * 99},${174 - b[key] / max * 136}`).join(' ');
    return <section className="panel"><div className="panel-heading"><div><h2>{t('Complaint trends')}</h2><p>{t('Five-day intervals · last 30 days')}</p></div></div><div className="chart-legend"><span><i />{t('Reported')}</span><span><i className="resolved-line"/>{t('Resolution events')}</span></div><div className="trend-chart"><svg viewBox="0 0 580 210" role="img" aria-label={t('Complaint trends')}>{[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="45" x2="540" y1={38 + i * 34} y2={38 + i * 34} stroke="#e7ebf0"/><text x="30" y={42 + i * 34} textAnchor="end">{max * (1 - i / 4)}</text></g>)}<polyline points={points('reported')} stroke="#1F4E79" strokeWidth="2.5" fill="none"/><polyline points={points('resolved')} stroke="#18864B" strokeWidth="2.5" strokeDasharray="5 3" fill="none"/>{bins.map((b, i) => <g key={b.start}><circle cx={45 + i * 99} cy={174 - b.reported / max * 136} r="3" fill="#1F4E79"/><text x={45 + i * 99} y="201" textAnchor="middle">{label(b.start)}</text></g>)}</svg></div><details className="chart-data"><summary>{t('View chart data')}</summary><table><thead><tr>{['Period beginning', 'Reported', 'Resolution events'].map(s => <th scope="col" key={s}>{t(s)}</th>)}</tr></thead><tbody>{bins.map(b => <tr key={b.start}><td>{label(b.start)}</td><td>{b.reported}</td><td>{b.resolved}</td></tr>)}</tbody></table></details><p className="chart-method">{t('Includes repairs later reopened.')}</p></section>;
}
