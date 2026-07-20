import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { capturePrintPopup, inspectPdf, type PdfEvidence } from "./support/pdf";
import {
  assertApprovedBackendTarget,
  BACKEND_URL,
  FRONTEND_URL,
  runStagingCli,
  STAGING_WRITE_CONSENT,
  writeJson,
  type JsonObject,
} from "./support/staging-cli";

const EMPLOYEE = "ACCOUNT — AC02 - Elma";
const PRODUCT_ID = 4338;
const PRODUCT_CODE = "123";
const PRODUCT_NAME = "testing";
const PRODUCT_PRICE = 1111;

interface DeliverySlot {
  id: number;
  displayLabel: string;
  startTime: string;
  endTime: string;
}

type DeliverySelection =
  | { mode: "slot"; slot: DeliverySlot }
  | { mode: "specified"; snapshot: string };

interface Inspection {
  order: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
  partners: Array<Record<string, unknown>>;
}

interface CreatedOrder {
  id: number;
  name: string;
}

interface RunData {
  runId: string;
  ordererName: string;
  ordererPhone: string;
  senderName: string;
  recipientName: string;
  recipientPhone: string;
  addressDetail: string;
  address: string;
  firstDeliveryDate: string;
  secondDeliveryDate: string;
  businessDate: string;
}

function hkDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
}

function makeRunData(): RunData {
  const suffix = String(Date.now()).slice(-6);
  const runId = `TEST-E2E-${hkDate().replaceAll("-", "")}-${suffix}`;
  const addressDetail = `${runId} Flower Tower 12/F Unit A`;
  return {
    runId,
    ordererName: `${runId} Secretary`,
    ordererPhone: `61${suffix}`,
    senderName: `${runId} Director`,
    recipientName: `${runId} Recipient`,
    recipientPhone: `62${suffix}`,
    addressDetail,
    address: `香港島 中西區 中環 ${addressDetail}`,
    firstDeliveryDate: hkDate(1),
    secondDeliveryDate: hkDate(2),
    businessDate: hkDate(),
  };
}

function inspectionFrom(payload: JsonObject): Inspection {
  const actual = payload.actual as Inspection | undefined;
  if (!actual?.order || !Array.isArray(actual.lines) || !Array.isArray(actual.partners)) {
    throw new Error("Staging inspect-order returned an unexpected payload.");
  }
  return actual;
}

function m2oId(value: unknown): number | null {
  if (Array.isArray(value) && typeof value[0] === "number") return value[0];
  return typeof value === "number" ? value : null;
}

