import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  CloudCog,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { usePosAuth } from "@/components/auth/PosAuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getSyncErrorCenter,
  hasOdooBackend,
  OdooApiError,
  recoverOperationalOrder,
  retryOperationalOrder,
  type SyncErrorCenterOrder,
  type SyncErrorCenterResponse,
  type SyncErrorStage,
} from "@/lib/odoo-api";


type ErrorFilter = "all" | "pending_odoo" | "syncing" | "needs_review";

const FILTERS: Array<{ value: ErrorFilter; label: string }> = [
  { value: "all", label: "全部未解決" },
  { value: "pending_odoo", label: "等待自動同步" },
  { value: "syncing", label: "同步中" },
  { value: "needs_review", label: "需人工處理" },
];

const STAGE_LABELS: Record<SyncErrorStage, string> = {
  order_validation: "訂單資料驗證",
  sales_assignment: "銷售員／Sales Team",
  customer: "客戶資料",
  recipient: "收件人配對",
  recipient_important_dates: "收件人重要日子",
  long_term_notes: "長期備註",
  delivery: "送貨資料",
  odoo_connection: "Odoo 連線／Worker",
  odoo_order: "Odoo 訂單建立",
  unknown: "尚待技術核對",
};

const STATUS_LABELS: Record<SyncErrorCenterOrder["syncState"], string> = {
  pending_odoo: "等待自動同步",
  syncing: "同步中",
  needs_review: "需人工處理",
};

const formatHongKongDateTime = (value: string | null): string => {
  if (!value) return "未有記錄";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hong_Kong",
  }).format(date);
};

const formatMoney = (minor: number): string => new Intl.NumberFormat("zh-HK", {
  style: "currency",
  currency: "HKD",
  currencyDisplay: "narrowSymbol",
}).format(minor / 100);

