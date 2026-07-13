import type { MonthlyDataPoint } from './market-data-aggregator';

export function aggregateToQuarterly(monthly: MonthlyDataPoint[]): MonthlyDataPoint[] {
  const groups = new Map<string, MonthlyDataPoint[]>();

  for (const m of monthly) {
    const [year, month] = m.period.split('-');
    const q = Math.ceil(parseInt(month) / 3);
    const key = `${year}-Q${q}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const result: MonthlyDataPoint[] = [];

  for (const [key, months] of groups) {
    const suburbNames = new Set<string>();
    for (const m of months) {
      for (const sn of Object.keys(m.suburbs)) {
        suburbNames.add(sn);
      }
    }

    const suburbs: MonthlyDataPoint['suburbs'] = {};
    for (const sn of suburbNames) {
      const medians: number[] = [];
      let salesSum = 0;
      const days: number[] = [];

      for (const m of months) {
        const sd = m.suburbs[sn];
        if (sd) {
          if (sd.median != null) medians.push(sd.median);
          salesSum += sd.sales;
          if (sd.days != null) days.push(sd.days);
        }
      }

      const sumField = (arr: (number | null | undefined)[]): number | null => {
        const nums = arr.filter((v): v is number => v != null);
        return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null;
      };

      suburbs[sn] = {
        median: medians.length > 0 ? medians.reduce((a, b) => a + b, 0) : null,
        sales: salesSum,
        days: days.length > 0 ? days.reduce((a, b) => a + b, 0) : null,
        priceDiffMomPct: sumField(months.map(m => m.suburbs[sn]?.priceDiffMomPct)),
        priceDiff1yrPct: sumField(months.map(m => m.suburbs[sn]?.priceDiff1yrPct)),
        medianListPrice: sumField(months.map(m => m.suburbs[sn]?.medianListPrice)),
        saleToValuationPct: sumField(months.map(m => m.suburbs[sn]?.saleToValuationPct)),
        listToValuationPct: sumField(months.map(m => m.suburbs[sn]?.listToValuationPct)),
        totalVolume: sumField(months.map(m => m.suburbs[sn]?.totalVolume)),
        medianPrice1yrPrior: sumField(months.map(m => m.suburbs[sn]?.medianPrice1yrPrior)),
        medianPrice3yrsPrior: sumField(months.map(m => m.suburbs[sn]?.medianPrice3yrsPrior)),
        priceDiff3yrsPct: sumField(months.map(m => m.suburbs[sn]?.priceDiff3yrsPct)),
        housePriceIndex: sumField(months.map(m => m.suburbs[sn]?.housePriceIndex)),
      };
    }

    const cityMedians = months.map(m => m.cityMedian).filter((v): v is number => v !== null);
    const cityDays = months.map(m => m.cityDays).filter((v): v is number => v !== null);

    const cityFirst = months[0];
    result.push({
      period: key,
      periodRaw: key,
      cityMedian: cityMedians.length > 0
        ? cityMedians.reduce((a, b) => a + b, 0)
        : null,
      citySales: months.reduce((sum, m) => sum + m.citySales, 0),
      cityDays: cityDays.length > 0
        ? cityDays.reduce((a, b) => a + b, 0)
        : null,
      cityDetail: cityFirst?.cityDetail ?? null,
      suburbs,
    });
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}