async function selectEmployee(page: Page) {
  const trigger = page.getByRole("combobox", { name: "負責員工" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByRole("option", { name: EMPLOYEE, exact: true }).click();
  await expect(trigger).toHaveText(EMPLOYEE);
}

async function addApprovedProduct(page: Page) {
  const search = page.getByPlaceholder("搜尋 product code / 商品名稱");
  await search.fill(PRODUCT_CODE);
  const product = page.locator(`button[title="${PRODUCT_CODE} — ${PRODUCT_NAME}"]`);
  await expect(product).toBeVisible();
  await product.click();
  await expect(page.locator(`input[value="${PRODUCT_NAME}"]`)).toBeVisible();
}

async function selectDeliveryAddress(page: Page, data: RunData) {
  await page.getByRole("combobox", { name: "送貨地區" }).click();
  await page.getByRole("option", { name: "香港島", exact: true }).click();
  await page.getByRole("combobox", { name: "送貨分區" }).click();
  await page.getByRole("option", { name: "中西區", exact: true }).click();
  await page.getByRole("combobox", { name: "送貨地點" }).click();
  await page.getByRole("option", { name: "中環", exact: true }).click();
  await page.getByPlaceholder("詳細地址（大廈名 / 樓層 / 室）").fill(data.addressDetail);
}

async function fillDeliveryAndNotes(
  page: Page,
  data: RunData,
  deliveryDate: string,
  useExistingAddress: boolean,
  selection: DeliverySelection,
) {
  await page.getByRole("textbox", { name: "送貨日期" }).fill(deliveryDate);
  if (selection.mode === "slot") {
    const slotChoice = page.getByRole("radio", { name: selection.slot.displayLabel, exact: true });
    await expect(slotChoice).toBeVisible();
    await slotChoice.click();
    await expect(slotChoice).toHaveAttribute("aria-checked", "true");
  } else {
    await page.getByRole("radio", { name: "指定時間", exact: true }).click();
    await page.getByRole("textbox", { name: "指定送貨時間" }).fill(selection.snapshot);
  }
  if (useExistingAddress) {
    const addressButton = page.getByRole("button", { name: `使用過往地址 ${data.address}` });
    await expect(addressButton).toBeVisible({ timeout: 20_000 });
    await addressButton.click();
    await expect(page.getByRole("combobox", { name: "送貨地區" })).toHaveText("香港島");
    await expect(page.getByRole("combobox", { name: "送貨分區" })).toHaveText("中西區");
    await expect(page.getByRole("combobox", { name: "送貨地點" })).toHaveText("中環");
    await expect(page.getByPlaceholder("詳細地址（大廈名 / 樓層 / 室）")).toHaveValue(data.addressDetail);
    await expect(page.getByPlaceholder("收貨人姓名")).toHaveValue(data.recipientName);
    await expect(page.getByPlaceholder("收貨人電話")).toHaveValue(data.recipientPhone);
  } else {
    await selectDeliveryAddress(page, data);
    await page.getByPlaceholder("收貨人姓名").fill(data.recipientName);
    await page.getByPlaceholder("收貨人電話").fill(data.recipientPhone);
  }
  await page.getByPlaceholder("負責送貨嘅同事名").fill("E2E Courier");
  await page.getByRole("textbox", { name: "送花人備註", exact: true }).fill(`Sender preference ${data.runId}`);
  await page.getByRole("textbox", { name: "送貨備註", exact: true }).fill(`Call before arrival ${data.runId}`);
  const rowEndMarker = `${data.runId} ${useExistingAddress ? "ROW-END-AFTERNOON" : "ROW-END-MORNING"}`;
  await page.getByRole("textbox", { name: "內部備註", exact: true }).fill(rowEndMarker);
}

async function submitOrder(
  page: Page,
  onSubmitted: (localId: string) => void,
  onCreated: (order: CreatedOrder) => void,
): Promise<CreatedOrder> {
  let submittedLocalId: string | null = null;
  const persistBeforePost = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname === "/orders") {
      const submittedBody = request.postDataJSON() as { id?: unknown };
      if (typeof submittedBody.id !== "string" || !submittedBody.id.trim()) {
        await route.abort();
        throw new Error("Submitted order did not contain a recoverable POS local id.");
      }
      submittedLocalId = submittedBody.id;
      onSubmitted(submittedBody.id);
    }
    await route.continue();
  };
  await page.route("**/orders", persistBeforePost);
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST" && url.pathname === "/orders";
  });
  try {
    await page.getByRole("button", { name: "確認訂單", exact: true }).click();
    const response = await responsePromise;
    if (!submittedLocalId) throw new Error("Order request bypassed pre-submission recovery persistence.");
    const body = await response.json() as CreatedOrder & { detail?: string | { message?: string } };
    const detail = typeof body.detail === "string" ? body.detail : body.detail?.message;
    expect(response.ok(), detail || "Order sync failed").toBeTruthy();
    const created = { id: body.id, name: body.name };
    onCreated(created);
    await expect(page.getByText(new RegExp(`已同步到 Odoo staging.*${body.name}`))).toBeVisible();
    return created;
  } finally {
    await page.unroute("**/orders", persistBeforePost);
  }
}

