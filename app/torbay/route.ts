import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const redirectUrl = new URL('/', request.url);
  redirectUrl.searchParams.set('utm_source', 'qr');
  redirectUrl.searchParams.set('utm_campaign', 'torbay');

  return NextResponse.redirect(redirectUrl);
}
