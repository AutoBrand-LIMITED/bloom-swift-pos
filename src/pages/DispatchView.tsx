import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Truck, CheckCircle2, Clock, AlertTriangle, Package, MapPin, Users, Navigation } from "lucide-react";
import type { Order } from "@/types/order";
import { loadOrders } from "@/lib/orders";
import { loadDrivers } from "@/lib/drivers";
import { useLanguage } from "@/contexts/LanguageContext";

type DateFilter = "today" | "tomorrow" | "all";
type GroupMode = "driver" | "district";

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

const DispatchView = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [groupMode, setGroupMode] = useState<GroupMode>("driver");

  useEffect(() => { setOrders(loadOrders()); }, []);

  const drivers = useMemo(() => loadDrivers(), []);
  const driverNames = useMemo(() => new Set(drivers.map((d) => d.name)), [drivers]);

  const filteredOrders = useMemo(() => {
    if (dateFilter === "all") return orders;
    const target = dateFilter === "today" ? todayStr() : tomorrowStr();
    return orders.filter((o) => orderPrimaryDate(o) === target);
  }, [orders, dateFilter]);

  const totalPending = filteredOrders.filter((o) => o.deliveryStatus !== "delivered").length;
  const totalDelivered = filteredOrders.filter((o) => o.deliveryStatus === "delivered").length;
  const blocked = filteredOrders.filter(isDispatchBlocked).length;

  // Vehicles to deploy = distinct assigned drivers with at least one pending order
  const vehiclesToDeploy = useMemo(() => {
    const set = new Set<string>();
    for (const o of filteredOrders) {
      if (o.deliveryStatus === "delivered") continue;
      const d = orderDriver(o);
      if (d) set.add(d);
    }
    return set.size;
  }, [filteredOrders]);

  const groups = useMemo(() => {
    const map: Record<string, Order[]> = {};
    for (const o of filteredOrders) {
      const key = groupMode === "driver"
        ? (orderDriver(o) || "未分配")
        : (orderPrimaryDistrict(o) || "—");
      map[key] = [...(map[key] ?? []), o];
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) =>
        (orderPrimaryDate(a) + orderPrimaryTime(a)).localeCompare(orderPrimaryDate(b) + orderPrimaryTime(b))
      );
    }
    if (groupMode === "driver") {
      const sortedKeys = [
        ...drivers.map((d) => d.name).filter((n) => map[n]),
        ...Object.keys(map).filter((k) => !driverNames.has(k)),
      ];
      return sortedKeys.map((key) => ({ key, orders: map[key] }));
    }
    // district mode — alphabetical, unknown last
    const sortedKeys = Object.keys(map).sort((a, b) => {
      if (a === "—") return 1;
      if (b === "—") return -1;
      return a.localeCompare(b);
    });
    return sortedKeys.map((key) => ({ key, orders: map[key] }));
  }, [filteredOrders, groupMode, drivers, driverNames]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-gradient-to-br from-primary/[0.06] via-card/80 to-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> {t("nav_back")}
            </Button>
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
              <Truck className="w-4 h-4" />
            </span>
            <h1 className="text-sm font-bold">{t("title_dispatch")}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-600 px-2.5 py-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-bold font-mono text-sm">{totalPending}</span>
                <span className="hidden sm:inline">{t("dispatch_pending")}</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 text-green-600 px-2.5 py-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="font-bold font-mono text-sm">{totalDelivered}</span>
                <span className="hidden sm:inline">{t("dispatch_delivered")}</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1" title={t("dispatch_vehicles")}>
                <Users className="w-3.5 h-3.5" />
                <span className="font-bold font-mono text-sm">{vehiclesToDeploy}</span>
                <span className="hidden sm:inline">{t("dispatch_vehicles")}</span>
              </span>
              {blocked > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 text-red-600 font-medium px-2.5 py-1"><AlertTriangle className="w-3.5 h-3.5" />{blocked}<span className="hidden sm:inline">{t("text_unpaid_warning")}</span></span>
              )}
            </div>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["driver", "district"] as GroupMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setGroupMode(m)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    groupMode === m ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {m === "driver" ? <Truck className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{m === "driver" ? t("group_by_driver") : t("group_by_district")}</span>
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["today", "tomorrow", "all"] as DateFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    dateFilter === f ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {f === "today" ? t("filter_today") : f === "tomorrow" ? t("filter_tomorrow") : t("filter_all")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/[0.06] text-primary/40">
              <Truck className="w-8 h-8" />
            </span>
            <p className="text-sm text-muted-foreground">{t("msg_no_dispatch")}</p>
          </div>
        )}

        {groups.map(({ key, orders: groupOrders }) => {
          const groupPending = groupOrders.filter((o) => o.deliveryStatus !== "delivered").length;
          const groupDone = groupOrders.filter((o) => o.deliveryStatus === "delivered").length;
          const isUnknown = key === "未分配" || key === "—";
          const headerLabel = isUnknown
            ? (groupMode === "driver" ? t("text_unassigned") : t("text_not_specified"))
            : key;

          const pendingAddresses = groupOrders
            .filter((o) => o.deliveryStatus !== "delivered")
            .map((o) => orderPrimaryAddress(o))
            .filter((a) => Boolean(a) && a !== "—");
          const routeUrl = pendingAddresses.length > 1
            ? `https://www.google.com/maps/dir/${pendingAddresses.map(encodeURIComponent).join("/")}`
            : null;

          return (
            <div key={key} className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/40 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                    isUnknown ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                  }`}>
                    {groupMode === "district" ? <MapPin className="w-3.5 h-3.5" /> : (isUnknown ? "?" : key[0])}
                  </span>
                  <span className="text-sm font-bold">{headerLabel}</span>
                  <span className="text-xs text-muted-foreground">{groupOrders.length} {t("dispatch_unit_order")}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {groupPending > 0 && <span className="text-amber-600 font-medium">{groupPending} {t("dispatch_pending")}</span>}
                  {groupDone > 0 && <span className="text-green-600 font-medium">{groupDone} {t("dispatch_delivered")}</span>}
                  {routeUrl && (
                    <a
                      href={routeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      {t("plan_route")}
                    </a>
                  )}
                </div>
              </div>

              {/* Orders table */}
              <div className="divide-y divide-border">
                {groupOrders.map((order) => {
                  const isDelivered = order.deliveryStatus === "delivered";
                  const blocked = isDispatchBlocked(order);
                  const orderAddr = orderPrimaryAddress(order);

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
                      <div className="flex-1 min-w-0 hidden md:flex items-center gap-1.5">
                        <p className="text-xs text-muted-foreground truncate">{orderAddr}</p>
                        {orderAddr && orderAddr !== "—" && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orderAddr + " 香港")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary shrink-0 transition-colors"
                            title={orderAddr}
                          >
                            <MapPin className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Items */}
                      <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                        <Package className="w-3 h-3" />
                        {order.items.length}
                      </div>

                      {/* Payment */}
                      <div className="shrink-0">
                        {order.paymentStatus === "unpaid" ? (
                          <span className="text-[11px] font-medium text-red-600 bg-red-100 rounded-full px-2 py-0.5">{t("status_unpaid_short")}</span>
                        ) : order.paymentStatus === "deposit" ? (
                          <span className="text-[11px] font-medium text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">{t("status_deposit_short")}</span>
                        ) : (
                          <span className="text-[11px] font-medium text-green-600 bg-green-100 rounded-full px-2 py-0.5">{t("status_paid_short")}</span>
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