function validateInspection(
  inspection: Inspection,
  created: CreatedOrder,
  data: RunData,
  paymentStatus: "paid" | "deposit",
  paymentMethod: "cash_other" | "bank_in_fps",
  deliveryDate: string,
  deliverySelection: DeliverySelection,
  rowEndMarker: string,
) {
  const order = inspection.order;
  expect(order.id).toBe(created.id);
  expect(order.name).toBe(created.name);
  expect(order.state).toBe("draft");
  expect(Number(order.amount_total)).toBe(PRODUCT_PRICE);
  expect(order.x_payment_status).toBe(paymentStatus);
  expect(order.x_payment_method).toBe(paymentMethod);
  expect(order.x_salesperson_source).toBe(EMPLOYEE);
  expect(order.x_source_customer_name).toBe(data.ordererName);
  expect(order.x_sender_name).toBe(data.senderName);
  expect(order.x_sender_phone).toBe(data.ordererPhone);
  expect(order.x_recipient_name).toBe(data.recipientName);
  expect(order.x_recipient_phone).toBe(data.recipientPhone);
  expect(order.x_delivery_address).toBe(data.address);
  expect(order.x_pos_notes).toBe(rowEndMarker);
  expect(String(order.commitment_date)).toContain(deliveryDate);
  expect(order.florist_pos_delivery_mode).toBe(deliverySelection.mode);
  if (deliverySelection.mode === "slot") {
    expect(m2oId(order.florist_pos_delivery_slot_id)).toBe(deliverySelection.slot.id);
    expect(order.florist_pos_delivery_time_snapshot).toBe(deliverySelection.slot.displayLabel);
    expect(String(order.commitment_date)).toContain(deliverySelection.slot.endTime);
  } else {
    expect(m2oId(order.florist_pos_delivery_slot_id)).toBeNull();
    expect(order.florist_pos_delivery_time_snapshot).toBe(deliverySelection.snapshot);
    expect(String(order.commitment_date)).toContain("00:00:00");
  }
  expect(order.invoice_ids).toEqual([]);
  expect(order.picking_ids).toEqual([]);

  expect(inspection.lines).toHaveLength(1);
  const line = inspection.lines[0];
  expect(m2oId(line.product_id)).toBe(PRODUCT_ID);
  expect(line.x_source_item_code).toBe(PRODUCT_CODE);
  expect(line.x_source_item_name).toBe(PRODUCT_NAME);
  expect(Number(line.product_uom_qty)).toBe(1);
  expect(Number(line.price_unit)).toBe(PRODUCT_PRICE);
}

function buildCleanupManifest(runId: string, inspections: Inspection[]) {
  if (!inspections.length) throw new Error("Cannot build cleanup manifest without an inspected order.");
  const partners = inspections[0].partners;
  const customer = partners.find((partner) => !m2oId(partner.parent_id));
  const recipient = partners.find((partner) => partner.type === "delivery" && m2oId(partner.parent_id));
  if (!customer || !recipient) throw new Error("Run-owned customer and recipient were not found.");
  const customerId = Number(customer.id);
  const recipientId = Number(recipient.id);

  for (const inspection of inspections) {
    if (m2oId(inspection.order.partner_id) !== customerId) throw new Error("Order customer changed during test.");
    if (m2oId(inspection.order.partner_shipping_id) !== recipientId) throw new Error("Order recipient changed during test.");
  }

  return {
    runMarker: runId,
    orders: inspections.map(({ order }) => ({
      id: Number(order.id),
      posLocalId: String(order.x_pos_local_id),
      internalMarker: String(order.x_pos_notes),
      customerId,
      recipientId,
    })),
    customer: {
      id: customerId,
      name: String(customer.name),
      phone: String(customer.phone),
    },
    recipient: {
      id: recipientId,
      name: String(recipient.name),
      phone: String(recipient.phone),
      parentId: customerId,
    },
  };
}

function assertPdfBasics(evidence: PdfEvidence) {
  expect(evidence.pages).toBeGreaterThanOrEqual(1);
  expect(evidence.bytes).toBeGreaterThan(5_000);
  expect(evidence.pdfText.trim().length).toBeGreaterThan(40);
  expect(evidence.printCalls).toBe(1);
}

