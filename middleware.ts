export { auth as middleware } from './lib/auth.middleware';

export const config = {
  matcher: ['/admin/:path*'],
};
