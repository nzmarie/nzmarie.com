import { NextResponse } from "next/server";
import { auth, hasPermission } from "../../../../lib/auth";
import { query } from "../../../../lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "viewer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await query(
    `SELECT id, client_name, property_address, email, phone, timeline, motivation,
            language_preference, heard_from, status, agent_notes, follow_up_at,
            created_at, updated_at
     FROM appraisal_leads
     ORDER BY created_at DESC
     LIMIT 100`
  );
  return NextResponse.json({ success: true, leads: result.rows });
}
