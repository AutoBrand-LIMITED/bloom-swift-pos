import { Fragment, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  HandCoins,
  LogOut,
  RefreshCw,
  UserRound,
} from "lucide-react";

import { usePosAuth } from "@/components/auth/PosAuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getReceivableDetail,
  getReceivables,
  hasOdooBackend,
  OdooApiError,
  OdooConflictError,
  validateReceivablesAccess,
  type ReceivableInvoiceDetail,
  type ReceivableInvoiceRow,
  type ReceivablesResponse,
  type ReceivablesStatus,
} from "@/lib/odoo-api";
import { posAuthRequired } from "@/lib/pos-auth";

const PAGE_LIMIT = 100;

const FILTERS: Array<{ value: ReceivablesStatus; label: string }> = [
  { value: "all", label: "全部" },
  { value: "overdue", label: "已逾期" },
  { value: "due_today", label: "今日到期" },
  { value: "not_due", label: "未到期" },
  { value: "missing_due_date", label: "未設付款期限" },
];

const formatMoney = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("zh-HK", {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("zh-HK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
};

const formatGeneratedAt = (value: string): string => {
  const generatedAt = new Date(value);
  if (!Number.isFinite(generatedAt.getTime())) return value;
  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hong_Kong",
  }).format(generatedAt);
};

const statusText = (row: ReceivableInvoiceRow): string => {
  if (row.status === "missing_due_date" || !row.dueDate) return "付款期限未設定";
  if (row.status === "due_today") return "今日到期";
  if (row.status === "overdue") return `逾期 ${row.daysOverdue ?? 0} 日`;
  return `尚有 ${row.daysUntilDue ?? 0} 日`;
};

