import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PosAuthContext } from "@/components/auth/PosAuthContext";
import {
  OdooApiError,
  OdooConflictError,
  type ReceivableInvoiceRow,
  type ReceivablesResponse,
  type ReceivablesStatus,
} from "@/lib/odoo-api";
import type { PosEmployeeRole } from "@/lib/pos-auth";
import ReceivablesDashboard from "@/pages/ReceivablesDashboard";

const getReceivables = vi.hoisted(() => vi.fn());
const getReceivableDetail = vi.hoisted(() => vi.fn());
const validateReceivablesAccess = vi.hoisted(() => vi.fn());
const logout = vi.fn();

const filterCases: Array<[string, ReceivablesStatus]> = [
  ["已逾期", "overdue"],
  ["今日到期", "due_today"],
  ["未到期", "not_due"],
  ["未設付款期限", "missing_due_date"],
];

vi.mock("@/lib/odoo-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/odoo-api")>();
  return {
    ...original,
    hasOdooBackend: true,
    getReceivables,
    getReceivableDetail,
    validateReceivablesAccess,
  };
});

vi.mock("@/lib/pos-auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/pos-auth")>();
  return {
    ...original,
    posAuthRequired: true,
  };
});

const rows: ReceivableInvoiceRow[] = [
  {
    id: 1,
    invoiceNumber: "INV/2026/0001",
    reference: "PO-100",
    origin: "S00100",
    invoiceDate: "2026-08-01",
    dueDate: "2026-08-28",
    paymentTermId: 3,
    paymentTerm: "30 Days",
    customerId: 10,
    customerName: "Alpha Flowers",
    salespersonId: 8,
    salesperson: "Elma",
    currencyId: 344,
    currency: "HKD",
    amountTotal: 1_000,
    amountReconciled: 400,
    amountResidual: 600,
    companyCurrencyResidual: 600,
    reconciliationStatus: "partially_reconciled",
    status: "overdue",
    daysOverdue: 2,
    daysUntilDue: null,
    overdueResidual: 600,
    dueTodayResidual: 0,
    notDueResidual: 0,
    missingDueDateResidual: 0,
  },
  {
    id: 2,
    invoiceNumber: "INV/2026/0002",
    reference: null,
    origin: "S00101",
    invoiceDate: "2026-08-30",
    dueDate: "2026-08-30",
    paymentTermId: 1,
    paymentTerm: "Immediate Payment",
    customerId: 11,
    customerName: "Beta Customer",
    salespersonId: null,
    salesperson: null,
    currencyId: 344,
    currency: "HKD",
    amountTotal: 800,
    amountReconciled: 0,
    amountResidual: 800,
    companyCurrencyResidual: 800,
    reconciliationStatus: "unreconciled",
    status: "due_today",
    daysOverdue: null,
    daysUntilDue: null,
    overdueResidual: 0,
    dueTodayResidual: 800,
    notDueResidual: 0,
    missingDueDateResidual: 0,
  },
  {
    id: 3,
    invoiceNumber: "INV/2026/0003",
    reference: null,
    origin: null,
    invoiceDate: "2026-08-30",
    dueDate: "2026-09-02",
    paymentTermId: 2,
    paymentTerm: "7 Days",
    customerId: 12,
    customerName: "Gamma Customer",
    salespersonId: 9,
    salesperson: "Ken",
    currencyId: 344,
    currency: "HKD",
    amountTotal: 1_200,
    amountReconciled: 0,
    amountResidual: 1_200,
    companyCurrencyResidual: 1_200,
    reconciliationStatus: "unreconciled",
    status: "not_due",
    daysOverdue: null,
    daysUntilDue: 3,
    overdueResidual: 0,
    dueTodayResidual: 0,
    notDueResidual: 1_200,
    missingDueDateResidual: 0,
  },
  {
    id: 4,
    invoiceNumber: "INV/2026/0004",
    reference: null,
    origin: null,
    invoiceDate: "2026-08-30",
    dueDate: null,
    paymentTermId: null,
    paymentTerm: null,
    customerId: 13,
    customerName: "Missing Terms Customer",
    salespersonId: null,
    salesperson: null,
    currencyId: 344,
    currency: "HKD",
    amountTotal: 1_400,
    amountReconciled: 0,
    amountResidual: 1_400,
    companyCurrencyResidual: 1_400,
    reconciliationStatus: "unreconciled",
    status: "missing_due_date",
    daysOverdue: null,
    daysUntilDue: null,
    overdueResidual: 0,
    dueTodayResidual: 0,
    notDueResidual: 0,
    missingDueDateResidual: 1_400,
  },
];

