import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ['/cart/:path*', '/account/:path*', '/admin/:path*'],
};
