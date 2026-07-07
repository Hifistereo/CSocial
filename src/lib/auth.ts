import { SignJWT, jwtVerify } from "jose";

// Session model: one httpOnly cookie ("sid") holding an HS256 JWT.
// Three scopes with a hard boundary enforced in proxy.ts + authz.ts:
//   parent           – logged in, dashboard locked (enough for the profile picker)
//   parent_unlocked  – PIN entered; degrades to "parent" when unlockedUntil lapses
//   child            – child mode; can only reach /api/child/* and /feed

export type Scope = "parent" | "parent_unlocked" | "child";

export type SessionClaims = {
  scope: Scope;
  userId: string; // always the parent/family id
  childId?: string; // present iff scope === "child"
  unlockedUntil?: number; // epoch ms; only meaningful for parent_unlocked
  tv: number; // tokenVersion, checked against DB in authz guards
};

export const SESSION_COOKIE = "sid";
const SESSION_DAYS = 30;
export const UNLOCK_MINUTES = 15;

function secretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function mintSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.tv !== "number" ||
      (payload.scope !== "parent" &&
        payload.scope !== "parent_unlocked" &&
        payload.scope !== "child")
    ) {
      return null;
    }
    if (payload.scope === "child" && typeof payload.childId !== "string") {
      return null;
    }
    return {
      scope: payload.scope,
      userId: payload.userId,
      childId: typeof payload.childId === "string" ? payload.childId : undefined,
      unlockedUntil:
        typeof payload.unlockedUntil === "number"
          ? payload.unlockedUntil
          : undefined,
      tv: payload.tv,
    };
  } catch {
    return null;
  }
}

/** Parse the session from a standard Request's Cookie header. */
export async function readSessionFromRequest(
  req: Request
): Promise<SessionClaims | null> {
  const header = req.headers.get("cookie") ?? "";
  const match = header
    .split(/;\s*/)
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  return verifySessionToken(token);
}

/** True while a parent session still has dashboard access. */
export function isUnlocked(claims: SessionClaims): boolean {
  return (
    claims.scope === "parent_unlocked" &&
    (claims.unlockedUntil ?? 0) > Date.now()
  );
}

export function unlockedParentClaims(userId: string, tv: number): SessionClaims {
  return {
    scope: "parent_unlocked",
    userId,
    tv,
    unlockedUntil: Date.now() + UNLOCK_MINUTES * 60_000,
  };
}

export function lockedParentClaims(userId: string, tv: number): SessionClaims {
  return { scope: "parent", userId, tv };
}

export function childClaims(
  userId: string,
  childId: string,
  tv: number
): SessionClaims {
  return { scope: "child", userId, childId, tv };
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 24 * 3600,
};
