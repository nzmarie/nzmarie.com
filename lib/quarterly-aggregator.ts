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

      suburbs[sn] = {
        median: medians.length > 0 ? Math.round(medians.reduce((a, b) => a + b, 0) / medians.length) : null,
        sales: salesSum,
        days: days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
      };
    }

    const cityMedians = months.map(m => m.cityMedian).filter((v): v is number => v !== null);
    const cityDays = months.map(m => m.cityDays).filter((v): v is number => v !== null);

    result.push({
      period: key,
      periodRaw: key,
      cityMedian: cityMedians.length > 0
        ? Math.round(cityMedians.reduce((a, b) => a + b, 0) / cityMedians.length)
        : null,
      citySales: months.reduce((sum, m) => sum + m.citySales, 0),
      cityDays: cityDays.length > 0
        ? Math.round(cityDays.reduce((a, b) => a + b, 0) / cityDays.length)
        : null,
      suburbs,
    });
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}
