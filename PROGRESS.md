# Avtopark — progress

## Decisions made by Giorgi

- **2026-10-27 — Who creates companies:** for now only Giorgi (platform admin) creates new rental companies. Each company owner then invites their own staff. Public sign-up comes later, together with subscription billing.

## Technical decisions (made by Claude, explained)

- **Supabase client instead of Prisma**: works directly with the database security rules (RLS), so the protection is stronger.
- **Supabase in Frankfurt** (closest to Georgia, data stays in the EU).
- **Three roles**: owner, manager, operator. Owner = manager + can manage other owners. A company always keeps at least one owner.
- **Platform admin cannot see companies' cars, customers or bookings** — only company names and staff counts. Better for privacy.
- **Prices are frozen in each booking**: the daily rate and extras prices are copied in, so later price changes do not change existing bookings.
- **Language is remembered per browser** (Georgian by default). Staff pages have no /ka or /en in the address.

## Phase 1 — Foundation: built, waiting for Supabase keys to test against the real database

Done (code):
- Next.js 16 project, Git, Tailwind with the demo's colors, light/dark mode, phone-first layout.
- Database (`supabase/migrations/20261028000001_foundation.sql`): companies, staff, settings (default prices from the demo), locations (Tbilisi/Kutaisi/Batumi airports + office), cars, customers, bookings, booking segments, fines, audit log.
- Security in the database itself:
  - every company sees only its own data (row level security on every table);
  - rows cannot point at another company's customer or car;
  - operators cannot change prices/deposits, blacklist, change settings, manage staff, or delete;
  - two bookings of the same car can never overlap (same-day turnover allowed; online requests block too; cancelled bookings free the car);
  - audit log of money, fines and blacklist changes (who, when, what changed);
  - login and password reset are rate-limited.
- Login, forgot password, set password (from invite/reset emails), sign out.
- Staff page (Settings → Staff): list, invite by email, change role, remove.
- Admin page (/admin): create a company and invite its owner.
- Georgian and English for every text.
- Demo data script: "Demo Rent" with the demo's 10 cars, 26 bookings (incl. the car replacement and 2 online requests), blacklisted Rustam Kerimov, 4 fines.
- Tests: 16 unit tests pass. 24 database security tests and 5 browser tests are written and will run once the keys are in `.env.local`.

Waiting on Giorgi (see docs/SETUP.md for exact clicks):
- [ ] Fill in the four Supabase values in `.env.local`
- [ ] Supabase dashboard: turn off public sign-up, set redirect URLs (email templates stay standard for now)
- [ ] GitHub username (to put the code online) and then connect Vercel

Then Claude will: apply the database, run all tests, load demo data, make Giorgi platform admin, deploy to Vercel.

## Next — Phase 2 (Fleet)

Vehicle list with status filters, add/edit vehicle, photos, service flag, reminders.

## Open questions for Giorgi

- None right now.

## Before real customers use it

- **Email service**: Supabase's built-in email only reaches your own address. Before inviting real staff we need an email service (e.g. Resend, free up to 3,000 emails/month) and ideally your own domain for sending. At the same time: Georgian/English email templates (docs/SETUP.md section 3). Until then emails are English-only and a password-reset link works only in the browser where it was requested.
- **Backups**: the Supabase free plan has no restorable backups. Before real data, upgrade to Pro (about $25/month) for daily backups.
- **Lawyer** (Georgian personal data protection law) — to confirm:
  - privacy notice text and consent checkbox on the public booking form (Phase 10);
  - how long we keep passport/license copies, and deleting them on request;
  - that storing data in the EU (Frankfurt) is fine for your customers;
  - contract terms text (Phase 6).
