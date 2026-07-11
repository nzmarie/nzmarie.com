import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';
import { parseREINZExcel, validateREINZData } from '@/lib/excel-parser';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseREINZExcel(buffer);

    let inserted = 0;
    let skipped = 0;

    for (const row of parsed.rows) {
      if (!validateREINZData(row)) {
        skipped++;
        continue;
      }

      try {
        await query(
          `INSERT INTO market_monthly_snapshots (
            region_type, region_name, property_type, period_month,
            median_price, sales_count, days_to_sell,
            median_price_1yr_prior, price_diff_1yr_pct,
            median_price_3yrs_prior, price_diff_3yrs_pct,
            median_valuation, median_list_price,
            sale_to_valuation_pct, list_to_valuation_pct,
            total_volume, pct_of_national_sales, house_price_index,
            price_diff_mom_pct, imported_by
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9,
            $10, $11,
            $12, $13,
            $14, $15,
            $16, $17, $18,
            $19, $20
          ) ON CONFLICT (region_name, period_month, property_type) DO NOTHING`,
          [
            'suburb', row.region_name, 'House', row.period_month,
            row.median_price, row.sales_count, row.days_to_sell,
            row.median_price_1yr_prior, row.price_diff_1yr_pct,
            row.median_price_3yrs_prior, row.price_diff_3yrs_pct,
            row.median_valuation, row.median_list_price,
            row.sale_to_valuation_pct, row.list_to_valuation_pct,
            row.total_volume, row.pct_of_national_sales, row.house_price_index,
            row.price_diff_mom_pct, session.user.email,
          ]
        );
        inserted++;
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      suburb: parsed.suburb_name,
      city: parsed.city,
      period_start: parsed.period_start,
      period_end: parsed.period_end,
      inserted_count: inserted,
      duplicates_skipped: skipped,
      total_rows: parsed.count,
      message: `Imported ${inserted} rows for ${parsed.suburb_name} (${parsed.period_start} to ${parsed.period_end})`,
    });
  } catch (error) {
    console.error('Error uploading Excel:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process file' },
      { status: 500 }
    );
  }
}
