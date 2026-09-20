import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifyToken, type Session } from './token';

export { SESSION_COOKIE, createToken, verifyToken } from './token';
export type { Session, Role } from './token';

/** Server-side session read for pages and route handlers. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
