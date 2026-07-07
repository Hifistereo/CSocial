import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR ?? ".";

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

// Login as parent, pick a child profile
await page.goto(`${BASE}/login`);
await page.fill('input[type="email"]', "parent@demo.family");
await page.fill('input[type="password"]', "password123");
await page.click('button[type="submit"]');
await page.waitForURL("**/profiles", { timeout: 15000 });
await page.click("text=Spark");
await page.waitForURL("**/feed", { timeout: 15000 });
console.log("entered child mode");

// Tap-to-start splash
await page.waitForSelector("text=Tap to start", { timeout: 15000 });
await page.screenshot({ path: `${SHOT_DIR}/10-feed-splash.png` });
await page.click("text=Tap to start");
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOT_DIR}/11-feed-active.png` });
console.log("feed started");

// Child cannot reach the parent API from this session
const status = await page.evaluate(async () => {
  const res = await fetch("/api/parent/videos");
  return res.status;
});
if (status !== 401) throw new Error(`child could reach parent API: ${status}`);
console.log("child->parent API blocked (401)");

// Favorite + more-like-this buttons
await page.click("text=More please");
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOT_DIR}/12-feed-flag.png` });
console.log("flag sent");

// Exit dialog requires PIN
await page.click('[aria-label="Parent exit"]');
await page.waitForSelector("text=Parents only");
await page.fill('[aria-label="Parent PIN"]', "9999");
await page.click("text=Unlock");
await page.waitForSelector("text=Incorrect PIN", { timeout: 5000 });
console.log("wrong PIN rejected");
await page.fill('[aria-label="Parent PIN"]', "1234");
await page.click("text=Unlock");
await page.waitForURL("**/profiles", { timeout: 15000 });
console.log("exit via PIN OK");

await browser.close();
console.log("CHILD SMOKE PASS");
