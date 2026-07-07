import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, jsonWithSession, HttpError } from "@/lib/api";
import { lockedParentClaims } from "@/lib/auth";
import { requireChild } from "@/lib/authz";
import { checkRateLimit, clearRateLimit } from "@/lib/ratelimit";

// The child can tap "exit", but only a parent can supply the PIN. Success
// returns a LOCKED parent session — the dashboard still requires unlock.
const bodySchema = z.object({
  secret: z.string().min(1).max(128),
});

export const POST = api(async (req) => {
  const session = await requireChild(req);
  const body = bodySchema.parse(await req.json());

  if (!checkRateLimit(`exit-child:${session.familyId}`)) {
    throw new HttpError(429, "Too many attempts, try again later");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.familyId },
  });
  const hash = user.pinHash ?? user.passwordHash;
  if (!(await bcrypt.compare(body.secret, hash))) {
    throw new HttpError(401, "Incorrect PIN");
  }
  clearRateLimit(`exit-child:${session.familyId}`);

  return jsonWithSession({ ok: true }, lockedParentClaims(user.id, user.tokenVersion));
});
