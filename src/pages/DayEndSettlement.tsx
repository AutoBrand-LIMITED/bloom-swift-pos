import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Calculator, LogOut, Printer, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDayEndMoney } from "@/lib/day-end";
import { getDayEndSummary, hasOdooBackend, type DayEndOrderRow, type DayEndPaymentBucket, type DayEndSummary } from "@/lib/odoo-api";
import { usePosAuth } from "@/components/auth/PosAuthContext";

const todayString = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });
const initialDateString = () => new URLSearchParams(window.location.search).get("date") || todayString();

const statusLabel: Record<string, string> = {
  paid: "已付",
  unpaid: "未付",
  deposit: "訂金",
};

const DayEndSettlement = () => {
  const navigate = useNavigate();
  const { employee, logout } = usePosAuth();
  const [date, setDate] = useState(initialDateString);
  const [summary, setSummary] = useState<DayEndSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback((signal?: AbortSignal) => {
    if (!hasOdooBackend) {
      setSummary(null);
      setError("未設定 Odoo backend，無法讀取日結資料。");
      return;
    }

    setLoading(true);
    setError(null);
    getDayEndSummary(date, signal)
      .then(setSummary)
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        setSummary(null);
        setError(err instanceof Error ? err.message : "讀取日結失敗");
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [date]);

  useEffect(() => {
    const controller = new AbortController();
    loadSummary(controller.signal);
    return () => controller.abort();
  }, [loadSummary]);

  const nonZeroBuckets = useMemo(
    () => summary?.salesToday.buckets.filter((bucket) => bucket.amount || bucket.orderCount) ?? [],
    [summary],
  );

  return (
    <div className="day-end-page min-h-screen bg-background">
      <header className="day-end-header sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-lg font-bold">每日埋數</h1>
              <p className="text-xs text-muted-foreground">Odoo staging 訂單核對，不寫入正式會計紀錄</p>
            </div>
          </div>
          <div className="day-end-controls flex flex-wrap items-center gap-2">
            {employee && (
              <div className="flex min-h-11 items-center gap-1.5 rounded-md border bg-background px-3 text-xs">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                <span>{employee.name}</span>
              </div>
            )}
            <Input
              aria-label="日結日期"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-9 w-[150px]"
            />
            <Button variant="outline" size="sm" onClick={() => loadSummary()} disabled={loading} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> 重新整理
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!summary} className="gap-1.5">
              <Printer className="w-3.5 h-3.5" /> 列印埋數表
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> 返回 POS
            </Button>
            {employee && (
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="min-h-11 gap-1.5 touch-manipulation"
                aria-label={`登出 ${employee.name}`}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" /> 登出
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="day-end-main max-w-7xl mx-auto px-4 py-5 space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {summary ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard label="Order qty" value={summary.salesToday.orderCount.toString()} />
              <MetricCard label="Sales today" value={formatDayEndMoney(summary.salesToday.saleTotal)} />
              <MetricCard label="Money received" value={formatDayEndMoney(summary.totalMoneyReceived)} />
              <MetricCard label="Avg spend" value={formatDayEndMoney(summary.salesToday.averageSpend)} />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">付款方式總覽</CardTitle>
              </CardHeader>
              <CardContent>
                <BucketGrid buckets={summary.salesToday.buckets} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">A. 今日營業額 Sales Today</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <OrderTable orders={summary.salesToday.orders} />
                <div className="flex flex-wrap justify-end gap-4 border-t pt-3 text-sm">
                  <span>訂單數：<strong>{summary.salesToday.orderCount}</strong></span>
                  <span>銷售額：<strong>{formatDayEndMoney(summary.salesToday.saleTotal)}</strong></span>
                  <span>今日收款：<strong>{formatDayEndMoney(summary.salesToday.receivedTotal)}</strong></span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">B. 今日收錢，非今日落單</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.receivedForOtherDays.unsupportedReason ? (
                  <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm text-muted-foreground">
                    {summary.receivedForOtherDays.unsupportedReason}
                  </div>
                ) : (
                  <OrderTable orders={summary.receivedForOtherDays.orders} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">C. Total Money A+B</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Input by</Label>
                  <Input placeholder="負責輸入同事名" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Check by</Label>
                  <Input placeholder="負責覆核同事名" />
                </div>
                <div className="rounded-lg border bg-primary/5 px-4 py-3 text-right">
                  <p className="text-xs text-muted-foreground">總收款</p>
                  <p className="text-xl font-bold font-mono">{formatDayEndMoney(summary.totalMoneyReceived)}</p>
                </div>
              </CardContent>
            </Card>

            {nonZeroBuckets.some((bucket) => bucket.key === "unmapped") && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-muted-foreground">
                有付款方式未分類。請先檢查付款方法設定，否則正式埋數時會有欄位對唔齊。
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            {loading ? "讀取 Odoo 日結資料中..." : "未有日結資料"}
          </div>
        )}
      </main>
    </div>
  );
};

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold font-mono mt-1">{value}</p>
    </CardContent>
  </Card>
);

const BucketGrid = ({ buckets }: { buckets: DayEndPaymentBucket[] }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
    {buckets.map((bucket) => (
      <div key={bucket.key} className="rounded-lg border bg-secondary/40 p-3 min-h-[82px]">
        <p className="text-xs text-muted-foreground">{bucket.label}</p>
        <p className="mt-2 text-lg font-bold font-mono">{formatDayEndMoney(bucket.amount)}</p>
        <p className="text-[11px] text-muted-foreground">{bucket.orderCount} 張單</p>
      </div>
    ))}
  </div>
);

export const OrderTable = ({ orders }: { orders: DayEndOrderRow[] }) => {
  if (!orders.length) {
    return <p className="text-sm text-muted-foreground">沒有記錄</p>;
  }

  return (
    <Table className="day-end-order-table">
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[120px]">SO#</TableHead>
          <TableHead className="min-w-[135px]">時間</TableHead>
          <TableHead className="min-w-[180px]">客戶</TableHead>
          <TableHead className="min-w-[180px]">落單員工／Sales</TableHead>
          <TableHead className="min-w-[120px]">付款</TableHead>
          <TableHead className="text-right min-w-[120px]">銷售額</TableHead>
          <TableHead className="text-right min-w-[120px]">今日收款</TableHead>
          <TableHead className="min-w-[160px]">收貨人</TableHead>
          <TableHead className="min-w-[240px]">地址 / Remarks</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-mono">
              <div>{order.invoiceReference || order.orderName}</div>
              <div className="text-xs text-muted-foreground">{order.orderName}</div>
            </TableCell>
            <TableCell className="font-mono text-xs">{order.dateOrder}</TableCell>
            <TableCell>{order.customerName}</TableCell>
            <TableCell>{order.salesperson || "-"}</TableCell>
            <TableCell>
              <div>{statusLabel[order.paymentStatus] || order.paymentStatus}</div>
              <div className="text-xs text-muted-foreground">{order.paymentMethod || "未分類"}</div>
            </TableCell>
            <TableCell className="text-right font-mono">{formatDayEndMoney(order.saleTotal)}</TableCell>
            <TableCell className="text-right font-mono">{formatDayEndMoney(order.receivedToday)}</TableCell>
            <TableCell>
              {order.recipientCompanyName && (
                <div>{order.recipientCompanyName}</div>
              )}
              <div>{order.recipientName || "-"}</div>
              <div className="text-xs text-muted-foreground">{order.recipientPhone || ""}</div>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              <div>{order.deliveryAddress || "-"}</div>
              {order.remarks && <div className="mt-1">{order.remarks}</div>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default DayEndSettlement;
