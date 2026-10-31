import { chromium } from "@playwright/test";

const base = process.env.CHECK_BASE ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript(() => window.localStorage.setItem("eye:theme", "dark"));
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: "dark-home.png", fullPage: false });

const report = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { color: cs.color, background: cs.backgroundColor, border: cs.borderColor };
  };
  return {
    theme: document.documentElement.dataset.theme,
    themeColor: document.querySelector('meta[name="theme-color"]')?.content,
    body: pick("body"),
    header: pick(".bf-header"),
    panel: pick(".bf-panel"),
    hero: pick(".bf-hero-card"),
    heroTitle: pick(".bf-hero-title"),
    postCard: pick(".bf-post-card"),
    footer: pick(".bf-footer"),
    toggle: pick(".bf-theme-toggle"),
    accent: getComputedStyle(document.documentElement).getPropertyValue("--bf-accent-dark").trim(),
  };
});
console.log(JSON.stringify(report, null, 2));

await page.goto(base + "/admin/login", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: "dark-login.png" });
const login = await page.evaluate(() => {
  const cs = (sel) => document.querySelector(sel) ? getComputedStyle(document.querySelector(sel)) : null;
  const card = cs(".login-card");
  const input = cs(".login-form input");
  return {
    shell: cs(".login-shell")?.backgroundImage.slice(0, 80),
    cardBg: card?.backgroundColor,
    cardColor: card?.color,
    inputBg: input?.backgroundColor,
    inputColor: input?.color,
  };
});
console.log(JSON.stringify(login, null, 2));

await browser.close();
