import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  resetDb,
  createFamily,
  createChild,
  createContentItem,
  callRoute,
  childCookie,
  lockedParentCookie,
  staleUnlockParentCookie,
  unlockedParentCookie,
  cookieFor,
} from "./helpers";

type RouteModule = Record<
  string,
  (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
>;

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/** Enumerate every route.ts under a zone so new routes are covered automatically. */
function findRouteFiles(zone: string): string[] {
  const root = path.join(__dirname, "..", "src", "app", "api", zone);
  if (!fs.existsSync(root)) return [];
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts") found.push(full);
    }
  };
  walk(root);
  return found;
}

async function loadHandlers(file: string) {
  const mod = (await import(file)) as RouteModule;
  return HTTP_METHODS.filter((m) => typeof mod[m] === "function").map(
    (method) => ({ method, handler: mod[method] })
  );
}

describe("parent zone rejects non-parent-unlocked tokens", () => {
  let family: Awaited<ReturnType<typeof createFamily>>;
  let child: Awaited<ReturnType<typeof createChild>>;

  beforeEach(async () => {
    await resetDb();
    family = await createFamily("boundary@test.family");
    child = await createChild(family.id);
  });

  const parentRoutes = findRouteFiles("parent");

  it("has at least one parent route to test", () => {
    expect(parentRoutes.length).toBeGreaterThan(0);
  });

  for (const file of parentRoutes) {
    const rel = path.relative(path.join(__dirname, ".."), file);

    it(`${rel}: child token -> 401`, async () => {
      for (const { handler } of await loadHandlers(file)) {
        const res = await callRoute(handler, "/api/parent/x", {
          cookie: await childCookie(family.id, child.id),
          body: {},
          params: { id: "some-id" },
        });
        expect(res.status).toBe(401);
      }
    });

    it(`${rel}: locked parent token -> 401`, async () => {
      for (const { handler } of await loadHandlers(file)) {
        const res = await callRoute(handler, "/api/parent/x", {
          cookie: await lockedParentCookie(family.id),
          body: {},
          params: { id: "some-id" },
        });
        expect(res.status).toBe(401);
      }
    });

    it(`${rel}: expired-unlock parent token -> 401`, async () => {
      for (const { handler } of await loadHandlers(file)) {
        const res = await callRoute(handler, "/api/parent/x", {
          cookie: await staleUnlockParentCookie(family.id),
          body: {},
          params: { id: "some-id" },
        });
        expect(res.status).toBe(401);
      }
    });

    it(`${rel}: no token -> 401`, async () => {
      for (const { handler } of await loadHandlers(file)) {
        const res = await callRoute(handler, "/api/parent/x", {
          body: {},
          params: { id: "some-id" },
        });
        expect(res.status).toBe(401);
      }
    });

    it(`${rel}: garbage token -> 401`, async () => {
      for (const { handler } of await loadHandlers(file)) {
        const res = await callRoute(handler, "/api/parent/x", {
          cookie: "sid=not.a.jwt",
          body: {},
          params: { id: "some-id" },
        });
        expect(res.status).toBe(401);
      }
    });
  }
});

describe("child zone rejects non-child tokens", () => {
  let family: Awaited<ReturnType<typeof createFamily>>;

  beforeEach(async () => {
    await resetDb();
    family = await createFamily("boundary2@test.family");
  });

  const childRoutes = findRouteFiles("child");

  it("has at least one child route to test", () => {
    expect(childRoutes.length).toBeGreaterThan(0);
  });

  for (const file of childRoutes) {
    const rel = path.relative(path.join(__dirname, ".."), file);

    it(`${rel}: unlocked parent token -> 401`, async () => {
      for (const { handler } of await loadHandlers(file)) {
        const res = await callRoute(handler, "/api/child/x", {
          cookie: await unlockedParentCookie(family.id),
          body: {},
          params: { id: "some-id" },
        });
        expect(res.status).toBe(401);
      }
    });

    it(`${rel}: no token -> 401`, async () => {
      for (const { handler } of await loadHandlers(file)) {
        const res = await callRoute(handler, "/api/child/x", {
          body: {},
          params: { id: "some-id" },
        });
        expect(res.status).toBe(401);
      }
    });
  }
});