async function printOrderDocuments(
  page: Page,
  testInfo: TestInfo,
  created: CreatedOrder,
  data: RunData,
  label: string,
  deliveryTimeLabel: string,
) {
  await page.getByRole("button", { name: /訂單記錄/ }).click();
  const group = page.getByRole("group", { name: `訂單 ${created.name} ${data.ordererName}` });
  await expect(group).toBeVisible();
  const evidence: Record<string, PdfEvidence> = {};
  for (const document of ["收據", "送貨單", "執貨單"] as const) {
    const pdfPath = testInfo.outputPath(`${label}-${document}.pdf`);
    evidence[document] = await capturePrintPopup(
      page,
      group.getByRole("button", { name: document, exact: true }),
      pdfPath,
    );
    assertPdfBasics(evidence[document]);
    await testInfo.attach(`${label}-${document}-pdf`, { path: pdfPath, contentType: "application/pdf" });
    for (const [index, pngPath] of evidence[document].pngPaths.entries()) {
      await testInfo.attach(`${label}-${document}-page-${index + 1}`, { path: pngPath, contentType: "image/png" });
    }
  }

  const receipt = evidence["收據"];
  expect(receipt.pdfText).toContain(created.name);
  expect(receipt.pdfText).toContain(data.ordererName);
  expect(receipt.pdfText).toContain(data.ordererPhone);
  expect(receipt.pdfText).toContain(data.senderName);
  expect(receipt.pdfText).toContain(PRODUCT_NAME);
  expect(receipt.pdfText).toContain(PRODUCT_PRICE.toLocaleString("en-US"));

  const delivery = evidence["送貨單"];
  expect(delivery.pdfText).toContain(created.name);
  expect(delivery.pdfText).toContain(data.recipientPhone);
  expect(delivery.pdfText).toContain(deliveryTimeLabel);
  expect(delivery.htmlText).toContain(data.address);
  expect(delivery.htmlText).toContain(`Call before arrival ${data.runId}`);
  expect(delivery.htmlText).not.toContain(data.ordererName);
  expect(delivery.htmlText).not.toContain(data.senderName);
  expect(delivery.htmlText).not.toContain(data.ordererPhone);
  expect(delivery.htmlText).not.toContain(`$${PRODUCT_PRICE.toLocaleString()}`);

  const picking = evidence["執貨單"];
  expect(picking.pages, "Warehouse and dispatch picking copies must use separate full A4 pages.").toBe(2);
  expect(picking.pdfText).toContain(created.name);
  expect(picking.pdfText).toContain(PRODUCT_NAME);
  expect(picking.pdfText).toContain(data.recipientPhone);
  expect(picking.pdfText).toContain(deliveryTimeLabel);
  expect(picking.htmlText).toContain(deliveryTimeLabel);
  expect(picking.htmlText).not.toContain(data.ordererName);
  expect(picking.htmlText).not.toContain(data.senderName);
  expect(picking.htmlText).not.toContain(data.ordererPhone);
  expect(picking.htmlText).toContain("PICKING LIST · 倉庫聯");
  expect(picking.htmlText).toContain("PICKING LIST · 出貨聯");
  expect(picking.pageTexts[0]).toContain("倉庫聯");
  expect(picking.pageTexts[0]).toContain(created.name);
  expect(picking.pageTexts[0]).toContain(PRODUCT_NAME);
  expect(picking.pageTexts[0]).toContain("CHECKED BY");
  expect(picking.pageTexts[1]).toContain("出貨聯");
  expect(picking.pageTexts[1]).toContain(created.name);
  expect(picking.pageTexts[1]).toContain(PRODUCT_NAME);
  expect(picking.pageTexts[1]).toContain("CHECKED BY");

  await page.getByRole("button", { name: "關閉訂單記錄" }).click();
}

