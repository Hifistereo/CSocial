import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR ?? ".";

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

// 1. Login
await page.goto(`${BASE}/login`);
await page.fill('input[type="email"]', "parent@demo.family");
await page.fill('input[type="password"]', "password123");
await page.click('button[type="submit"]');
await page.waitForURL("**/profiles", { timeout: 15000 });
await page.screenshot({ path: `${SHOT_DIR}/01-profiles.png` });
console.log("profiles OK");

// 2. Parent area (fresh login = unlocked)
await page.click("text=Parent area");
await page.waitForURL("**/dashboard", { timeout: 15000 });
await page.screenshot({ path: `${SHOT_DIR}/02-dashboard.png` });
console.log("dashboard OK");

// 3. Videos review queue
await page.click('nav >> text=Videos');
await page.waitForURL("**/dashboard/videos", { timeout: 15000 });
await page.waitForSelector("text=To review");
await page.waitForTimeout(1000);
await page.screenshot({ path: `${SHOT_DIR}/03-videos.png` });
console.log("videos OK");

// 4. Approve the pending seed video
const approveBtn = page.locator("li >> text=Approve").first();
if (await approveBtn.count()) {
  await approveBtn.click();
  await page.waitForTimeout(800);
  console.log("approved a pending video");
}

// 5. Children page
await page.click('nav >> text=Children');
await page.waitForSelector("text=Spark");
await page.screenshot({ path: `${SHOT_DIR}/04-children.png` });
console.log("children OK");

await browser.close();
console.log("SMOKE PASS");
