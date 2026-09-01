import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { PosAuthContext } from "@/components/auth/PosAuthContext";
import SyncErrorCenter from "@/pages/SyncErrorCenter";
import type { PosEmployeeIdentity } from "@/lib/pos-auth";


const apiMocks = vi.hoisted(() => ({
  getSyncErrorCenter: vi.fn(),
  recoverOperationalOrder: vi.fn(),
  retryOperationalOrder: vi.fn(),
}));

vi.mock("@/lib/odoo-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/odoo-api")>()),
  hasOdooBackend: true,
  getSyncErrorCenter: apiMocks.getSyncErrorCenter,
  recoverOperationalOrder: apiMocks.recoverOperationalOrder,
  retryOperationalOrder: apiMocks.retryOperationalOrder,
}));

const manager: PosEmployeeIdentity = {
  id: 99,
  name: "Testing Manager",
  login: "manager",
  salesLabel: "M99 — Testing Manager",
  role: "manager",
};

const staff: PosEmployeeIdentity = {
  ...manager,
  id: 7,
  name: "Testing Staff",
  role: "staff",
};

const response = {
  generatedAt: "2026-09-01T15:00:00+08:00",
  summary: {
    pendingCount: 1,
    syncingCount: 0,
    needsReviewCount: 1,
    unresolvedCount: 2,
    unresolvedValueMinor: 123_500,
    oldestAcceptedAt: "2026-08-31T22:00:00+08:00",
  },
  worker: {
    status: "succeeded" as const,
    lastStartedAt: "2026-09-01T14:59:00+08:00",
    lastCompletedAt: "2026-09-01T14:59:05+08:00",
    lastSuccessAt: "2026-09-01T14:59:05+08:00",
    lastClaimed: 2,
    lastSynced: 1,
    lastRetried: 0,
    lastNeedsReview: 1,
  },
  truncated: false,
  orders: [
    {
      operationalOrderId: "11111111-2222-4333-8444-abcdef123456",
      traceId: "SYNC-EF123456",
      posReference: "POS-REVIEW-1",
      acceptedAt: "2026-08-31T22:00:00+08:00",
      updatedAt: "2026-09-01T14:59:00+08:00",
      customerName: "Alex",
      amountTotalMinor: 123_400,
      syncState: "needs_review" as const,
      operatorEmployeeId: 174,
      salespersonLabel: "RITA — Rita Li",
      attemptCount: 2,
      nextAttemptAt: null,
      retryEligible: false,
      diagnostic: {
        code: "recipient_occasions_stale",
        stage: "recipient_important_dates" as const,
        title: "收件人重要日子已更新",
        reason: "落單期間，Odoo 入面嘅收件人重要日子版本已經改變。",
        action: "重新搜尋並選擇收件人，確認最新重要日子後再提交。",
        retryable: false,
      },
    },
    {
      operationalOrderId: "22222222-3333-4444-8555-abcdef654321",
      traceId: "SYNC-EF654321",
      posReference: "POS-PENDING-2",
      acceptedAt: "2026-09-01T14:55:00+08:00",
      updatedAt: "2026-09-01T14:59:00+08:00",
      customerName: "Jay",
      amountTotalMinor: 100,
      syncState: "pending_odoo" as const,
      operatorEmployeeId: 174,
      salespersonLabel: "RUBY — Ruby Wong",
      attemptCount: 1,
      nextAttemptAt: "2026-09-01T14:59:00+08:00",
      retryEligible: true,
      diagnostic: {
        code: "odoo_temporarily_unavailable",
        stage: "odoo_connection" as const,
        title: "Odoo 暫時未能連接",
        reason: "同步時 Odoo 無回應、逾時或暫時返回伺服器錯誤。",
        action: "系統會自動重試。",
        retryable: true,
      },
    },
  ],
};

