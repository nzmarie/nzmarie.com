import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { recordCampaignVisit, getClientIp } from '@/lib/campaign-tracker';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || '';
  const referrer = request.headers.get('referer') || '';

  after(async () => {
    try {
      await recordCampaignVisit({
        campaignKey: 'hillcrest',
        campaignName: 'Hillcrest',
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
  redirectUrl.searchParams.set('utm_campaign', 'hillcrest');

  return NextResponse.redirect(redirectUrl);
}