const statusBadgeClass = (status: ReceivableInvoiceRow["status"]): string => {
  if (status === "overdue") return "border-red-300 bg-red-50 text-red-800";
  if (status === "due_today") return "border-amber-300 bg-amber-50 text-amber-900";
  if (status === "missing_due_date") return "border-slate-300 bg-slate-50 text-slate-700";
  return "border-emerald-300 bg-emerald-50 text-emerald-800";
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

const SummaryCard = ({
  label,
  amount,
  count,
  currency,
}: {
  label: string;
  amount: number;
  count: number;
  currency: string;
}) => (
  <Card>
    <CardHeader className="p-4 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      <p className="text-2xl font-bold tabular-nums">{formatMoney(amount, currency)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{count} 張發票</p>
    </CardContent>
  </Card>
);

const DetailItem = ({ label, children }: { label: string; children: string }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="mt-1 break-words text-sm font-medium">{children || "-"}</dd>
  </div>
);

const ReceivablesDashboard = () => {
  const navigate = useNavigate();
  const { employee, logout } = usePosAuth();
  const [status, setStatus] = useState<ReceivablesStatus>("all");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const forceRefreshRef = useRef(false);
  const snapshotVersionRef = useRef<string>();
  const accessValidationRef = useRef<Promise<void> | null>(null);
  const receivablesRequestRef = useRef<AbortController | null>(null);
  const detailRequestRef = useRef<AbortController | null>(null);
  const [data, setData] = useState<ReceivablesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ReceivableInvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

  useEffect(() => {
    if (employee?.role !== "manager" || !posAuthRequired) return;
    let active = true;
    const controller = new AbortController();
    const revalidate = () => {
      if (accessValidationRef.current) return;
      const validation = validateReceivablesAccess(controller.signal);
      accessValidationRef.current = validation;
      void validation
        .catch((accessError: unknown) => {
          if (!active || isAbortError(accessError)) return;
          receivablesRequestRef.current?.abort();
          detailRequestRef.current?.abort();
          snapshotVersionRef.current = undefined;
          setData(null);
          setExpandedInvoiceId(null);
          setDetail(null);
          setDetailLoading(false);
          setDetailError(false);
          setLoading(false);
          const accessStatus = accessError instanceof OdooApiError
            ? accessError.status
            : 503;
          if (accessStatus === 401 || accessStatus === 403) {
            setError(null);
            logout();
            return;
          }
          setError({
            status: accessStatus,
            message: accessError instanceof Error
              ? accessError.message
              : "暫時無法核實 Manager 權限。",
          });
        })
        .finally(() => {
          if (accessValidationRef.current === validation) {
            accessValidationRef.current = null;
          }
        });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") revalidate();
    };
    revalidate();
    const intervalId = window.setInterval(revalidate, 15_000);
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      controller.abort();
      accessValidationRef.current = null;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [employee?.role, logout]);

  useEffect(() => {
    if (employee?.role !== "manager") return;

    const controller = new AbortController();
    receivablesRequestRef.current = controller;
    setData(null);
    setExpandedInvoiceId(null);
    setError(null);
    setLoading(true);

    if (!hasOdooBackend) {
      setError({ status: 503, message: "未設定 Odoo backend。" });
      setLoading(false);
      return () => controller.abort();
    }

    const forceRefresh = forceRefreshRef.current;
    forceRefreshRef.current = false;
    const snapshotVersion = forceRefresh ? undefined : snapshotVersionRef.current;
    getReceivables({
      status,
      page,
      limit: PAGE_LIMIT,
      refresh: forceRefresh,
      ...(snapshotVersion !== undefined ? { snapshotVersion } : {}),
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) return;
        snapshotVersionRef.current = response.snapshotVersion;
        const lastPage = Math.max(1, Math.ceil(response.totalRows / response.limit));
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setData(response);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        const snapshotExpired = requestError instanceof OdooConflictError
          || (requestError instanceof OdooApiError && requestError.status === 409);
        if (snapshotVersion !== undefined && snapshotExpired) {
          snapshotVersionRef.current = undefined;
          if (page !== 1) {
            setPage(1);
          } else {
            setRefreshKey((key) => key + 1);
          }
          return;
        }
        if (requestError instanceof OdooApiError) {
          if (requestError.status === 401 || requestError.status === 403) {
            detailRequestRef.current?.abort();
            snapshotVersionRef.current = undefined;
            setExpandedInvoiceId(null);
            setDetail(null);
            setDetailLoading(false);
            setDetailError(false);
            setError(null);
            logout();
            return;
          }
          setError({ status: requestError.status, message: requestError.message });
          return;
        }
        setError({
          status: 503,
          message: requestError instanceof Error ? requestError.message : "讀取應收資料失敗。",
        });
      })
      .finally(() => {
        if (receivablesRequestRef.current === controller) {
          receivablesRequestRef.current = null;
        }
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
      if (receivablesRequestRef.current === controller) {
        receivablesRequestRef.current = null;
      }
    };
  }, [employee?.role, logout, page, refreshKey, status]);

  useEffect(() => {
    if (expandedInvoiceId === null || employee?.role !== "manager") {
      setDetail(null);
      setDetailLoading(false);
      setDetailError(false);
      return;
    }
    const controller = new AbortController();
    detailRequestRef.current = controller;
    setDetail(null);
    setDetailError(false);
    setDetailLoading(true);
    getReceivableDetail(expandedInvoiceId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setDetail(response);
      })
      .catch((detailRequestError: unknown) => {
        if (controller.signal.aborted) return;
        if (
          detailRequestError instanceof OdooApiError
          && (detailRequestError.status === 401 || detailRequestError.status === 403)
        ) {
          receivablesRequestRef.current?.abort();
          snapshotVersionRef.current = undefined;
          setData(null);
          setExpandedInvoiceId(null);
          setDetail(null);
          setDetailError(false);
          setError(null);
          logout();
          return;
        }
        setDetailError(true);
      })
      .finally(() => {
        if (detailRequestRef.current === controller) {
          detailRequestRef.current = null;
        }
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => {
      controller.abort();
      if (detailRequestRef.current === controller) {
        detailRequestRef.current = null;
      }
    };
  }, [employee?.role, expandedInvoiceId, logout]);

  if (employee?.role !== "manager") {
    return <Navigate to="/" replace />;
  }

  const startLoading = () => {
    setData(null);
    setExpandedInvoiceId(null);
    setError(null);
    setLoading(true);
  };

  const changeStatus = (nextStatus: ReceivablesStatus) => {
    if (nextStatus === status) return;
    startLoading();
    setStatus(nextStatus);
    setPage(1);
  };

  const changePage = (nextPage: number) => {
    if (nextPage < 1 || nextPage === page) return;
    startLoading();
    setPage(nextPage);
  };

  const refresh = () => {
    startLoading();
    snapshotVersionRef.current = undefined;
    forceRefreshRef.current = true;
    setRefreshKey((key) => key + 1);
  };

  const toggleInvoice = (invoiceId: number) => {
    setExpandedInvoiceId((current) => current === invoiceId ? null : invoiceId);
  };

  const firstVisibleRow = data && data.rows.length
    ? ((data.page - 1) * data.limit) + 1
    : 0;
  const lastVisibleRow = data && data.rows.length
    ? firstVisibleRow + data.rows.length - 1
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold">應收追數</h1>
              <p className="text-xs text-muted-foreground">Manager 專用 · Odoo 未清客戶發票</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex min-h-11 items-center gap-1.5 rounded-md border bg-background px-3 text-xs">
              <UserRound className="h-4 w-4" aria-hidden="true" />
              <span>{employee.name}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 gap-1.5 touch-manipulation"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              重新整理
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 gap-1.5 touch-manipulation"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> 返回 POS
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 gap-1.5 touch-manipulation"
              onClick={logout}
              aria-label={`登出 ${employee.name}`}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> 登出
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5" aria-busy={loading}>
        <Alert className="border-blue-200 bg-blue-50 text-blue-950">
          <AlertTriangle className="h-4 w-4 text-blue-700" aria-hidden="true" />
          <AlertTitle>追數工作清單，不等同正式應收帳報表</AlertTitle>
          <AlertDescription>
            此頁只協助跟進 Odoo 已過帳而仍有餘額的客戶發票。正式 Odoo Aged Receivable、退款、credit、匯率及會計 ageing 仍以 Odoo Accounting 為準。
          </AlertDescription>
        </Alert>

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="應收狀態篩選">
          {FILTERS.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              variant={status === filter.value ? "default" : "outline"}
              className="min-h-11 shrink-0 touch-manipulation"
              aria-pressed={status === filter.value}
              onClick={() => changeStatus(filter.value)}
              disabled={loading}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          分期發票可同時喺多個到期分類計算未清金額；列表會以最緊急一期作主要狀態。
        </p>

        {loading && (
          <section
            className="grid min-h-64 place-items-center rounded-xl border bg-card"
            role="status"
            aria-live="polite"
          >
            <div className="text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">正在取得最新應收資料...</p>
              <p className="mt-1 text-xs text-muted-foreground">更新期間不顯示舊 totals。</p>
            </div>
          </section>
        )}

        {!loading && error && (
          <section
            className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-8 text-center"
            role="alert"
          >
            <AlertTriangle className="mx-auto h-9 w-9 text-amber-700" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-semibold text-amber-950">
              {error.status === 403 ? "沒有權限查看應收追數" : "暫未能取得最新應收資料"}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-amber-900">
              {error.status === 403
                ? "Backend 已拒絕這次請求。請以 manager 帳戶重新登入。"
                : "Odoo 或 backend 暫時無法使用，請稍後再試。"}
            </p>
            <p className="mx-auto mt-2 max-w-xl text-xs text-amber-800">
              系統不會把舊資料、零值或不完整 totals 顯示為目前正式數字。
            </p>
            {error.status !== 403 && (
              <Button
                type="button"
                variant="outline"
                className="mt-5 min-h-11 gap-2 border-amber-400 bg-white touch-manipulation"
                onClick={refresh}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> 重試取得最新資料
              </Button>
            )}
          </section>
        )}

        {!loading && data && (
          <>
            <section aria-label="應收摘要" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <p>截至香港日期 {data.asOfDate}</p>
                <p>資料產生時間：{formatGeneratedAt(data.generatedAt)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <SummaryCard label="全部未清" amount={data.summary.openResidual} count={data.summary.openInvoiceCount} currency={data.summary.companyCurrency} />
                <SummaryCard label="已逾期" amount={data.summary.overdueResidual} count={data.summary.overdueInvoiceCount} currency={data.summary.companyCurrency} />
                <SummaryCard label="今日到期" amount={data.summary.dueTodayResidual} count={data.summary.dueTodayInvoiceCount} currency={data.summary.companyCurrency} />
                <SummaryCard label="未到期" amount={data.summary.notDueResidual} count={data.summary.notDueInvoiceCount} currency={data.summary.companyCurrency} />
                <SummaryCard label="未設付款期限" amount={data.summary.missingDueDateResidual} count={data.summary.missingDueDateInvoiceCount} currency={data.summary.companyCurrency} />
              </div>
            </section>

            <Card>
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-base">未清發票</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.rows.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <p className="font-medium">
                      {status === "all" ? "暫無未清發票" : "此篩選暫無發票"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      可重新整理以取得 Odoo 最新狀態。
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[190px]">客戶</TableHead>
                        <TableHead className="min-w-[170px]">發票</TableHead>
                        <TableHead className="min-w-[160px]">付款條款</TableHead>
                        <TableHead className="min-w-[140px] text-right">未清餘額</TableHead>
                        <TableHead className="min-w-[210px]">到期日／狀態</TableHead>
                        <TableHead className="w-14"><span className="sr-only">詳情</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((row) => {
                        const expanded = expandedInvoiceId === row.id;
                        return (
                          <Fragment key={row.id}>
                            <TableRow
                              className="hover:bg-muted/40"
                            >
                              <TableCell className="font-medium">{row.customerName}</TableCell>
                              <TableCell>
                                <div className="font-mono text-sm">{row.invoiceNumber}</div>
                                <div className="text-xs text-muted-foreground">{row.invoiceDate}</div>
                              </TableCell>
                              <TableCell>{row.paymentTerm || "未設定"}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {formatMoney(row.amountResidual, row.currency)}
                                <div className="text-xs font-normal text-muted-foreground">
                                  {row.reconciliationStatus === "partially_reconciled" ? "部分核銷" : "未核銷"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>{row.dueDate || "未設定"}</div>
                                <Badge
                                  variant="outline"
                                  className={`mt-1 whitespace-nowrap ${statusBadgeClass(row.status)}`}
                                >
                                  {statusText(row)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="min-h-11 min-w-11 touch-manipulation"
                                  aria-label={`${expanded ? "收起" : "展開"}發票 ${row.invoiceNumber} 詳情`}
                                  aria-expanded={expanded}
                                  aria-controls={`receivable-detail-${row.id}`}
                                  onClick={() => toggleInvoice(row.id)}
                                >
                                  {expanded
                                    ? <ChevronDown className="h-4 w-4" aria-hidden="true" />
                                    : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                                </Button>
                              </TableCell>
                            </TableRow>
                            {expanded && (
                              <TableRow id={`receivable-detail-${row.id}`} className="bg-muted/30 hover:bg-muted/30">
                                <TableCell colSpan={6} className="px-5 py-4">
                                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <DetailItem label="公司" children={detailLoading ? "載入中..." : detail?.customerCompany || (detailError ? "暫時無法讀取" : "-")} />
                                    <DetailItem label="電話" children={detailLoading ? "載入中..." : detail?.customerPhone || (detailError ? "暫時無法讀取" : "-")} />
                                    <DetailItem label="電郵" children={detailLoading ? "載入中..." : detail?.customerEmail || (detailError ? "暫時無法讀取" : "-")} />
                                    <DetailItem label="Salesperson" children={row.salesperson || "-"} />
                                    <DetailItem label="發票編號" children={row.invoiceNumber} />
                                    <DetailItem label="發票參考" children={row.reference || "-"} />
                                    <DetailItem label="來源訂單" children={row.origin || "-"} />
                                    <DetailItem label="發票總額" children={formatMoney(row.amountTotal, row.currency)} />
                                    <DetailItem label="已核銷金額" children={formatMoney(row.amountReconciled, row.currency)} />
                                    <DetailItem label="未清餘額" children={formatMoney(row.amountResidual, row.currency)} />
                                    <DetailItem label="逾期部分" children={formatMoney(row.overdueResidual, data.summary.companyCurrency)} />
                                    <DetailItem label="今日到期部分" children={formatMoney(row.dueTodayResidual, data.summary.companyCurrency)} />
                                    <DetailItem label="未到期部分" children={formatMoney(row.notDueResidual, data.summary.companyCurrency)} />
                                    <DetailItem label="未設期限部分" children={formatMoney(row.missingDueDateResidual, data.summary.companyCurrency)} />
                                  </dl>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="應收發票分頁">
              <p className="text-sm text-muted-foreground">
                第 {data.page} 頁 · 顯示 {firstVisibleRow}–{lastVisibleRow}／共 {data.totalRows} 張
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 touch-manipulation"
                  onClick={() => changePage(data.page - 1)}
                  disabled={data.page <= 1}
                >
                  上一頁
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 touch-manipulation"
                  onClick={() => changePage(data.page + 1)}
                  disabled={!data.hasMore}
                >
                  下一頁
                </Button>
              </div>
            </nav>
          </>
        )}
      </main>
    </div>
  );
};

export default ReceivablesDashboard;
