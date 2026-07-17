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
    const toNum = (v: unknown): number => Number(v);
    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + toNum(b), 0) / arr.length) : null;
    const sum = (arr: number[]) => arr.reduce((a, b) => a + toNum(b), 0);
    const avgField = (arr: (number | null | undefined)[]) => {
      const nums = arr.filter((v): v is number => v != null);
      return nums.length > 0 ? Math.round(nums.reduce((a, b) => a + toNum(b), 0) / nums.length) : null;
    };

    for (const sn of suburbNames) {
      const medians: number[] = [];
      let salesSum = 0;
      const days: number[] = [];
      const priceDiffMom: (number | null | undefined)[] = [];
      const priceDiff1yr: (number | null | undefined)[] = [];
      const medianListPrices: (number | null | undefined)[] = [];
      const saleToValuation: (number | null | undefined)[] = [];
      const listToValuation: (number | null | undefined)[] = [];
      const totalVolumes: number[] = [];
      const medianPrice1yr: (number | null | undefined)[] = [];
      const medianPrice3yrs: (number | null | undefined)[] = [];
      const priceDiff3yrs: (number | null | undefined)[] = [];
      const housePriceIndexes: (number | null | undefined)[] = [];

      for (const m of months) {
        const sd = m.suburbs[sn];
        if (sd) {
          if (sd.median != null) medians.push(Number(sd.median));
          salesSum += Number(sd.sales);
          if (sd.days != null) days.push(Number(sd.days));
          priceDiffMom.push(sd.priceDiffMomPct);
          priceDiff1yr.push(sd.priceDiff1yrPct);
          medianListPrices.push(sd.medianListPrice);
          saleToValuation.push(sd.saleToValuationPct);
          listToValuation.push(sd.listToValuationPct);
          if (sd.totalVolume != null) totalVolumes.push(sd.totalVolume);
          medianPrice1yr.push(sd.medianPrice1yrPrior);
          medianPrice3yrs.push(sd.medianPrice3yrsPrior);
          priceDiff3yrs.push(sd.priceDiff3yrsPct);
          housePriceIndexes.push(sd.housePriceIndex);
        }
      }

      suburbs[sn] = {
        median: avg(medians),
        sales: salesSum,
        days: avg(days),
        priceDiffMomPct: avgField(priceDiffMom),
        priceDiff1yrPct: avgField(priceDiff1yr),
        medianListPrice: avgField(medianListPrices),
        saleToValuationPct: avgField(saleToValuation),
        listToValuationPct: avgField(listToValuation),
        totalVolume: totalVolumes.length > 0 ? sum(totalVolumes) : null,
        medianPrice1yrPrior: avgField(medianPrice1yr),
        medianPrice3yrsPrior: avgField(medianPrice3yrs),
        priceDiff3yrsPct: avgField(priceDiff3yrs),
        housePriceIndex: avgField(housePriceIndexes),
      };
    }

    const cityMedians = months.map(m => m.cityMedian).filter((v): v is number => v !== null);
    const cityDays = months.map(m => m.cityDays).filter((v): v is number => v !== null);

    const cityFirst = months[0];
    result.push({
      period: key,
      periodRaw: key,
      cityMedian: avg(cityMedians),
      citySales: months.reduce((s, m) => s + Number(m.citySales), 0),
      cityDays: avg(cityDays),
      cityDetail: cityFirst?.cityDetail ?? null,
      suburbs,
    });
  }

  return result.sort((a, b) => a.period.localeCompare(b.period));
}
