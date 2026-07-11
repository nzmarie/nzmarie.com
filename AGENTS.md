## Objective
Implement the Analytics Page (REINZ market trends + PDF reports + outreach funnel). Fix Google Street View images on /properties page. Build succeeds with 0 errors.

## Important Details
- CockroachDB has limited trigger support — all tracking logic must be in application layer (`lib/tracking.ts`), not PL/pgSQL triggers
- Plan doc (`04_Analytics_Page_Development_Plan.md`) proposes 3 PostgreSQL triggers; must be converted to app-layer pattern
- REINZ CSV format: Location `"Oteha, Auckland"`, Period `"2025-01-01T00:00:00"`, numeric fields (some `Low Vol.`/`N/A`)
- Migration files go in `database/migrations/` with `NNN_description.sql` naming, run by `scripts/run-migrations.ts`
- `outreach_properties` table uses status values: `pending`/`sent`/`interacted`/`converted` (no `liked` in constraint)
- `getFixedImageUrl` reconstructs Street View URLs from lat/lng in existing URL, uses `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `return_error_code=true`
- Analytics page is super_admin only (`nzlouis.com@gmail.com`)

## Completed
- **Google Street View image fix**: `lib/google-maps.ts` with shared `getFixedImageUrl()`. Replaced 4 duplicate implementations with shared import. Build + 255 tests pass.
- **Phase 0 deps**: `recharts`, `xlsx`, `@types/recharts`
- **Phase 1 migrations**: `015_create_market_monthly_snapshots.sql`, `016_create_suburb_html_templates.sql` — no triggers
- **Phase 2 Excel parser**: `lib/excel-parser.ts` — parses REINZ CSV/Excel, validates data
- **Phase 3 aggregator**: `lib/market-data-aggregator.ts` — `getQuarterlyComparison()` SQL aggregate by year/quarter
- **Phase 3-4 APIs**: `GET /api/admin/analytics/chart-data`, `POST /api/admin/analytics/upload-excel`
- **Phase 5 frontend**: `MarketTrendsChart.tsx` (Recharts line chart), `ExcelUploadForm.tsx` (upload form with result display), analytics page updated with suburb selector, chart, data table, quick guide
- **Outreach per-tab controls + infinite scroll + optimistic updates**
- **Properties page UI alignment**: Like icon right, Built badge left, edit cache fix

## Active
- (none)

## Build Commands
- `npm run build` — full build with typecheck + lint
- `npm run test` — 255 tests
