import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const redirectUrl = new URL('/', request.url);
  redirectUrl.searchParams.set('utm_source', 'qr');
  redirectUrl.searchParams.set('utm_campaign', 'devonport');

  return NextResponse.redirect(redirectUrl);
}
