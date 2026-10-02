# TAMIMA Booking Dash

Production workspace for **PT Tamima Jaya Wisata** — hotel confirmation letters, Haramain train tickets, and Umroh armada charters, with dual-currency (SAR / IDR) profitability, RBAC, and an audit trail.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- SQLite via Prisma (PostgreSQL-ready schema)
- Session cookies, bcrypt password hashing, role-based access

## Setup

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Open `http://localhost:3000`.

## Demo accounts

Password for all: `Tamima@2026`

| Role    | Email                   |
|---------|-------------------------|
| Admin   | admin@tamima.local      |
| Manager | manager@tamima.local    |
| Staff   | staff@tamima.local      |
| Finance | finance@tamima.local    |
| Viewer  | viewer@tamima.local     |

## Modules

- Hotel bookings — CRUD, payments, visa workflow, calendar, reports, Excel import
- Haramain Train — tickets, passenger manifest, PDF pass
- Armada Umroh — vehicle charter, drivers, voucher
- Master data — customers, vendors, products
- Settings, users, audit log
