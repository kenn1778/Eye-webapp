import { expect, test, type Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../playwright.config";

/**
 * Visual regression snapshots.
 *
 * These exist to make CSS reorganisations reviewable. If a rule moves and the
 * rendered result changes, these fail and Playwright writes an actual diff
 * image to test-results/ so the change can be inspected rather than guessed at.
 *
 * Run:  npm run test:visual
 * Accept intended changes: npm run test:visual:update
 */

const LOADER_TIMEOUT = 15_000;

/**
 * Stub Unsplash cover images with a local 16x16 fixture PNG.
 *
 * The seed data hot-links images.unsplash.com. Under Playwright those requests
 * sometimes hang and never complete (trace records them with status -1), which
 * makes image regions of snapshots flap between "photo loaded" and the grey
 * fallback — a network flake, not a CSS change. Fulfilling the route locally
 * keeps every pixel deterministic and the suite offline-safe.
 */
const PLACEHOLDER_IMAGE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACnSURBVDhPpcvtBsIAGAbQ55pKM8usj/U1q1mt1WpWs7LKSEQkIhGJSEQkutGni3jP/4OcqzDvqSz4GpWgSDXUqUUGi3GZ+qxKIzVZWtZZyZo01xZrG5uNbZutnUNr7xKSbB96hCR3jn1Ckp2TT0iyex4Skty9jAhJ9q4hIcn+LSIkeXCfEJIcPGJCksfPhJDk8DUnJDl6p4QkTz8LQpLj74qQ5OSX8Q8r9hPdUmLCxwAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeEach(async ({ page }) => {
  // The newsletter popup opens three seconds after mount in a fresh context,
  // which lands mid-capture under parallel workers. Mark it dismissed so no
  // snapshot races its appearance; the popup is not what these shots verify.
  await page.addInitScript(() => {
    window.localStorage.setItem("eye:subscribe-popup:dismissed", String(Date.now()));
  });

  await page.route("**images.unsplash.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PLACEHOLDER_IMAGE }),
  );

  // Server-side auth stub. State is kept per page so a successful login makes
  // subsequent /me calls succeed, without running the real backend.
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

    if (path.endsWith("/forgot-password") && method === "POST") {
      return json(200, { message: "If that address is registered, a reset link has been sent." });
    }

    if (path.endsWith("/me")) {
      if (signedIn) return json(200, { user: { email: ADMIN_EMAIL } });
      return json(401, { message: "Not signed in." });
    }

    return route.continue();
  });

  // Admin dashboard data. The dev server proxies /api to localhost:4000, which
  // is not running under test, so stub the admin + chat endpoints with fixed
  // payloads to keep the workspace snapshots deterministic and offline-safe.
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
      return json({
        posts: 4,
        stories: 4,
        subscribers: 12,
        chatMessages: 27,
        reviews: 6,
        unreadNotifications: 2,
      });
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
          {
            id: "n1",
            type: "subscriber",
            title: "New newsletter subscriber",
            body: "Signed up from footer",
            actor: "j***e@example.com",
            read: false,
            createdAt: "2026-09-14T09:00:00.000Z",
          },
          {
            id: "n2",
            type: "chat",
            title: "New message in Scholarship seekers",
            body: "Is the deadline still open?",
            actor: "A visitor",
            read: true,
            createdAt: "2026-09-13T15:30:00.000Z",
          },
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
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  // Public content API. Without this stub every landing-page request falls
  // through the dev proxy to a backend that is not running, and on Windows each
  // refused connection burns seconds, starving the loader timeout. The stub
  // keeps the snapshots deterministic and offline-safe.
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
    if (path.endsWith("/posts/popular")) {
      return json({ items: stubPosts.slice(0, 4) });
    }
    if (path.endsWith("/posts/trending")) {
      return json({ items: stubPosts.slice(0, 5) });
    }
    if (path.endsWith("/posts")) {
      return json({ items: stubPosts });
    }
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
          {
            id: "r1",
            name: "Jessica Parker",
            rating: 5,
            comment:
              "This blog has become my daily source of inspiration. The content is always valuable and well-written!",
            createdAt: "2026-09-02T09:00:00.000Z",
          },
          {
            id: "r2",
            name: "Marcus Adeyemi",
            rating: 5,
            comment: "I found two fully funded programs through the weekly brief.",
            createdAt: "2026-09-18T09:00:00.000Z",
          },
        ],
      });
    }
    if (/\/communities\/[^/]+\/join$/.test(path)) {
      return json({ joined: true, members: 129 });
    }
    if (/\/communities\/[^/]+\/leave$/.test(path)) {
      return json({ joined: false, members: 128 });
    }
    if (path.includes("/membership")) {
      return json({ joined: false, members: 128 });
    }
    if (path.endsWith("/view")) {
      return json({ counted: true, views: 41 });
    }
    return json({ ok: true });
  });

  // Story page fetch. Same origin as the proxy, so stub it for the same reason.
  await page.route("**/api/v1/posts/*", (route) => {
    const path = new URL(route.request().url()).pathname;
    const id = path.split("/").pop() ?? "";
    const post = stubPosts.find((item) => item.id === id);
    if (!post) return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(post) });
  });
});

/**
 * content-visibility: auto skips layout for off-screen sections, so a full-page
 * screenshot taken straight away can capture a different height on each run.
 * Scroll through the page once to force every section to render, then return to
 * the top, before any full-page capture measures the page.
 */
async function settlePage(page: Page) {
  // content-visibility: auto makes a skipped grid contribute its 500px
  // placeholder instead of its real height, so the captured page height wobbles
  // a few pixels between runs. Force the grids to render for deterministic shots.
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
  await page.waitForTimeout(300);
}

