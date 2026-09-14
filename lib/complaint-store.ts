import { env } from 'cloudflare:workers';
import { database } from './db';
import { demoIds, seed, type Complaint } from './domain';

export interface ComplaintStore {
 list(): Promise<Complaint[]>;
 find(id: string): Promise<Complaint | null>;
 insert(complaint: Complaint): Promise<void>;
 save(complaint: Complaint, previousVersion: number): Promise<boolean>;
 seed(): Promise<void>;
 curate(): Promise<number>;
}

const d1Store: ComplaintStore = {
 async list() {
  const rows = await database().prepare("SELECT payload FROM complaints WHERE coalesce(json_extract(payload,'$.demoArchived'),0)=0 ORDER BY id DESC").all<{payload:string}>();
  return rows.results.map(row => JSON.parse(row.payload));
 },
 async find(id) {
  const row = await database().prepare('SELECT payload FROM complaints WHERE id=?').bind(id).first<{payload:string}>();
  return row ? JSON.parse(row.payload) : null;
 },
 async insert(c) { await database().prepare('INSERT INTO complaints (id,payload,version) VALUES (?,?,?)').bind(c.id, JSON.stringify(c), c.version).run(); },
 async save(c, version) {
  const result = await database().prepare('UPDATE complaints SET payload=?,version=? WHERE id=? AND version=?').bind(JSON.stringify(c), c.version, c.id, version).run();
  return !!result.meta.changes;
 },
 async seed() { await database().batch(seed().map(c => database().prepare('INSERT OR IGNORE INTO complaints (id,payload,version) VALUES (?,?,1)').bind(c.id, JSON.stringify(c)))); },
 async curate() {
  const unused = Array.from({length:84}, (_, i) => `UP-EL-${20260001+i}`).filter(id => !demoIds.includes(id));
  const result = await database().prepare(`UPDATE complaints SET payload=json_set(payload,'$.demoArchived',json('true'),'$.version',version+1),version=version+1 WHERE id IN (${unused.map(() => '?').join(',')}) AND version=1 AND json_extract(payload,'$.history[0].note')=?`).bind(...unused, 'Complaint received through citizen portal.').run();
  return result.meta.changes;
 }
};

export function complaintStore(): ComplaintStore {
 return (env as unknown as {UP_STORE?: ComplaintStore}).UP_STORE || d1Store;
}
