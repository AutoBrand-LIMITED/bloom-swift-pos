import { expect, test } from "@playwright/test";

test("customer credit supports full, partial, and mixed payment states", async ({ page }, testInfo) => {
  await page.goto("/e2e/fixtures/customer-credit-preview.html");

  const panel = page.getByRole("region", { name: "Customer Credit browser preview" });
  await expect(panel.getByText("可用餘額 $900")).toBeVisible();

  await panel.getByRole("switch", { name: "使用 Customer Credit" }).click();
  await expect(panel.getByRole("spinbutton", { name: "今次使用 Customer Credit 金額" })).toHaveValue("700");
  await expect(panel.getByRole("button", { name: "立即付款" })).toHaveClass(/bg-success/);
  await expect(panel.getByText("付款方式")).toHaveCount(0);

  const fullCreditScreenshot = testInfo.outputPath("customer-credit-full.png");
  await panel.screenshot({ path: fullCreditScreenshot });
  await testInfo.attach("full-credit-ui", { path: fullCreditScreenshot, contentType: "image/png" });

  await panel.getByRole("spinbutton", { name: "今次使用 Customer Credit 金額" }).fill("500");
  await expect(panel.getByRole("button", { name: "部分付款 / 訂金" })).toHaveClass(/bg-warning/);
  await expect(panel.getByText("$200", { exact: true })).toBeVisible();

  await panel.getByRole("spinbutton", { name: "訂金金額" }).fill("100");
  await expect(panel.getByText("付款方式")).toBeVisible();
  await expect(panel.getByRole("button", { name: "現金 / 其他" })).toBeVisible();
  await expect(panel.getByText("$100", { exact: true })).toBeVisible();

  const mixedCreditScreenshot = testInfo.outputPath("customer-credit-mixed.png");
  await panel.screenshot({ path: mixedCreditScreenshot });
  await testInfo.attach("mixed-credit-ui", { path: mixedCreditScreenshot, contentType: "image/png" });
});
