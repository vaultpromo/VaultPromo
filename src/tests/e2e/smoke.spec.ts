import { test, expect } from "@playwright/test";

/**
 * Smoke tests — verify the critical public routes load without errors.
 *
 * These run against the dev server (configured in playwright.config.ts).
 * They do NOT test authenticated flows (those require a real DB connection).
 * The happy-path e2e (Task 15) validates the public surface: home, login,
 * signup, and the promo page error state.
 */

test.describe("Public routes smoke test", () => {
  test("home page loads and shows platform name", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /promovault/i })).toBeVisible();
    await expect(page).toHaveTitle(/PromoVault/i);
  });

  test("login page renders sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("signup page renders create account form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
    await expect(page.getByLabel(/name or label/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("promo page with invalid token shows error", async ({ page }) => {
    // A well-formed 64-char hex token that doesn't exist in DB
    const fakeToken = "a".repeat(64);
    await page.goto(`/promo/fake-campaign-id?token=${fakeToken}`);
    // Should show the token error page, not crash
    await expect(page.getByText(/link not found|invalid|expired/i)).toBeVisible();
  });

  test("dashboard redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    // Proxy should redirect to /login
    await expect(page).toHaveURL(/\/login/);
  });

  test("campaigns route redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard/campaigns");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page has link to signup", async ({ page }) => {
    await page.goto("/login");
    const signupLink = page.getByRole("link", { name: /sign up/i });
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute("href", "/signup");
  });

  test("signup page has link back to login", async ({ page }) => {
    await page.goto("/signup");
    const loginLink = page.getByRole("link", { name: /sign in/i });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });
});

test.describe("API routes respond correctly without auth", () => {
  test("storage upload-url returns 401 without session", async ({ request }) => {
    const res = await request.post("/api/storage/upload-url", {
      data: { type: "track", campaignId: "x", trackId: "y", contentType: "audio/wav", fileSizeBytes: 1024 },
    });
    // verifySession redirects, which in API context returns a redirect or 401/302
    expect([302, 307, 401, 403]).toContain(res.status());
  });

  test("promo access with invalid token format returns 400", async ({ request }) => {
    const res = await request.post("/api/promo/access", {
      data: { token: "short", campaignId: "abc" },
    });
    expect(res.status()).toBe(400);
  });

  test("promo access with valid-format but unknown token returns 404", async ({ request }) => {
    const res = await request.post("/api/promo/access", {
      data: { token: "b".repeat(64), campaignId: "non-existent-campaign" },
    });
    expect(res.status()).toBe(404);
  });
});
