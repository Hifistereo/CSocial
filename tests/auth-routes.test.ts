import { describe, it, expect, beforeEach } from "vitest";
import {
  resetDb,
  createFamily,
  createChild,
  callRoute,
  childCookie,
  lockedParentCookie,
} from "./helpers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { POST as registerPOST } from "@/app/api/auth/register/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as unlockPOST } from "@/app/api/auth/unlock/route";
import { POST as enterChildPOST } from "@/app/api/auth/enter-child/route";
import { POST as exitChildPOST } from "@/app/api/auth/exit-child/route";

function extractSessionCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  expect(match, "expected a session cookie").not.toBeNull();
  return `${SESSION_COOKIE}=${match![1]}`;
}

async function claimsOf(cookie: string) {
  const token = decodeURIComponent(cookie.split("=").slice(1).join("="));
  const claims = await verifySessionToken(token);
  expect(claims).not.toBeNull();
  return claims!;
}

describe("auth flows", () => {
  beforeEach(resetDb);

  it("register issues an unlocked parent session", async () => {
    const res = await callRoute(registerPOST, "/api/auth/register", {
      body: { email: "new@test.family", password: "password123", pin: "1234" },
    });
    expect(res.status).toBe(201);
    const claims = await claimsOf(extractSessionCookie(res));
    expect(claims.scope).toBe("parent_unlocked");
    expect(claims.unlockedUntil).toBeGreaterThan(Date.now());
  });

  it("register rejects duplicate emails", async () => {
    await createFamily("dupe@test.family");
    const res = await callRoute(registerPOST, "/api/auth/register", {
      body: { email: "dupe@test.family", password: "password123" },
    });
    expect(res.status).toBe(409);
  });

  it("login verifies the password", async () => {
    await createFamily("login@test.family");

    const bad = await callRoute(loginPOST, "/api/auth/login", {
      body: { email: "login@test.family", password: "wrong-password" },
    });
    expect(bad.status).toBe(401);

    const good = await callRoute(loginPOST, "/api/auth/login", {
      body: { email: "login@test.family", password: "password123" },
    });
    expect(good.status).toBe(200);
    const claims = await claimsOf(extractSessionCookie(good));
    expect(claims.scope).toBe("parent_unlocked");
  });

  it("unlock upgrades a locked parent session with the PIN", async () => {
    const family = await createFamily("unlock@test.family");
    const cookie = await lockedParentCookie(family.id);

    const bad = await callRoute(unlockPOST, "/api/auth/unlock", {
      cookie,
      body: { secret: "9999" },
    });
    expect(bad.status).toBe(401);

    const good = await callRoute(unlockPOST, "/api/auth/unlock", {
      cookie,
      body: { secret: "1234" },
    });
    expect(good.status).toBe(200);
    const claims = await claimsOf(extractSessionCookie(good));
    expect(claims.scope).toBe("parent_unlocked");
    expect(claims.unlockedUntil).toBeGreaterThan(Date.now());
  });

  it("unlock refuses child tokens", async () => {
    const family = await createFamily("unlock2@test.family");
    const child = await createChild(family.id);
    const res = await callRoute(unlockPOST, "/api/auth/unlock", {
      cookie: await childCookie(family.id, child.id),
      body: { secret: "1234" },
    });
    expect(res.status).toBe(401);
  });

  it("enter-child swaps to a child-scope session for own child", async () => {
    const family = await createFamily("enter@test.family");
    const child = await createChild(family.id);
    const res = await callRoute(enterChildPOST, "/api/auth/enter-child", {
      cookie: await lockedParentCookie(family.id),
      body: { childId: child.id },
    });
    expect(res.status).toBe(200);
    const claims = await claimsOf(extractSessionCookie(res));
    expect(claims.scope).toBe("child");
    expect(claims.childId).toBe(child.id);
    expect(claims.unlockedUntil).toBeUndefined();
  });

  it("exit-child requires the PIN and returns a LOCKED parent session", async () => {
    const family = await createFamily("exit@test.family");
    const child = await createChild(family.id);
    const cookie = await childCookie(family.id, child.id);

    const bad = await callRoute(exitChildPOST, "/api/auth/exit-child", {
      cookie,
      body: { secret: "0000" },
    });
    expect(bad.status).toBe(401);

    const good = await callRoute(exitChildPOST, "/api/auth/exit-child", {
      cookie,
      body: { secret: "1234" },
    });
    expect(good.status).toBe(200);
    const claims = await claimsOf(extractSessionCookie(good));
    expect(claims.scope).toBe("parent");
    expect(claims.childId).toBeUndefined();
  });

  it("exit-child rate-limits repeated wrong PINs", async () => {
    const family = await createFamily("ratelimit@test.family");
    const child = await createChild(family.id);
    const cookie = await childCookie(family.id, child.id);

    let last: Response | null = null;
    for (let i = 0; i < 6; i++) {
      last = await callRoute(exitChildPOST, "/api/auth/exit-child", {
        cookie,
        body: { secret: "0000" },
      });
    }
    expect(last!.status).toBe(429);
  });
});
