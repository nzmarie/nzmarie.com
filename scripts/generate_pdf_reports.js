const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const csvPath = path.join(__dirname, '..', 'tasks', 'Northcross-Jule-2025 to May-2026-Market Insights Report Export (1).csv');
const pdfOutputDir = path.join(__dirname, '..', 'pdf');

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length === 0) return [];
  
  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };
  
  const headers = parseLine(lines[0]);
  const data = lines.slice(1).map(line => {
    const cells = parseLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || '';
    });
    return row;
  });
  
  return data;
}

function formatCurrency(val) {
  if (isNaN(val) || val === 0) return 'N/A';
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(val);
}

function getCumulativeReports(rawData) {
  const reports = [
    {
      key: '2025_H2',
      name: '2025 Year-to-Date (H2)',
      periodText: 'July – December 2025',
      months: ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'],
      anomalyTitle: 'The Gap Fallacy',
      anomalyText: 'Across the second half of 2025, Northcross achieved a strong performance with $35.0M in total volume. However, automated systems showed significant value gaps (NaNs) during August, October, and December due to lower monthly transaction counts (2-3 sales). AVMs fail to calculate baseline metrics during low-volume months, artificially flatlining valuations when human-vetted demand actually remained stable.',
      compareLabel: 'Compared to July 2025 Baseline',
      comparePriceChange: '+17.9%',
      comparePriceUp: true,
      compareSalesChange: '-22.2%',
      compareSalesUp: false,
      compareDaysChange: '-33',
      compareDaysUp: true,
      data: []
    },
    {
      key: '2026_YTD_Q1',
      name: '2026 Year-to-Date (Q1)',
      periodText: 'January – March 2026',
      months: ['2026-01', '2026-02', '2026-03'],
      anomalyTitle: 'The Product Mix Trap',
      anomalyText: 'In the first quarter of 2026, the local market registered 14 sales totaling $16.6M. Automated estimates in March published a median price drop to $910,000, signaling a steep crash. In reality, this was a statistical illusion caused by a higher concentration of lower-value townhouse trades. True land value for premium residential estates in Northcross remained solid.',
      compareLabel: 'Compared to 2025 H2 Average',
      comparePriceChange: '-24.0%',
      comparePriceUp: false,
      compareSalesChange: '0.0%',
      compareSalesUp: true,
      compareDaysChange: '-14',
      compareDaysUp: true,
      data: []
    },
    {
      key: '2026_YTD_H1',
      name: '2026 Year-to-Date (Jan–May)',
      periodText: 'January – May 2026',
      months: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'],
      anomalyTitle: 'Cumulative Market Correction',
      anomalyText: 'Looking at the cumulative Jan–May 2026 data (5 months of available transactions), the volume rebounded strongly to $36.4M across 30 sales, smoothing out the product mix anomalies seen in Q1 alone. With the average time to sell stabilising at 39 days, it gently reminds us why looking at a single month or quarter in isolation rarely tells the whole story for our local streets. Note: June 2026 data is not yet available; this report will be updated when REINZ releases the full H1 figures.',
      compareLabel: 'Compared to 2025 H2 Average',
      comparePriceChange: '-8.9%',
      comparePriceUp: false,
      compareSalesChange: '+28.6%',
      compareSalesUp: true,
      compareDaysChange: '-5',
      compareDaysUp: true,
      data: []
    }
  ];

  rawData.forEach(row => {
    const period = row['Period'];
    if (!period) return;
    const yearMonth = period.substring(0, 7);
    reports.forEach(report => {
      if (report.months.some(m => yearMonth.startsWith(m))) {
        report.data.push(row);
      }
    });
  });

  return reports.filter(r => r.data.length > 0);
}

