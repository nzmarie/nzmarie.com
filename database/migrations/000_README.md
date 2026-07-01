# Database Migrations

## Overview

This directory contains SQL migration files for the Admin System. All migrations should be applied to **Marie DB** (Singapore) only.

**Louis DB** (Jakarta) is READ-ONLY for property data.

## Migration Files

| # | File | Description | Tables Created |
|---|------|-------------|----------------|
| 001 | `001_create_admin_users.sql` | Admin user roles | `admin_users` |
| 002 | `002_create_appraisal_leads.sql` | Appraisal requests | `appraisal_leads` |
| 003 | `003_create_report_downloads.sql` | PDF download tracking | `report_downloads` |
| 004 | `004_create_direct_mail_campaigns.sql` | Marketing campaigns | `direct_mail_campaigns` |
| 005 | `005_create_direct_mail_addresses.sql` | Mailed addresses tracking | `direct_mail_addresses` |
| 006 | `006_create_outreach_tasks.sql` | Mail queue management | `outreach_tasks` |
| 007 | `007_create_suburb_reports.sql` | Quarterly reports | `suburb_reports` |
| 008 | `008_create_triggers.sql` | Automatic tracking triggers | - |

## How to Run Migrations

### Method 1: Using Node.js Script (Recommended)

```bash
npm run db:migrate
```

### Method 2: Manual Execution

Run each file in order against Marie DB:

```bash
psql "$DATABASE_URL" -f database/migrations/001_create_admin_users.sql
psql "$DATABASE_URL" -f database/migrations/002_create_appraisal_leads.sql
# ... continue for all files
```

### Method 3: Using Database Tool

1. Connect to Marie DB using TablePlus, DBeaver, or pgAdmin
2. Execute each SQL file in numerical order

## Important Notes

### Database Permissions

- ✅ **Marie DB**: Full read/write access - create tables, triggers, functions
- ❌ **Louis DB**: Read-only access - do NOT create tables or modify data

### Migration Order

Migrations MUST be run in numerical order due to dependencies:

- `005` depends on `004` (foreign key: `campaign_id`)
- `008` depends on `002`, `003`, `005`, `006` (trigger functions)

### Idempotency

All migrations use `IF NOT EXISTS` clauses, so they can be safely re-run without errors.

### Rollback

To rollback all migrations:

```sql
-- Run on Marie DB only
DROP TABLE IF EXISTS suburb_reports CASCADE;
DROP TABLE IF EXISTS outreach_tasks CASCADE;
DROP TABLE IF EXISTS direct_mail_addresses CASCADE;
DROP TABLE IF EXISTS direct_mail_campaigns CASCADE;
DROP TABLE IF EXISTS report_downloads CASCADE;
DROP TABLE IF EXISTS appraisal_leads CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_download_tracking CASCADE;
DROP FUNCTION IF EXISTS update_appraisal_tracking CASCADE;
DROP FUNCTION IF EXISTS update_campaign_stats CASCADE;
DROP FUNCTION IF EXISTS check_download_limit CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
```

## Environment Variables Required

```env
# Marie DB (Admin System) - Read/Write
DATABASE_URL=postgresql://nzmarie:...@baby-centaur-27756.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full

# Louis DB (Properties) - Read Only
LOUIS_DATABASE_URL=postgresql://nz-property:...@jazzed-buzzard-25204.j77.aws-ap-southeast-3.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full
```

## Verification

After running migrations, verify with:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'admin_users',
  'appraisal_leads',
  'report_downloads',
  'direct_mail_campaigns',
  'direct_mail_addresses',
  'outreach_tasks',
  'suburb_reports'
)
ORDER BY table_name;

-- Check triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY trigger_name;

-- Check admin users
SELECT email, role, name FROM admin_users;
```

## Database Schema Diagram

```
admin_users
  └─ (user roles)

appraisal_leads ←──[trigger]──┐
  └─ (appraisal requests)      │
                               │
report_downloads ←──[trigger]──┤
  └─ (download tracking)       │
                               │
direct_mail_campaigns          │
  ├─> direct_mail_addresses ←──┴─ (auto-update engagement)
  └─> outreach_tasks ←───────────┘

suburb_reports
  └─ (quarterly PDF files)

properties (Louis DB - READ ONLY)
  └─ (10万+ property data)
```

## Support

For issues with migrations, check:

1. Database connection strings in `.env`
2. SSL mode (`sslmode=verify-full`)
3. Network access to CockroachDB clusters
4. Run migrations in order

Contact: nzlouis.com@gmail.com