const waitingDuration = (value: string | null): string => {
  if (!value) return "0 分鐘";
  const started = Date.parse(value);
  if (!Number.isFinite(started)) return "未能計算";
  const minutes = Math.max(0, Math.floor((Date.now() - started) / 60_000));
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時 ${minutes % 60} 分鐘`;
  return `${Math.floor(hours / 24)} 日 ${hours % 24} 小時`;
};

const statusClass = (status: SyncErrorCenterOrder["syncState"]): string => {
  if (status === "needs_review") return "border-red-300 bg-red-50 text-red-800";
  if (status === "syncing") return "border-blue-300 bg-blue-50 text-blue-800";
  return "border-amber-300 bg-amber-50 text-amber-900";
};

const workerLabel = (data: SyncErrorCenterResponse): string => {
  if (data.worker.status === "running") return "Worker 正在運行";
  if (data.worker.status === "succeeded") return "Worker 上次正常完成";
  if (data.worker.status === "failed") return "Worker 上次運行失敗";
  return "未有 Worker 健康記錄";
};

const SummaryCard = ({ label, value, hint }: { label: string; value: string; hint: string }) => (
  <Card>
    <CardHeader className="p-4 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
    </CardHeader>
    <CardContent className="p-4 pt-0">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </CardContent>
  </Card>
);

const SyncErrorCenter = () => {
  const navigate = useNavigate();
  const { employee, logout } = usePosAuth();
  const [data, setData] = useState<SyncErrorCenterResponse | null>(null);
  const dataRef = useRef<SyncErrorCenterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [stale, setStale] = useState(false);
  const [filter, setFilter] = useState<ErrorFilter>("all");
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [retryTarget, setRetryTarget] = useState<SyncErrorCenterOrder | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    if (employee?.role !== "manager") return;
    let active = true;
    let timer: number | undefined;
    let controller: AbortController | null = null;

    const load = async (initial: boolean) => {
      controller?.abort();
      controller = new AbortController();
      if (initial) setLoading(true);
      try {
        if (!hasOdooBackend) throw new OdooApiError("未設定 Odoo backend。", 503);
        const response = await getSyncErrorCenter(controller.signal);
        if (!active || controller.signal.aborted) return;
        setData(response);
        dataRef.current = response;
        setError(null);
        setStale(false);
      } catch (requestError) {
        if (!active || controller.signal.aborted) return;
        const status = requestError instanceof OdooApiError ? requestError.status : 503;
        if (status === 401) {
          logout();
          return;
        }
        setError({
          status,
          message: requestError instanceof Error
            ? requestError.message
            : "暫時未能載入同步錯誤。",
        });
        setStale(Boolean(dataRef.current));
      } finally {
        if (active) {
          setLoading(false);
          timer = window.setTimeout(() => void load(false), 15_000);
        }
      }
    };

    void load(true);
    return () => {
      active = false;
      controller?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [employee?.role, logout, refreshKey]);

  const visibleOrders = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLocaleLowerCase("zh-HK");
    return data.orders.filter((order) => {
      if (filter !== "all" && order.syncState !== filter) return false;
      if (!normalized) return true;
      return [
        order.traceId,
        order.posReference,
        order.customerName,
        order.salespersonLabel || "",
        order.diagnostic.title,
        order.diagnostic.code,
        STAGE_LABELS[order.diagnostic.stage],
      ].some((value) => value.toLocaleLowerCase("zh-HK").includes(normalized));
    });
  }, [data, filter, query]);

  const refresh = () => setRefreshKey((value) => value + 1);

  const retry = async () => {
    if (!retryTarget || retryingId) return;
    const target = retryTarget;
    setRetryTarget(null);
    setRetryingId(target.operationalOrderId);
    try {
      const recovery = target.syncState === "needs_review";
      const result = recovery
        ? await recoverOperationalOrder(target.operationalOrderId)
        : await retryOperationalOrder(target.operationalOrderId);
      if (result.syncState === "synced") {
        toast.success(recovery ? "舊單已成功修復並同步" : "已完成手動重試", {
          description: result.odooOrderName
            ? `${target.traceId} → ${result.odooOrderName}`
            : `${target.traceId} 已同步到 Odoo。`,
        });
      } else if (result.syncState === "pending_odoo") {
        toast.warning("Odoo 暫時未能完成同步", {
          description: `${target.traceId} 已保留並交畀系統自動重試。`,
        });
      } else {
        toast.error("修復後仍需人工核對", {
          description: `${target.traceId} 已用最新版本重試，請按新原因處理。`,
        });
      }
      refresh();
    } catch (retryError) {
      toast.error("重試未完成", {
        description: retryError instanceof Error
          ? retryError.message
          : `請用 ${target.traceId} 核對。`,
      });
    } finally {
      setRetryingId(null);
    }
  };

  const copyTrace = async (traceId: string) => {
    try {
      await navigator.clipboard.writeText(traceId);
      toast.success("已複製追蹤編號", { description: traceId });
    } catch {
      toast.error("未能自動複製", { description: `請手動記錄：${traceId}` });
    }
  };

  if (employee?.role !== "manager") return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold">同步錯誤中心</h1>
              <p className="text-xs text-muted-foreground">Manager 專用 · 定位 POS → Odoo 同步問題</p>
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
          <CloudCog className="h-4 w-4 text-blue-700" aria-hidden="true" />
          <AlertTitle>每張錯誤都有失敗位置、原因、處理方法同追蹤編號</AlertTitle>
          <AlertDescription>
            呢度只顯示仍未完成 Odoo 同步嘅訂單。請先按建議處理；需要技術協助時，提供 SYNC 開頭嘅追蹤編號即可對照 runtime logs。
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>{stale ? "未能更新，現正顯示上次資料" : "暫時未能載入同步錯誤"}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {data && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="同步錯誤摘要">
              <SummaryCard
                label="全部未解決"
                value={String(data.summary.unresolvedCount)}
                hint={`訂單值 ${formatMoney(data.summary.unresolvedValueMinor)}（唔等同營業額）`}
              />
              <SummaryCard
                label="等待／同步中"
                value={String(data.summary.pendingCount + data.summary.syncingCount)}
                hint={`等待 ${data.summary.pendingCount} · 同步中 ${data.summary.syncingCount}`}
              />
              <SummaryCard
                label="需人工處理"
                value={String(data.summary.needsReviewCount)}
                hint="需要按畫面建議修正資料"
              />
              <SummaryCard
                label="最舊等待時間"
                value={waitingDuration(data.summary.oldestAcceptedAt)}
                hint={formatHongKongDateTime(data.summary.oldestAcceptedAt)}
              />
            </section>

            <Card className={data.worker.status === "failed" ? "border-red-300" : ""}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-start gap-3">
                  {data.worker.status === "succeeded" ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Clock3 className="mt-0.5 h-5 w-5 text-amber-600" aria-hidden="true" />
                  )}
                  <div>
                    <p className="font-semibold">{workerLabel(data)}</p>
                    <p className="text-xs text-muted-foreground">
                      最後成功：{formatHongKongDateTime(data.worker.lastSuccessAt)} ·
                      上次同步 {data.worker.lastSynced} 張 · 待重試 {data.worker.lastRetried} 張 ·
                      需核對 {data.worker.lastNeedsReview} 張
                    </p>
                  </div>
                </div>
                <Badge variant="outline">資料更新：{formatHongKongDateTime(data.generatedAt)}</Badge>
              </CardContent>
            </Card>

            <section className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-2 overflow-x-auto pb-1" aria-label="同步錯誤狀態篩選">
                  {FILTERS.map((item) => (
                    <Button
                      key={item.value}
                      type="button"
                      variant={filter === item.value ? "default" : "outline"}
                      className="min-h-11 shrink-0 touch-manipulation"
                      aria-pressed={filter === item.value}
                      onClick={() => setFilter(item.value)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
                <div className="relative w-full lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="搜尋同步錯誤"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜尋追蹤編號、訂單、客戶或原因"
                    className="min-h-11 pl-9"
                  />
                </div>
              </div>

              {data.truncated && (
                <p role="alert" className="text-sm text-amber-800">
                  未解決訂單超過 500 張；摘要係完整數字，列表只顯示最舊 500 張。
                </p>
              )}

              {visibleOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-10 text-center text-muted-foreground">
                    {data.orders.length === 0
                      ? "目前冇未解決嘅 Odoo 同步錯誤。"
                      : "冇符合目前篩選或搜尋條件嘅錯誤。"}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {visibleOrders.map((order) => (
                    <Card key={order.operationalOrderId} className={order.syncState === "needs_review" ? "border-red-200" : ""}>
                      <CardContent className="space-y-4 p-4">
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={statusClass(order.syncState)}>
                                {STATUS_LABELS[order.syncState]}
                              </Badge>
                              <span className="font-semibold">{order.customerName}</span>
                              <span className="font-mono text-sm text-muted-foreground">{order.posReference}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              接納：{formatHongKongDateTime(order.acceptedAt)} ·
                              更新：{formatHongKongDateTime(order.updatedAt)} ·
                              已嘗試 {order.attemptCount} 次
                            </p>
                          </div>
                          <p className="text-lg font-bold tabular-nums">{formatMoney(order.amountTotalMinor)}</p>
                        </div>

                        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[180px_minmax(0,1fr)]">
                          <div>
                            <p className="text-xs text-muted-foreground">失敗位置</p>
                            <p className="font-semibold">{STAGE_LABELS[order.diagnostic.stage]}</p>
                            <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                              {order.diagnostic.code}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <p className="font-semibold">{order.diagnostic.title}</p>
                              <p className="text-sm text-muted-foreground">原因：{order.diagnostic.reason}</p>
                            </div>
                            <p className="text-sm"><span className="font-semibold">建議處理：</span>{order.diagnostic.action}</p>
                          </div>
                        </div>

                        <div className="flex flex-col justify-between gap-3 border-t pt-3 sm:flex-row sm:items-center">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-muted-foreground">追蹤編號</span>
                            <code className="rounded bg-muted px-2 py-1 font-semibold">{order.traceId}</code>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="min-h-11 gap-1 touch-manipulation"
                              onClick={() => void copyTrace(order.traceId)}
                            >
                              <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" /> 複製
                            </Button>
                            {order.salespersonLabel && <span>負責銷售：{order.salespersonLabel}</span>}
                          </div>
                          {order.syncState === "pending_odoo" && (
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11 gap-2 touch-manipulation"
                              disabled={!order.retryEligible || Boolean(retryingId)}
                              onClick={() => setRetryTarget(order)}
                            >
                              {retryingId === order.operationalOrderId
                                ? <LoaderCircle className="h-4 w-4 animate-spin" />
                                : <RefreshCw className="h-4 w-4" />}
                              {order.retryEligible ? "立即重試" : "等候自動重試時間"}
                            </Button>
                          )}
                          {order.syncState === "needs_review" && (
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11 gap-2 touch-manipulation"
                              disabled={Boolean(retryingId)}
                              onClick={() => setRetryTarget(order)}
                            >
                              {retryingId === order.operationalOrderId
                                ? <LoaderCircle className="h-4 w-4 animate-spin" />
                                : <RefreshCw className="h-4 w-4" />}
                              用修正版重試
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {!data && loading && (
          <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            正在載入同步錯誤中心…
          </div>
        )}
      </main>

      <AlertDialog open={Boolean(retryTarget)} onOpenChange={(open) => !open && setRetryTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {retryTarget?.syncState === "needs_review"
                ? "確認用修正版重試呢一張舊單？"
                : "確認重試呢一張訂單？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              系統只會重試 {retryTarget?.traceId}（{retryTarget?.posReference}），唔會批量重試其他訂單。
              {retryTarget?.syncState === "needs_review" && (
                " 會保留原 checkout UUID、先檢查 Odoo 有冇同一張單，再用目前收件人及重要日子修復邏輯處理。"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void retry()}>
              {retryTarget?.syncState === "needs_review" ? "確認修復重試" : "確認重試"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SyncErrorCenter;
