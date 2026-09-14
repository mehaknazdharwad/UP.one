import { database } from '../../../lib/db';
import { categories, districts, officers, seed, demoIds, transitions, type Complaint } from '../../../lib/domain';
import { z } from 'zod';
import { allowed, authorized } from '../../../lib/access';
import { boundedForm, bucket, imageType, MAX_PHOTO_BYTES } from '../../../lib/photos';
const coordinate = (min: number, max: number) => z.preprocess(v => v === '' || v === null || v === undefined ? null : v, z.coerce.number().min(min).max(max).nullable());
const locationFields = { latitude: coordinate(-90, 90), longitude: coordinate(-180, 180) };
const areaFields = { ward: z.string().trim().max(100).optional(), zone: z.string().trim().max(100).optional() };
const coordinatesTogether = (v: {
    latitude: number | null;
    longitude: number | null;
}) => (v.latitude === null) === (v.longitude === null);
const newComplaint = z.object({ title: z.string().trim().min(1).max(500), category: z.enum(categories), district: z.string().refine(x => districts.includes(x)), address: z.string().trim().min(1).max(500), citizen: z.string().trim().min(1).max(500), priority: z.enum(['Critical', 'High', 'Normal']), description: z.string().trim().max(3000).optional(), ...areaFields, ...locationFields }).refine(coordinatesTogether);
const update = z.object({ id: z.string(), version: z.coerce.number().int(), status: z.string(), officer: z.string().refine(x => ['', ...officers].includes(x)), note: z.string().trim().min(1).max(2000), address: z.string().trim().min(1).max(500).optional(), district: z.string().refine(x => districts.includes(x)).optional(), ...areaFields, ...locationFields }).refine(coordinatesTogether);
const fail = (error: string, status = 400) => Response.json({ error }, { status });
export async function GET(req: Request) {
    if (!authorized(req))
        return fail('Sign in to access complaints. / शिकायतें देखने के लिए साइन इन करें।', 401);
    try {
        const result = await database().prepare("SELECT payload FROM complaints WHERE coalesce(json_extract(payload,'$.demoArchived'),0)=0 ORDER BY id DESC").all<{
            payload: string;
        }>();
        return Response.json({ complaints: result.results.map(r => JSON.parse(r.payload)) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (e) {
        console.error(e);
        return fail('Unable to load complaints. Please retry. / शिकायतें लोड नहीं हुईं। पुनः प्रयास करें।', 503);
    }
}
export async function POST(req: Request) {
    if (!allowed(req))
        return fail('Unauthorized / अनुमति नहीं है', 403);
    try {
        const body = await req.json();
        const db = database();
        if (body && typeof body === 'object' && 'action' in body && body.action === 'curate-demo-15') {
            // User-requested, reversible retirement of pristine generated samples only.
            // Custom complaints, edits, and evidence are never touched.
            const unused = Array.from({ length: 84 }, (_, i) => `UP-EL-${20260001 + i}`).filter(id => !demoIds.includes(id));
            const result = await db.prepare(`UPDATE complaints SET payload=json_set(payload,'$.demoArchived',json('true'),'$.version',version+1),version=version+1 WHERE id IN (${unused.map(() => '?').join(',')}) AND version=1 AND json_extract(payload,'$.history[0].note')=?`).bind(...unused, 'Complaint received through citizen portal.').run();
            return Response.json({ archived: result.meta.changes });
        }
        if (body && typeof body === 'object' && 'action' in body && body.action === 'seed') {
            await db.batch(seed().map(c => db.prepare('INSERT OR IGNORE INTO complaints (id,payload,version) VALUES (?,?,1)').bind(c.id, JSON.stringify(c))));
            return Response.json({ ok: true });
        }
        const parsed = newComplaint.safeParse(body);
        if (!parsed.success)
            return fail('Please provide valid complaint details. / सही शिकायत विवरण भरें।');
        const now = new Date().toISOString();
        const c: Complaint = { ...parsed.data, id: `UP-EL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: 'New', officer: '', createdAt: now, updatedAt: now, resolvedAt: null, resolution: '', history: [{ at: now, action: 'New', note: 'Complaint received and routed to the Electrical Department.' }], version: 1 };
        await db.prepare('INSERT INTO complaints (id,payload,version) VALUES (?,?,1)').bind(c.id, JSON.stringify(c)).run();
        return Response.json(c, { status: 201 });
    }
    catch (e) {
        console.error(e);
        return fail('Unable to save. Please retry. / सहेजा नहीं गया। पुनः प्रयास करें।', 503);
    }
}
export async function PATCH(req: Request) {
    if (!allowed(req))
        return fail('Unauthorized / अनुमति नहीं है', 403);
    let uploadedKey: string | null = null;
    try {
        const multipart = req.headers.get('content-type')?.startsWith('multipart/form-data');
        const form = multipart ? await boundedForm(req) : null;
        const raw = form ? Object.fromEntries(form) : await req.json();
        const file = form?.get('photo');
        const parsed = update.safeParse(raw);
        if (!parsed.success)
            return fail('Check the location and enter an activity note. / स्थान जाँचें और गतिविधि नोट भरें।');
        const body = parsed.data, db = database();
        const row = await db.prepare('SELECT payload,version FROM complaints WHERE id=?').bind(body.id).first<{
            payload: string;
            version: number;
        }>();
        if (!row)
            return fail('Complaint not found. / शिकायत नहीं मिली।', 404);
        if (row.version !== body.version)
            return fail('This complaint changed. Reload before saving. / शिकायत बदल गई है। पुनः लोड करें।', 409);
        const c: Complaint = JSON.parse(row.payload), oldOfficer = c.officer;
        if (raw && typeof raw === 'object' && !('latitude' in raw) && !('longitude' in raw)) {
            body.latitude = c.latitude ?? null;
            body.longitude = c.longitude ?? null;
        }
        if (!(body.status === c.status || transitions[c.status]?.includes(body.status)))
            return fail('Invalid status transition. / अमान्य स्थिति परिवर्तन।');
        if (body.status !== 'New' && !body.officer)
            return fail('Assign an officer first. / पहले अधिकारी नियुक्त करें।');
        if (body.status === 'New' && body.officer)
            return fail('Select Assigned when assigning an officer. / अधिकारी नियुक्त करते समय नियुक्त स्थिति चुनें।');
        const resolving = body.status === 'Resolved' && c.status !== 'Resolved';
        let photo: Complaint['resolutionPhoto'];
        if (resolving) {
            if (!file || typeof file === 'string' || !file.size)
                return fail('Add a photo of the completed repair before resolving. / निस्तारण से पहले मरम्मत की फोटो जोड़ें।');
            if (file.size > MAX_PHOTO_BYTES)
                return fail('Photo must be 5 MB or smaller. / फोटो 5 MB या कम होनी चाहिए।', 413);
            const bytes = new Uint8Array(await file.arrayBuffer()), mime = imageType(bytes);
            if (!mime || mime !== file.type)
                return fail('Upload a JPEG, PNG or WebP photo. / JPEG, PNG या WebP फोटो चुनें।');
            photo = { id: crypto.randomUUID(), mime, name: file.name.slice(0, 180) };
            uploadedKey = `resolution/${c.id}/${photo.id}`;
            await bucket().put(uploadedKey, bytes, { httpMetadata: { contentType: mime } });
        }
        else if (file && typeof file !== 'string' && file.size)
            return fail('Select Resolved to submit a repair photo. / मरम्मत की फोटो जमा करने के लिए निस्तारित चुनें।');
        const locationChanged = (body.ward !== undefined && body.ward !== (c.ward || '')) || (body.zone !== undefined && body.zone !== (c.zone || '')) || (body.address !== undefined && body.address !== c.address) || (body.district !== undefined && body.district !== c.district) || body.latitude !== (c.latitude ?? null) || body.longitude !== (c.longitude ?? null);
        if (body.ward !== undefined)
            c.ward = body.ward;
        if (body.zone !== undefined)
            c.zone = body.zone;
        if (body.address !== undefined)
            c.address = body.address;
        if (body.district !== undefined)
            c.district = body.district;
        c.latitude = body.latitude;
        c.longitude = body.longitude;
        const now = new Date().toISOString(), previousStatus = c.status;
        c.status = body.status;
        c.officer = body.officer;
        c.updatedAt = now;
        c.version++;
        if (resolving) {
            c.resolvedAt = now;
            c.resolution = body.note;
            c.resolutionPhoto = photo;
        }
        if (body.status === 'Reopened' && previousStatus !== 'Reopened') {
            c.resolvedAt = null;
            c.resolution = '';
            c.resolutionPhoto = null;
        }
        const actor = req.headers.get('oai-authenticated-user-email') || 'Local department head';
        c.history.push({ at: now, action: body.status, fromStatus: previousStatus, note: body.note, actor, ...(body.officer !== oldOfficer ? { officer: body.officer } : {}), ...(locationChanged ? { location: [c.district, c.address, c.ward, c.zone, c.latitude != null ? `(${c.latitude}, ${c.longitude})` : ''].filter(Boolean).join(', ') } : {}), ...(photo ? { photo } : {}) });
        const result = await db.prepare('UPDATE complaints SET payload=?,version=? WHERE id=? AND version=?').bind(JSON.stringify(c), c.version, c.id, row.version).run();
        if (!result.meta.changes) {
            if (uploadedKey)
                await bucket().delete(uploadedKey);
            return fail('This complaint changed. Reload before saving. / शिकायत बदल गई है। पुनः लोड करें।', 409);
        }
        uploadedKey = null;
        return Response.json(c);
    }
    catch (e) {
        console.error(e);
        if ((e as Error).message === 'UPLOAD_TOO_LARGE')
            return fail('Photo must be 5 MB or smaller. / फोटो 5 MB या कम होनी चाहिए।', 413);
        return fail('Unable to save. Your photo and note can be retried. / सहेजा नहीं गया। फोटो और नोट के साथ पुनः प्रयास करें।', 503);
    }
}
