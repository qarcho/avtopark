# Avtopark

Rental management for small car rental companies in Georgia.

- Product and rules: [CLAUDE.md](CLAUDE.md)
- What is done and what is next: [PROGRESS.md](PROGRESS.md)
- How to set up and run: [docs/SETUP.md](docs/SETUP.md)

Stack: Next.js 16 (App Router), Supabase (Postgres, Auth, Storage), Tailwind CSS, next-intl (ka/en), Zod, Vitest, Playwright.

## Where things are

| Path | What |
| --- | --- |
| `supabase/migrations/` | Database tables, security rules (RLS), triggers |
| `src/app/(auth)/` | Login, password reset, set password |
| `src/app/(staff)/` | Staff screens (Today, Fleet, …, Settings → Staff) |
| `src/app/(admin)/` | Platform admin: create companies |
| `src/lib/` | Permissions, validation, dates, Supabase clients |
| `messages/` | Georgian and English texts |
| `scripts/` | Migrate, seed demo data, add platform admin |
| `tests/db/` | Database security tests (tenant isolation, roles, double booking) |
| `tests/e2e/` | Browser tests |
