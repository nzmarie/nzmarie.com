import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const BASE_DIR = path.resolve(process.cwd(), "tmp", "r2-mock-reports");

function sanitizeKeyFromPath(raw: string): string {
  // raw is like /reports/Northcross/2026-Q2.pdf or Northcross/2026-Q2.pdf
  let key = raw;
  if (key.startsWith("/reports/")) key = key.slice("/reports/".length);
  key = decodeURIComponent(key);
  const normalized = path.normalize(key);
  if (normalized.includes("..")) {
    throw new Error("Invalid report key");
  }
  return normalized;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    // pathname after host
    const pathname = url.pathname; // e.g. /reports/Northcross/2026-Q2.pdf
    const rawKey = pathname.replace(/^\/reports\//, "");
    if (!rawKey) {
      return NextResponse.json({ error: "Missing report key" }, { status: 400 });
    }

    const sanitizedKey = sanitizeKeyFromPath(rawKey);

    // support files placed either directly under BASE_DIR or under BASE_DIR/reports/
    let reportPath = path.join(BASE_DIR, sanitizedKey);
    if (!fs.existsSync(reportPath)) {
      reportPath = path.join(BASE_DIR, 'reports', sanitizedKey);
    }

    if (!reportPath.startsWith(BASE_DIR)) {
      return NextResponse.json({ error: "Invalid report path" }, { status: 400 });
    }

    if (!fs.existsSync(reportPath) || !fs.statSync(reportPath).isFile()) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(reportPath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${path.basename(reportPath)}"`,
      },
    });
  } catch (error) {
    console.error("Local reports path fetch error:", error);
    return NextResponse.json({ error: "Unable to fetch report" }, { status: 500 });
  }
}
