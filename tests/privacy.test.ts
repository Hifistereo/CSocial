import { describe, it, expect, beforeEach } from "vitest";
import {
  resetDb,
  createFamily,
  createChild,
  createContentItem,
  callRoute,
  unlockedParentCookie,
} from "./helpers";
import { prisma } from "@/lib/db";

describe("account deletion (GDPR erasure)", () => {
  beforeEach(resetDb);

  it("removes every row belonging to the family and clears the session", async () => {
    const family = await createFamily("erase@test.family");
    const other = await createFamily("keep@test.family");
    const child = await createChild(family.id);
    const otherChild = await createChild(other.id);
    const item = await createContentItem(family.id);
    const otherItem = await createContentItem(other.id);

    await prisma.watchEvent.create({
      data: { childId: child.id, contentItemId: item.id },
    });
    await prisma.favorite.create({
      data: { childId: child.id, contentItemId: item.id },
    });
    await prisma.childFlag.create({
      data: { childId: child.id, contentItemId: item.id, type: "REPORT" },
    });
    await prisma.auditLog.create({
      data: {
        familyId: family.id,
        actorType: "PARENT",
        actorId: family.id,
        action: "VIDEO_ADDED",
        entityType: "ContentItem",
        entityId: item.id,
      },
    });

    const { DELETE } = await import("@/app/api/parent/account/route");
    const res = await callRoute(DELETE, "/api/parent/account", {
      method: "DELETE",
      cookie: await unlockedParentCookie(family.id),
    });
    expect(res.status).toBe(200);
    // Session cookie is cleared
    expect(res.headers.get("set-cookie")).toContain("sid=;");

    // Zero rows remain for the deleted family…
    expect(await prisma.user.findUnique({ where: { id: family.id } })).toBeNull();
    expect(await prisma.childProfile.count({ where: { familyId: family.id } })).toBe(0);
    expect(await prisma.contentItem.count({ where: { familyId: family.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { familyId: family.id } })).toBe(0);
    expect(await prisma.watchEvent.count({ where: { childId: child.id } })).toBe(0);
    expect(await prisma.favorite.count({ where: { childId: child.id } })).toBe(0);
    expect(await prisma.childFlag.count({ where: { childId: child.id } })).toBe(0);

    // …while the other family is untouched.
    expect(await prisma.user.findUnique({ where: { id: other.id } })).not.toBeNull();
    expect(await prisma.childProfile.count({ where: { familyId: other.id } })).toBe(1);
    expect(otherChild.id).toBeTruthy();
    expect(otherItem.id).toBeTruthy();
  });
});

describe("watch history retention", () => {
  beforeEach(resetDb);

  it("login purges events older than the retention window", async () => {
    const family = await createFamily("retention@test.family");
    const child = await createChild(family.id);
    const item = await createContentItem(family.id);

    await prisma.user.update({
      where: { id: family.id },
      data: { watchRetentionDays: 30 },
    });
    await prisma.watchEvent.create({
      data: {
        childId: child.id,
        contentItemId: item.id,
        watchedAt: new Date(Date.now() - 40 * 24 * 3600_000), // stale
      },
    });
    await prisma.watchEvent.create({
      data: {
        childId: child.id,
        contentItemId: item.id,
        watchedAt: new Date(Date.now() - 5 * 24 * 3600_000), // fresh
      },
    });

    const { POST } = await import("@/app/api/auth/login/route");
    const res = await callRoute(POST, "/api/auth/login", {
      body: { email: "retention@test.family", password: "password123" },
    });
    expect(res.status).toBe(200);

    const remaining = await prisma.watchEvent.findMany({
      where: { childId: child.id },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].watchedAt.getTime()).toBeGreaterThan(
      Date.now() - 30 * 24 * 3600_000
    );
  });
});

describe("PIN change", () => {
  beforeEach(resetDb);

  it("updates the hash and writes a PIN_CHANGED audit row", async () => {
    const family = await createFamily("pin@test.family");
    const { POST } = await import("@/app/api/parent/pin/route");
    const res = await callRoute(POST, "/api/parent/pin", {
      cookie: await unlockedParentCookie(family.id),
      body: { pin: "5678" },
    });
    expect(res.status).toBe(200);

    const logs = await prisma.auditLog.findMany({
      where: { familyId: family.id, action: "PIN_CHANGED" },
    });
    expect(logs).toHaveLength(1);

    const bcrypt = (await import("bcryptjs")).default;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: family.id },
    });
    expect(await bcrypt.compare("5678", user.pinHash!)).toBe(true);
    expect(await bcrypt.compare("1234", user.pinHash!)).toBe(false);
  });

  it("rejects malformed PINs", async () => {
    const family = await createFamily("pin2@test.family");
    const { POST } = await import("@/app/api/parent/pin/route");
    for (const bad of ["12", "1234567", "abcd", ""]) {
      const res = await callRoute(POST, "/api/parent/pin", {
        cookie: await unlockedParentCookie(family.id),
        body: { pin: bad },
      });
      expect(res.status).toBe(400);
    }
  });
});
