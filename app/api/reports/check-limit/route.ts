// app/api/reports/check-limit/route.ts
// Check if user can download report (5 times per month limit)

import { NextRequest, NextResponse } from 'next/server';
import { checkDownloadLimit } from '@/lib/download-tracker';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const suburb = searchParams.get('suburb');
    
    if (!email || !suburb) {
      return NextResponse.json(
        { error: 'Missing required parameters: email, suburb' },
        { status: 400 }
      );
    }
    
    const limitCheck = await checkDownloadLimit(email, suburb);
    
    return NextResponse.json(limitCheck);
  } catch (error) {
    console.error('Check limit error:', error);
    return NextResponse.json(
      { error: 'Failed to check download limit' },
      { status: 500 }
    );
  }
}