const responseFixture = (overrides: Partial<ReceivablesResponse> = {}): ReceivablesResponse => ({
  snapshotVersion: "receivables-snapshot-1",
  generatedAt: "2026-08-30T10:30:00+08:00",
  asOfDate: "2026-08-30",
  timezone: "Asia/Hong_Kong",
  summary: {
    companyCurrencyId: 344,
    companyCurrency: "HKD",
    openInvoiceCount: 4,
    openResidual: 4_000,
    overdueInvoiceCount: 1,
    overdueResidual: 600,
    dueTodayInvoiceCount: 1,
    dueTodayResidual: 800,
    notDueInvoiceCount: 1,
    notDueResidual: 1_200,
    missingDueDateInvoiceCount: 1,
    missingDueDateResidual: 1_400,
  },
  rows,
  totalRows: 4,
  page: 1,
  limit: 100,
  hasMore: false,
  ...overrides,
});

const renderDashboard = (role: PosEmployeeRole = "manager") => render(
  <PosAuthContext.Provider value={{
    employee: {
      id: 95,
      name: role === "manager" ? "Manager" : "Staff",
      login: role,
      salesLabel: role,
      role,
    },
    logout,
  }}>
    <MemoryRouter initialEntries={["/receivables"]}>
      <Routes>
        <Route path="/" element={<p>POS 首頁</p>} />
        <Route path="/receivables" element={<ReceivablesDashboard />} />
      </Routes>
    </MemoryRouter>
  </PosAuthContext.Provider>,
);

