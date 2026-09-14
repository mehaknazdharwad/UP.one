import { done, due, recurringGroups, type Complaint } from './domain';
export const DAY = 86400000;
export type Risk = '' | 'overdue' | 'near' | 'critical' | 'escalated' | 'unassigned' | 'escalation';
export type Sort = 'priority' | 'oldest' | 'newest';
export type Filters = {
    query: string;
    district: string;
    period: string;
    status: string;
    priority: string;
    officer: string;
    risk: Risk;
    recurrence: string;
    sort: Sort;
};
export const emptyFilters: Filters = { query: '', district: '', period: 'all', status: '', priority: '', officer: '', risk: '', recurrence: '', sort: 'priority' };
export function slaState(c: Complaint, now = Date.now()) {
    if (done(c))
        return !c.resolvedAt ? 'unknown' : +new Date(c.resolvedAt) <= due(c) ? 'met' : 'late';
    const left = due(c) - now;
    return left <= 0 ? 'overdue' : left <= 2 * DAY ? 'near' : 'on-track';
}
export function matchesRisk(c: Complaint, risk: Risk, now = Date.now()) {
    if (!risk)
        return true;
    if (done(c))
        return false;
    if (risk === 'critical')
        return c.priority === 'Critical';
    if (risk === 'escalated')
        return c.status === 'Escalated';
    if (risk === 'unassigned')
        return !c.officer;
    if (risk === 'escalation')
        return slaState(c, now) === 'overdue' && c.status !== 'Escalated';
    return slaState(c, now) === risk;
}
export function cohort(items: Complaint[], f: Filters, now: number, t: (s: string) => string) {
    const query = f.query.trim().toLocaleLowerCase();
    return items.filter(c => (!f.district || c.district === f.district) && (f.period === 'all' || +new Date(c.createdAt) >= now - 30 * DAY) && (!query || [c.id, c.title, t(c.title), c.category, t(c.category), c.district, t(c.district), c.address, c.ward, c.zone, c.citizen, c.officer, t(c.officer)].join(' ').toLocaleLowerCase().includes(query)));
}
export function selectComplaints(base: Complaint[], f: Filters, now: number) {
    const recurring = new Set(recurringGroups(base).filter(g => g[0].category === f.recurrence).flat().map(c => c.id));
    return base.filter(c => (!f.status || c.status === f.status) && (!f.priority || c.priority === f.priority) && (!f.officer || c.officer === f.officer) && (!f.recurrence || recurring.has(c.id)) && matchesRisk(c, f.risk, now)).sort((a, b) => {
        if (f.sort === 'newest')
            return +new Date(b.createdAt) - +new Date(a.createdAt);
        if (f.sort === 'oldest')
            return +new Date(a.createdAt) - +new Date(b.createdAt);
        return Number(done(a)) - Number(done(b)) || Number(b.priority === 'Critical') - Number(a.priority === 'Critical') || due(a) - due(b) || a.id.localeCompare(b.id);
    });
}
export function metrics(items: Complaint[], now: number) {
    const active = items.filter(c => !done(c)), completed = items.filter(done), known = completed.filter(c => !!c.resolvedAt);
    const met = known.filter(c => slaState(c, now) === 'met').length;
    return { total: items.length, active: active.length, completed: completed.length, known: known.length, met, compliance: known.length ? Math.round(met / known.length * 100) : null, overdue: items.filter(c => matchesRisk(c, 'overdue', now)).length, near: items.filter(c => matchesRisk(c, 'near', now)).length, critical: items.filter(c => matchesRisk(c, 'critical', now)).length, escalated: items.filter(c => matchesRisk(c, 'escalated', now)).length, unassigned: items.filter(c => matchesRisk(c, 'unassigned', now)).length, escalation: items.filter(c => matchesRisk(c, 'escalation', now)).length };
}
export function nextAction(c: Complaint, now: number) {
    if (c.status === 'Resolved')
        return 'Verify the repair evidence and close, or reopen with a reason.';
    if (c.status === 'Closed')
        return 'Closed. Reopen only if the issue has returned.';
    if (!c.officer)
        return 'Assign a responsible officer to begin work.';
    if (c.status === 'Escalated')
        return 'Review the escalation and record the next action.';
    if (slaState(c, now) === 'overdue')
        return 'SLA breached. Escalate or record progress toward resolution.';
    if (c.status === 'Assigned' || c.status === 'Reopened')
        return 'Confirm the officer has started work.';
    return 'Record progress, or submit the completed repair with a photo.';
}
// Trend counts resolution events from history, including repairs later reopened.
export function trendBins(items: Complaint[], now: number) {
    return Array.from({ length: 6 }, (_, i) => {
        const start = now - (30 - i * 5) * DAY, end = start + 5 * DAY;
        return { start, reported: items.filter(c => +new Date(c.createdAt) >= start && +new Date(c.createdAt) < end).length, resolved: items.reduce((n, c) => {
                const events = c.history.filter(h => h.action === 'Resolved' && h.fromStatus !== 'Resolved');
                const times = events.length ? events.map(h => h.at) : c.resolvedAt ? [c.resolvedAt] : [];
                return n + times.filter(at => +new Date(at) >= start && +new Date(at) < end).length;
            }, 0) };
    });
}
