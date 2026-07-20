import * as fs from "fs";
import * as path from "path";
import { slugMap, parseCSV, getCumulativeReports, aggregateReportMetrics } from "../lib/report-data";

const csvPath = path.join(process.cwd(), "tasks", "Northcross-Jule-2025 to May-2026-Market Insights Report Export (1).csv");
const raw = fs.readFileSync(csvPath, "utf8");
const rawData = parseCSV(raw);
const reports = getCumulativeReports(rawData);

const allMetrics: Record<string, unknown> = {};
for (const [slug, entry] of Object.entries(slugMap)) {
  const report = reports.find((r) => r.key === entry.version);
  if (report) {
    allMetrics[slug] = aggregateReportMetrics(report, rawData);
  }
}

const replacer = (_key: string, value: unknown) =>
  typeof value === "number" && isNaN(value) ? null : value;

const outPath = path.join(process.cwd(), "lib", "report-data-static.ts");
const content =
  '// auto-generated\nimport type { ReportMetrics } from "./report-data";\nexport const staticMetrics: Record<string, ReportMetrics> = ' +
  JSON.stringify(allMetrics, replacer, 2) +
  ";\n";
fs.writeFileSync(outPath, content);
console.log("Written to", outPath);
