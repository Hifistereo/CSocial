import { cookies } from "next/headers";
import {
  verifySessionToken,
  SESSION_COOKIE,
  type SessionClaims,
} from "@/lib/auth";

/**
 * Session for Server Components (pages/layouts). API routes use
 * readSessionFromRequest via lib/authz guards instead — this module imports
 * next/headers and therefore only works inside a Next request scope.
 */
export async function getPageSession(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}