/** The app holds first paint behind an eye loader; wait for real content. */
async function waitForApp(page: Page) {
  await page.waitForSelector(".site-shell, .login-shell, .admin-shell", { timeout: LOADER_TIMEOUT });
  await expect(page.locator(".eye-loader")).toHaveCount(0);

  // The UI fonts come from Google Fonts through an @import in index.css.
  // document.fonts.ready can resolve before that import registers its faces, so
  // explicitly request each family; the baseline must not fall back to system
  // fonts, which reflow the page and shift every snapshot.
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('400 16px "Manrope"'),
      document.fonts.load('500 16px "DM Mono"'),
      document.fonts.load('600 16px "Playfair Display"'),
      document.fonts.load('600 16px "Caveat"'),
    ]);
    await document.fonts.ready;
  });

  await settlePage(page);
}

/**
 * Dismiss the consent gate so it stops covering page content.
 *
 * First-visit visitors are blocked by a full-screen gate until they choose;
 * the gate renders immediately (no fade-in delay), so it is always present
 * when no consent is stored.
 */
async function acceptCookies(page: Page) {
  const consent = await page.evaluate(() => window.localStorage.getItem("eye:consent"));
  if (consent) return;

  const gate = page.locator(".cookie-gate");
  await gate.waitFor({ state: "visible", timeout: 10_000 });
  await gate.getByRole("button", { name: "Accept all" }).click();
  await expect(gate).toHaveCount(0);
}

/** On narrow viewports the admin sidebar starts collapsed; open it first. */
async function openAdminSidebar(page: Page) {
  const toggle = page.locator(".menu-toggle");
  if ((await toggle.count()) && (await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
}

async function loginToAdmin(page: Page) {
  // Seed consent before the app boots. The banner is a modal overlay, so leaving
  // it to time out against a click is a race under parallel workers.
  await page.addInitScript(() => window.localStorage.setItem("eye:consent", "accepted"));
  await page.goto("/admin/login");
  await waitForApp(page);
  await page.fill("input[type=email]", ADMIN_EMAIL);
  await page.fill("input[type=password]", ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin");
  await expect(page.locator(".admin-shell")).toBeVisible();
}

test.describe("public site", () => {
  test("homepage", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);

    // Wait for the consent gate to actually render, otherwise this snapshot
    // races its fade-in and captures an inconsistent first-visit state.
    await expect(page.locator(".cookie-gate")).toBeVisible();

    // Snapshot the first-visit state, consent gate included.
    await expect(page).toHaveScreenshot("home-first-visit.png", { fullPage: true });

    await acceptCookies(page);
    await expect(page).toHaveScreenshot("home.png", { fullPage: true });
  });

  test("story page opens", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    await acceptCookies(page);

    // Post cards link to the story page. Navigate directly so the capture is
    // not affected by the scroll position the click would leave behind.
    await page.goto("/story/p1");
    await expect(page.locator(".bf-story-page")).toBeVisible();
    await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('400 16px "Manrope"'),
        document.fonts.load('600 16px "Playfair Display"'),
      ]);
      await document.fonts.ready;
    });
    await expect(page).toHaveScreenshot("story-page.png", { fullPage: true });
  });

  test("community chat panel", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    await acceptCookies(page);

    // The join button carries an aria-label ("Join <name> and open chat"),
    // which overrides its visible "Join community" text for role queries.
    const joinButton = page.getByRole("button", { name: /join .+ and open chat/i }).first();
    await joinButton.scrollIntoViewIfNeeded();
    await joinButton.click();

    // Joining fires the blinking-eye transition overlay; let it finish so it
    // cannot cover the panel in the capture.
    await expect(page.locator(".eye-transition")).toHaveCount(0, { timeout: 15_000 });

    const panel = page.locator(".chat-panel");
    await expect(panel).toBeVisible();

    // The chat list glides to the newest message when the panel opens. Let that
    // settle so the capture never lands mid-scroll.
    await panel.locator(".chat-list").evaluate(async (element) => {
      for (let frame = 0; frame < 60; frame++) {
        const before = element.scrollTop;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (element.scrollTop === before) break;
      }
    });

    // Snapshot the panel itself, not the page: the full-page shot includes the
    // blurred page behind the backdrop, which flickers under parallel load.
    await expect(panel).toHaveScreenshot("community-chat.png", { animations: "disabled" });
  });

  for (const route of ["privacy", "terms", "refund", "cookies"]) {
    test(`legal page: ${route}`, async ({ page }) => {
      await page.goto(`/${route}`);
      await waitForApp(page);
      await acceptCookies(page);
      await expect(page).toHaveScreenshot(`${route}.png`, { fullPage: true });
    });
  }
});

test.describe("admin workspace", () => {
  test("login screen", async ({ page }) => {
    await page.goto("/admin/login");
    await waitForApp(page);
    await acceptCookies(page);
    await expect(page).toHaveScreenshot("admin-login.png", { fullPage: true });
  });

  test("dashboard", async ({ page }) => {
    await loginToAdmin(page);
    // Wait for the stubbed insights + activity to render so the shot is stable.
    await expect(page.locator(".activity-chart svg")).toBeVisible();
    await expect(page).toHaveScreenshot("admin-dashboard.png", { fullPage: true });
  });

  test("new post editor", async ({ page }) => {
    await loginToAdmin(page);
    await openAdminSidebar(page);
    await page.getByRole("button", { name: /new post/i }).first().click();
    await expect(page.locator(".modal-backdrop")).toBeVisible();
    await expect(page).toHaveScreenshot("admin-editor.png");
  });

  test("communities section", async ({ page }) => {
    await loginToAdmin(page);
    await openAdminSidebar(page);
    await page.getByRole("button", { name: /^Communities$/ }).first().click();
    await expect(page).toHaveScreenshot("admin-communities.png", { fullPage: true });
  });
});
