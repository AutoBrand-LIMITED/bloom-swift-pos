import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Truck, MapPin, Clock, User, Phone, Package, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loadOrders } from "@/lib/orders";
import { useLanguage } from "@/contexts/LanguageContext";
import { generateDeliveryNote, printBatch } from "@/lib/print-utils";
import type { Order, Delivery } from "@/types/order";

interface FlatDelivery {
  orderId: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  itemCount: number;
  totalAmount: number;
  paymentStatus: Order["paymentStatus"];
  driver: string;
  delivery: Delivery;
  order: Order;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildAddress(d: Delivery): string {
  return [d.deliveryArea, d.deliveryDistrict, d.deliveryRegion, d.deliveryDetail]
    .filter(Boolean)
    .join(", ");
}

const STATUS_STYLES: Record<Order["paymentStatus"], string> = {
  unpaid: "bg-red-50 text-red-700 border border-red-200",
  paid: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  deposit: "bg-amber-50 text-amber-700 border border-amber-200",
};

const DeliveryView = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [viewDate, setViewDate] = useState(today());

  const allOrders = useMemo(() => loadOrders(), []);

  const flatDeliveries = useMemo((): FlatDelivery[] => {
    const result: FlatDelivery[] = [];
    for (const order of allOrders) {
      const deliveries = order.deliveries?.length
        ? order.deliveries
        : order.deliveryDate
        ? [{
            id: "legacy",
            deliveryDate: order.deliveryDate,
            deliveryTime: order.deliveryTime || "",
            deliveryRegion: "",
            deliveryDistrict: "",
            deliveryArea: "",
            deliveryDetail: order.deliveryAddress || "",
            recipientName: order.recipientName || "",
            recipientPhone: order.recipientPhone || "",
            deliveryPerson: order.deliveryPerson || "",
            failedDeliveryAction: "",
          } as Delivery]
        : [];

      for (const d of deliveries) {
        if (d.deliveryDate === viewDate) {
          result.push({
            orderId: order.id,
            invoiceNumber: order.invoiceNumber || order.id.slice(-6).toUpperCase(),
            customerName: order.customerName || order.phone || "—",
            customerPhone: order.phone || "",
            itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
            totalAmount: order.finalPrice,
            paymentStatus: order.paymentStatus,
            driver: d.deliveryPerson?.trim() || "未分配",
            delivery: d,
            order,
          });
        }
      }
    }
    return result.sort((a, b) => (a.delivery.deliveryTime || "").localeCompare(b.delivery.deliveryTime || ""));
  }, [allOrders, viewDate]);

  const driverGroups = useMemo(() => {
    const groups: Record<string, FlatDelivery[]> = {};
    for (const fd of flatDeliveries) {
      if (!groups[fd.driver]) groups[fd.driver] = [];
      groups[fd.driver].push(fd);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "未分配") return 1;
      if (b === "未分配") return -1;
      return a.localeCompare(b);
    });
  }, [flatDeliveries]);

  const handlePrintAll = () => {
    const uniqueOrders = [...new Map(flatDeliveries.map(fd => [fd.orderId, fd.order])).values()];
    printBatch(uniqueOrders.map(generateDeliveryNote));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-xs shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" /> {t("nav_back")}
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold tracking-tight leading-none flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-primary" />
              {t("title_today_deliveries")}
            </h1>
          </div>
          <input
            type="date"
            value={viewDate}
            onChange={(e) => setViewDate(e.target.value)}
            className="h-8 px-2 text-xs rounded-lg border border-border bg-card text-foreground shrink-0"
          />
          {flatDeliveries.length > 0 && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 shrink-0" onClick={handlePrintAll}>
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("btn_print_all")}</span>
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {flatDeliveries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <Truck className="w-10 h-10 opacity-25" />
            <p className="text-sm">{t("label_no_deliveries_today")}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {driverGroups.map(([driver, items]) => (
              <section key={driver}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {driver === "未分配" ? "?" : driver.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{driver === "未分配" ? t("text_unassigned") : driver}</p>
                    <p className="text-xs text-muted-foreground">{items.length} {t("label_deliveries_suffix")}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 text-xs gap-1 text-muted-foreground"
                    onClick={() => {
                      const driverOrders = [...new Map(items.map(fd => [fd.orderId, fd.order])).values()];
                      printBatch(driverOrders.map(generateDeliveryNote));
                    }}
                  >
                    <Printer className="w-3 h-3" />
                    {t("btn_print_delivery_notes")}
                  </Button>
                </div>

                <div className="space-y-3">
                  {items.map((fd, idx) => {
                    const address = buildAddress(fd.delivery);
                    return (
                      <div key={`${fd.orderId}-${idx}`} className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {fd.delivery.deliveryTime && (
                                <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                                  <Clock className="w-3 h-3" />
                                  {fd.delivery.deliveryTime}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground font-mono">#{fd.invoiceNumber}</span>
                            </div>
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLES[fd.paymentStatus]}`}>
                            {t(fd.paymentStatus === "unpaid" ? "status_unpaid_short" : fd.paymentStatus === "paid" ? "status_paid_short" : "status_deposit_short")}
                          </span>
                        </div>

                        {fd.delivery.recipientName && (
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-semibold">{fd.delivery.recipientName}</span>
                            {fd.delivery.recipientPhone && (
                              <a href={`tel:${fd.delivery.recipientPhone}`} className="flex items-center gap-1 text-xs text-primary ml-auto shrink-0">
                                <Phone className="w-3 h-3" />
                                {fd.delivery.recipientPhone}
                              </a>
                            )}
                          </div>
                        )}

                        {address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <span className="text-sm text-foreground/80 leading-snug">{address}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-1 border-t border-border/50 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {fd.itemCount} {fd.itemCount === 1 ? "item" : "items"}
                          </span>
                          <span className="font-mono font-medium text-foreground tabular-nums ml-auto">
                            ${fd.totalAmount.toLocaleString()}
                          </span>
                          <span>{fd.customerName}</span>
                          {fd.customerPhone && <span>· {fd.customerPhone}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default DeliveryView;
