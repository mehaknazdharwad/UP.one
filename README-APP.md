# UP.one — UP Electrical Department

A functional bilingual demonstration dashboard with D1-backed complaints, seven lifecycle states, officer assignments, optimistic concurrency, activity history, seven-day SLA monitoring, district/category analysis, and CSV exports.

This is a demonstration, not an official government service. Eight sample districts and six sample officers are configured in `lib/domain.ts`. No real citizen system is connected. Hosted access is owner-private through Sites; a government deployment needs its own approved identity, roles, officer directory, citizen intake integration, and operational security review.

## Run locally

1. Install Node 22.13+ and run `npm ci`.
2. Run `npm run build`.
3. Apply the migration with `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_true_thing.sql`.
4. Run `npm start`, then open the printed local URL. Select **Load sample complaints** or register a new complaint.

Use `npm run dev` for development after local migration. `npm run build` produces a Cloudflare-compatible Worker. Use the Sites publishing workflow for the registered private deployment. No GitHub secrets or tokens are stored in source.

## Vercel hosting

Vercel uses `next build --webpack` and the storage adapter in `lib/vercel-env.ts`. The small demonstration dataset lives in a private Blob object; consistent reads and conditional ETag writes protect concurrent updates. Repair photos are separate private objects. This is a demo storage design, not a replacement for a production grievance database at government scale.

Set `UP_DASHBOARD_PASSWORD` as a Vercel Secret. The username defaults to `mehaknazd-1657` and can be changed with `UP_DASHBOARD_USER`. The dashboard and APIs require a signed, eight-hour, HttpOnly session cookie over HTTPS; logout clears the session. Private Blob credentials are configured by the project's storage connection. Never commit environment files or sign-in details. Vercel starts with its own 15 samples; it does not migrate the original host's records.

For isolated verification, set `UP_STORAGE_PREFIX` to a unique test prefix. The production default is `dashboard`. The existing Sites deployment continues using D1 and R2 through the same complaint-store interface.

## Operational rules

- Deadline is the original report time plus exactly seven 24-hour days. Reopening does not reset it.
- Due within 48 hours excludes overdue and resolved/closed cases.
- SLA compliance is completed cases resolved by their deadline divided by completed cases with a recorded resolution date in the selected report-created-date cohort. The denominator is displayed; missing resolution dates are Unknown.
- Officer assignment is required beyond New. New resolutions require a note and a JPEG, PNG or WebP repair photo (maximum 4 MB). Photos are saved in private storage and served only when referenced by the complaint history. Reopening clears the current resolution while retaining all historical evidence. Earlier sample resolutions are labeled when no photo exists.
- Complaint location includes a required address and district, optional ward/zone and paired latitude/longitude, a map link, and an editable location section. New activities store actor, owner/location changes and previous status separately from the user's note.
- Concurrent updates return 409 rather than silently overwriting another user's work.
- Sample data loads only through an explicit action and is idempotent. The demo contains 15 complaints spanning every lifecycle status. On opening the app, an idempotent archival action retires the 69 unused, untouched legacy samples; custom complaints, edited samples, and uploaded evidence are retained. Archived rows remain in storage and are excluded from dashboard queries.
- Recurring issues means the same category appearing in at least two complaints in the same district within the selected reporting cohort. The pie counts all complaints in those groups; its legend opens the matching cases. This is a pattern indicator, not proof of a shared root cause.
- User-entered text remains in its original language; interface labels switch between Hindi and English.
- The trend chart covers the most recent 30 days in five-day intervals, counting resolution transitions in history even if a case was reopened. Notes on an already resolved case do not count as additional repairs. Global search, district and reporting-period filters apply to every view.
- Overdue means now is at or beyond the original seven-day deadline. Escalated and escalation-required queues are distinct: escalation is recorded by the department head; an overdue case is flagged for review without pretending an external notification has been sent.

## Review and validation

See `PRODUCT-REVIEW.md` for the assessment and retained production boundaries. Shared selectors are in `lib/operations.ts`, translations in `lib/i18n.ts`, and complaint workflows in `app/complaint-dialogs.tsx`. Inter and Noto Sans Devanagari are self-hosted with their OFL licenses.

Run `node scripts/test-operations.mjs` for SLA boundaries, counts, recurring groups, Hindi search and resolution-event history. Run `node scripts/test-workflow.mjs <local-url>` only against an isolated local test database; it creates test records and exercises transitions, required images, locations, history and concurrency. Browser review covered English/Hindi, 1440/1280/768/390px layouts, 200% text, navigation, filters, the complaint lifecycle, keyboard focus, unsaved edits and error recovery.

## GitHub

Public source repository: [mehaknazdharwad/UP.one](https://github.com/mehaknazdharwad/UP.one). The hosted demonstration retains its own access controls; publishing source does not publish stored complaints or uploaded photos.
