import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { recordCampaignVisit } from '@/lib/campaign-tracker';

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || '';
  const referrer = request.headers.get('referer') || '';

  after(async () => {
    try {
      await recordCampaignVisit({
        campaignKey: 'glenfield',
        campaignName: 'Glenfield',
        ip,
        userAgent,
        referrer,
      });
    } catch (err) {
      console.error('Asynchronous campaign visit recording failed:', err);
    }
  });

  const redirectUrl = new URL('/', request.url);
  redirectUrl.searchParams.set('utm_source', 'qr');
  redirectUrl.searchParams.set('utm_campaign', 'glenfield');

  return NextResponse.redirect(redirectUrl);
}
