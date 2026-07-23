import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { marieDB } from '@/lib/db';
import { isAdmin } from '@/lib/permissions';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || 'mock',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'mock',
  },
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const suburb = formData.get('suburb') as string;
    const quarter = formData.get('quarter') as string;
    const yearRaw = formData.get('year') as string;
    const year = parseInt(yearRaw, 10);

    if (!file || !suburb || !quarter || isNaN(year)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `reports/${suburb}/${quarter}-${year}.pdf`;

    if (process.env.R2_BUCKET_NAME) {
      await r2.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: 'application/pdf',
        })
      );
    }

    const publicDomain = (process.env.R2_PUBLIC_DOMAIN || 'https://r2.nzmarie.com').replace(/\/+$/, '');
    const fileUrl = `${publicDomain}/${key}`;

    const result = await marieDB.query(
      `INSERT INTO suburb_reports (suburb, quarter, year, file_url, file_name, file_size, uploaded_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       ON CONFLICT (suburb, quarter, year) 
       DO UPDATE SET 
         file_url = $4, 
         file_name = $5,
         file_size = $6, 
         uploaded_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [suburb, quarter, year, fileUrl, file.name || `${suburb}_${quarter}_${year}.pdf`, buffer.length, session.user.email]
    );

    return NextResponse.json({
      success: true,
      url: fileUrl,
      report: result.rows[0],
      message: 'Report uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return NextResponse.json(
      { error: 'Failed to upload PDF' },
      { status: 500 }
    );
  }
}