test.describe("Odoo staging full-day POS workflow", () => {
  test("creates, reuses, prints, reconciles, and safely cleans a complete florist day", async ({ page, context, request }, testInfo) => {
    test.skip(
      process.env.POS_E2E_ALLOW_STAGING_WRITES !== STAGING_WRITE_CONSENT,
      "Set POS_E2E_ALLOW_STAGING_WRITES to the exact staging acknowledgement value.",
    );

    const data = makeRunData();
    const createdOrders: CreatedOrder[] = [];
    const inspections: Inspection[] = [];
    const manifestPath = testInfo.outputPath("cleanup-manifest.json");
    const pendingPath = testInfo.outputPath("pending-recovery.json");
    const createdIdsPath = testInfo.outputPath("created-order-ids.json");
    const reportPath = testInfo.outputPath("run-report.json");
    let cleanupResult: JsonObject | null = null;
    let verifyResult: JsonObject | null = null;
    const submittedLocalIds: string[] = [];

    await context.addInitScript(() => {
      try {
        sessionStorage.removeItem("florist-pos-orders");
      } catch {
        // about:blank may not expose storage before navigation.
      }
    });

    runStagingCli([
      "preflight",
      "--run-id", data.runId,
      "--phone", data.ordererPhone,
      "--phone", data.recipientPhone,
      "--frontend-url", FRONTEND_URL,
      "--backend-url", BACKEND_URL,
    ]);
    await assertApprovedBackendTarget(request);
    const slotsResponse = await request.get(`${BACKEND_URL}/delivery-slots`);
    expect(slotsResponse.ok(), "Delivery slot endpoint must be ready before browser order writes.").toBeTruthy();
    const deliverySlots = await slotsResponse.json() as DeliverySlot[];
    const standardSlot = deliverySlots.find((slot) => (
      slot.startTime === "09:00" && slot.endTime === "13:00"
    ));
    expect(standardSlot, "Staging must expose the 09:00-13:00 morning delivery slot.").toBeDefined();
    if (!standardSlot) throw new Error("Staging has no active 09:00-13:00 delivery slot.");
    const standardDelivery: DeliverySelection = { mode: "slot", slot: standardSlot };
    const specifiedDelivery: DeliverySelection = { mode: "specified", snapshot: "上午 10 時前" };

    const registerCreatedOrder = (order: CreatedOrder) => {
      createdOrders.push(order);
      writeJson(createdIdsPath, { runMarker: data.runId, orders: createdOrders });
    };
    const registerSubmittedOrder = (localId: string) => {
      if (!submittedLocalIds.includes(localId)) submittedLocalIds.push(localId);
      writeJson(pendingPath, {
        runMarker: data.runId,
        localIds: submittedLocalIds,
        customer: { name: data.ordererName, phone: data.ordererPhone },
        recipient: { name: data.recipientName, phone: data.recipientPhone },
      });
    };

    try {
      await page.goto("/");
      await selectEmployee(page);
      await page.getByLabel("電話號碼 *").fill(data.ordererPhone);
      await page.getByPlaceholder("選擇或輸入客戶名稱").fill(data.ordererName);
      await page.getByLabel("送花人名稱 *").fill(data.senderName);
      await addApprovedProduct(page);
      await fillDeliveryAndNotes(page, data, data.firstDeliveryDate, false, standardDelivery);
      await page.getByRole("button", { name: "立即付款", exact: true }).click();
      await page.getByRole("button", { name: "現金 / 其他", exact: true }).click();

      const first = await submitOrder(page, registerSubmittedOrder, registerCreatedOrder);
      const firstInspection = inspectionFrom(runStagingCli([
        "inspect-order", "--run-id", data.runId, "--order-id", String(first.id),
      ]));
      inspections.push(firstInspection);
      validateInspection(
        firstInspection,
        first,
        data,
        "paid",
        "cash_other",
        data.firstDeliveryDate,
        standardDelivery,
        `${data.runId} ROW-END-MORNING`,
      );
      writeJson(manifestPath, buildCleanupManifest(data.runId, inspections));
      await printOrderDocuments(
        page,
        testInfo,
        first,
        data,
        "morning-paid",
        standardSlot.displayLabel,
      );

      await selectEmployee(page);
      await page.getByLabel("電話號碼 *").fill(data.ordererPhone);
      const customerResult = page.getByRole("button", { name: new RegExp(data.ordererName) }).first();
      await expect(customerResult).toBeVisible({ timeout: 20_000 });
      await customerResult.click();
      await expect(page.getByPlaceholder("選擇或輸入客戶名稱")).toHaveValue(data.ordererName);
      await page.getByLabel("送花人名稱 *").fill(data.senderName);
      await addApprovedProduct(page);
      await fillDeliveryAndNotes(page, data, data.secondDeliveryDate, true, specifiedDelivery);
      await page.getByRole("button", { name: "已付訂金", exact: true }).click();
      await page.getByRole("button", { name: "Bank-in / FPS", exact: true }).click();
      await page.getByRole("spinbutton", { name: "訂金金額" }).fill("300");

      const second = await submitOrder(page, registerSubmittedOrder, registerCreatedOrder);
      const secondInspection = inspectionFrom(runStagingCli([
        "inspect-order", "--run-id", data.runId, "--order-id", String(second.id),
      ]));
      inspections.push(secondInspection);
      validateInspection(
        secondInspection,
        second,
        data,
        "deposit",
        "bank_in_fps",
        data.secondDeliveryDate,
        specifiedDelivery,
        `${data.runId} ROW-END-AFTERNOON`,
      );
      expect(Number(secondInspection.order.x_deposit_amount)).toBe(300);
      expect(Number(secondInspection.order.x_balance_amount)).toBe(PRODUCT_PRICE - 300);
      expect(m2oId(secondInspection.order.partner_id)).toBe(m2oId(firstInspection.order.partner_id));
      expect(m2oId(secondInspection.order.partner_shipping_id)).toBe(m2oId(firstInspection.order.partner_shipping_id));
      writeJson(manifestPath, buildCleanupManifest(data.runId, inspections));
      await printOrderDocuments(
        page,
        testInfo,
        second,
        data,
        "specified-deposit",
        `指定時間：${specifiedDelivery.snapshot}`,
      );

      const recordsResponse = await request.get(`${BACKEND_URL}/orders?date=${data.businessDate}`);
      expect(recordsResponse.ok(), "Odoo order-record endpoint must expose the created staging orders.").toBeTruthy();
      const recordsPayload = await recordsResponse.json() as {
        orders: Array<{
          id: string;
          odooOrderId?: number;
          odooOrderName?: string;
          recipientName: string;
          recipientPhone: string;
          deliveryAddress: string;
        }>;
      };
      const projectedRecords = recordsPayload.orders.filter((record) => (
        createdOrders.some((order) => order.id === record.odooOrderId)
      ));
      expect(projectedRecords).toHaveLength(2);
      for (const record of projectedRecords) {
        expect(record.id).toBeTruthy();
        expect(record.odooOrderName).toBeTruthy();
        expect(record.recipientName).toBe(data.recipientName);
        expect(record.recipientPhone).toBe(data.recipientPhone);
        expect(record.deliveryAddress).toBe(data.address);
      }

      await page.goto("/");
      await page.evaluate(() => {
        localStorage.removeItem("florist-pos-orders");
        localStorage.removeItem("florist-pos-unsynced-orders-v1");
        sessionStorage.removeItem("florist-pos-orders");
      });
      await page.reload();
      await page.getByRole("button", { name: /訂單記錄/ }).click();
      await expect(page.getByRole("group", { name: `訂單 ${first.name} ${data.ordererName}` })).toBeVisible();
      await expect(page.getByRole("group", { name: `訂單 ${second.name} ${data.ordererName}` })).toBeVisible();
      await page.getByRole("button", { name: "關閉訂單記錄" }).click();

      const summaryResponse = await request.get(`${BACKEND_URL}/day-end/summary?date=${data.businessDate}`);
      expect(summaryResponse.ok()).toBeTruthy();
      const summary = await summaryResponse.json() as {
        salesToday: { orders: Array<Record<string, unknown>>; buckets: Array<Record<string, unknown>> };
        receivedForOtherDays: { unsupportedReason: string | null };
      };
      const runRows = summary.salesToday.orders.filter((row) => createdOrders.some((order) => order.id === row.id));
      expect(runRows).toHaveLength(2);
      expect(runRows.map((row) => row.paymentStatus).sort()).toEqual(["deposit", "paid"]);
      expect(runRows.reduce((sum, row) => sum + Number(row.receivedToday), 0)).toBe(PRODUCT_PRICE + 300);
      expect(summary.receivedForOtherDays.unsupportedReason).toContain("Accounting payment records");

      await page.goto(`/day-end?date=${data.businessDate}`);
      await expect(page.getByText(first.name, { exact: true })).toBeVisible();
      await expect(page.getByText(second.name, { exact: true })).toBeVisible();
      await page.getByPlaceholder("負責輸入同事名").fill("ACCOUNT");
      await page.getByPlaceholder("負責覆核同事名").fill("E2E CHECKER");
      await page.evaluate(() => {
        const target = window as typeof window & { __posE2ePrintCalls?: number };
        target.__posE2ePrintCalls = 0;
        window.print = () => {
          target.__posE2ePrintCalls = (target.__posE2ePrintCalls || 0) + 1;
        };
      });
      await page.getByRole("button", { name: "列印埋數表" }).click();
      await expect.poll(() => page.evaluate(
        () => (window as typeof window & { __posE2ePrintCalls?: number }).__posE2ePrintCalls || 0,
      )).toBe(1);

      const dayEndPdfPath = testInfo.outputPath("day-end.pdf");
      await page.emulateMedia({ media: "print" });
      await page.pdf({ path: dayEndPdfPath, format: "A4", landscape: true, printBackground: true });
      const dayEndEvidence = inspectPdf(dayEndPdfPath, await page.locator("body").innerText(), 1);
      assertPdfBasics(dayEndEvidence);
      expect(dayEndEvidence.pdfText).toContain(first.name);
      expect(dayEndEvidence.pdfText).toContain(second.name);
      const rowMarkers = [
        "ROW-END-MORNING",
        "ROW-END-AFTERNOON",
      ];
      for (const [index, order] of createdOrders.entries()) {
        const startPages = dayEndEvidence.pageTexts
          .map((pageText, pageIndex) => pageText.includes(order.name) ? pageIndex : -1)
          .filter((pageIndex) => pageIndex >= 0);
        const endPages = dayEndEvidence.pageTexts
          .map((pageText, pageIndex) => pageText.includes(rowMarkers[index]) ? pageIndex : -1)
          .filter((pageIndex) => pageIndex >= 0);
        expect(startPages, `${order.name} must appear on exactly one physical day-end page.`).toHaveLength(1);
        expect(endPages, `${order.name} row-end marker must appear on exactly one physical page.`).toHaveLength(1);
        expect(endPages[0], `${order.name} first and last cells must stay on the same page.`).toBe(startPages[0]);
      }
      expect(dayEndEvidence.htmlText).toContain("Bank-in / FPS");
      expect(dayEndEvidence.htmlText).toContain("Cash / Other");
      expect(dayEndEvidence.htmlText).toContain("暫時未接駁 Odoo Accounting payment records");
      await testInfo.attach("day-end-pdf", { path: dayEndPdfPath, contentType: "application/pdf" });
      for (const [index, pngPath] of dayEndEvidence.pngPaths.entries()) {
        await testInfo.attach(`day-end-page-${index + 1}`, { path: pngPath, contentType: "image/png" });
      }

      writeJson(reportPath, {
        runId: data.runId,
        target: "approved Odoo staging only",
        createdOrders,
        businessDate: data.businessDate,
        pdfs: fs.readdirSync(path.dirname(dayEndPdfPath)).filter((name) => name.endsWith(".pdf")),
        knownUnsupported: summary.receivedForOtherDays.unsupportedReason,
      });
    } finally {
      if (createdOrders.length) {
        try {
          while (inspections.length < createdOrders.length) {
            const order = createdOrders[inspections.length];
            inspections.push(inspectionFrom(runStagingCli([
              "inspect-order", "--run-id", data.runId, "--order-id", String(order.id),
            ])));
          }
          writeJson(manifestPath, buildCleanupManifest(data.runId, inspections));
          cleanupResult = runStagingCli(["cleanup", "--manifest", manifestPath]);
          verifyResult = runStagingCli(["verify-clean", "--manifest", manifestPath]);
        } catch {
          cleanupResult = null;
          verifyResult = null;
        }
      }
      if (fs.existsSync(pendingPath)) {
        const recovery = runStagingCli(["recover-pending", "--pending-file", pendingPath]);
        cleanupResult ||= recovery.cleanup as JsonObject;
        verifyResult = recovery.verification as JsonObject;
        if (recovery.recording && !fs.existsSync(manifestPath)) {
          writeJson(manifestPath, recovery.recording);
        }
      }
      writeJson(testInfo.outputPath("cleanup-result.json"), { cleanupResult, verifyResult });
      if (fs.existsSync(manifestPath)) {
        await testInfo.attach("cleanup-manifest", { path: manifestPath, contentType: "application/json" });
      }
      if (fs.existsSync(reportPath)) {
        await testInfo.attach("run-report", { path: reportPath, contentType: "application/json" });
      }
      if (fs.existsSync(createdIdsPath)) {
        await testInfo.attach("created-order-ids", { path: createdIdsPath, contentType: "application/json" });
      }
      if (fs.existsSync(pendingPath)) {
        await testInfo.attach("pending-recovery", { path: pendingPath, contentType: "application/json" });
      }
    }

    expect(cleanupResult?.ok).toBeTruthy();
    expect(verifyResult?.ok).toBeTruthy();
  });
});
