'use client';
import { useEffect, useRef, useState } from 'react';
import { MapPin, Upload, X } from 'lucide-react';
import { categories, districts, officers, transitions, due, done, type Complaint, type Evidence } from '../lib/domain';
import { DAY, nextAction } from '../lib/operations';
import type { Translate } from '../lib/i18n';
import { Status } from './operations-ui';
export type SaveComplaint = (body: Record<string, unknown> | FormData, method?: string) => Promise<boolean>;
function Dialog({ children, close, title, t, dirty, busy }: {
    children: React.ReactNode;
    close: () => void;
    title: string;
    t: Translate;
    dirty: boolean;
    busy: boolean;
}) {
    const ref = useRef<HTMLElement>(null), current = useRef({ close, dirty, busy }), [discard, setDiscard] = useState(false);
    current.current = { close, dirty, busy };
    function requestClose() { if (current.current.busy)
        return; if (current.current.dirty)
        setDiscard(true);
    else
        current.current.close(); }
    useEffect(() => {
        const before = document.activeElement as HTMLElement, overflow = document.body.style.overflow;
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') {
            e.preventDefault();
            requestClose();
        } if (e.key === 'Tab') {
            const els = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary') || []).filter(el => el.getClientRects().length > 0);
            const first = els[0], last = els[els.length - 1];
            if (e.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) {
                e.preventDefault();
                last?.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            }
        } };
        document.addEventListener('keydown', key);
        document.body.style.overflow = 'hidden';
        ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
        return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; before?.focus(); };
    }, []);
    return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget)
        requestClose(); }}><section ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><h2 id="dialog-title">{title}</h2><button type="button" className="icon-button" aria-label={t('Close')} disabled={busy} onClick={requestClose}><X size={21}/></button></header>{discard && <div className="discard" role="alert"><strong>{t('Discard unsaved changes?')}</strong><p>{t('Your changes have not been saved.')}</p><div><button className="button" type="button" onClick={() => setDiscard(false)}>{t('Keep editing')}</button><button className="button danger" type="button" onClick={close}>{t('Discard changes')}</button></div></div>}{children}</section></div>;
}
function LocationFields({ t, c }: {
    t: Translate;
    c?: Complaint;
}) {
    return <fieldset className="location-fields"><legend>{t('Complaint location')}</legend><div className="form-grid"><label>{t('District')}<select name="district" defaultValue={c?.district || districts[0]}>{districts.map(d => <option key={d} value={d}>{t(d)}</option>)}</select></label><label>{t('Ward')} <small>{t('Optional')}</small><input name="ward" maxLength={100} defaultValue={c?.ward || ''}/></label></div><label>{t('Zone')} <small>{t('Optional')}</small><input name="zone" maxLength={100} defaultValue={c?.zone || ''}/></label><label>{t('Location / address')}<textarea name="address" required maxLength={500} defaultValue={c?.address || ''} placeholder={t('Village / locality, ward, road and nearest landmark')}/></label><details className="coordinates" open={c?.latitude != null}><summary>{t('Map coordinates (optional)')}</summary><div className="form-grid"><label>{t('Latitude')}<input name="latitude" type="number" step="any" min="-90" max="90" defaultValue={c?.latitude ?? ''}/></label><label>{t('Longitude')}<input name="longitude" type="number" step="any" min="-180" max="180" defaultValue={c?.longitude ?? ''}/></label></div><small>{t('Enter both coordinates, or leave both blank.')}</small></details></fieldset>;
}
function Photo({ id, photo, t }: {
    id: string;
    photo: Evidence;
    t: Translate;
}) {
    const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0), src = `/api/complaints/photo?complaint=${encodeURIComponent(id)}&photo=${encodeURIComponent(photo.id)}`;
    return <figure className="evidence-photo">{failed ? <div className="photo-error">{t('Photo unavailable')}<button type="button" className="text-button" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>{t('Retry')}</button></div> : <a href={src} target="_blank" rel="noreferrer"><img key={attempt} src={src + (attempt ? `&retry=${attempt}` : '')} alt={t('Photo of completed repair')} onError={() => setFailed(true)}/></a>}<figcaption>{t('Resolution photo')} · {photo.name}</figcaption></figure>;
}
export function ComplaintDialog({ c, t, date, sla, now, saving, close, save, reload }: {
    c: Complaint;
    t: Translate;
    date: (s: string) => string;
    sla: (c: Complaint) => React.ReactNode;
    now: number;
    saving: boolean;
    close: () => void;
    save: SaveComplaint;
    reload: () => Promise<void>;
}) {
    const [status, setStatus] = useState(c.status), [officer, setOfficer] = useState(c.officer), [note, setNote] = useState(''), [photo, setPhoto] = useState<File | null>(null), [preview, setPreview] = useState(''), [error, setError] = useState(''), [dirty, setDirty] = useState(false), [editingLocation, setEditingLocation] = useState(false);
    const resolving = status === 'Resolved' && c.status !== 'Resolved', changing = status !== c.status;
    useEffect(() => { setStatus(c.status); setOfficer(c.officer); }, [c.version, c.status, c.officer]);
    useEffect(() => { if (!photo) {
        setPreview('');
        return;
    } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
    const mapQuery = c.latitude != null && c.longitude != null ? `${c.latitude},${c.longitude}` : `${c.address}, ${c.district}, Uttar Pradesh`;
    async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setError(''); if (resolving && !photo) {
        setError('A repair photo is required to resolve this complaint.');
        return;
    } const form = new FormData(e.currentTarget); form.set('id', c.id); form.set('version', String(c.version)); form.set('status', status); form.set('officer', officer); form.set('note', note); form.delete('photo'); if (resolving && photo)
        form.set('photo', photo); try {
        if (await save(form)) {
            setNote('');
            setPhoto(null);
            setDirty(false);
            setEditingLocation(false);
        }
    }
    catch (e) {
        setError((e as Error).message);
    } }
    const history = (events: Complaint['history']) => <ol className="timeline">{[...events].reverse().map((h, i) => <li key={`${h.at}-${i}`}><div className="history-heading"><strong>{t(h.action)}</strong><time dateTime={h.at}>{date(h.at)} IST</time></div><p>{t(h.note)}</p>{h.actor && <small>{t('Recorded by')}: {t(h.actor)}</small>}{h.officer && <small>{t('Officer changed to')}: {t(h.officer)}</small>}{h.location && <small>{t('Location updated')}: {h.location}</small>}{h.photo && h.photo.id !== c.resolutionPhoto?.id && <Photo id={c.id} photo={h.photo} t={t}/>}</li>)}</ol>;
    return <Dialog close={close} title={t('Complaint details')} t={t} dirty={dirty} busy={saving}><div className="dialog-body"><div className="case-heading"><span className="eyebrow">{c.id}</span><Status value={c.status} t={t}/><h2>{t(c.title)}</h2><p>{t(c.category)} · <span className={'severity ' + c.priority.toLowerCase()}>{t(c.priority)}</span></p></div><div className="next-action"><strong>{t('Next action')}</strong><p>{t(nextAction(c, now))}</p></div><dl className="detail-fields"><div><dt>{t('Assigned officer')}</dt><dd>{t(c.officer) || t('Unassigned')}</dd></div><div><dt>{t('SLA status')}</dt><dd>{sla(c)}</dd></div><div><dt>{t('Reported on')}</dt><dd>{date(c.createdAt)} IST</dd></div><div><dt>{t('Due by')}</dt><dd>{date(new Date(due(c)).toISOString())} IST</dd></div>{!done(c) && <div><dt>{t('Open for')}</dt><dd>{Math.max(0, Math.floor((now - +new Date(c.createdAt)) / DAY))} {t('days')}</dd></div>}<div><dt>{t('Citizen')}</dt><dd>{c.citizen}</dd></div></dl>
 <section className="detail-section"><h3>{t('Complaint location')}</h3><p className="location-address">{c.address}, {t(c.district)}</p><dl className="detail-fields small"><div><dt>{t('Ward')}</dt><dd>{c.ward || t('Not recorded')}</dd></div><div><dt>{t('Zone')}</dt><dd>{c.zone || t('Not recorded')}</dd></div></dl><a className="map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer"><MapPin size={15}/>{t('View location on map')}</a></section><section className="detail-section"><h3>{t('Citizen report')}</h3><p className="report-text">{c.description || t(c.title)}</p></section><section className="detail-section"><h3>{t('Attachments & resolution')}</h3><p>{t(c.resolution || 'Not resolved yet')}</p>{c.resolutionPhoto ? <Photo id={c.id} photo={c.resolutionPhoto} t={t}/> : c.resolvedAt && <p className="section-note">{t('No photo attached to this earlier resolution.')}</p>}</section>
 <form className="update-form" onSubmit={submit} onChange={() => setDirty(true)}><h3>{t('Update complaint')}</h3><fieldset disabled={saving} className="plain-fieldset"><div className="form-grid"><label>{t('Assigned officer')}<select aria-label={t('Assigned officer')} value={officer} onChange={e => { setOfficer(e.target.value); if (c.status === 'New' && e.target.value && status === 'New')
        setStatus('Assigned'); if (c.status === 'New' && !e.target.value && status === 'Assigned')
        setStatus('New'); }} required={status !== 'New'}>{['', ...officers].map(o => <option key={o} value={o}>{t(o) || t('Unassigned')}</option>)}</select></label><label>{t('Status')}<select aria-label={t('Status')} value={status} onChange={e => { setStatus(e.target.value); setError(''); if (e.target.value === 'New')
        setOfficer(''); }}>{[c.status, ...(transitions[c.status] || [])].map(s => <option key={s} value={s}>{t(s)}</option>)}</select></label></div>{c.status === 'New' && <p className="section-note">{t('New assignment changes the status to Assigned.')}</p>}<details className="edit-location" open={editingLocation} onToggle={e => setEditingLocation(e.currentTarget.open)}><summary>{t('Edit complaint location')}</summary>{editingLocation && <LocationFields t={t} c={c}/>}</details><label>{t(changing && status === 'Escalated' ? 'Escalation reason' : changing && status === 'Reopened' ? 'Reason for reopening' : changing && status === 'Closed' ? 'Closure verification note' : resolving ? 'Resolution details' : 'Activity note / resolution details')}<textarea required maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder={t('Describe the action taken…')}/></label>
 {resolving && <div className="photo-upload"><label htmlFor="resolution-photo"><span><Upload size={16}/>{t('Resolution photo')} · {t('Required')}</span><small>{t('Upload a photo showing the completed repair. JPEG, PNG or WebP · up to 4 MB.')}</small></label><input id="resolution-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0] || null; setPhoto(null); setError(''); if (f && (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 4 * 1024 * 1024 || !f.size)) {
        setError('Choose a JPEG, PNG or WebP photo up to 4 MB.');
        e.target.value = '';
        return;
    } setPhoto(f); }}/>{preview && <div className="upload-preview"><img src={preview} alt={t('Selected repair photo')} onError={() => { setPhoto(null); setError('This image cannot be opened. Choose another photo.'); }}/><span>{photo?.name}</span><button type="button" className="text-button" onClick={() => { setPhoto(null); const input = document.getElementById('resolution-photo') as HTMLInputElement; if (input)
        input.value = ''; }}>{t('Remove photo')}</button></div>}</div>}{changing && status === 'Closed' && <p className="section-note">{t('Closing confirms that you have reviewed the resolution evidence.')}</p>}{error && <div className="form-error" role="alert"><p>{t(error)}</p>{error.includes('Reload') && <button type="button" className="text-button" onClick={async () => { await reload(); setError(''); }}>{t('Reload latest complaint')}</button>}</div>}<div className="form-actions"><button className="button primary" disabled={saving || !note.trim() || (resolving && !photo)}>{t(saving ? 'Saving…' : resolving ? 'Submit as resolved' : changing && status === 'Escalated' ? 'Escalate complaint' : changing && status === 'Closed' ? 'Confirm closure' : changing && status === 'Reopened' ? 'Reopen complaint' : 'Save update')}</button></div></fieldset></form>
 <details className="history-details" open><summary>{t('Activity & history')} <span className="count">{c.history.length}</span></summary>{history(c.history)}</details><p className="section-note">{t('SLA clock starts when reported; reopening keeps the original deadline.')}</p></div></Dialog>;
}
export function NewDialog({ t, saving, close, save }: {
    t: Translate;
    saving: boolean;
    close: () => void;
    save: SaveComplaint;
}) {
    const [dirty, setDirty] = useState(false), [error, setError] = useState('');
    return <Dialog close={close} title={t('New complaint')} t={t} dirty={dirty} busy={saving}><form className="dialog-body" onChange={() => setDirty(true)} onSubmit={async (e) => { e.preventDefault(); setError(''); try {
        await save(Object.fromEntries(new FormData(e.currentTarget)), 'POST');
    }
    catch (e) {
        setError((e as Error).message);
    } }}><fieldset className="plain-fieldset" disabled={saving}><label>{t('Issue summary')}<input name="title" required maxLength={500}/></label><label>{t('Citizen report')} <small>{t('Optional')}</small><textarea name="description" maxLength={3000} placeholder={t('Describe the issue and its impact')}/></label><label>{t('Issue category')}<select name="category">{categories.map(c => <option key={c} value={c}>{t(c)}</option>)}</select></label><LocationFields t={t}/><div className="form-grid"><label>{t('Citizen name')}<input name="citizen" required maxLength={500}/></label><label>{t('Priority')}<select name="priority">{['Normal', 'High', 'Critical'].map(c => <option key={c} value={c}>{t(c)}</option>)}</select></label></div>{error && <p className="form-error" role="alert">{t(error)}</p>}<div className="form-actions"><button className="button primary" disabled={saving}>{t(saving ? 'Saving…' : 'Register complaint')}</button></div></fieldset></form></Dialog>;
}
