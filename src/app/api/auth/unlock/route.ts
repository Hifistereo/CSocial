import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, jsonWithSession, HttpError } from "@/lib/api";
import { unlockedParentClaims } from "@/lib/auth";
import { requireParentBase } from "@/lib/authz";
import { checkRateLimit, clearRateLimit } from "@/lib/ratelimit";

const bodySchema = z.object({
  secret: z.string().min(1).max(128), // the parent's PIN, or password if no PIN set
});

export const POST = api(async (req) => {
  const session = await requireParentBase(req);
  const body = bodySchema.parse(await req.json());

  if (!checkRateLimit(`unlock:${session.userId}`)) {
    throw new HttpError(429, "Too many attempts, try again later");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
  });
  const hash = user.pinHash ?? user.passwordHash;
  if (!(await bcrypt.compare(body.secret, hash))) {
    throw new HttpError(401, "Incorrect PIN");
  }
  clearRateLimit(`unlock:${session.userId}`);

  return jsonWithSession(
    { ok: true },
    unlockedParentClaims(user.id, user.tokenVersion)
  );
});
