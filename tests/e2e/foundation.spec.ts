import { expect, test, type Page } from "@playwright/test";

// Needs the demo data: npm run db:seed
const password = process.env.SEED_DEMO_PASSWORD ?? "";
test.skip(!password || !process.env.DATABASE_URL, "demo data not configured (.env.local)");

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/ელფოსტა|Email/).fill(email);
  await page.getByLabel(/^(პაროლი|Password)$/).fill(password);
  await page.getByRole("button", { name: /^(შესვლა|Sign in)$/ }).click();
  await expect(page).toHaveURL(/\/today$/);
}

test("logged-out visitors are sent to the login page, in Georgian by default", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/settings/staff");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "შესვლა" })).toBeVisible();
  await page.getByRole("button", { name: "ENG" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("wrong password shows one neutral message", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "ENG" }).click();
  await page.getByLabel("Email").fill("demo-operator@avtopark.test");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Next.js has its own hidden role="alert" route announcer, so match by text.
  await expect(page.getByRole("alert").filter({ hasText: "Wrong email or password." })).toBeVisible();
});

test("operator signs in, sees the company, and cannot manage staff", async ({ page }) => {
  await login(page, "demo-operator@avtopark.test");
  await expect(page.getByText("Demo Rent").first()).toBeVisible();
  await page.goto("/settings/staff");
  await expect(page.getByText(/მხოლოდ მენეჯერს|Only managers/)).toBeVisible();
  await expect(page.getByRole("button", { name: /მოწვევის გაგზავნა|Send invite/ })).toHaveCount(0);
});

test("manager sees the invite form and the staff list", async ({ page }) => {
  await login(page, "demo-manager@avtopark.test");
  await page.goto("/settings/staff");
  await expect(page.getByText("demo-owner@avtopark.test")).toBeVisible();
  await expect(page.getByRole("button", { name: /მოწვევის გაგზავნა|Send invite/ })).toBeVisible();
});

test("the page fits a phone screen without sideways scrolling", async ({ page }) => {
  await login(page, "demo-owner@avtopark.test");
  for (const path of ["/today", "/settings/staff"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
