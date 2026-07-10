import { test, expect } from "@playwright/test";

test.describe("Home page smoke test", () => {
  test("loads and shows the platform name", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /promovault/i })).toBeVisible();
  });

  test("get started link is present and points to /login", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /get started/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/login");
  });
});
