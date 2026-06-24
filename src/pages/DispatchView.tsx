import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Truck, CheckCircle2, Clock, AlertTriangle, Package } from "lucide-react";
import { DRIVERS } from "@/types/order";
import type { Order } from "@/types/order";
import { loadOrders } from "@/lib/orders";

type DateFilter = "today" | "tomorrow" | "all";

function toDateStr(d: Date): string { return d.toISOString().slice(0, 10); }
function todayStr(): string { return toDateStr(new Date()); }
function tomorrowStr(): string { const d = new Date(); d.setDate(d.getDate() + 1); return toDateStr(d); }

function orderPrimaryDate(o: Order): string {
  return o.deliveries?.[0]?.deliveryDate || o.deliveryDate || "";
}
function orderPrimaryTime(o: Order): string {
  return o.deliveries?.[0]?.deliveryTime || o.deliveryTime || "";
}
function orderPrimaryRecipient(o: Order): string {
  return o.deliveries?.[0]?.recipientName || o.recipientName || "—";
}
function orderPrimaryDistrict(o: Order): string {
  return o.deliveries?.[0]?.deliveryDistrict || "—";
}
function orderPrimaryAddress(o: Order): string {
  const d = o.deliveries?.[0];
  if (d) return [d.deliveryDistrict, d.deliveryArea, d.deliveryDetail].filter(Boolean).join(" ");
  return o.deliveryAddress || "—";
}
function orderDriver(o: Order): string {
  return o.deliveries?.[0]?.deliveryPerson || o.deliveryPerson || "";
}

function isDispatchBlocked(order: Order): boolean {
  if (order.paymentStatus !== "unpaid") return false;
  const today = todayStr();
  const dates = (order.deliveries?.map((d) => d.deliveryDate).filter(Boolean) ?? []);
  if (dates.length === 0 && order.deliveryDate) dates.push(order.deliveryDate);
  return dates.some((date) => date <= today);
}

const DATE_LABELS: Record<DateFilter, string> = { today: "今天", tomorrow: "明天", all: "全部" };
const DRIVER_NAMES = new Set(DRIVERS.map((d) => d.name));

const DispatchView = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  useEffect(() => { setOrders(loadOrders()); }, []);

  const filteredOrders = useMemo(() => {
    if (dateFilter === "all") return orders;
    const target = dateFilter === "today" ? todayStr() : tomorrowStr();
    return orders.filter((o) => orderPrimaryDate(o) === target);
  }, [orders, dateFilter]);

  const totalPending = filteredOrders.filter((o) => o.deliveryStatus !== "delivered").length;
  const totalDelivered = filteredOrders.filter((o) => o.deliveryStatus === "delivered").length;
  const blocked = filteredOrders.filter(isDispatchBlocked).length;

  const driverGroups = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    for (const o of filteredOrders) {
      const driver = orderDriver(o) || "未分配";
      groups[driver] = [...(groups[driver] ?? []), o];
    }
    // Sort orders within each group by date then time
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) =>
        (orderPrimaryDate(a) + orderPrimaryTime(a)).localeCompare(orderPrimaryDate(b) + orderPrimaryTime(b))
      );
    }
    // Return named drivers first (in DRIVERS order), then 未分配 last
    const sortedKeys = [
      ...DRIVERS.map((d) => d.name).filter((n) => groups[n]),
      ...Object.keys(groups).filter((k) => !DRIVER_NAMES.has(k)),
    ];
    return sortedKeys.map((key) => ({ driver: key, orders: groups[key] }));
  }, [filteredOrders]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> 返回
            </Button>
            <Truck className="w-5 h-5 text-primary" />
            <h1 className="text-sm font-bold">送貨調度</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" />{totalPending} 待送</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{totalDelivered} 已送</span>
              {blocked > 0 && (
                <span className="flex items-center gap-1 text-red-500 font-medium"><AlertTriangle className="w-3.5 h-3.5" />{blocked} 未付款警告</span>
              )}
            </div>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["today", "tomorrow", "all"] as DateFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    dateFilter === f ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {DATE_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {filteredOrders.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">沒有送貨記錄</p>
          </div>
        )}

        {driverGroups.map(({ driver, orders: driverOrders }) => {
          const driverPending = driverOrders.filter((o) => o.deliveryStatus !== "delivered").length;
          const driverDone = driverOrders.filter((o) => o.deliveryStatus === "delivered").length;

          return (
            <div key={driver} className="rounded-xl border border-border overflow-hidden bg-card">
              {/* Driver header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/40 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{driver}</span>
                  <span className="text-xs text-muted-foreground">{driverOrders.length} 單</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {driverPending > 0 && <span className="text-amber-600 font-medium">{driverPending} 待送</span>}
                  {driverDone > 0 && <span className="text-green-600 font-medium">{driverDone} 已送</span>}
                </div>
              </div>

              {/* Orders table */}
              <div className="divide-y divide-border">
                {driverOrders.map((order) => {
                  const isDelivered = order.deliveryStatus === "delivered";
                  const blocked = isDispatchBlocked(order);

                  return (
                    <div
                      key={order.id}
                      className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        isDelivered ? "opacity-50" : blocked ? "bg-red-50/50" : "hover:bg-secondary/30"
                      }`}
                    >
                      {/* Status icon */}
                      <div className="shrink-0">
                        {isDelivered ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : blocked ? (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-500" />
                        )}
                      </div>

                      {/* Time */}
                      <div className="w-20 shrink-0">
                        <p className="font-mono text-xs text-muted-foreground">{orderPrimaryTime(order) || orderPrimaryDate(order)}</p>
                      </div>

                      {/* Recipient */}
                      <div className="w-28 shrink-0">
                        <p className="font-semibold truncate">{orderPrimaryRecipient(order)}</p>
                      </div>

                      {/* District */}
                      <div className="w-20 shrink-0 hidden sm:block">
                        <p className="text-xs text-muted-foreground">{orderPrimaryDistrict(order)}</p>
                      </div>

                      {/* Address */}
                      <div className="flex-1 min-w-0 hidden md:block">
                        <p className="text-xs text-muted-foreground truncate">{orderPrimaryAddress(order)}</p>
                      </div>

                      {/* Items */}
                      <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                        <Package className="w-3 h-3" />
                        {order.items.length}
                      </div>

                      {/* Payment */}
                      <div className="shrink-0">
                        {order.paymentStatus === "unpaid" ? (
                          <span className="text-[11px] font-medium text-red-600 bg-red-100 rounded-full px-2 py-0.5">未付</span>
                        ) : order.paymentStatus === "deposit" ? (
                          <span className="text-[11px] font-medium text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">訂金</span>
                        ) : (
                          <span className="text-[11px] font-medium text-green-600 bg-green-100 rounded-full px-2 py-0.5">已付</span>
                        )}
                      </div>

                      {/* Total */}
                      <div className="w-20 shrink-0 text-right">
                        <p className="font-mono text-xs">${order.finalPrice.toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DispatchView;
