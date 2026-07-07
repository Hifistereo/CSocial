import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  resetDb,
  createFamily,
  createContentItem,
  createChild,
  callRoute,
  unlockedParentCookie,
} from "./helpers";
import { prisma } from "@/lib/db";
import { setContentStatus } from "@/lib/services/content";

describe("content status state machine", () => {
  beforeEach(resetDb);

  it("PENDING -> APPROVED and PENDING -> REJECTED are allowed", async () => {
    const family = await createFamily("sm1@test.family");
    const a = await createContentItem(family.id, { status: "PENDING" });
    const b = await createContentItem(family.id, { status: "PENDING" });

    expect((await setContentStatus(family.id, a.id, "APPROVED")).status).toBe("APPROVED");
    expect((await setContentStatus(family.id, b.id, "REJECTED")).status).toBe("REJECTED");
  });

  it("APPROVED -> REVOKED is allowed; APPROVED -> REJECTED is not", async () => {
    const family = await createFamily("sm2@test.family");
    const item = await createContentItem(family.id, { status: "APPROVED" });

    await expect(
      setContentStatus(family.id, item.id, "REJECTED")
    ).rejects.toMatchObject({ status: 409 });

    expect((await setContentStatus(family.id, item.id, "REVOKED")).status).toBe("REVOKED");
  });

  it("PENDING -> REVOKED is rejected", async () => {
    const family = await createFamily("sm3@test.family");
    const item = await createContentItem(family.id, { status: "PENDING" });
    await expect(
      setContentStatus(family.id, item.id, "REVOKED")
    ).rejects.toMatchObject({ status: 409 });
  });

  it("REJECTED and REVOKED can be re-approved after re-review", async () => {
    const family = await createFamily("sm4@test.family");
    const rejected = await createContentItem(family.id, { status: "REJECTED" });
    const revoked = await createContentItem(family.id, { status: "REVOKED" });

    expect((await setContentStatus(family.id, rejected.id, "APPROVED")).status).toBe("APPROVED");
    expect((await setContentStatus(family.id, revoked.id, "APPROVED")).status).toBe("APPROVED");
  });

  it("cannot change another family's item (404, no info leak)", async () => {
    const familyA = await createFamily("smA@test.family");
    const familyB = await createFamily("smB@test.family");
    const itemB = await createContentItem(familyB.id, { status: "PENDING" });

    await expect(
      setContentStatus(familyA.id, itemB.id, "APPROVED")
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("every mutation writes an audit row", () => {
  beforeEach(resetDb);

  it("status changes produce matching AuditLog entries", async () => {
    const family = await createFamily("audit1@test.family");
    const item = await createContentItem(family.id, { status: "PENDING" });

    await setContentStatus(family.id, item.id, "APPROVED");
    await setContentStatus(family.id, item.id, "REVOKED");

    const logs = await prisma.auditLog.findMany({
      where: { familyId: family.id },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.action)).toEqual([
      "VIDEO_APPROVED",
      "VIDEO_REVOKED",
    ]);
    expect(logs[0].entityId).toBe(item.id);
    expect(JSON.parse(logs[0].meta!)).toMatchObject({
      from: "PENDING",
      to: "APPROVED",
    });
  });

  it("child CRUD routes produce audit entries", async () => {
    const family = await createFamily("audit2@test.family");
    const cookie = await unlockedParentCookie(family.id);

    const { POST } = await import("@/app/api/parent/children/route");
    const createRes = await callRoute(POST, "/api/parent/children", {
      cookie,
      body: {
        nickname: "Testkid",
        ageBand: "AGE_7_9",
        allowedCategories: ["MUSIC"],
      },
    });
    expect(createRes.status).toBe(201);
    const { child } = (await createRes.json()) as { child: { id: string } };

    const { PATCH, DELETE } = await import(
      "@/app/api/parent/children/[id]/route"
    );
    const patchRes = await callRoute(PATCH, `/api/parent/children/${child.id}`, {
      method: "PATCH",
      cookie,
      body: { nickname: "Renamed" },
      params: { id: child.id },
    });
    expect(patchRes.status).toBe(200);

    const deleteRes = await callRoute(
      DELETE,
      `/api/parent/children/${child.id}`,
      { method: "DELETE", cookie, params: { id: child.id } }
    );
    expect(deleteRes.status).toBe(200);

    const logs = await prisma.auditLog.findMany({
      where: { familyId: family.id },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.action)).toEqual([
      "CHILD_CREATED",
      "CHILD_UPDATED",
      "CHILD_DELETED",
    ]);
  });
});

describe("add video via oEmbed (mocked fetch)", () => {
  beforeEach(resetDb);
  afterEach(() => vi.unstubAllGlobals());

  function stubOEmbed(ok = true) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("youtube.com/oembed")) {
          return ok
            ? new Response(
                JSON.stringify({
                  title: "Mock Video",
                  author_name: "Mock Channel",
                  thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg",
                }),
                { status: 200 }
              )
            : new Response("Not Found", { status: 404 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );
  }

  it("creates a PENDING item with metadata and audit row", async () => {
    stubOEmbed();
    const family = await createFamily("add1@test.family");
    const cookie = await unlockedParentCookie(family.id);

    const { POST } = await import("@/app/api/parent/videos/route");
    const res = await callRoute(POST, "/api/parent/videos", {
      cookie,
      body: {
        url: "https://youtu.be/dQw4w9WgXcQ",
        category: "MUSIC",
        ageBand: "AGE_10_12",
      },
    });
    expect(res.status).toBe(201);
    const { item } = (await res.json()) as {
      item: { status: string; title: string; videoId: string };
    };
    expect(item.status).toBe("PENDING");
    expect(item.title).toBe("Mock Video");
    expect(item.videoId).toBe("dQw4w9WgXcQ");

    const logs = await prisma.auditLog.findMany({
      where: { familyId: family.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("VIDEO_ADDED");
  });

  it("rejects duplicates within the family", async () => {
    stubOEmbed();
    const family = await createFamily("add2@test.family");
    await createContentItem(family.id, { videoId: "dQw4w9WgXcQ" });
    const cookie = await unlockedParentCookie(family.id);

    const { POST } = await import("@/app/api/parent/videos/route");
    const res = await callRoute(POST, "/api/parent/videos", {
      cookie,
      body: {
        url: "https://youtu.be/dQw4w9WgXcQ",
        category: "MUSIC",
        ageBand: "AGE_10_12",
      },
    });
    expect(res.status).toBe(409);
  });

  it("surfaces oEmbed failure as 'not found or not embeddable'", async () => {
    stubOEmbed(false);
    const family = await createFamily("add3@test.family");
    const cookie = await unlockedParentCookie(family.id);

    const { POST } = await import("@/app/api/parent/videos/route");
    const res = await callRoute(POST, "/api/parent/videos", {
      cookie,
      body: {
        url: "https://youtu.be/dQw4w9WgXcQ",
        category: "MUSIC",
        ageBand: "AGE_10_12",
      },
    });
    expect(res.status).toBe(404);
  });

  it("rejects non-YouTube URLs", async () => {
    stubOEmbed();
    const family = await createFamily("add4@test.family");
    const cookie = await unlockedParentCookie(family.id);

    const { POST } = await import("@/app/api/parent/videos/route");
    const res = await callRoute(POST, "/api/parent/videos", {
      cookie,
      body: {
        url: "https://vimeo.com/12345",
        category: "MUSIC",
        ageBand: "AGE_10_12",
      },
    });
    expect(res.status).toBe(400);
  });

  it("videos list is scoped to the family", async () => {
    const familyA = await createFamily("list1@test.family");
    const familyB = await createFamily("list2@test.family");
    await createContentItem(familyA.id, { videoId: "aaaaaaaaaaa" });
    await createContentItem(familyB.id, { videoId: "bbbbbbbbbbb" });

    const { GET } = await import("@/app/api/parent/videos/route");
    const res = await callRoute(GET, "/api/parent/videos", {
      cookie: await unlockedParentCookie(familyA.id),
    });
    const raw = await res.text();
    expect(raw).toContain("aaaaaaaaaaa");
    expect(raw).not.toContain("bbbbbbbbbbb");
  });

  // Guard against forgetting createChild in enter-child flow coverage
  it("children list is scoped to the family", async () => {
    const familyA = await createFamily("clist1@test.family");
    const familyB = await createFamily("clist2@test.family");
    await createChild(familyA.id, { nickname: "MineKid" });
    await createChild(familyB.id, { nickname: "OtherKid" });

    const { GET } = await import("@/app/api/parent/children/route");
    const res = await callRoute(GET, "/api/parent/children", {
      cookie: await unlockedParentCookie(familyA.id),
    });
    const raw = await res.text();
    expect(raw).toContain("MineKid");
    expect(raw).not.toContain("OtherKid");
  });
});
