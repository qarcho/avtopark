# Setup

How to get Avtopark running on a new computer and connected to Supabase.

## 1. Programs

- Node.js 24 LTS and Git (`winget install OpenJS.NodeJS.LTS`, `winget install Git.Git`)
- Then in the project folder: `npm install`

## 2. Secret settings (`.env.local`)

Copy `.env.example` to `.env.local` (already done on Giorgi's computer) and fill in:

| Variable | Where to find it in Supabase |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → Publishable key (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys → Secret key (`sb_secret_…`) — never share |
| `DATABASE_URL` | Top bar **Connect** → **Session pooler** → copy, then replace `[YOUR-PASSWORD]` with the database password |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` on your computer; the real address on Vercel |
| `SEED_DEMO_PASSWORD` | Already generated. Password for the demo logins |

If the database password contains symbols like `@ : / ? #`, it must be "percent-encoded" in `DATABASE_URL`.
Easiest: reset the database password (Project Settings → Database) to one with only letters and digits.

## 3. Supabase dashboard settings (one time per project)

**Authentication → Sign In / Providers → Email**
- Turn **off** "Allow new users to sign up" (only invited people get accounts).
- Minimum password length: **10**.

**Authentication → URL Configuration**
- Site URL: `http://localhost:3000` (change to the Vercel address when we go live)
- Redirect URLs: add `http://localhost:3000/**` and `http://localhost:3100/**`
  (later also `https://YOUR-APP.vercel.app/**`)

**Authentication → Emails → Templates**

*Invite user* — subject: `მოწვევა ავტოპარკში / Invitation to Avtopark`
```html
<h2>მოწვევა ავტოპარკში / You are invited to Avtopark</h2>
<p>დააჭირე ბმულს და დააყენე პაროლი.<br>Click the link to set your password.</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite">პაროლის დაყენება / Set password</a></p>
```

*Reset password* — subject: `პაროლის აღდგენა / Reset your Avtopark password`
```html
<h2>პაროლის აღდგენა / Reset your password</h2>
<p>დააჭირე ბმულს ახალი პაროლის დასაყენებლად. თუ ეს შენ არ მოგითხოვია, უბრალოდ წაშალე ეს წერილი.<br>
Click the link to set a new password. If you did not ask for this, ignore this email.</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">ახალი პაროლი / New password</a></p>
```

**Email delivery.** Supabase's built-in email only delivers to members of your Supabase team
(your own address) and only a few emails per hour. Before inviting real staff we must connect
an email service (Authentication → Emails → SMTP Settings). See PROGRESS.md.

## 4. Database

```
npm run db:migrate     # creates/updates tables and security rules
npm run test:db        # proves companies cannot see each other's data
npm run db:seed        # demo company "Demo Rent" with cars, customers, bookings
npm run admin:add -- you@example.com "Your Name"   # makes you platform admin
```

## 5. Run

```
npm run dev            # http://localhost:3000
npm test               # business-rule unit tests
npm run test:e2e       # browser tests (needs demo data)
```

## Backups and restore

- Supabase **Pro** plan makes a daily backup automatically and keeps 7 days
  (Database → Backups). The free plan does not keep restorable backups.
- To restore: Database → Backups → pick a day → Restore. The project is offline for a few minutes.
- Extra safety copy you control: `npx supabase db dump --db-url "$DATABASE_URL" -f backup.sql --data-only`
  (store the file somewhere private: it contains personal data).
