import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList, X, ShieldAlert, Truck } from "lucide-react";
import PrintButtons from "@/components/pos/PrintButtons";
import type { Order, PaymentStatus } from "@/types/order";
import { useLanguage } from "@/contexts/LanguageContext";

function isDispatchBlocked(order: Order): boolean {
  if (order.paymentStatus !== "unpaid") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Check all deliveries (multi-recipient); fall back to legacy flat field
  const dates = (order.deliveries?.map(d => d.deliveryDate).filter(Boolean) ?? []);
  if (dates.length === 0 && order.deliveryDate) dates.push(order.deliveryDate);
  return dates.some(date => new Date(date) <= today);
}

interface OrderHistoryProps {
  orders: Order[];
  open: boolean;
  onClose: () => void;
}

const STATUS_VARIANTS: Record<PaymentStatus, "destructive" | "default" | "secondary"> = {
  unpaid: "destructive",
  paid: "default",
  deposit: "secondary",
};

const OrderHistory = ({ orders, open, onClose }: OrderHistoryProps) => {
  const { t } = useLanguage();
  // All hooks must run before any conditional return
  const driverGroups = useMemo(() => {
    const sorted = [...orders].sort((a, b) => {
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

    // Sort groups: named drivers first (alphabetical), unassigned last
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "未分配") return 1;
      if (b === "未分配") return -1;
      return a.localeCompare(b);
    });
  }, [orders]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border-l border-border h-full animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            {t("panel_order_history")} ({orders.length})
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Dispatch block alert */}
        {orders.some(isDispatchBlocked) && (
          <div className="mx-4 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-destructive">{t("alert_dispatch_warning")}</p>
              <p className="text-xs text-destructive/80">
                {orders.filter(isDispatchBlocked).length} {t("alert_dispatch_desc_suffix")}
              </p>
            </div>
          </div>
        )}
        <ScrollArea className="h-[calc(100vh-65px)]">
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">{t("msg_no_orders")}</p>
          ) : (
            <div className="p-4 space-y-5">
              {driverGroups.map(([driver, driverOrders]) => (
                <div key={driver}>
                  {/* Driver group header */}
                  <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-dashed border-border">
                    <Truck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                      {driver === "未分配" ? t("text_unassigned") : driver}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                      {driverOrders.length} {t("unit_order")}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {driverOrders.map((order) => {
                      const badgeVariant = STATUS_VARIANTS[order.paymentStatus];
                      const badgeLabel = t(order.paymentStatus === "unpaid" ? "status_unpaid" : order.paymentStatus === "paid" ? "status_paid" : "status_deposit");
                      const blocked = isDispatchBlocked(order);
                      const extraDeliveries = (order.deliveries?.length ?? 0) > 1 ? order.deliveries!.slice(1) : [];
                      return (
                        <div
                          key={order.id}
                          className={`rounded-lg border p-3 space-y-2 ${
                            blocked
                              ? "border-destructive bg-destructive/10"
                              : order.paymentStatus === "unpaid"
                              ? "border-destructive/40 bg-destructive/5"
                              : "border-border"
                          }`}
                        >
                          {blocked && (
                            <div className="flex items-center gap-1.5 text-destructive text-xs font-semibold">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              {t("label_must_collect")}
                            </div>
                          )}
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{order.customerName || order.phone}</p>
                              <p className="text-xs text-muted-foreground font-mono">{order.phone}</p>
                            </div>
                            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                          </div>

                          {/* Delivery info */}
                          {order.deliveryDate && (
                            <p className="text-xs text-muted-foreground">
                              📅 {order.deliveryDate}
                              {order.deliveryTime && ` · ${order.deliveryTime}`}
                              {order.recipientName && ` → ${order.recipientName}`}
                            </p>
                          )}
                          {extraDeliveries.map((d, i) => (
                            <p key={d.id} className="text-xs text-muted-foreground">
                              📅 [{i + 2}] {d.deliveryDate}
                              {d.deliveryTime && ` · ${d.deliveryTime}`}
                              {d.recipientName && ` → ${d.recipientName}`}
                              {d.deliveryPerson && ` (${d.deliveryPerson})`}
                            </p>
                          ))}

                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {order.items.map((item) => (
                              <p key={item.id}>
                                {item.name} × {item.quantity} = ${(item.price * item.quantity).toLocaleString()}
                              </p>
                            ))}
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-border">
                            <span className="text-xs text-muted-foreground">
                              {new Date(order.createdAt).toLocaleString("zh-HK")}
                            </span>
                            <span className="font-mono font-bold text-sm">${order.finalPrice.toLocaleString()}</span>
                          </div>
                          <PrintButtons order={order} />
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
