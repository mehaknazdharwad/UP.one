# UP.one — UP Electrical Department

A functional bilingual demonstration dashboard with D1-backed complaints, seven lifecycle states, officer assignments, optimistic concurrency, activity history, seven-day SLA monitoring, district/category analysis, and CSV exports.

This is a demonstration, not an official government service. Eight sample districts and six sample officers are configured in `lib/domain.ts`. No real citizen system is connected. Hosted access is owner-private through Sites; a government deployment needs its own approved identity, roles, officer directory, citizen intake integration, and operational security review.

## Run locally

1. Install Node 22.13+ and run `npm ci`.
2. Run `npm run build`.
3. Apply the migration with `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_true_thing.sql`.
4. Run `npm start`, then open the printed local URL. Select **Load sample complaints** or register a new complaint.

Use `npm run dev` for development after local migration. `npm run build` produces a Cloudflare-compatible Worker. Use the Sites publishing workflow for the registered private deployment. No GitHub secrets or tokens are stored in source.

## Operational rules

- Deadline is the original report time plus exactly seven 24-hour days. Reopening does not reset it.
- Due within 48 hours excludes overdue and resolved/closed cases.
- SLA compliance is completed cases resolved by their deadline divided by all completed cases in the report-created-date cohort.
- Officer assignment is required beyond New. New resolutions require a note and a JPEG, PNG or WebP repair photo (maximum 5 MB). Photos are saved in private R2 storage and served only when referenced by the complaint history. Reopening clears the current resolution while retaining all historical evidence. Earlier sample resolutions are labeled when no photo exists.
- Complaint location includes a required address and district, optional paired latitude/longitude, a map link, and an editable location section with changes recorded in history.
- Concurrent updates return 409 rather than silently overwriting another user's work.
- Sample data loads only through an explicit action and is idempotent. The demo contains 15 complaints spanning every lifecycle status. On opening the app, an idempotent archival action retires the 69 unused, untouched legacy samples; custom complaints, edited samples, and uploaded evidence are retained. Archived rows remain in storage and are excluded from dashboard queries.
- Recurring issues means the same category appearing in at least two complaints in the same district within the selected reporting cohort. The pie counts all complaints in those groups; its legend opens the matching cases. This is a pattern indicator, not proof of a shared root cause.
- User-entered text remains in its original language; interface labels switch between Hindi and English.
- The trend chart covers the most recent 30 days; all-time filters apply to totals, queues and district/category analysis.

## GitHub

Requested owner: `mehaknazd`. Repository publication is pending sign-in or repository write access for that account. The existing local GitHub account is a different identity.
