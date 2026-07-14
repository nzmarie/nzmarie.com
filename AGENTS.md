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
- **Properties 页市场状态融合**: API (`app/api/admin/properties/route.ts:22-96`) 新增 `on_market_sale`/`on_market_rent`/`sale_listing_status`/`rent_listing_status`/`sale_price`/`rent_price`/`sale_agent` SELECT 字段 + `?market_status=all|for_sale|for_rent|not_listed` 过滤参数。前端：Property 接口新增字段、卡片图片区域叠加绿色 For Sale / 紫色 To Rent 徽章（含价格）、Property Type 行右侧新增 Market Status 按钮组（All/For Sale/To Rent/Not Listed），marketStatus 状态参与 queryKey 自动触发重取。AI data chamber 加入市场状态信息。5 个新测试覆盖徽章、按钮、AI chamber 文本。Build 0 errors，355 tests pass。

## Active
- (none)

## Bug Fixes
- **address_fingerprint JOIN never matched**: `p.address_fingerprint = re.address_fingerprint` was `NULL=NULL` (always false) because the column is never populated. Changed to match on address + suburb: `LOWER(TRIM(SPLIT_PART(re.address, ',', 1))) = LOWER(TRIM(p.address)) AND LOWER(TRIM(re.suburb)) = LOWER(TRIM(p.suburb))`. Fixed in both `properties/route.ts` and `outreach/route.ts`. Added 6 new API tests verifying JOIN behavior. 362 tests pass.

## Build Commands
- `npm run build` — full build with typecheck + lint
- `npm run test` — 350 tests
