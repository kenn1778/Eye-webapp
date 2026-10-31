import { expect, test, type Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../playwright.config";

// Temporary dark-mode review harness. Mirrors the stubbing from visual.spec.ts
// so pages render fully offline, forces the dark theme, and drops screenshots
// into test-results/ for eyeballing. Not part of the regression suite.

const LOADER_TIMEOUT = 15_000;

const PLACEHOLDER_IMAGE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACnSURBVDhPpcvtBsIAGAbQ55pKM8usj/U1q1mt1WpWs7LKSEQkIhGJSEQkutGni3jP/4OcqzDvqSz4GpWgSDXUqUUGi3GZ+qxKIzVZWtZZyZo01xZrG5uNbZutnUNr7xKSbB96hCR3jn1Ckp2TT0iyex4Skty9jAhJ9q4hIcn+LSIkeXCfEJIcPGJCksfPhJDk8DUnJDl6p4QkTz8LQpLj74qQ5OSX8Q8r9hPdUmLCxwAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("eye:theme", "dark");
    window.localStorage.setItem("eye:subscribe-popup:dismissed", String(Date.now()));
  });

  await page.route("**images.unsplash.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PLACEHOLDER_IMAGE }),
  );

  let signedIn = false;
  await page.route("**/api/v1/auth/**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path.endsWith("/login") && method === "POST") {
      let body: { email?: string; password?: string } = {};
      try {
        body = request.postDataJSON();
      } catch {
        body = {};
      }
      if (body.email === ADMIN_EMAIL && body.password === ADMIN_PASSWORD) {
        signedIn = true;
        return json(200, { user: { email: ADMIN_EMAIL } });
      }
      return json(401, { message: "Invalid email or password." });
    }
    if (path.endsWith("/logout") && method === "POST") {
      signedIn = false;
      return json(200, { ok: true });
    }
    if (path.endsWith("/me")) {
      if (signedIn) return json(200, { user: { email: ADMIN_EMAIL } });
      return json(401, { message: "Not signed in." });
    }
    return route.continue();
  });

  const activitySeries = Array.from({ length: 14 }, (_, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, "0")}`,
    subscribers: (index * 3) % 5,
    chat: (index * 5) % 9,
    reviews: index % 3,
  }));

  await page.route("**/api/v1/admin/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

    if (path.endsWith("/metrics")) {
      return json({ posts: 4, stories: 4, subscribers: 12, chatMessages: 27, reviews: 6, unreadNotifications: 2 });
    }
    if (path.endsWith("/insights")) {
      return json({
        subscribers: { total: 12, last7Days: 4, last30Days: 9 },
        chat: { total: 27, last7Days: 11, last30Days: 22 },
        reviews: { total: 6, averageRating: 4.5 },
        posts: { total: 4 },
        topCommunities: [{ name: "Scholarship seekers", messages: 14 }],
      });
    }
    if (path.endsWith("/activity")) {
      return json({ days: 14, series: activitySeries });
    }
    if (path.endsWith("/notifications")) {
      return json({
        notifications: [
          { id: "n1", type: "subscriber", title: "New newsletter subscriber", body: "Signed up from footer", actor: "j***e@example.com", read: false, createdAt: "2026-09-14T09:00:00.000Z" },
          { id: "n2", type: "chat", title: "New message in Scholarship seekers", body: "Is the deadline still open?", actor: "A visitor", read: true, createdAt: "2026-09-13T15:30:00.000Z" },
        ],
        unread: 2,
      });
    }
    return json({ ok: true });
  });

  await page.route("**/api/v1/chat/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith("/agent")
      ? { reply: "Thanks for reaching out - here is how to get started." }
      : { ok: true };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  const stubPosts = [1, 2, 3, 4].map((index) => ({
    id: `p${index}`,
    title: [
      "The quiet power of applying before you feel ready",
      "Five fully funded programs with autumn deadlines",
      "What a good first job application actually needs",
      "A new audio series for the long road ahead",
    ][index - 1],
    excerpt: [
      "A practical guide to finding strong opportunities, building confidence, and submitting work that sounds like you.",
      "A focused shortlist for ambitious students looking beyond the usual search results.",
      "Remove the noise from your CV, your email, and the three lines most recruiters read first.",
      "Conversations with young people building meaningful careers in public, creative, and technical work.",
    ][index - 1],
    content: "Full story content for the visual snapshot.\n\nSecond paragraph of the story body.",
    category: ["Scholarship tips", "Scholarships", "Work", "Culture"][index - 1],
    image: `https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=700&q=70&v=${index}`,
    actionUrl: null,
    actionLabel: null,
    mediaAssetId: null,
    linkHeaderAssetId: null,
    audioAssetId: null,
    videoAssetId: null,
    linkHeaderUrl: null,
    audioUrl: null,
    videoUrl: null,
    status: "published",
    deletedAt: null,
    publishedAt: `2026-09-${String(13 - index).padStart(2, "0")}T09:00:00.000Z`,
    createdAt: `2026-09-${String(13 - index).padStart(2, "0")}T09:00:00.000Z`,
    updatedAt: `2026-09-${String(13 - index).padStart(2, "0")}T09:00:00.000Z`,
    viewCount: 40 - index * 7,
  }));

  await page.route("**/api/v1/public/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

    if (path.endsWith("/posts/categories")) {
      return json({
        items: [
          { name: "Scholarships", count: 12 },
          { name: "Scholarship tips", count: 16 },
          { name: "Work", count: 10 },
          { name: "Culture", count: 8 },
        ],
      });
    }
    if (path.endsWith("/posts/popular")) return json({ items: stubPosts.slice(0, 4) });
    if (path.endsWith("/posts/trending")) return json({ items: stubPosts.slice(0, 5) });
    if (path.endsWith("/posts")) return json({ items: stubPosts });
    if (path.endsWith("/author")) {
      return json({
        name: "Alozie Izuchukwu Johnkennedy",
        role: "Founder and editor",
        bio: "Writes about scholarships, first jobs, and building a career on your own terms.",
        email: "teckennedy177@gmail.com",
        avatarUrl: null,
      });
    }
    if (path.endsWith("/reviews")) {
      return json({
        items: [
          { id: "r1", name: "Jessica Parker", rating: 5, comment: "This blog has become my daily source of inspiration. The content is always valuable and well-written!", createdAt: "2026-09-02T09:00:00.000Z" },
          { id: "r2", name: "Marcus Adeyemi", rating: 5, comment: "I found two fully funded programs through the weekly brief.", createdAt: "2026-09-18T09:00:00.000Z" },
        ],
      });
    }
    if (/\/communities\/[^/]+\/join$/.test(path)) return json({ joined: true, members: 129 });
    if (/\/communities\/[^/]+\/leave$/.test(path)) return json({ joined: false, members: 128 });
    if (path.includes("/membership")) return json({ joined: false, members: 128 });
    if (path.endsWith("/view")) return json({ counted: true, views: 41 });
    return json({ ok: true });
  });

  await page.route("**/api/v1/posts/*", (route) => {
    const path = new URL(route.request().url()).pathname;
    const id = path.split("/").pop() ?? "";
    const post = stubPosts.find((item) => item.id === id);
    if (!post) return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(post) });
  });
});

async function waitForApp(page: Page) {
  await page.waitForSelector(".site-shell, .login-shell, .admin-shell", { timeout: LOADER_TIMEOUT });
  await expect(page.locator(".eye-loader")).toHaveCount(0);
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('400 16px "Manrope"'),
      document.fonts.load('500 16px "DM Mono"'),
      document.fonts.load('600 16px "Playfair Display"'),
      document.fonts.load('600 16px "Caveat"'),
    ]);
    await document.fonts.ready;
  });
}

async function acceptCookies(page: Page) {
  const consent = await page.evaluate(() => window.localStorage.getItem("eye:consent"));
  if (consent) return;
  const gate = page.locator(".cookie-gate");
  await gate.waitFor({ state: "visible", timeout: 10_000 });
  await gate.getByRole("button", { name: "Accept all" }).click();
  await expect(gate).toHaveCount(0);
}

test("dark homepage", async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);
  await acceptCookies(page);
  await page.addStyleTag({
    content: ".bf-post-grid, .bf-community-grid, .bf-insta-grid, .media-grid { content-visibility: visible !important; }",
  });
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight, 400);
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/dark-home.png", fullPage: true, animations: "disabled" });

  const heading = await page.evaluate(() => {
    const h2 = document.querySelector("#communities-title");
    if (!h2) return null;
    const cs = getComputedStyle(h2);
    const chain: string[] = [];
    let el: Element | null = h2;
    while (el && el !== document.documentElement) {
      const o = getComputedStyle(el).opacity;
      if (o !== "1") chain.push(`${el.tagName.toLowerCase()}.${el.className} opacity=${o}`);
      el = el.parentElement;
    }
    return { color: cs.color, opacity: cs.opacity, faintAncestors: chain };
  });
  console.log("communities h2:", JSON.stringify(heading, null, 2));
});

test("dark story page", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("eye:consent", "accepted"));
  await page.goto("/story/p1");
  await expect(page.locator(".bf-story-page")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/dark-story.png", fullPage: true });
});

test("dark admin login", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("eye:consent", "accepted"));
  await page.goto("/admin/login");
  await waitForApp(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/dark-login.png", fullPage: true });
});

test("dark admin dashboard", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("eye:consent", "accepted"));
  await page.goto("/admin/login");
  await waitForApp(page);
  await page.fill("input[type=email]", ADMIN_EMAIL);
  await page.fill("input[type=password]", ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin");
  await expect(page.locator(".admin-shell")).toBeVisible();
  await expect(page.locator(".activity-chart svg")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/dark-admin.png", fullPage: true });
});
