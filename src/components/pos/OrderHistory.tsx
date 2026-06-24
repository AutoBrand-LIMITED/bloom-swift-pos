import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, X, ShieldAlert, Truck, Search, Pencil, RefreshCw, Calendar } from "lucide-react";
import PrintButtons from "@/components/pos/PrintButtons";
import type { Order, PaymentStatus } from "@/types/order";
import { SALES_STAFF } from "@/types/order";
import { useLanguage } from "@/contexts/LanguageContext";

function isDispatchBlocked(order: Order): boolean {
  if (order.paymentStatus !== "unpaid") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = (order.deliveries?.map(d => d.deliveryDate).filter(Boolean) ?? []);
  if (dates.length === 0 && order.deliveryDate) dates.push(order.deliveryDate);
  return dates.some(date => new Date(date) <= today);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

interface OrderHistoryProps {
  orders: Order[];
  open: boolean;
  onClose: () => void;
  onEdit?: (order: Order) => void;
  onReorder?: (order: Order) => void;
}

const STATUS_STYLES: Record<PaymentStatus, string> = {
  unpaid: "bg-red-50 text-red-700 border border-red-200",
  paid: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  deposit: "bg-amber-50 text-amber-700 border border-amber-200",
};

const OrderHistory = ({ orders, open, onClose, onEdit, onReorder }: OrderHistoryProps) => {
  const { t } = useLanguage();
  const [searchText, setSearchText] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (staffFilter !== "all") {
      result = result.filter(o => o.salesId === staffFilter);
    }

    if (periodFilter !== "all") {
      const cutoff = periodFilter === "today"
        ? new Date().toISOString().slice(0, 10)
        : periodFilter === "last7"
        ? daysAgo(7)
        : daysAgo(30);
      result = result.filter(o => {
        const date = (o.createdAt || "").slice(0, 10);
        return periodFilter === "today" ? date === cutoff : date >= cutoff;
      });
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(o =>
        o.customerName?.toLowerCase().includes(q) ||
        o.phone?.includes(q) ||
        o.recipientName?.toLowerCase().includes(q) ||
        o.deliveries?.some(d =>
          d.recipientName?.toLowerCase().includes(q) || d.recipientPhone?.includes(q)
        )
      );
    }

    return result;
  }, [orders, staffFilter, periodFilter, searchText]);

  const driverGroups = useMemo(() => {
    const sorted = [...filteredOrders].sort((a, b) => {
      const da = a.deliveryDate || "";
      const db = b.deliveryDate || "";
      if (da !== db) return da.localeCompare(db);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const groups: Record<string, Order[]> = {};
    for (const order of sorted) {
      const driver = order.deliveryPerson?.trim() || "未分配";
      if (!groups[driver]) groups[driver] = [];
      groups[driver].push(order);
    }

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "未分配") return 1;
      if (b === "未分配") return -1;
      return a.localeCompare(b);
    });
  }, [filteredOrders]);

  const hasFilters = staffFilter !== "all" || periodFilter !== "all" || searchText.trim() !== "";
  const blockedCount = orders.filter(isDispatchBlocked).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border-l border-border h-full animate-in slide-in-from-right duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              {t("panel_order_history")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
              {filteredOrders.length} / {orders.length}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="px-4 pt-3 pb-3 space-y-2 shrink-0 border-b border-border bg-muted/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder={t("placeholder_search_history")}
              className="pl-8 h-9 text-sm bg-card"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                aria-label={t("btn_clear_search")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="h-8 text-xs flex-1 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("label_all_staff")}</SelectItem>
                {SALES_STAFF.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="h-8 text-xs flex-1 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filter_all")}</SelectItem>
                <SelectItem value="today">{t("filter_today")}</SelectItem>
                <SelectItem value="last7">{t("filter_last7")}</SelectItem>
                <SelectItem value="last30">{t("filter_last30")}</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs px-2 text-muted-foreground shrink-0"
                onClick={() => { setSearchText(""); setStaffFilter("all"); setPeriodFilter("all"); }}
              >
                {t("btn_clear_filters")}
              </Button>
            )}
          </div>
        </div>

        {/* Dispatch block alert */}
        {blockedCount > 0 && (
          <div className="mx-4 mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2.5 shrink-0">
            <ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-destructive">{t("alert_dispatch_warning")}</p>
              <p className="text-xs text-destructive/70 mt-0.5">
                {blockedCount} {t("alert_dispatch_desc_suffix")}
              </p>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ClipboardList className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-sm">{t("msg_no_orders")}</p>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {driverGroups.map(([driver, driverOrders]) => (
                <div key={driver}>
                  {/* Driver group header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-0.5 h-4 rounded-full bg-primary/40 shrink-0" />
                    <Truck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-bold text-foreground/70 uppercase tracking-wider">
                      {driver === "未分配" ? t("text_unassigned") : driver}
                    </span>
                    <span className="ml-auto text-xs font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground tabular-nums">
                      {driverOrders.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {driverOrders.map((order) => {
                      const badgeLabel = t(
                        order.paymentStatus === "unpaid" ? "status_unpaid"
                        : order.paymentStatus === "paid" ? "status_paid"
                        : "status_deposit"
                      );
                      const blocked = isDispatchBlocked(order);
                      const extraDeliveries = (order.deliveries?.length ?? 0) > 1
                        ? order.deliveries!.slice(1)
                        : [];

                      return (
                        <div
                          key={order.id}
                          className={`rounded-xl overflow-hidden border transition-colors ${
                            blocked
                              ? "border-destructive/50 shadow-sm"
                              : order.paymentStatus === "unpaid"
                              ? "border-destructive/30"
                              : "border-border"
                          }`}
                        >
                          {/* Blocked banner */}
                          {blocked && (
                            <div className="bg-destructive/10 px-3 py-2 flex items-center gap-2 border-b border-destructive/20">
                              <ShieldAlert className="w-3.5 h-3.5 text-destructive shrink-0" />
                              <span className="text-xs font-semibold text-destructive">{t("label_must_collect")}</span>
                            </div>
                          )}

                          <div className="p-3 space-y-2.5">
                            {/* Customer + status */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-sm leading-tight">{order.customerName || order.phone}</p>
                                <p className="text-xs text-muted-foreground font-mono mt-0.5 tabular-nums">{order.phone}</p>
                              </div>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[order.paymentStatus]}`}>
                                {badgeLabel}
                              </span>
                            </div>

                            {/* Delivery date(s) */}
                            {order.deliveryDate && (
                              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/50" />
                                <span>
                                  {order.deliveryDate}
                                  {order.deliveryTime && <span className="text-muted-foreground/60"> · {order.deliveryTime}</span>}
                                  {order.recipientName && <span> → <span className="text-foreground/70">{order.recipientName}</span></span>}
                                </span>
                              </div>
                            )}
                            {extraDeliveries.map((d, i) => (
                              <div key={d.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/50" />
                                <span>
                                  [{i + 2}] {d.deliveryDate}
                                  {d.deliveryTime && <span className="text-muted-foreground/60"> · {d.deliveryTime}</span>}
                                  {d.recipientName && <span> → <span className="text-foreground/70">{d.recipientName}</span></span>}
                                  {d.deliveryPerson && <span className="text-muted-foreground/60"> ({d.deliveryPerson})</span>}
                                </span>
                              </div>
                            ))}

                            {/* Items */}
                            <div className="rounded-lg bg-muted/40 px-2.5 py-2 space-y-0.5">
                              {order.items.map((item) => (
                                <div key={item.id} className="flex justify-between items-baseline">
                                  <span className="text-xs text-foreground/80">{item.name} × {item.quantity}</span>
                                  <span className="text-xs font-mono text-foreground/70 tabular-nums">${(item.price * item.quantity).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>

                            {/* Timestamp + total */}
                            <div className="flex items-center justify-between pt-0.5 border-t border-border/60">
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {new Date(order.createdAt).toLocaleString("zh-HK")}
                              </span>
                              <span className="font-mono font-bold text-sm tabular-nums">${order.finalPrice.toLocaleString()}</span>
                            </div>

                            {/* Print buttons */}
                            <PrintButtons order={order} compact />

                            {/* Edit / Reorder */}
                            {(onEdit || onReorder) && (
                              <div className="flex gap-2 pt-0.5">
                                {onEdit && (
                                  <Button
                                    variant="outline"
                                    className="flex-1 h-9 text-xs gap-1.5"
                                    onClick={() => { onEdit(order); onClose(); }}
                                  >
                                    <Pencil className="w-3.5 h-3.5" /> {t("btn_edit_order")}
                                  </Button>
                                )}
                                {onReorder && (
                                  <Button
                                    variant="ghost"
                                    className="flex-1 h-9 text-xs gap-1.5"
                                    onClick={() => { onReorder(order); onClose(); }}
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" /> {t("btn_reorder")}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default OrderHistory;
