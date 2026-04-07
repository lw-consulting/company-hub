import * as jose from 'jose';
import { env } from '../config/env.js';
import type { JwtPayload } from '@company-hub/shared';

const accessSecret = new TextEncoder().encode(env.JWT_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

function parseExpiry(expiry: string): string {
  return expiry;
}

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(parseExpiry(env.ACCESS_TOKEN_EXPIRY))
    .sign(accessSecret);
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(parseExpiry(env.REFRESH_TOKEN_EXPIRY))
    .sign(refreshSecret);
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, accessSecret);
  return payload as unknown as JwtPayload;
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jose.jwtVerify(token, refreshSecret);
  return { sub: payload.sub as string };
}
