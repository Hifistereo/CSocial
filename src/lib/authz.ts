import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import {
  isUnlocked,
  readSessionFromRequest,
  type SessionClaims,
} from "@/lib/auth";

// Layer-2 guards (layer 1 is proxy.ts path-prefix enforcement; layer 3 is the
// hard-coded where-clauses in lib/feed.ts and services). Every route handler
// calls one of these first. They re-verify the cookie and check tokenVersion
// against the database, then return a typed session.

async function readValidSession(req: Request): Promise<SessionClaims> {
  const claims = await readSessionFromRequest(req);
  if (!claims) throw new HttpError(401, "Unauthorized");
  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { tokenVersion: true },
  });
  if (!user || user.tokenVersion !== claims.tv) {
    throw new HttpError(401, "Unauthorized");
  }
  return claims;
}

export type ParentSession = { userId: string; claims: SessionClaims };
export type ChildSession = {
  familyId: string;
  childId: string;
  claims: SessionClaims;
};

/** Any parent session, locked or unlocked (profile picker, unlock, enter-child). */
export async function requireParentBase(req: Request): Promise<ParentSession> {
  const claims = await readValidSession(req);
  if (claims.scope === "child") throw new HttpError(401, "Unauthorized");
  return { userId: claims.userId, claims };
}

/** Unlocked parent only — all of /api/parent/*. */
export async function requireParentUnlocked(
  req: Request
): Promise<ParentSession> {
  const claims = await readValidSession(req);
  if (claims.scope === "child" || !isUnlocked(claims)) {
    throw new HttpError(401, "Unauthorized");
  }
  return { userId: claims.userId, claims };
}

/**
 * Child scope only — all of /api/child/*. Identity comes exclusively from the
 * token; child endpoints must never read childId/familyId from params or body.
 */
export async function requireChild(req: Request): Promise<ChildSession> {
  const claims = await readValidSession(req);
  if (claims.scope !== "child" || !claims.childId) {
    throw new HttpError(401, "Unauthorized");
  }
  return { familyId: claims.userId, childId: claims.childId, claims };
}