describe("token integrity", () => {
  beforeEach(resetDb);

  it("rejects a token signed with the wrong secret", async () => {
    const family = await createFamily("integrity@test.family");
    const child = await createChild(family.id);

    const { SignJWT } = await import("jose");
    const evil = await new SignJWT({
      scope: "child",
      userId: family.id,
      childId: child.id,
      tv: 0,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30d")
      .sign(new TextEncoder().encode("attacker-secret-attacker-secret-0000"));

    const { GET } = await import("@/app/api/child/feed/route");
    const res = await callRoute(GET, "/api/child/feed", {
      cookie: `sid=${evil}`,
    });
    expect(res.status).toBe(401);
  });

  it("rejects a token whose tokenVersion is stale", async () => {
    const family = await createFamily("tv@test.family");
    const child = await createChild(family.id);
    const cookie = await childCookie(family.id, child.id, 0);

    await import("@/lib/db").then(({ prisma }) =>
      prisma.user.update({
        where: { id: family.id },
        data: { tokenVersion: 1 },
      })
    );

    const { GET } = await import("@/app/api/child/feed/route");
    const res = await callRoute(GET, "/api/child/feed", { cookie });
    expect(res.status).toBe(401);
  });
});

describe("cross-family and smuggling protection", () => {
  beforeEach(resetDb);

  it("enter-child rejects a childId from another family", async () => {
    const familyA = await createFamily("a@test.family");
    const familyB = await createFamily("b@test.family");
    const childB = await createChild(familyB.id);

    const { POST } = await import("@/app/api/auth/enter-child/route");
    const res = await callRoute(POST, "/api/auth/enter-child", {
      cookie: await unlockedParentCookie(familyA.id),
      body: { childId: childB.id },
    });
    expect(res.status).toBe(403);
  });

  it("watch-events ignores a smuggled childId and uses the token's child", async () => {
    const family = await createFamily("smuggle@test.family");
    const childA = await createChild(family.id, { nickname: "A" });
    const childB = await createChild(family.id, { nickname: "B" });
    const item = await createContentItem(family.id);

    const { POST } = await import("@/app/api/child/watch-events/route");
    const res = await callRoute(POST, "/api/child/watch-events", {
      cookie: await childCookie(family.id, childA.id),
      body: {
        contentItemId: item.id,
        secondsWatched: 10,
        completed: false,
        childId: childB.id, // smuggled — must be ignored
      },
    });
    expect(res.status).toBe(201);

    const { prisma } = await import("@/lib/db");
    const events = await prisma.watchEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0].childId).toBe(childA.id);
  });

  it("watch-events rejects content belonging to another family", async () => {
    const familyA = await createFamily("wa@test.family");
    const familyB = await createFamily("wb@test.family");
    const childA = await createChild(familyA.id);
    const itemB = await createContentItem(familyB.id);

    const { POST } = await import("@/app/api/child/watch-events/route");
    const res = await callRoute(POST, "/api/child/watch-events", {
      cookie: await childCookie(familyA.id, childA.id),
      body: { contentItemId: itemB.id, secondsWatched: 5, completed: false },
    });
    expect(res.status).toBe(404);
  });

  it("a child token for a deleted child is rejected by child routes", async () => {
    const family = await createFamily("deleted-child@test.family");
    const child = await createChild(family.id);
    const cookie = await childCookie(family.id, child.id);

    const { prisma } = await import("@/lib/db");
    await prisma.childProfile.delete({ where: { id: child.id } });

    const { GET } = await import("@/app/api/child/feed/route");
    const res = await callRoute(GET, "/api/child/feed", { cookie });
    // The profile is gone; the feed must not be servable.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("cookie helper sanity", () => {
  it("mints and reads back claims", async () => {
    const cookie = await cookieFor({
      scope: "parent",
      userId: "u1",
      tv: 0,
    });
    expect(cookie.startsWith("sid=")).toBe(true);
  });
});