function aggregateReportMetrics(report, rawData) {
  let totalVolume = 0;
  let totalSales = 0;
  let daysToSellSum = 0;
  let daysToSellCount = 0;

  const monthlyBreakdown = report.data.map(row => {
    const monthName = new Date(row['Period']).toLocaleString('en-NZ', { month: 'short', year: '2-digit' }).replace(' ', '-');
    const medianPrice = parseFloat(row['Median Sale Price']) || NaN;
    const salesCount = parseInt(row['No of Sales']) || 0;
    const vol = parseFloat(row['Total Sales Volume']) || 0;
    const days = parseInt(row['Median Days to Sell']) || NaN;

    totalVolume += vol;
    totalSales += salesCount;

    if (!isNaN(days)) {
      daysToSellSum += days;
      daysToSellCount++;
    }

    return {
      monthName,
      medianPrice,
      salesCount,
      vol,
      days,
      rawPeriod: row['Period']
    };
  });

  const avgDaysToSell = daysToSellCount > 0 ? Math.round(daysToSellSum / daysToSellCount) : 'N/A';

  const trendRows = monthlyBreakdown.map(curr => {
    const currIndex = rawData.findIndex(r => r['Period'] === curr.rawPeriod);
    let prevPrice = NaN;
    let prevSales = 0;
    let prevDays = NaN;

    if (currIndex > 0) {
      const prevRow = rawData[currIndex - 1];
      prevPrice = parseFloat(prevRow['Median Sale Price']) || NaN;
      prevSales = parseInt(prevRow['No of Sales']) || 0;
      prevDays = parseInt(prevRow['Median Days to Sell']) || NaN;
    }

    let priceDiffPct = 'N/A';
    if (!isNaN(curr.medianPrice) && !isNaN(prevPrice) && prevPrice > 0) {
      const diff = ((curr.medianPrice - prevPrice) / prevPrice) * 100;
      priceDiffPct = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
    }

    let salesDiffPct = 'N/A';
    if (curr.salesCount > 0 && prevSales > 0) {
      const diff = ((curr.salesCount - prevSales) / prevSales) * 100;
      salesDiffPct = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
    }

    let daysDiff = 'N/A';
    if (!isNaN(curr.days) && !isNaN(prevDays)) {
      const diff = curr.days - prevDays;
      daysDiff = (diff >= 0 ? '+' : '') + diff;
    }

    return {
      monthName: curr.monthName,
      currPrice: curr.medianPrice,
      prevPrice: prevPrice,
      priceDiffPct,
      currSales: curr.salesCount,
      prevSales: prevSales,
      salesDiffPct,
      currDays: curr.days,
      prevDays: prevDays,
      daysDiff
    };
  }).reverse();

  return {
    name: report.name,
    periodText: report.periodText,
    totalVolume,
    totalSales,
    avgDaysToSell,
    anomalyTitle: report.anomalyTitle,
    anomalyText: report.anomalyText,
    compareLabel: report.compareLabel,
    comparePriceChange: report.comparePriceChange,
    comparePriceUp: report.comparePriceUp,
    compareSalesChange: report.compareSalesChange,
    compareSalesUp: report.compareSalesUp,
    compareDaysChange: report.compareDaysChange,
    compareDaysUp: report.compareDaysUp,
    trendRows
  };
}

