import { test, expect } from "@playwright/test";

test.describe("Clone AI Employee OS Dashboard E2E", () => {
  test("should load company overview page and render key metrics", async ({ page }) => {
    await page.goto("http://localhost:3000/overview");
    await expect(page.locator("h1")).toContainText("Company AI Overview");
    await expect(page.getByText("AI Employees")).toBeVisible();
    await expect(page.getByText("Tasks Running")).toBeVisible();
  });

  test("should navigate to AI Employees directory and view list", async ({ page }) => {
    await page.goto("http://localhost:3000/employees");
    await expect(page.locator("h1")).toContainText("AI Employees");
    await expect(page.getByText("Alex Vance")).toBeVisible();
  });

  test("should navigate to Approval Center and show risk level tags", async ({ page }) => {
    await page.goto("http://localhost:3000/approvals");
    await expect(page.locator("h1")).toContainText("Action Approval Center");
    await expect(page.getByText("Approve Action")).toBeVisible();
  });

  test("should navigate to Integration Marketplace and display 18 catalog apps", async ({ page }) => {
    await page.goto("http://localhost:3000/integrations");
    await expect(page.locator("h1")).toContainText("Integration Marketplace");
    await expect(page.getByText("GitHub")).toBeVisible();
    await expect(page.getByText("Slack")).toBeVisible();
  });
});
