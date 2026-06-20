import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { hashEmail, isValidEmail } from "../../../lib/hash";
import { sendAppraisalNotification } from "../../../lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, address, email, phone, timeline, motivation, languagePreference, heardFrom } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ success: false, error: "Invalid email address" }, { status: 400 });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }
    if (!address || typeof address !== "string" || address.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Address is required" }, { status: 400 });
    }
    if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Phone is required" }, { status: 400 });
    }

    const emailHash = hashEmail(email);

    const duplicate = await query<{ id: string }>(
      `SELECT id FROM appraisal_leads
       WHERE email_hash = $1
         AND property_address = $2
         AND created_at > NOW() - INTERVAL '7 days'`,
      [emailHash, address.trim()]
    );

    if (duplicate.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: "You have already submitted a request for this property recently." },
        { status: 409 }
      );
    }

    await query(
      `INSERT INTO appraisal_leads
       (client_name, property_address, email, email_hash, phone, timeline, motivation, language_preference, heard_from)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        name.trim(),
        address.trim(),
        email.trim().toLowerCase(),
        emailHash,
        phone.trim(),
        timeline || null,
        motivation || null,
        languagePreference || null,
        heardFrom || null,
      ]
    );

    sendAppraisalNotification({
      name: name.trim(),
      address: address.trim(),
      email: email.trim(),
      phone: phone.trim(),
      timeline,
      motivation,
      languagePreference,
      heardFrom,
    }).catch((err) => console.error("Email send failed:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Appraisal API Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