function generateHTML(metrics, mariePhotoBase64) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${metrics.name} Market Report</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@300;400;500;600;700&display=swap');
        @page {
          size: A4;
          margin: 0;
        }
        body {
          font-family: 'Inter', sans-serif;
          -webkit-print-color-adjust: exact;
        }
        .font-serif-premium {
          font-family: 'Cinzel', serif;
        }
        .page-container {
          page-break-after: always;
          height: 297mm;
          width: 210mm;
          position: relative;
          box-sizing: border-box;
        }
        .page-container:last-child {
          page-break-after: avoid;
        }
      </style>
    </head>
    <body class="bg-slate-100">

      <div class="page-container bg-[#F8FAFC] text-slate-800 p-16 flex flex-col justify-between">
        <div class="flex justify-between items-start border-b border-slate-200/60 pb-4 w-full">
          <div class="flex flex-col space-y-0.5">
            <span class="text-[10px] font-mono font-bold tracking-widest text-slate-800">
              Independent Market Intelligence
            </span>
            <span class="text-[8px] font-sans text-slate-400">
              Compiled by Marie Nian, Licensed Residential Sales, Barfoot & Thompson.
            </span>
          </div>

          <div class="text-right flex flex-col space-y-0.5">
            <span class="text-[10px] font-mono font-bold text-slate-500 tracking-widest">
              ${metrics.name}
            </span>
            <span class="text-[8px] font-sans text-slate-400 italic">
              ${metrics.periodText} • Northcross Cumulative Analysis
            </span>
          </div>
        </div>

        <div class="my-auto space-y-6">
          <div class="inline-block bg-slate-900 text-white text-xs px-3 py-1 rounded-full font-sans font-semibold tracking-wide">
            Northcross Local Insights
          </div>
          
          <h1 class="text-4xl font-serif font-bold text-slate-900 leading-tight">
            Northcross Property<br/>
            <span class="text-slate-700 text-3xl font-light tracking-wide normal-case block mt-2">Market Intelligence Report</span>
          </h1>
          
          <div class="w-20 h-[3px] bg-[#B45309]"></div>
          
          <p class="text-base text-slate-600 font-sans leading-relaxed max-w-xl">
            A clear, data-driven digest of recent sales, family buyer trends, and genuine property potential in our Northcross community.
          </p>
        </div>

        <div class="pt-6 border-t border-slate-200 flex flex-col space-y-1">
          <p class="text-xs font-sans font-semibold text-slate-700 tracking-wide">
            Prepared independently by Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008).
          </p>
          <p class="text-[10px] font-sans text-slate-400 leading-normal">
            This publication is an independent market analysis based on official REINZ data and does not constitute an official corporate report issued by Barfoot & Thompson.
          </p>
        </div>
      </div>

      <div class="page-container bg-white text-slate-800 p-16 flex flex-col justify-between">
        <div class="flex justify-between items-center border-b border-slate-200 pb-4">
          <div class="text-xs font-serif tracking-tight text-slate-800 font-semibold">Local Overview</div>
          <div class="text-xs text-slate-400">${metrics.name}</div>
        </div>

        <div class="my-auto space-y-4">
          <div class="flex items-center space-x-4">
            <svg class="h-12 w-12 text-blue-900" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4,20A1,1 0 0,0 5,21H19A1,1 0 0,0 20,20V19H4V20M12,2L4,17H20L12,2M12,6.5L17.5,15H6.5L12,6.5Z" />
            </svg>
            <h2 class="font-serif text-4xl font-bold tracking-tight text-slate-800">Northcross</h2>
          </div>

          <div class="space-y-2 text-slate-700 leading-relaxed text-xs">
            <p class="font-semibold text-slate-900 text-sm">
              Northcross continues to hold its ground remarkably well. Even as the wider Auckland market moves through its usual cycles, the underlying value of our neighbourhood remains deeply resilient.
            </p>
            <p>
              First home buyers and family owner-occupiers remain the most active cohorts in Northcross, prioritizing proximity to Long Bay College, Northcross Intermediate, and local infrastructure. While investor activity has been selective due to borrowing costs, we see consistent interest in properties with land potential under the Auckland Unitary Plan.
            </p>
            <p>
              We’re seeing a very sensible alignment out there — local homeowners are setting realistic expectations, which is keeping our local market moving nicely. Well-presented family homes near our local schools are still capturing plenty of warm interest at open homes.
            </p>
            <p class="text-[11px] font-medium text-slate-500 italic pt-1">
              These figures reflect the broader Northcross picture. But your specific address — your section size, school zone, build year, and street — tells a very different story. That’s exactly the kind of detail I look at when preparing a no-cost, personalised appraisal.
            </p>
            <div class="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] font-semibold text-slate-700 flex justify-between items-center">
              <span>📩 Request your personalised property estimate:</span>
              <div class="space-x-2 text-blue-700 font-bold">
                <a href="https://nzmarie.com/appraisal" class="underline">nzmarie.com/appraisal</a>
                <span class="text-slate-300 font-normal">|</span>
                <span class="underline">m.nian@barfoot.co.nz</span>
              </div>
            </div>
            <p class="text-[9px] font-bold text-slate-400 tracking-wider">
              REINZ data analysed by Marie Nian
            </p>
          </div>

          <div class="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span class="text-[10px] tracking-widest text-slate-400 font-bold block">Total Volume</span>
              <span class="text-lg font-bold text-slate-900 mt-1 block">${formatCurrency(metrics.totalVolume)}</span>
            </div>
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span class="text-[10px] tracking-widest text-slate-400 font-bold block">Transactions</span>
              <span class="text-lg font-bold text-blue-600 mt-1 block">${metrics.totalSales}</span>
            </div>
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span class="text-[10px] tracking-widest text-slate-400 font-bold block">Avg Days to Sell</span>
              <span class="text-lg font-bold text-slate-900 mt-1 block">${metrics.avgDaysToSell} Days</span>
            </div>
          </div>

          <div class="bg-[#F3E8FF]/30 p-4 rounded-xl border border-[#E9D5FF] space-y-2">
            <div class="flex items-baseline space-x-2">
              <span class="text-3xl font-extrabold text-purple-900">${metrics.avgDaysToSell}</span>
              <span class="text-lg font-bold text-purple-900">Days to Sell</span>
            </div>
            <p class="text-xs text-purple-950 leading-relaxed">
              The current average Days to Sell of ${metrics.avgDaysToSell} days reflects current market liquidity. Family homes in premium school zones trade quickly, while properties with development potential require longer negotiation periods.
            </p>
            
            <div class="border-t border-[#E9D5FF] pt-2">
              <h4 class="text-xs font-bold tracking-wider text-purple-900 mb-2">${metrics.compareLabel}</h4>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div class="text-[10px] text-purple-700 font-medium">Median Price</div>
                  <div class="text-sm font-bold flex items-center justify-center space-x-1 mt-1 ${metrics.comparePriceUp ? 'text-green-600' : 'text-red-600'}">
                    <span>${metrics.comparePriceUp ? '▲' : '▼'}</span>
                    <span>${metrics.comparePriceChange}</span>
                  </div>
                </div>
                <div>
                  <div class="text-[10px] text-purple-700 font-medium">Sales Count</div>
                  <div class="text-sm font-bold flex items-center justify-center space-x-1 mt-1 ${metrics.compareSalesUp ? 'text-green-600' : 'text-red-600'}">
                    <span>${metrics.compareSalesUp ? '▲' : '▼'}</span>
                    <span>${metrics.compareSalesChange}</span>
                  </div>
                </div>
                <div>
                  <div class="text-[10px] text-purple-700 font-medium">Days to Sell</div>
                  <div class="text-sm font-bold flex items-center justify-center space-x-1 mt-1 ${metrics.compareDaysUp ? 'text-green-600' : 'text-red-600'}">
                    <span>${metrics.compareDaysUp ? '▼' : '▲'}</span>
                    <span>${metrics.compareDaysChange}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

          <div class="pt-4 pb-2">
            <p class="text-[10px] font-sans italic text-slate-400 tracking-wider">
              Note: This data reflects broader neighbourhood trends. Since every street in Northcross has its own unique character, feel free to drop me a line at m.nian@barfoot.co.nz if you ever want a quiet, obligation-free chat about your specific address.
            </p>
          </div>

        <footer class="absolute bottom-6 left-16 right-16 flex justify-between items-center text-[8.5px] font-sans text-slate-400/80 border-t border-slate-200/40 pt-3">
          <div class="tracking-wide flex-1 pr-8 text-left">
            <span>© 2026 Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008). This publication is an independent market analysis based on official REINZ data.</span>
          </div>
          <div class="font-mono text-slate-600 font-bold tracking-widest whitespace-nowrap flex-shrink-0 text-right">
            Page 02
          </div>
        </footer>
      </div>

      <div class="page-container bg-[#F8FAFC] text-slate-800 p-16 flex flex-col justify-between">
        <div class="flex justify-between items-center border-b border-slate-200 pb-4">
          <div class="text-xs font-serif tracking-tight text-slate-800 font-semibold">Market Trends</div>
          <div class="text-xs text-slate-400">${metrics.name}</div>
        </div>

        <div class="my-auto space-y-8">
          <div class="space-y-2">
            <h2 class="font-serif text-3xl font-bold tracking-tight text-slate-800">Northcross Region Trends</h2>
            <p class="text-slate-500 text-xs">Here is a snapshot of how our local market has naturally moved over the last five months.</p>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden text-[10px]">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-[#F1F5F9] text-slate-700 font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <th class="px-2.5 py-2.5 border-r border-slate-200">Month</th>
                  <th colspan="3" class="px-1.5 py-2.5 text-center border-r border-slate-200">Median Price</th>
                  <th colspan="3" class="px-1.5 py-2.5 text-center border-r border-slate-200">Sales Count</th>
                  <th colspan="3" class="px-1.5 py-2.5 text-center">Days to Sell</th>
                </tr>
                <tr class="bg-slate-50 text-slate-500 border-b border-slate-200 text-[8.5px] font-bold tracking-wider">
                  <th class="px-2.5 py-1.5 border-r border-slate-200">Period</th>
                  <th class="px-1 py-1.5 text-right">Current</th>
                  <th class="px-1 py-1.5 text-right">Previous</th>
                  <th class="px-1.5 py-1.5 text-right border-r border-slate-200">MoM %</th>
                  <th class="px-1 py-1.5 text-right">Current</th>
                  <th class="px-1 py-1.5 text-right">Previous</th>
                  <th class="px-1.5 py-1.5 text-right border-r border-slate-200">MoM %</th>
                  <th class="px-1 py-1.5 text-right">Current</th>
                  <th class="px-1 py-1.5 text-right">Previous</th>
                  <th class="px-1.5 py-1.5 text-right">Change</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-medium">
                ${metrics.trendRows.map(row => `
                  <tr class="border-b border-slate-100">
                    <td class="px-2.5 py-2 font-semibold text-slate-900 border-r border-slate-200 bg-slate-50/50">${row.monthName}</td>
                    ${isNaN(row.currPrice) ? `
                      <td colspan="3" class="px-1.5 py-2 text-center text-slate-400 italic text-[8.5px] border-r border-slate-200 bg-slate-50/20">Low Vol. (Calculations Suppressed)</td>
                    ` : `
                      <td class="px-1 py-2 text-right font-bold text-slate-900">${formatCurrency(row.currPrice)}</td>
                      <td class="px-1 py-2 text-right text-slate-500">${isNaN(row.prevPrice) ? 'N/A' : formatCurrency(row.prevPrice)}</td>
                      <td class="px-1.5 py-2 text-right border-r border-slate-200 ${row.priceDiffPct.startsWith('-') ? 'text-red-600' : row.priceDiffPct === 'N/A' ? 'text-slate-400' : 'text-green-600'}">${row.priceDiffPct}</td>
                    `}
                    <td class="px-1 py-2 text-right font-bold text-slate-900">${row.currSales}</td>
                    <td class="px-1 py-2 text-right text-slate-500">${row.prevSales}</td>
                    <td class="px-1.5 py-2 text-right border-r border-slate-200 ${row.salesDiffPct.startsWith('-') ? 'text-red-600' : row.salesDiffPct === 'N/A' ? 'text-slate-400' : 'text-green-600'}">${row.salesDiffPct}</td>
                    <td class="px-1 py-2 text-right font-bold text-slate-900">
                      ${row.currDays === 30 ? `<span class="text-[#B45309] font-extrabold border border-amber-200 bg-amber-50/50 px-1.5 py-0.5 rounded">${row.currDays}</span>` : (isNaN(row.currDays) ? 'N/A' : row.currDays)}
                    </td>
                    <td class="px-1 py-2 text-right text-slate-500">${isNaN(row.prevDays) ? 'N/A' : row.prevDays}</td>
                    <td class="px-1.5 py-2 text-right ${row.daysDiff.startsWith('+') ? 'text-red-600 font-bold' : row.daysDiff === 'N/A' ? 'text-slate-400' : 'text-green-600 font-bold'}">${row.daysDiff}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="bg-amber-50/50 border-l-4 border-amber-500 p-4 rounded-r-xl space-y-2">
            <h3 class="text-xs tracking-wider text-amber-800 font-bold">${metrics.anomalyTitle}</h3>
            <p class="text-xs text-slate-700 leading-relaxed">
              ${metrics.anomalyText}
            </p>
          </div>
        </div>

          <div class="pt-4 pb-2">
            <p class="text-[10px] font-sans italic text-slate-400 tracking-wider">
              Note: This data reflects broader neighbourhood trends. Since every street in Northcross has its own unique character, feel free to drop me a line at m.nian@barfoot.co.nz if you ever want a quiet, obligation-free chat about your specific address.
            </p>
          </div>

        <footer class="absolute bottom-6 left-16 right-16 flex justify-between items-center text-[8.5px] font-sans text-slate-400/80 border-t border-slate-200/40 pt-3">
          <div class="tracking-wide flex-1 pr-8 text-left">
            <span>© 2026 Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008). This publication is an independent market analysis based on official REINZ data.</span>
          </div>
          <div class="font-mono text-slate-600 font-bold tracking-widest whitespace-nowrap flex-shrink-0 text-right">
            Page 03
          </div>
        </footer>
      </div>

      <div class="page-container bg-white text-slate-800 p-16 flex flex-col justify-between">
        <div class="flex justify-between items-center border-b border-slate-200 pb-4">
          <div class="text-xs font-serif tracking-tight text-slate-800 font-semibold">A Personal Note from Marie</div>
          <div class="text-xs text-slate-400">Bespoke Consultancy</div>
        </div>

        <div class="my-auto space-y-4">
          <div class="flex items-start space-x-8">
            <div class="flex-shrink-0">
              <img
                src="data:image/jpeg;base64,${mariePhotoBase64}"
                alt="Marie Nian"
                style="width:120px;height:120px;object-fit:cover;object-position:top center;border-radius:9999px;border:3px solid #E2E8F0;"
              />
            </div>

            <div class="flex-1 space-y-2 pt-1">
              <p class="text-[13px] text-slate-700 leading-relaxed">
                Hi, I’m Marie Nian, Licensed Residential Sales, Barfoot & Thompson.
              </p>

              <p class="text-[13px] text-slate-700 leading-relaxed">
                In New Zealand, we know that property isn’t just about data and contracts. It’s about people, families, and trust. Every home holds a unique story and years of hard work, which is why I choose to bring genuine care, patience, and absolute preparation to every transaction.
              </p>

              <p class="text-[13px] text-slate-700 leading-relaxed">
                With a background in finance, I love digging into the numbers. But instead of relying on automated online estimates, I prefer spending hours personally analysing underlying REINZ data, school zone dynamics, and the real land potential of our local Northcross streets.
              </p>

              <p class="text-[13px] text-slate-700 leading-relaxed">
                My goal is simple: to remove the noise and anxiety from your property decisions by giving you honest, patient, and clear guidance. There is no high-pressure sales pitch here. Whenever you are ready to look at your property's true potential, or if you just want to chat over a coffee, I am always here to listen.
              </p>

              <div class="my-3 p-4 bg-[#F8FAFC]/60 border border-slate-200/60 rounded-sm border-l-2 border-l-[#B45309] shadow-sm">
                <h3 class="font-serif font-bold tracking-wide text-slate-900 text-[14px] mb-2">
                  How a Free Appraisal Works (Our 3-Step No-Pressure Promise)
                </h3>
                <div class="font-sans text-[11.5px] leading-[1.7] text-slate-600 space-y-1">
                  <p><strong>1. Send your address:</strong> Drop a quick line to m.nian@barfoot.co.nz or visit nzmarie.com/appraisal.</p>
                  <p><strong>2. I’ll do the homework:</strong> Analysing REINZ stats, local school zones, and unitary land potential.</p>
                  <p><strong>3. Private, obligation-free delivery:</strong> Receive a clear estimate with zero high-pressure sales pitch.</p>
                </div>
              </div>

              <div class="pt-2 space-y-1 text-xs text-slate-600">
                <p>📍 Serving North Shore & Greater Auckland</p>
                <p>📞 021 069 3089</p>
                <p>✉️ m.nian@barfoot.co.nz</p>
                <p>💼 Licensed under REAA 2008</p>
              </div>

              <p class="text-xs font-semibold text-[#1D4ED8] pt-1">
                For more information, visit <span class="underline underline-offset-2">nzmarie.com</span>
              </p>
            </div>
          </div>

          <div class="pt-2 pb-1">
            <p class="text-[9.5px] font-sans italic text-slate-400 tracking-wider">
              Note: This data reflects broader neighbourhood trends. Since every street in Northcross has its own unique character, feel free to drop me a line at m.nian@barfoot.co.nz if you ever want a quiet, obligation-free chat about your specific address.
            </p>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[9.5px] text-slate-500 italic leading-relaxed">
            This document is an independent market analysis prepared by Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008). It is based on official REINZ data and does not constitute binding financial valuation advice.
          </div>
        </div>

        <footer class="absolute bottom-6 left-16 right-16 flex justify-between items-center text-[8.5px] font-sans text-slate-400/80 border-t border-slate-200/40 pt-3">
          <div class="tracking-wide flex-1 pr-8 text-left">
            <span>© 2026 Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008). This publication is an independent market analysis based on official REINZ data.</span>
          </div>
          <div class="font-mono text-slate-600 font-bold tracking-widest whitespace-nowrap flex-shrink-0 text-right">
            Page 04
          </div>
        </footer>
      </div>

    </body>
    </html>
  `;
}

async function main() {
  try {
    console.log('Starting PDF generation pipeline...');
    
    if (!fs.existsSync(pdfOutputDir)) {
      fs.mkdirSync(pdfOutputDir, { recursive: true });
    }

    console.log(`Reading and parsing CSV data from: ${csvPath}`);
    const rawData = parseCSV(csvPath);
    console.log(`Successfully parsed ${rawData.length} data rows.`);

    const mariePhotoPath = path.join(__dirname, '..', 'public', 'img', 'Marie_large7.jpg');
    const mariePhotoBase64 = fs.readFileSync(mariePhotoPath).toString('base64');

    const reports = getCumulativeReports(rawData);

    console.log('Launching Puppeteer browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    for (const report of reports) {
      console.log('Processing metrics...');
      const metrics = aggregateReportMetrics(report, rawData);
      
      console.log('Generating HTML...');
      const htmlContent = generateHTML(metrics, mariePhotoBase64);

      console.log('Rendering PDF...');
      await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 3000));
      
      const pdfFileName = `Northcross_Market_Report_${report.key}.pdf`;
      const pdfPath = path.join(pdfOutputDir, pdfFileName);
      
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0px',
          bottom: '0px',
          left: '0px',
          right: '0px'
        }
      });
      
      console.log(`✅ Successfully generated report: ${pdfPath}`);
    }

    await browser.close();
    console.log('PDF generation pipeline finished successfully!');
  } catch (error) {
    console.error('Error running PDF generator:', error);
    process.exit(1);
  }
}

main();
