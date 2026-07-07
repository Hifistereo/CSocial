import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, jsonWithSession, HttpError } from "@/lib/api";
import { unlockedParentClaims } from "@/lib/auth";

const bodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, "PIN must be 4-6 digits")
    .optional(),
});

export const POST = api(async (req) => {
  const body = bodySchema.parse(await req.json());
  const email = body.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, "An account with this email already exists");

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(body.password, 10),
      pinHash: body.pin ? await bcrypt.hash(body.pin, 10) : null,
    },
  });

  return jsonWithSession(
    { userId: user.id },
    unlockedParentClaims(user.id, user.tokenVersion),
    { status: 201 }
  );
});
