import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  mintSessionToken,
  childClaims,
  lockedParentClaims,
  unlockedParentClaims,
  type SessionClaims,
} from "@/lib/auth";
import type { AgeBand, Category, ContentStatus } from "@/lib/enums";

export async function resetDb() {
  // Order matters for FK constraints; cascades handle the rest.
  await prisma.auditLog.deleteMany();
  await prisma.childFlag.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.watchEvent.deleteMany();
  await prisma.contentItem.deleteMany();
  await prisma.childProfile.deleteMany();
  await prisma.user.deleteMany();
}

export async function createFamily(email: string) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("password123", 4),
      pinHash: await bcrypt.hash("1234", 4),
    },
  });
}

export async function createChild(
  familyId: string,
  opts: {
    nickname?: string;
    ageBand?: AgeBand;
    allowedCategories?: Category[];
  } = {}
) {
  return prisma.childProfile.create({
    data: {
      familyId,
      nickname: opts.nickname ?? "Kid",
      ageBand: opts.ageBand ?? "AGE_7_9",
      allowedCategories: JSON.stringify(
        opts.allowedCategories ?? ["EDUCATION", "ANIMALS", "MUSIC"]
      ),
    },
  });
}

let videoCounter = 0;

export async function createContentItem(
  familyId: string,
  opts: {
    status?: ContentStatus;
    category?: Category;
    ageBand?: AgeBand;
    videoId?: string;
    channelName?: string;
    title?: string;
  } = {}
) {
  videoCounter += 1;
  const videoId =
    opts.videoId ?? `vid${String(videoCounter).padStart(8, "0")}`;
  return prisma.contentItem.create({
    data: {
      familyId,
      videoId,
      title: opts.title ?? `Video ${videoCounter}`,
      channelName: opts.channelName ?? "Test Channel",
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      category: opts.category ?? "EDUCATION",
      ageBand: opts.ageBand ?? "AGE_7_9",
      status: opts.status ?? "APPROVED",
    },
  });
}

export async function cookieFor(claims: SessionClaims): Promise<string> {
  return `sid=${await mintSessionToken(claims)}`;
}

export async function childCookie(familyId: string, childId: string, tv = 0) {
  return cookieFor(childClaims(familyId, childId, tv));
}

export async function unlockedParentCookie(userId: string, tv = 0) {
  return cookieFor(unlockedParentClaims(userId, tv));
}

export async function lockedParentCookie(userId: string, tv = 0) {
  return cookieFor(lockedParentClaims(userId, tv));
}

/** Expired-unlock parent cookie: authenticated but dashboard-locked. */
export async function staleUnlockParentCookie(userId: string, tv = 0) {
  return cookieFor({
    scope: "parent_unlocked",
    userId,
    tv,
    unlockedUntil: Date.now() - 60_000,
  });
}

type RouteHandler = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> }
) => Promise<Response>;

export function callRoute(
  handler: RouteHandler,
  url: string,
  opts: {
    method?: string;
    cookie?: string;
    body?: unknown;
    params?: Record<string, string>;
  } = {}
): Promise<Response> {
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", opts.cookie);
  let bodyInit: string | undefined;
  if (opts.body !== undefined) {
    headers.set("content-type", "application/json");
    bodyInit = JSON.stringify(opts.body);
  }
  const req = new Request(`http://localhost${url}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: bodyInit,
  });
  return handler(req, { params: Promise.resolve(opts.params ?? {}) });
}
