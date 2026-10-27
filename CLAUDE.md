# Avtopark — rental management for small car rental companies in Georgia

## Who you are working with

The owner, Giorgi, works at a car rental desk and knows this business from the inside. He is **not reviewing code line by line**. That makes you responsible for quality, security and tests. In return:

- Explain every finished step in plain, simple language (short, no jargon), so he can make decisions.
- Ask him before any decision that changes how the business works (pricing rules, what staff can see, what customers see). Do not ask him about technical details you can decide yourself; decide, then explain briefly.
- When something touches money, personal documents or permissions, say so explicitly when you finish that step.
- Keep `PROGRESS.md` up to date: what is done, what is next, open questions for Giorgi.

A working demo exists at `reference/avtopark-demo.html` (single HTML file, Georgian/English). Use it as the reference for features, screens and wording. It is a prototype: do not copy its code structure, but match its behaviour and business rules.

## Product in one paragraph

A web app (SaaS) for small rent-a-car companies in Georgia (5–50 cars). Each company manages its fleet, bookings, customers, pickups and returns, contracts, deposits and traffic fines in one place, and gets its own public booking website. Companies pay a monthly subscription. Staff use it mostly on phones and tablets at the desk or in the parking lot.

## Tech stack (use this unless you have a strong reason; if so, explain and ask first)

- **Next.js (App Router) + TypeScript**, React Server Components where sensible
- **PostgreSQL** via **Supabase** (database, auth, file storage)
- **Prisma** or Supabase client for data access — pick one and stay consistent
- **Tailwind CSS** for styling
- **Zod** for validating every input on the server
- **Vitest** for unit tests of business rules, **Playwright** for a few end-to-end flows
- PDF generation on the server (e.g. `@react-pdf/renderer` or `pdf-lib`)
- Hosting: **Vercel** (app) + Supabase (data). Keep all secrets in environment variables.
- i18n: Georgian (`ka`, default) and English (`en`) from day one; Russian later. No hard-coded UI strings.
- Timezone: `Asia/Tbilisi`. Currency: GEL (₾).

## Multi-tenancy and roles

- Every company is an **Organization**. Every business table has `organization_id`.
- **Tenant isolation is mandatory**: enable Postgres Row Level Security on every table so one company can never read or change another company's data, even if application code has a bug. Write tests that prove it.
- Roles inside an organization:
  - **Owner/Manager**: everything, including prices, revenue, deleting records, blacklist, settings, staff accounts.
  - **Operator** (desk staff): bookings, pickups, returns, customers, fines. Cannot see revenue reports, cannot change prices or settings, cannot delete.
- Enforce permissions on the server, not only by hiding buttons.

## Domain model (starting point; adjust if needed and explain)

- **Organization**: name, legal details for contracts, logo, slug for the public site, settings.
- **Settings** (per organization): extras prices, fee rules (fuel per 1/8, cleaning fees), deposit by vehicle class, approximate currency rates for the public site, cancellation policy text, contract terms text.
- **Location**: e.g. Tbilisi Airport, Kutaisi Airport, Batumi Airport, City office.
- **Vehicle**: plate (Georgian format `AA-123-BB`), make, model, year, class (economy, compact, SUV, 4×4, minivan, premium), transmission, fuel type, color, daily rate, deposit, odometer, last oil change km, oil interval, insurance valid until, technical inspection valid until, in_service flag, photos, current known damages.
- **Customer**: name, phone, email, country, documents (license, passport images), documents_verified flags, blacklist flag + reason, notes.
- **Booking**: number (e.g. `B-1041`), customer, pickup/return date, pickup location, daily rate (copied at booking time), extras, hotel address (for delivery), status (`request` from the public site, `confirmed`, `cancelled`), source (`desk`, `online`), deposit (amount, status: none/held/returned/withheld, withheld amount), note.
- **BookingSegment**: which vehicle the customer has for which dates. A normal booking has one segment. A car replacement splits it into several. **All availability checks use segments, not the booking's vehicle.**
- **VehicleSwap**: date, from vehicle, to vehicle, reason (breakdown, accident, customer request, other), note, old car odometer/fuel/cleanliness, new car odometer/fuel.
- **Inspection** (type `pickup` or `return`): odometer, fuel level (in eighths, 1–8), cleanliness (1 clean, 2 normal, 3 dirty, 4 very dirty), damage marks on a top-view car diagram (x, y, type: scratch/dent/crack/paint chip), photos by angle (front, rear, left, right, interior, dashboard) plus extra photos, timestamp, staff member.
- **Charges** on return: fuel fee, cleaning fee, damage charge, total, amount withheld from deposit.
- **Contract**: generated from the booking, customer signature (drawn on screen), PDF.
- **Fine**: vehicle, date and time, violation type, place, amount, status (new, assigned to customer, paid), matched booking.
- **AuditLog**: who changed what and when, for bookings, deposits, charges, fines, blacklist.