describe("ReceivablesDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateReceivablesAccess.mockResolvedValue(undefined);
    getReceivables.mockResolvedValue(responseFixture());
    getReceivableDetail.mockResolvedValue({
      invoiceId: 1,
      customerId: 10,
      customerName: "Alpha Flowers",
      customerCompany: "Alpha Holdings Limited",
      customerPhone: "9123 4567",
      customerEmail: "accounts@alpha.example",
    });
  });

  it("shows manager summary, every status, partial reconciliation, and private details on expansion", async () => {
    renderDashboard();

    expect(await screen.findByText("Alpha Flowers")).toBeVisible();
    expect(screen.getByText("追數工作清單，不等同正式應收帳報表")).toBeVisible();
    expect(screen.getByText("逾期 2 日")).toBeVisible();
    expect(screen.getAllByText("今日到期")).toHaveLength(3);
    expect(screen.getByText("尚有 3 日")).toBeVisible();
    expect(screen.getByText("付款期限未設定")).toBeVisible();
    expect(screen.getByText("部分核銷")).toBeVisible();
    expect(screen.queryByText("9123 4567")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展開發票 INV/2026/0001 詳情" }));

    expect(await screen.findByText("9123 4567")).toBeVisible();
    expect(screen.getByText("accounts@alpha.example")).toBeVisible();
    expect(screen.getByText("Alpha Holdings Limited")).toBeVisible();
    expect(screen.getByText("S00100")).toBeVisible();
    expect(screen.getByText("HK$400.00")).toBeVisible();
    expect(getReceivables).toHaveBeenCalledWith(expect.objectContaining({
      status: "all",
      page: 1,
      limit: 100,
      refresh: false,
    }));
    expect(getReceivableDetail).toHaveBeenCalledWith(1, expect.any(AbortSignal));
  });

  it("redirects staff away without requesting receivables", async () => {
    renderDashboard("staff");

    expect(await screen.findByText("POS 首頁")).toBeVisible();
    expect(screen.queryByText("應收追數")).not.toBeInTheDocument();
    expect(getReceivables).not.toHaveBeenCalled();
  });

  it.each(filterCases)("requests the %s filter from page one", async (label, requestedStatus) => {
    renderDashboard();
    await screen.findByText("Alpha Flowers");

    fireEvent.click(screen.getByRole("button", { name: label }));

    await waitFor(() => expect(getReceivables).toHaveBeenLastCalledWith(expect.objectContaining({
      status: requestedStatus,
      page: 1,
      limit: 100,
      refresh: false,
      snapshotVersion: "receivables-snapshot-1",
    })));
  });

  it("loads the next page and disables pagination at the end", async () => {
    getReceivables.mockImplementation(({ page = 1 }: { page?: number }) => Promise.resolve(
      page === 1
        ? responseFixture({ totalRows: 101, hasMore: true, rows: [rows[0]] })
        : responseFixture({
            page: 2,
            totalRows: 101,
            hasMore: false,
            rows: [{ ...rows[1], id: 101, customerName: "Page Two Customer" }],
          }),
    ));
    renderDashboard();
    await screen.findByText("Alpha Flowers");

    fireEvent.click(screen.getByRole("button", { name: "下一頁" }));

    expect(await screen.findByText("Page Two Customer")).toBeVisible();
    expect(screen.getByText("第 2 頁 · 顯示 101–101／共 101 張")).toBeVisible();
    expect(screen.getByRole("button", { name: "下一頁" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "上一頁" })).toBeEnabled();
    expect(getReceivables).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 2,
      snapshotVersion: "receivables-snapshot-1",
    }));
  });

  it("shows a clear empty state", async () => {
    getReceivables.mockResolvedValue(responseFixture({
      rows: [],
      totalRows: 0,
      summary: {
        companyCurrencyId: 344,
        companyCurrency: "HKD",
        openInvoiceCount: 0,
        openResidual: 0,
        overdueInvoiceCount: 0,
        overdueResidual: 0,
        dueTodayInvoiceCount: 0,
        dueTodayResidual: 0,
        notDueInvoiceCount: 0,
        notDueResidual: 0,
        missingDueDateInvoiceCount: 0,
        missingDueDateResidual: 0,
      },
    }));

    renderDashboard();

    expect(await screen.findByText("暫無未清發票")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("hides all official data for a 503 response", async () => {
    const statusCode = 503;
    const heading = "暫未能取得最新應收資料";
    getReceivables.mockRejectedValue(new OdooApiError("backend failure", statusCode));

    renderDashboard();

    expect(await screen.findByText(heading)).toBeVisible();
    expect(screen.queryByText("Alpha Flowers")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("應收摘要")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("logs out immediately when the receivables list rejects current manager access", async () => {
    getReceivables.mockRejectedValueOnce(new OdooApiError("manager access revoked", 403));
    renderDashboard();

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(screen.queryByLabelText("應收摘要")).not.toBeInTheDocument();
  });

  it("logs out immediately when invoice detail rejects current manager access", async () => {
    getReceivableDetail.mockRejectedValueOnce(new OdooApiError("manager access revoked", 403));
    renderDashboard();
    await screen.findByText("Alpha Flowers");

    fireEvent.click(screen.getByRole("button", { name: "展開發票 INV/2026/0001 詳情" }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Alpha Flowers")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("應收摘要")).not.toBeInTheDocument();
  });

  it("manual refresh removes stale totals and rows until a fresh response arrives", async () => {
    let resolveRefresh!: (value: ReceivablesResponse) => void;
    const refreshResponse = new Promise<ReceivablesResponse>((resolve) => {
      resolveRefresh = resolve;
    });
    getReceivables
      .mockResolvedValueOnce(responseFixture())
      .mockReturnValueOnce(refreshResponse);
    renderDashboard();
    await screen.findByText("Alpha Flowers");

    fireEvent.click(screen.getByRole("button", { name: "重新整理" }));

    expect(screen.getByText("正在取得最新應收資料...")).toBeVisible();
    expect(screen.queryByText("Alpha Flowers")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("應收摘要")).not.toBeInTheDocument();

    await act(async () => {
      resolveRefresh(responseFixture({
        rows: [{ ...rows[0], customerName: "Fresh Customer" }],
        totalRows: 1,
      }));
    });

    expect(await screen.findByText("Fresh Customer")).toBeVisible();
    expect(getReceivables).toHaveBeenCalledTimes(2);
    const refreshRequest = getReceivables.mock.calls.at(-1)?.[0];
    expect(refreshRequest).toEqual(expect.objectContaining({ refresh: true, page: 1 }));
    expect(refreshRequest).not.toHaveProperty("snapshotVersion");
  });

  it("recovers once from an expired snapshot at page one without refresh", async () => {
    getReceivables
      .mockResolvedValueOnce(responseFixture({
        totalRows: 101,
        hasMore: true,
        rows: [rows[0]],
      }))
      .mockRejectedValueOnce(new OdooConflictError("Snapshot expired"))
      .mockResolvedValueOnce(responseFixture({
        snapshotVersion: "receivables-snapshot-2",
        rows: [{ ...rows[1], customerName: "Recovered Customer" }],
        totalRows: 1,
      }));
    renderDashboard();
    await screen.findByText("Alpha Flowers");

    fireEvent.click(screen.getByRole("button", { name: "下一頁" }));

    expect(await screen.findByText("Recovered Customer")).toBeVisible();
    expect(screen.getByText("第 1 頁 · 顯示 1–1／共 1 張")).toBeVisible();
    expect(getReceivables).toHaveBeenCalledTimes(3);
    expect(getReceivables.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      page: 2,
      refresh: false,
      snapshotVersion: "receivables-snapshot-1",
    }));
    const recoveryRequest = getReceivables.mock.calls[2]?.[0];
    expect(recoveryRequest).toEqual(expect.objectContaining({
      page: 1,
      refresh: false,
    }));
    expect(recoveryRequest).not.toHaveProperty("snapshotVersion");
  });

  it.each([
    ["401", new OdooApiError("signed session expired", 401)],
    ["403", new OdooApiError("manager access revoked", 403)],
  ])("fails closed and logs out when access validation returns %s", async (_label, failure) => {
    let rejectAccess!: (error: unknown) => void;
    validateReceivablesAccess.mockReturnValueOnce(new Promise<void>((_resolve, reject) => {
      rejectAccess = reject;
    }));
    renderDashboard();
    await screen.findByText("Alpha Flowers");
    fireEvent.click(screen.getByRole("button", { name: "展開發票 INV/2026/0001 詳情" }));
    expect(await screen.findByText("9123 4567")).toBeVisible();

    await act(async () => {
      rejectAccess(failure);
      await Promise.resolve();
    });

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Alpha Flowers")).not.toBeInTheDocument();
    expect(screen.queryByText("9123 4567")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("應收摘要")).not.toBeInTheDocument();
  });

  it.each([
    ["503", new OdooApiError("Odoo unavailable", 503)],
    ["network failure", new TypeError("Failed to fetch")],
  ])("hides sensitive data without disconnecting the POS when access validation returns %s", async (_label, failure) => {
    let rejectAccess!: (error: unknown) => void;
    validateReceivablesAccess.mockReturnValueOnce(new Promise<void>((_resolve, reject) => {
      rejectAccess = reject;
    }));
    renderDashboard();
    await screen.findByText("Alpha Flowers");
    fireEvent.click(screen.getByRole("button", { name: "展開發票 INV/2026/0001 詳情" }));
    expect(await screen.findByText("9123 4567")).toBeVisible();

    await act(async () => {
      rejectAccess(failure);
      await Promise.resolve();
    });

    expect(logout).not.toHaveBeenCalled();
    expect(await screen.findByText("暫未能取得最新應收資料")).toBeVisible();
    expect(screen.queryByText("Alpha Flowers")).not.toBeInTheDocument();
    expect(screen.queryByText("9123 4567")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("應收摘要")).not.toBeInTheDocument();
  });

  it("deduplicates overlapping periodic access checks", async () => {
    let resolveAccess!: () => void;
    validateReceivablesAccess.mockReturnValue(new Promise<void>((resolve) => {
      resolveAccess = resolve;
    }));
    renderDashboard();
    await waitFor(() => expect(validateReceivablesAccess).toHaveBeenCalledTimes(1));

    fireEvent.focus(window);
    fireEvent.focus(window);
    expect(validateReceivablesAccess).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAccess();
      await Promise.resolve();
    });
    fireEvent.focus(window);
    await waitFor(() => expect(validateReceivablesAccess).toHaveBeenCalledTimes(2));
  });
});
