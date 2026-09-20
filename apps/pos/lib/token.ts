import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export const SESSION_COOKIE = 'pos_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days — local register PC, long session is the point

export type Role = 'owner' | 'seller';

export interface Session {
  userId: string;
  name: string;
  role: Role;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? '');
}

export function createToken(session: Session): Promise<string> {
  return new SignJWT(session as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

/** Edge-safe (pure jose) — used by middleware. */
export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== 'string' || typeof payload.name !== 'string') {
      return null;
    }
    if (payload.role !== 'owner' && payload.role !== 'seller') {
      return null;
    }
    return { userId: payload.userId, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}
