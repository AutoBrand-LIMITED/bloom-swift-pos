import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CalendarDays, ClipboardList, LoaderCircle, Pencil, RefreshCw, Search, X } from "lucide-react";
import PrintButtons from "@/components/pos/PrintButtons";
import OrderEditDialog from "@/components/pos/OrderEditDialog";
import type { PaymentStatus } from "@/types/order";
import { orderItemTotal } from "@/lib/order-pricing";
import type { OrderRecordView } from "@/lib/order-records";

interface OrderHistoryProps {
  orders: OrderRecordView[];
  open: boolean;
  onClose: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  loading?: boolean;
  loaded?: boolean;
  searchPhase?: "idle" | "too_short" | "debouncing" | "searching" | "success" | "error";
  error?: string | null;
  stale?: boolean;
  truncated?: boolean;
  onRetry?: () => void;
  onOrderUpdated?: () => void;
}

const statusBadge: Record<PaymentStatus, { label: string; variant: "destructive" | "default" | "secondary" }> = {
  unpaid: { label: "未付款", variant: "destructive" },
  paid: { label: "已付款", variant: "default" },
  deposit: { label: "已付訂金", variant: "secondary" },
};

const OrderHistory = ({
  orders,
  open,
  onClose,
  searchQuery = "",
  onSearchQueryChange,
  loading = false,
  loaded = true,
  searchPhase = "idle",
  error,
  stale = false,
  truncated = false,
  onRetry,
  onOrderUpdated,
}: OrderHistoryProps) => {
  const [editingOrder, setEditingOrder] = useState<OrderRecordView | null>(null);
  if (!open) return null;
  const normalizedSearch = searchQuery.trim();
  const searchNeedsMoreInput = normalizedSearch.length > 0 && normalizedSearch.length < 2;
  const searchActive = normalizedSearch.length >= 2;
  const searchSettled = searchActive && searchPhase === "success";
  const showOrderCount = !searchActive || searchSettled;

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex justify-end" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-hidden bg-card border-l border-border animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            訂單記錄{showOrderCount ? ` (${orders.length})` : ""}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="關閉訂單記錄">
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="shrink-0 space-y-1.5 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="搜尋訂單"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange?.(event.target.value)}
              placeholder="搜尋電郵、電話、下單人、地址或收貨人"
              className="min-h-11 pl-9 pr-11 text-sm"
              maxLength={200}
              autoComplete="off"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="清除訂單搜尋"
                className="absolute right-0 top-0 min-h-11 min-w-11"
                onClick={() => onSearchQueryChange?.("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {searchNeedsMoreInput
              ? "請輸入至少 2 個字元"
              : searchActive
                ? searchPhase === "debouncing"
                  ? "等待搜尋當前資料..."
                  : searchPhase === "searching"
                    ? "正在搜尋當前資料..."
                    : searchSettled
                      ? `跨日期搜尋結果：${orders.length} 筆`
                      : searchPhase === "error"
                        ? "搜尋未完成，請重試"
                        : "準備搜尋..."
                : "留空會顯示今日訂單；搜尋會跨日期查找。"}
          </p>
        </div>
        <ScrollArea className="min-h-0 flex-1" data-testid="order-history-scroll-area">
          {(loading || error || truncated) && (
            <div className="border-b border-border p-3 space-y-2">
              {loading && (
                <p aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {searchActive ? "正在 Odoo 搜尋訂單" : "正在從 Odoo 載入今日訂單記錄"}
                </p>
              )}
              {error && (
                <div role="alert" className="flex items-start justify-between gap-3 text-xs text-destructive">
                  <p className="flex items-start gap-1.5">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {stale
                      ? "Odoo 更新失敗，暫時顯示上次成功載入嘅資料。"
                      : searchActive
                        ? "未能完成 Odoo 訂單搜尋。"
                        : "未能從 Odoo 載入完整訂單記錄。"}
                  </p>
                  {onRetry && (
                    <Button variant="outline" size="sm" className="min-h-9 shrink-0 gap-1" onClick={onRetry}>
                      <RefreshCw className="h-3.5 w-3.5" /> 重試
                    </Button>
                  )}
                </div>
              )}
              {truncated && (
                <p className="text-xs text-amber-700">
                  {searchActive
                    ? "搜尋結果超過顯示上限，請輸入更完整資料收窄結果。"
                    : "當日訂單超過顯示上限，完整記錄請到 Odoo 查看。"}
                </p>
              )}
            </div>
          )}
          {searchActive && !searchSettled ? (
            searchPhase === "error" ? null : (
              <p aria-live="polite" className="text-center text-muted-foreground p-8">
                {searchPhase === "debouncing" ? "等待搜尋當前資料..." : "正在搜尋當前資料..."}
              </p>
            )
          ) : orders.length === 0 && !loaded ? (
            loading ? null : (
              <p className="text-center text-muted-foreground p-8">
                未能確認 Odoo 訂單記錄，請重試
              </p>
            )
          ) : orders.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">
              {searchNeedsMoreInput
                ? "請輸入至少 2 個字元開始搜尋"
                : searchActive
                  ? "未找到符合資料的訂單"
                  : "今日暫無訂單"}
            </p>
          ) : (
            <div className="p-4 space-y-3">
              {orders.map((order) => {
                const badge = statusBadge[order.paymentStatus];
                const deliveryTimeLabel = order.deliveryTimeMode === "specified"
                  ? `指定時間：${order.deliveryTime || "未指定"}`
                  : order.deliveryTime || "未指定時段";
                const businessDetails = [
                  ["落單員工", order.salesId],
                  ["公司名稱", order.companyName],
                  ["送花人", order.senderName],
                  ["收貨公司", order.recipientCompanyName],
                  ["收花聯絡人", order.recipientName],
                  ["收花電話", order.recipientPhone],
                  ["送貨地址", order.deliveryAddress],
                  ["客戶電郵", order.customerEmail],
                  ["帳單地址", order.billingAddress],
                  ["客戶群組", order.customerGroup],
                  ["部門", order.department],
                ].filter((detail): detail is [string, string] => Boolean(detail[1]?.trim()));
                return (
                  <div
                    key={order.id}
                    role="group"
                    aria-label={`訂單 ${order.odooOrderName || order.id} ${order.customerName || order.phone}`}
                    className={`rounded-lg border p-3 space-y-2 ${
                      order.paymentStatus === "unpaid" ? "border-destructive/40 bg-destructive/5" : "border-border"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{order.customerName || order.phone}</p>
                        <p className="text-xs text-muted-foreground font-mono">{order.phone}</p>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p className="flex items-center gap-1.5 font-medium text-foreground">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        送貨：{order.deliveryDate || "未指定日期"} · {deliveryTimeLabel}
                      </p>
                      {order.items.map((item) => (
                        <div key={item.id}>
                          <p>{item.name} × {item.quantity} = ${orderItemTotal(item).toLocaleString()}</p>
                          {(item.packing || item.remarks) && (
                            <p className="pl-2 text-[11px]">
                              {[
                                item.packing ? `包裝：${item.packing}` : "",
                                item.remarks ? `備註：${item.remarks}` : "",
                              ].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    {businessDetails.length > 0 && (
                      <details className="rounded-md border border-border bg-muted/25 px-2.5 py-2 text-xs">
                        <summary className="min-h-6 cursor-pointer font-medium text-foreground">
                          業務詳情
                        </summary>
                        <dl className="mt-2 space-y-1.5">
                          {businessDetails.map(([label, value]) => (
                            <div key={label} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                              <dt className="text-muted-foreground">{label}</dt>
                              <dd className="whitespace-pre-wrap break-words text-foreground">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    )}
                    <div className="flex justify-between items-center pt-1 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString("zh-HK")}
                      </span>
                      <span className="font-mono font-bold text-sm">${order.finalPrice.toLocaleString()}</span>
                    </div>
                    {order.source === "local" && (
                      <p className="text-[11px] font-medium text-amber-700">
                        {order.syncState === "pending_confirmation"
                          ? "等待確認 Odoo 同步結果"
                          : "只儲存在本機，尚未同步 Odoo"}
                      </p>
                    )}
                    {order.source === "operational" && (
                      <p className={`text-[11px] font-medium ${
                        order.syncState === "needs_review" ? "text-destructive" : "text-amber-700"
                      }`}>
                        {order.syncState === "pending_odoo"
                          ? "已安全保存，等候 Odoo 自動同步"
                          : order.syncState === "syncing"
                            ? "Odoo 同步處理中"
                          : order.syncState === "needs_review"
                            ? order.operationalReviewError || "訂單需要管理員核對"
                            : "已同步 Odoo，正在更新訂單記錄"}
                      </p>
                    )}
                    {order.source === "odoo"
                      && order.odooOrderId
                      && order.writeDate
                      && order.deliveryTimeMode && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 w-full gap-2 touch-manipulation"
                          onClick={() => setEditingOrder(order)}
                        >
                          <Pencil className="h-4 w-4" /> 編輯訂單資料
                        </Button>
                    )}
                    <PrintButtons order={order} />
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <OrderEditDialog
          order={editingOrder}
          open={Boolean(editingOrder)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingOrder(null);
          }}
          onSaved={() => onOrderUpdated?.()}
        />
      </div>
    </div>
  );
};

export default OrderHistory;
