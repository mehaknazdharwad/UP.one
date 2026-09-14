'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ChevronRight, Clock3, FileText, LayoutDashboard, MapPin, Menu, Plus, RefreshCw, Search, Users, X, Zap } from 'lucide-react';
import { categories, done, districts, officers, statuses, type Complaint } from '../lib/domain';
import { cohort, emptyFilters, matchesRisk, metrics, selectComplaints, type Filters, type Risk, type Sort } from '../lib/operations';
import { locale, translator, type Language } from '../lib/i18n';
import { ComplaintDialog, NewDialog } from './complaint-dialogs';
import { ComplaintTable, Sla, Trend } from './operations-ui';
import { RecurringPie } from './recurring-pie';
const navigation = [{ name: 'Overview', icon: LayoutDashboard }, { name: 'Complaints', icon: FileText }, { name: 'SLA & escalations', icon: Clock3 }, { name: 'Officers', icon: Users }, { name: 'District insights', icon: MapPin }] as const;
type View = typeof navigation[number]['name'];
const PAGE_SIZE = 15;
export default function Dashboard() {
    const [language, setLanguage] = useState<Language>('en'), [view, setView] = useState<View>('Overview'), [items, setItems] = useState<Complaint[]>([]), [filters, setFilters] = useState<Filters>(emptyFilters);
    const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [now, setNow] = useState(Date.now()), [refreshed, setRefreshed] = useState<number | null>(null);
    const [selected, setSelected] = useState<Complaint | null>(null), [creating, setCreating] = useState(false), [saving, setSaving] = useState(false), [notice, setNotice] = useState(''), [page, setPage] = useState(0), [mobile, setMobile] = useState(false);
    const menuRef = useRef<HTMLButtonElement>(null), headingRef = useRef<HTMLHeadingElement>(null), requestId = useRef(0);
    const t = translator(language), date = (s: string) => new Date(s).toLocaleString(locale(language), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    const load = useCallback(async (prepare = false) => {
        const id = ++requestId.current;
        setLoading(true);
        setLoadError('');
        try {
            if (prepare) {
                const r = await fetch('/api/complaints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'curate-demo-15' }) });
                if (!r.ok)
                    throw Error('Unable to load complaints. Please retry.');
            }
            const r = await fetch('/api/complaints');
            if (!r.ok)
                throw Error('Unable to load complaints. Please retry.');
            const data = await r.json() as {
                complaints: Complaint[];
            };
            if (id === requestId.current) {
                setItems(data.complaints);
                setRefreshed(Date.now());
                setNow(Date.now());
            }
            return data.complaints;
        }
        catch {
            if (id === requestId.current)
                setLoadError('Unable to load complaints. Please retry.');
            return null;
        }
        finally {
            if (id === requestId.current)
                setLoading(false);
        }
    }, []);
    useEffect(() => { load(true); const saved = localStorage.getItem('up-language'); if (saved === 'hi')
        setLanguage('hi'); const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, [load]);
    useEffect(() => { document.documentElement.lang = language; localStorage.setItem('up-language', language); }, [language]);
    useEffect(() => { if (!notice)
        return; const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); }, [notice]);
    useEffect(() => setPage(0), [filters, view]);
    useEffect(() => { if (!mobile)
        return; const key = (e: KeyboardEvent) => { if (e.key === 'Escape') {
        setMobile(false);
        menuRef.current?.focus();
    } }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [mobile]);
    const base = cohort(items, filters, now, t), m = metrics(base, now), rows = selectComplaints(base, filters, now), pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)), safePage = Math.min(page, pageCount - 1);
    const patch = (values: Partial<Filters>) => setFilters(f => ({ ...f, ...values }));
    function navigate(next: View, values: Partial<Filters> = {}) { setView(next); setFilters(f => ({ ...emptyFilters, query: f.query, district: f.district, period: f.period, ...values })); setMobile(false); setTimeout(() => headingRef.current?.focus(), 0); }
    async function save(body: Record<string, unknown> | FormData, method = 'PATCH') {
        setSaving(true);
        try {
            const r = await fetch('/api/complaints', { method, ...(body instanceof FormData ? { body } : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
            const data = await r.json() as Complaint & {
                error?: string;
            };
            if (!r.ok)
                throw Error(data.error || 'Network unavailable. Your changes have not been saved. Please retry.');
            ++requestId.current;
            setLoading(false);
            if (method === 'PATCH') {
                setItems(old => old.map(c => c.id === data.id ? data : c));
                setSelected(data);
            }
            else if (data.id) {
                setItems(old => [data, ...old]);
                setCreating(false);
            }
            else
                await load();
            setRefreshed(Date.now());
            setNow(Date.now());
            setNotice('Complaint saved successfully');
            return true;
        }
        catch (e) {
            throw Error(e instanceof Error && e.message !== 'Failed to fetch' ? e.message : 'Network unavailable. Your changes have not been saved. Please retry.');
        }
        finally {
            setSaving(false);
        }
    }
    async function reloadSelected() { const latest = await load(); const c = latest?.find(c => c.id === selected?.id); if (c)
        setSelected(c); }
    function exportCSV() {
        const exported = view === 'Complaints' || view === 'SLA & escalations' ? rows : base;
        const values = [['Complaint', 'Issue summary', 'Issue category', 'District', 'Location', 'Ward', 'Zone', 'Priority', 'Status', 'Assigned officer', 'Reported on', 'Resolution details'].map(t), ...exported.map(c => [c.id, c.title, t(c.category), t(c.district), c.address, c.ward || '', c.zone || '', t(c.priority), t(c.status), c.officer || t('Unassigned'), date(c.createdAt), c.resolution])];
        const csv = values.map(row => row.map(v => '"' + (/^[=+@-]/.test(v) ? "'" : '') + v.replaceAll('"', '""') + '"').join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'UP.one-complaints.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    const drill = (risk: Risk) => navigate(risk === 'unassigned' ? 'Complaints' : 'SLA & escalations', { risk });
    const riskOptions: [
        Risk,
        string,
        number
    ][] = [['overdue', 'Overdue', m.overdue], ['near', 'Due within 48 hours', m.near], ['escalated', 'Escalated', m.escalated], ['escalation', 'Escalation required', m.escalation], ['critical', 'Critical', m.critical], ['', 'All cases', m.total]];
    const hasFilters = Object.entries(filters).some(([key, value]) => value !== emptyFilters[key as keyof Filters]);
    return <div className="shell"><a className="skip-link" href="#main">{t('Skip to content')}</a>
 {mobile && <button className="nav-scrim" aria-label={t('Close navigation')} onClick={() => { setMobile(false); menuRef.current?.focus(); }}/>}
 <aside className={'sidebar ' + (mobile ? 'expanded' : '')} aria-label={t('Operations')}><a className="brand" href="#main" onClick={() => navigate('Overview')}><Zap size={23}/><span>UP<span className="brand-accent">.one</span></span></a><div className="department"><span>{t('Government of Uttar Pradesh')}</span><strong>{t('Electrical Department')}</strong></div><nav>{navigation.map(({ name, icon: Icon }) => <button key={name} aria-current={view === name ? 'page' : undefined} className={view === name ? 'active' : ''} onClick={() => navigate(name)}><Icon size={18}/><span>{t(name)}</span>{name === 'Complaints' && <b>{items.length}</b>}</button>)}</nav><div className="sidebar-bottom"><strong>{t('Department Head')}</strong><span>{t('Demonstration workspace')}</span></div></aside>
 <div className="workspace"><header className="topbar"><div className="breadcrumb"><button ref={menuRef} className="icon-button mobile-toggle" aria-label={t('Open navigation')} aria-expanded={mobile} onClick={() => setMobile(!mobile)}><Menu size={22}/></button><span>{t('Electrical Department')}</span><ChevronRight size={14}/><strong>{t(view)}</strong></div><div className="language" role="group" aria-label={t('Language')}><button lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button><button lang="hi" aria-pressed={language === 'hi'} onClick={() => setLanguage('hi')}>हिन्दी</button></div></header>
 <main id="main"><div className="page-heading"><div><p className="eyebrow">{t('Operations')} / {t('Uttar Pradesh')}</p><h1 ref={headingRef} tabIndex={-1}>{t(view === 'Overview' ? 'Department overview' : view)}</h1></div><div className="heading-actions"><button className="button export" aria-label={t('Export report')} disabled={loading || !!loadError || !base.length} onClick={exportCSV}><ArrowDownToLine size={16}/><span>{t('Export report')}</span></button><button className="button primary" onClick={() => setCreating(true)}><Plus size={17}/>{t('New complaint')}</button></div></div>
 <section className="global-filters" aria-label={t('Filtered results')}><label className="search"><Search size={17}/><span className="sr-only">{t('Search complaints')}</span><input value={filters.query} onChange={e => patch({ query: e.target.value })} placeholder={t('Search ID, issue, location or officer')}/></label><label><span className="sr-only">{t('District')}</span><select value={filters.district} onChange={e => patch({ district: e.target.value })}><option value="">{t('All districts')}</option>{districts.map(d => <option key={d} value={d}>{t(d)}</option>)}</select></label><label><span className="sr-only">{t('Reporting period')}</span><select value={filters.period} onChange={e => patch({ period: e.target.value })}><option value="all">{t('All time')}</option><option value="30">{t('Last 30 days')}</option></select></label><button className="icon-button refresh" aria-label={t('Refresh')} title={t('Refresh')} disabled={loading} onClick={() => load()}><RefreshCw size={18}/></button></section>
 <div className="filter-context"><span>{loading ? t('Updating…') : refreshed ? `${t('Last refreshed')} ${new Date(refreshed).toLocaleTimeString(locale(language), { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST` : ''}</span>{hasFilters && <button className="text-button" onClick={() => setFilters({ ...emptyFilters })}><X size={14}/>{t('Clear all filters')}</button>}</div>
 {loadError ? <div className="error" role="alert"><p>{t(loadError)}</p><button className="button" onClick={() => load(true)}>{t('Retry')}</button></div> : loading && !items.length ? <div className="loading" role="status">{t('Loading complaints…')}</div> : !items.length ? <section className="panel empty"><h2>{t('No complaints found')}</h2><p>{t('Start with sample cases or register a new complaint.')}</p><button className="button" disabled={saving} onClick={async () => { try {
            await save({ action: 'seed' }, 'POST');
        }
        catch (e) {
            setLoadError((e as Error).message);
        } }}>{t('Load sample complaints')}</button></section> : <div aria-busy={loading}>
 {view === 'Overview' && <>
 <div className="stats">{[{ label: 'Total complaints', value: m.total, sub: `${m.completed} ${t('Completed cases')}` }, { label: 'Active complaints', value: m.active, sub: t('Awaiting resolution') }, { label: 'Overdue', value: m.overdue, sub: `${m.escalation} ${t('Escalation required')}`, alert: m.overdue > 0 }, { label: 'SLA compliance', value: m.compliance === null ? '—' : `${m.compliance}%`, sub: m.known ? `${m.met} / ${m.known} ${t('of completed cases met the SLA')}` : t('No resolution dates recorded') }].map(s => <section className={'stat ' + (s.alert ? 'stat-alert' : '')} key={s.label}><h2>{t(s.label)}</h2><strong>{s.value}</strong><p>{s.sub}</p></section>)}</div>
 <section className="attention panel"><div className="panel-heading"><h2>{t('Needs attention')}</h2><p>{t('Counts may overlap')}</p></div><div className="attention-actions">{([['critical', 'Critical', m.critical], ['near', 'Due within 48 hours', m.near], ['unassigned', 'Unassigned', m.unassigned], ['escalated', 'Active escalations', m.escalated]] as [
                Risk,
                string,
                number
            ][]).map(([risk, label, n]) => <button key={risk} onClick={() => drill(risk)}><strong className={risk === 'critical' && n ? 'critical-text' : ''}>{n}</strong><span>{t(label)}</span><ChevronRight size={17}/></button>)}</div></section>
 <section className="panel queue"><div className="panel-heading"><div><h2>{t('Priority queue')}</h2><p>{t('Critical first, then earliest deadline')}</p></div><button className="text-button" onClick={() => navigate('Complaints')}>{t('View all complaints')}<ArrowRight size={16}/></button></div><ComplaintTable rows={selectComplaints(base.filter(c => !done(c)), { ...emptyFilters }, now).slice(0, 5)} t={t} now={now} language={language} onOpen={setSelected}/></section>
 <div className="charts"><Trend items={base} t={t} language={language} now={now}/><RecurringPie items={base} t={t} onSelect={recurrence => navigate('Complaints', { recurrence })}/></div><div className="overview-links"><button className="text-button" onClick={() => navigate('District insights')}><MapPin size={16}/>{t('View district insights')}<ArrowRight size={16}/></button><button className="text-button" onClick={() => navigate('Officers')}><Users size={16}/>{t('View officer workload')}<ArrowRight size={16}/></button></div></>}
 {(view === 'Complaints' || view === 'SLA & escalations') && <>{view === 'SLA & escalations' && <><div className="risk-tabs" aria-label={t('SLA overview')}>{riskOptions.map(([risk, label, n]) => <button aria-pressed={filters.risk === risk} key={risk} onClick={() => patch({ risk })}><span>{t(label)}</span><strong>{n}</strong></button>)}</div><p className="section-note">{t('Complaints are escalated by the department head; overdue cases are flagged for review.')}</p></>}
 <section className="panel"><div className="list-filters"><label>{t('Status')}<select value={filters.status} onChange={e => patch({ status: e.target.value })}><option value="">{t('All statuses')}</option>{statuses.map(s => <option key={s} value={s}>{t(s)}</option>)}</select></label><label>{t('Priority')}<select value={filters.priority} onChange={e => patch({ priority: e.target.value })}><option value="">{t('All priorities')}</option>{['Critical', 'High', 'Normal'].map(s => <option key={s} value={s}>{t(s)}</option>)}</select></label><label>{t('Assigned officer')}<select value={filters.officer} onChange={e => patch({ officer: e.target.value })}><option value="">{t('All officers')}</option>{officers.map(s => <option key={s}>{s}</option>)}</select></label><label>{t('Sort by')}<select value={filters.sort} onChange={e => patch({ sort: e.target.value as Sort })}><option value="priority">{t('Priority and deadline')}</option><option value="oldest">{t('Oldest first')}</option><option value="newest">{t('Newest first')}</option></select></label></div>
 {(filters.recurrence || filters.risk) && <div className="active-filter"><span>{filters.recurrence ? `${t('Recurring issues')}: ${t(filters.recurrence)}` : t(filters.risk === 'unassigned' ? 'Unassigned' : riskOptions.find(r => r[0] === filters.risk)?.[1] || 'All cases')}</span><button className="icon-button" aria-label={t('Clear filters')} onClick={() => patch({ risk: '', recurrence: '' })}><X size={14}/></button></div>}
 <ComplaintTable rows={rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)} t={t} now={now} language={language} onOpen={setSelected}/><div className="pagination" aria-live="polite"><span>{t('Showing')} {rows.length ? safePage * PAGE_SIZE + 1 : 0}–{Math.min((safePage + 1) * PAGE_SIZE, rows.length)} {t('of')} {rows.length}</span>{pageCount > 1 && <div><button className="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>{t('Previous')}</button><button className="button" disabled={safePage === pageCount - 1} onClick={() => setPage(safePage + 1)}>{t('Next')}</button></div>}</div></section></>}
 {view === 'Officers' && <section className="panel"><div className="panel-heading"><div><h2>{t('Officer workload')}</h2><p>{t('Active assignments and overdue cases')}</p></div><button className="text-button" onClick={() => drill('unassigned')}>{m.unassigned} {t('Unassigned')}<ChevronRight size={16}/></button></div><div className="table-scroll"><table><thead><tr>{['Assigned officer', 'Active complaints', 'Overdue', 'Escalated', 'Resolved & closed', 'Actions'].map(s => <th scope="col" key={s}>{t(s)}</th>)}</tr></thead><tbody>{officers.map(officer => ({ officer, counts: metrics(base.filter(c => c.officer === officer), now) })).sort((a, b) => b.counts.overdue - a.counts.overdue || b.counts.active - a.counts.active).map(({ officer, counts }) => <tr key={officer}><th scope="row">{officer}</th><td>{counts.active}</td><td className={counts.overdue ? 'critical-text' : ''}>{counts.overdue}</td><td>{counts.escalated}</td><td>{counts.completed}</td><td><button className="text-button" aria-label={`${t('Complaints')}: ${officer}`} onClick={() => navigate('Complaints', { officer })}>{t('Complaints')}<ChevronRight size={16}/></button></td></tr>)}</tbody></table></div></section>}
 {view === 'District insights' && <div className="charts"><section className="panel"><div className="panel-heading"><div><h2>{t('District concentration')}</h2><p>{t('Complaints by district')}</p></div></div>{districts.map(d => ({ d, count: base.filter(c => c.district === d).length, late: base.filter(c => c.district === d && matchesRisk(c, 'overdue', now)).length })).filter(x => x.count).sort((a, b) => b.count - a.count).map(({ d, count, late }) => <button className="district-row" key={d} onClick={() => navigate('Complaints', { district: d })}><span><strong>{t(d)}</strong><small>{late} {t('overdue')}</small></span><span className="district-bar"><i style={{ width: `${count / Math.max(1, m.total) * 100}%` }}/></span><b>{count}</b><ChevronRight size={16}/></button>)}{!base.length && <div className="empty">{t('No matching districts')}</div>}</section><RecurringPie items={base} t={t} onSelect={recurrence => navigate('Complaints', { recurrence })}/></div>}
 </div>}<footer><span>UP.one · {t('Electrical Department')}</span><span>{t('Sample records · not connected to government systems')}</span></footer></main></div>
 {notice && <div className="toast" role="status">{t(notice)}<button className="icon-button" aria-label={t('Dismiss')} onClick={() => setNotice('')}><X size={16}/></button></div>}
 {selected && <ComplaintDialog key={selected.id} c={selected} t={t} date={date} sla={c => <Sla c={c} now={now} t={t}/>} now={now} saving={saving} close={() => setSelected(null)} save={save} reload={reloadSelected}/>}
 {creating && <NewDialog t={t} saving={saving} close={() => setCreating(false)} save={save}/>}
 </div>;
}