## Business rules (write unit tests for each)

1. **Dates**: a booking occupies `[pickup_date, return_date)`. Same-day turnover is allowed: a car returned on the 10th can go out again on the 10th.
2. **No double booking**: two segments for the same vehicle must never overlap. Enforce it in the database (exclusion constraint or a transaction with locking), not only in the UI. Online requests also block the dates until declined.
3. **Price** = days × daily rate + extras. Extras: additional driver (per day), child seat (per day, quantity 0–2), full insurance with zero excess (per day), hotel delivery (one-time). Prices come from Settings. The daily rate is copied into the booking so later price changes do not change existing bookings.
4. **Deposit** depends on vehicle class (from Settings), editable per booking by a manager.
5. **Vehicle status today** is derived, never stored: in service → "in service"; segment starts today and no pickup recorded → "goes out today"; segment ends today and no return recorded → "returns today"; inside a segment → "on rent"; otherwise "available".
6. **Return charges**: fuel fee = missing eighths × fee per eighth; cleaning fee applies only if cleanliness at return is worse than at pickup; damage charge is entered by staff. Suggested deposit withholding = total charges, capped at the deposit; staff can change it. If charges exceed the deposit, show a warning.
7. **Car replacement**: allowed only after pickup and before return. The current segment ends on the swap date, a new segment starts with the new vehicle until the original return date. Price does not change. Optionally put the old car in service. The return inspection compares against the new car's state at the swap, not the original pickup.
8. **Fine matching**: find the segment whose vehicle matches and whose dates include the fine date (inclusive of the return day). Show the customer and booking. If nothing matches, mark "not on rent at that time".
9. **Blacklist**: creating a booking for a blacklisted customer shows the reason and requires an explicit confirmation.
10. **Reminders**: oil change overdue or due within 1,000 km; insurance or technical inspection expired or expiring within 30 days.

## Features, built in this order

Finish, test and show each phase before starting the next. After each phase, update `PROGRESS.md` and write Giorgi a short summary of what he can now try.

1. **Foundation**: project setup, database, auth (email + password, password reset), organizations, roles, RLS, i18n, base layout that works on a phone. Seed script with realistic demo data (Georgian plates, GEL, airports).
2. **Fleet**: vehicle list with status filters, add/edit vehicle, photos, service flag, reminders.
3. **Bookings + calendar**: create/edit/cancel bookings, extras, price summary, deposit, conflict checks, 14-day timeline calendar (cars × days) where clicking an empty cell starts a booking.
4. **Customers**: list with search, customer card, document upload, verification, blacklist, rental history.
5. **Pickup and return**: inspection screens (diagram, fuel, cleanliness, photos by angle, odometer), side-by-side photo comparison on return, automatic charges, deposit handling.
6. **Contracts**: contract generated from the booking (Georgian and English), on-screen signature, PDF download, email to customer.
7. **Car replacement** during a rental.
8. **Fines**: add fines, automatic matching, assign to customer, mark paid.
9. **Today dashboard**: pickups today, returns today, next 7 days, online requests to confirm or decline, reminders, deposits held; revenue and utilization for managers only.
10. **Public booking site** per organization (`/{slug}` or subdomain): search by dates and location, available cars with full price, extras, deposit, requirements, driving rules, booking request with optional online check-in (document upload). Requests appear on the Today dashboard.
11. **Settings**: prices, fees, deposits, contract terms, locations, staff accounts.

Later, not now: online payments (Georgian bank gateways), SMS/WhatsApp notifications, automatic fine import, Russian language, subscription billing.

## Security and personal data (non-negotiable)

- Passports and licenses are sensitive personal data. Store files in a **private** storage bucket; serve them only through short-lived signed URLs to staff of the same organization.
- Never put personal data in URLs, logs, error messages or analytics.
- Validate every input on the server with Zod. Rate-limit public endpoints (public booking form, login).
- Hash passwords through the auth provider; never store them yourself.
- Daily database backups; document how to restore.
- Write an audit log entry for money-related and blacklist changes.
- Georgia has a personal data protection law. Add a clear privacy notice and consent checkbox on the public booking form, and list in `PROGRESS.md` what Giorgi should confirm with a lawyer before real customers use it.

## Quality bar

- Mobile-first: every staff screen must be usable on a 390px-wide phone.
- Accessible forms (labels, keyboard focus, readable contrast), light and dark mode.
- Unit tests for every business rule above; Playwright tests for: create booking → pickup → return with charges; public booking request → confirm; car replacement.
- No secrets in the repository. `.env.example` lists every variable.
- Small, focused commits with clear messages.
- When unsure about a business rule, look at the demo first, then ask Giorgi.