const renderPage = (employee: PosEmployeeIdentity) => render(
  <PosAuthContext.Provider value={{ employee, logout: vi.fn() }}>
    <MemoryRouter initialEntries={["/sync-errors"]}>
      <Routes>
        <Route path="/" element={<p>POS 首頁</p>} />
        <Route path="/sync-errors" element={<SyncErrorCenter />} />
      </Routes>
    </MemoryRouter>
  </PosAuthContext.Provider>,
);

describe("SyncErrorCenter", () => {
  beforeEach(() => {
    apiMocks.getSyncErrorCenter.mockResolvedValue(response);
    apiMocks.retryOperationalOrder.mockResolvedValue({
      operationalOrderId: response.orders[1].operationalOrderId,
      syncState: "synced",
    });
    apiMocks.recoverOperationalOrder.mockResolvedValue({
      operationalOrderId: response.orders[0].operationalOrderId,
      syncState: "synced",
      odooOrderName: "S18001",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects staff without requesting manager diagnostics", () => {
    renderPage(staff);

    expect(screen.getByText("POS 首頁")).toBeVisible();
    expect(apiMocks.getSyncErrorCenter).not.toHaveBeenCalled();
  });

  it("shows the exact failure stage, reason, action and trace ID", async () => {
    renderPage(manager);

    expect(await screen.findByText("收件人重要日子已更新")).toBeVisible();
    expect(screen.getByText("收件人重要日子")).toBeVisible();
    expect(screen.getByText(/原因：落單期間/)).toBeVisible();
    expect(screen.getByText(/重新搜尋並選擇收件人/)).toBeVisible();
    expect(screen.getByText("SYNC-EF123456")).toBeVisible();
    expect(screen.getByText("Worker 上次正常完成")).toBeVisible();
    expect(screen.getByText("2", { selector: "p.text-2xl" })).toBeVisible();
  });

  it("filters issues and retries only the confirmed eligible order", async () => {
    renderPage(manager);
    await screen.findByText("收件人重要日子已更新");

    fireEvent.click(screen.getByRole("button", { name: "等待自動同步" }));
    expect(screen.queryByText("收件人重要日子已更新")).not.toBeInTheDocument();
    expect(screen.getByText("Odoo 暫時未能連接")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "立即重試" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("SYNC-EF654321");
    fireEvent.click(screen.getByRole("button", { name: "確認重試" }));

    await waitFor(() => {
      expect(apiMocks.retryOperationalOrder).toHaveBeenCalledWith(
        response.orders[1].operationalOrderId,
      );
    });
    await waitFor(() => expect(apiMocks.getSyncErrorCenter).toHaveBeenCalledTimes(2));
  });

  it("searches by trace ID and diagnostic code", async () => {
    renderPage(manager);
    await screen.findByText("收件人重要日子已更新");

    fireEvent.change(screen.getByRole("textbox", { name: "搜尋同步錯誤" }), {
      target: { value: "EF654321" },
    });
    expect(screen.queryByText("收件人重要日子已更新")).not.toBeInTheDocument();
    expect(screen.getByText("Odoo 暫時未能連接")).toBeVisible();

    fireEvent.change(screen.getByRole("textbox", { name: "搜尋同步錯誤" }), {
      target: { value: "recipient_occasions_stale" },
    });
    expect(screen.getByText("收件人重要日子已更新")).toBeVisible();
    expect(screen.queryByText("Odoo 暫時未能連接")).not.toBeInTheDocument();
  });

  it("requires confirmation before recovering exactly one review order", async () => {
    renderPage(manager);
    await screen.findByText("收件人重要日子已更新");

    fireEvent.click(screen.getByRole("button", { name: "用修正版重試" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("保留原 checkout UUID");
    fireEvent.click(screen.getByRole("button", { name: "確認修復重試" }));

    await waitFor(() => {
      expect(apiMocks.recoverOperationalOrder).toHaveBeenCalledWith(
        response.orders[0].operationalOrderId,
      );
    });
    expect(apiMocks.retryOperationalOrder).not.toHaveBeenCalled();
  });
});
