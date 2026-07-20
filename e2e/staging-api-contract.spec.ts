import { expect, test } from "@playwright/test";
import fs from "node:fs";
import {
  assertApprovedBackendTarget,
  BACKEND_URL,
  FRONTEND_URL,
  runStagingCli,
  STAGING_WRITE_CONSENT,
  writeJson,
  type JsonObject,
} from "./support/staging-cli";

const PRODUCT_ID = 4338;

interface DeliverySlot {
  id: number;
  displayLabel: string;
  startTime: string;
  endTime: string;
}

function m2oId(value: unknown): number | null {
  if (Array.isArray(value) && typeof value[0] === "number") return value[0];
  return typeof value === "number" ? value : null;
}

test("fast endpoint-to-Odoo staging contract", async ({ request }, testInfo) => {
  test.skip(
    process.env.POS_E2E_ALLOW_STAGING_WRITES !== STAGING_WRITE_CONSENT,
    "Set POS_E2E_ALLOW_STAGING_WRITES to the exact staging acknowledgement value.",
  );

  const suffix = String(Date.now()).slice(-6);
  const businessDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
  const runId = `TEST-E2E-API-${businessDate.replaceAll("-", "")}-${suffix}`;
  const ordererName = `${runId} Secretary`;
  const senderName = `${runId} Director`;
  const recipientName = `${runId} Recipient`;
  const ordererPhone = `63${suffix}`;
  const recipientPhone = `64${suffix}`;
  const localId = crypto.randomUUID();
  const manifestPath = testInfo.outputPath("cleanup-manifest.json");
  const pendingPath = testInfo.outputPath("pending-recovery.json");
  let orderId: number | null = null;
  let manifest: Record<string, unknown> | null = null;

  runStagingCli([
    "preflight",
    "--run-id", runId,
    "--phone", ordererPhone,
    "--phone", recipientPhone,
    "--frontend-url", FRONTEND_URL,
    "--backend-url", BACKEND_URL,
  ]);
  await assertApprovedBackendTarget(request);
  const slotsResponse = await request.get(`${BACKEND_URL}/delivery-slots`);
  expect(slotsResponse.ok(), "Delivery slot endpoint must be ready before order writes.").toBeTruthy();
  const deliverySlots = await slotsResponse.json() as DeliverySlot[];
  const deliverySlot = deliverySlots[0];
  if (!deliverySlot) throw new Error("Staging has no active delivery slot for the API contract test.");
  writeJson(pendingPath, {
    runMarker: runId,
    localIds: [localId],
    customer: { name: ordererName, phone: ordererPhone },
    recipient: { name: recipientName, phone: recipientPhone },
  });

  try {
    const response = await request.post(`${BACKEND_URL}/orders`, {
      data: {
        id: localId,
        salesId: "ACCOUNT — AC02 - Elma",
        customerName: ordererName,
        senderName,
        phone: ordererPhone,
        customerType: "personal",
        companyName: "",
        items: [{
          id: crypto.randomUUID(),
          name: "testing",
          price: 1111,
          quantity: 1,
          productId: PRODUCT_ID,
          productCode: "123",
        }],
        deliveryFee: 0,
        urgentFee: 0,
        subtotal: 1111,
        finalPrice: 1111,
        priceOverridden: false,
        paymentStatus: "paid",
        depositAmount: 0,
        paymentMethod: "cash_other",
        deliveryDate: businessDate,
        deliveryTimeMode: "slot",
        deliverySlotId: deliverySlot.id,
        deliveryTime: deliverySlot.displayLabel,
        deliveryAddress: `${runId} API Test Address`,
        recipientName,
        recipientPhone,
        deliveryPerson: "API TEST",
        giftCardEnabled: false,
        giftCardMessage: "",
        senderNote: `${runId} sender note`,
        deliveryNote: `${runId} delivery note`,
        internalNote: runId,
        createdAt: new Date().toISOString(),
      },
    });
    const body = await response.json() as {
      id: number;
      name: string;
      detail?: string | { message?: string };
    };
    if (Number.isInteger(body.id) && body.id > 0) orderId = body.id;
    const detail = typeof body.detail === "string" ? body.detail : body.detail?.message;
    expect(response.ok(), detail || "Direct order endpoint failed").toBeTruthy();

    const payload = runStagingCli([
      "inspect-order", "--run-id", runId, "--order-id", String(orderId),
    ]);
    const actual = payload.actual as {
      order: Record<string, unknown>;
      lines: Array<Record<string, unknown>>;
      partners: Array<Record<string, unknown>>;
    };
    expect(actual.order.x_pos_local_id).toBe(localId);
    expect(actual.order.x_payment_status).toBe("paid");
    expect(actual.order.x_payment_method).toBe("cash_other");
    expect(actual.order.x_source_customer_name).toBe(ordererName);
    expect(actual.order.x_sender_name).toBe(senderName);
    expect(actual.order.x_recipient_name).toBe(recipientName);
    expect(actual.order.florist_pos_delivery_mode).toBe("slot");
    expect(m2oId(actual.order.florist_pos_delivery_slot_id)).toBe(deliverySlot.id);
    expect(actual.order.florist_pos_delivery_time_snapshot).toBe(deliverySlot.displayLabel);
    expect(String(actual.order.commitment_date)).toContain(deliverySlot.endTime);
    expect(Number(actual.order.amount_total)).toBe(1111);
    expect(actual.lines).toHaveLength(1);
    expect(m2oId(actual.lines[0].product_id)).toBe(PRODUCT_ID);

    const customer = actual.partners.find((partner) => !m2oId(partner.parent_id));
    const recipient = actual.partners.find((partner) => partner.type === "delivery");
    if (!customer || !recipient) throw new Error("API test partners were not created as expected.");
    const customerId = Number(customer.id);
    const recipientId = Number(recipient.id);
    manifest = {
      runMarker: runId,
      orders: [{
        id: orderId,
        posLocalId: localId,
        internalMarker: runId,
        customerId,
        recipientId,
      }],
      customer: { id: customerId, name: String(customer.name), phone: String(customer.phone) },
      recipient: {
        id: recipientId,
        name: String(recipient.name),
        phone: String(recipient.phone),
        parentId: customerId,
      },
    };
    writeJson(manifestPath, manifest);

    const summaryResponse = await request.get(`${BACKEND_URL}/day-end/summary?date=${businessDate}`);
    const summary = await summaryResponse.json() as { salesToday: { orders: Array<{ id: number }> } };
    expect(summary.salesToday.orders.some((order) => order.id === orderId)).toBeTruthy();
  } finally {
    if (orderId) {
      try {
        if (!manifest) {
          const payload = runStagingCli([
            "inspect-order", "--run-id", runId, "--order-id", String(orderId),
          ]);
          const actual = payload.actual as {
            order: Record<string, unknown>;
            partners: Array<Record<string, unknown>>;
          };
          const customer = actual.partners.find((partner) => !m2oId(partner.parent_id));
          const recipient = actual.partners.find((partner) => partner.type === "delivery");
          if (customer && recipient) {
            const customerId = Number(customer.id);
            const recipientId = Number(recipient.id);
            manifest = {
              runMarker: runId,
              orders: [{
                id: orderId,
                posLocalId: String(actual.order.x_pos_local_id),
                internalMarker: String(actual.order.x_pos_notes),
                customerId,
                recipientId,
              }],
              customer: { id: customerId, name: String(customer.name), phone: String(customer.phone) },
              recipient: {
                id: recipientId,
                name: String(recipient.name),
                phone: String(recipient.phone),
                parentId: customerId,
              },
            };
            writeJson(manifestPath, manifest);
          }
        }
        if (manifest) {
          const cleanup = runStagingCli(["cleanup", "--manifest", manifestPath]) as JsonObject;
          const verification = runStagingCli(["verify-clean", "--manifest", manifestPath]) as JsonObject;
          expect(cleanup.ok).toBeTruthy();
          expect(verification.ok).toBeTruthy();
        }
      } catch {
        // The exact pending identity recovery below handles partial cleanup too.
      }
    }
    const recovery = runStagingCli(["recover-pending", "--pending-file", pendingPath]);
    expect((recovery.cleanup as JsonObject).ok).toBeTruthy();
    expect((recovery.verification as JsonObject).ok).toBeTruthy();
    if (recovery.recording && !manifest) {
      manifest = recovery.recording as Record<string, unknown>;
      writeJson(manifestPath, manifest);
    }
    if (manifest && fs.existsSync(manifestPath)) {
      await testInfo.attach("cleanup-manifest", { path: manifestPath, contentType: "application/json" });
    }
    if (fs.existsSync(pendingPath)) {
      await testInfo.attach("pending-recovery", { path: pendingPath, contentType: "application/json" });
    }
  }
});
