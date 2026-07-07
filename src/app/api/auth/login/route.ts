import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, jsonWithSession, HttpError } from "@/lib/api";
import { unlockedParentClaims } from "@/lib/auth";
import { checkRateLimit, clearRateLimit } from "@/lib/ratelimit";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const POST = api(async (req) => {
  const body = bodySchema.parse(await req.json());
  const email = body.email.toLowerCase().trim();

  if (!checkRateLimit(`login:${email}`)) {
    throw new HttpError(429, "Too many attempts, try again later");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password");
  }
  clearRateLimit(`login:${email}`);

  // Opportunistic GDPR retention cleanup: purge this family's watch history
  // older than the configured window (no cron needed at pilot scale).
  const cutoff = new Date(Date.now() - user.watchRetentionDays * 24 * 3600_000);
  await prisma.watchEvent.deleteMany({
    where: { watchedAt: { lt: cutoff }, child: { familyId: user.id } },
  });

  return jsonWithSession(
    { userId: user.id },
    unlockedParentClaims(user.id, user.tokenVersion)
  );
});
