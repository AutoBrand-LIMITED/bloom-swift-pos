import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Truck, CheckCircle2, Clock, Camera, Package } from "lucide-react";
import { toast } from "sonner";
import { DRIVERS } from "@/types/order";
import type { Order } from "@/types/order";
import { loadOrders, updateOrder, loadPhotos, savePhoto, deletePhoto, compressImage } from "@/lib/orders";
import type { OrderPhotos } from "@/lib/orders";
import { useLanguage } from "@/contexts/LanguageContext";

type DateFilter = "today" | "tomorrow" | "all";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayStr(): string { return toDateStr(new Date()); }
function tomorrowStr(): string {
  const d = new Date(); d.setDate(d.getDate() + 1); return toDateStr(d);
}

function orderPrimaryDate(o: Order): string {
  return o.deliveries?.[0]?.deliveryDate || o.deliveryDate || "";
}

function orderPrimaryTime(o: Order): string {
  return o.deliveries?.[0]?.deliveryTime || o.deliveryTime || "";
}

function orderPrimaryRecipient(o: Order): string {
  return o.deliveries?.[0]?.recipientName || o.recipientName || "—";
}

function orderPrimaryAddress(o: Order): string {
  const d = o.deliveries?.[0];
  if (d) {
    return [d.deliveryRegion, d.deliveryDistrict, d.deliveryArea, d.deliveryDetail].filter(Boolean).join(" ");
  }
  return o.deliveryAddress || "—";
}

function filterByDate(orders: Order[], filter: DateFilter): Order[] {
  if (filter === "all") return orders;
  const target = filter === "today" ? todayStr() : tomorrowStr();
  return orders.filter((o) => orderPrimaryDate(o) === target);
}

const DriverApp = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [photos, setPhotos] = useState<Record<string, OrderPhotos>>({});
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const productPhotoRef = useRef<Record<string, HTMLInputElement | null>>({});
  const receiptPhotoRef = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setOrders(loadOrders());
    setPhotos(loadPhotos());
  }, []);

  const driverOrders = orders.filter(
    (o) => (o.deliveries?.[0]?.deliveryPerson || o.deliveryPerson) === selectedDriver
  );
  const filtered = filterByDate(driverOrders, dateFilter);
  const sortedOrders = [...filtered].sort((a, b) =>
    (orderPrimaryDate(a) + orderPrimaryTime(a)).localeCompare(orderPrimaryDate(b) + orderPrimaryTime(b))
  );

  const pendingCount = driverOrders.filter((o) => o.deliveryStatus !== "delivered").length;
  const deliveredCount = driverOrders.filter((o) => o.deliveryStatus === "delivered").length;

  const handlePhotoUpload = async (orderId: string, photoKey: keyof OrderPhotos, file: File) => {
    if (!file.type.startsWith("image/")) { toast.error(t("toast_photo_failed")); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error(t("toast_photo_failed")); return; }
    setUploading(`${orderId}-${photoKey}`);
    try {
      const dataUrl = await compressImage(file);
      savePhoto(orderId, photoKey, dataUrl);
      setPhotos(loadPhotos());
      toast.success(t("toast_photo_saved"));
    } catch {
      toast.error(t("toast_photo_failed"));
    } finally {
      setUploading(null);
    }
  };

  const handleMarkDelivered = (order: Order) => {
    const orderPhotos = photos[order.id];
    if (!orderPhotos?.productPhoto || !orderPhotos?.receiptPhoto) {
      toast.error(t("toast_error_upload_photos"));
      return;
    }
    try {
      updateOrder(order.id, { deliveryStatus: "delivered", deliveredAt: new Date().toISOString() });
      setOrders(loadOrders());
      toast.success(`${orderPrimaryRecipient(order)} — ${t("badge_delivered")} ✓`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast_photo_failed"));
    }
  };

  if (!selectedDriver) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> {t("nav_back")}
          </Button>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <h1 className="text-sm font-bold">{t("title_driver_login")}</h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center flex-1 p-8 gap-8">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">{t("msg_select_name")}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            {DRIVERS.map((d, i) => {
              const accents = [
                "border-t-emerald-400 hover:bg-emerald-50 hover:border-emerald-300",
                "border-t-sky-400 hover:bg-sky-50 hover:border-sky-300",
                "border-t-violet-400 hover:bg-violet-50 hover:border-violet-300",
                "border-t-amber-400 hover:bg-amber-50 hover:border-amber-300",
                "border-t-rose-400 hover:bg-rose-50 hover:border-rose-300",
              ];
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDriver(d.name)}
                  className={`rounded-2xl border border-border border-t-4 bg-card transition-all p-8 text-center font-bold text-lg active:scale-95 ${accents[i % accents.length]}`}
                >
                  <Truck className="w-6 h-6 mx-auto mb-2 opacity-60" />
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedDriver(null)} className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> {t("btn_switch_driver")}
          </Button>
          <span className="font-bold text-sm">{selectedDriver}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {pendingCount} {t("label_pending_count")} · {deliveredCount} {t("label_delivered_count")}
          </span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["today", "tomorrow", "all"] as DateFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  dateFilter === f ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"
                }`}
              >
                {f === "today" ? t("filter_today") : f === "tomorrow" ? t("filter_tomorrow") : t("filter_all")}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {sortedOrders.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{t("msg_no_deliveries")}</p>
          </div>
        )}

        {sortedOrders.map((order) => {
          const isDelivered = order.deliveryStatus === "delivered";
          const isExpanded = expandedId === order.id;
          const orderPhotos = photos[order.id] ?? {};
          const hasAllPhotos = !!orderPhotos.productPhoto && !!orderPhotos.receiptPhoto;

          return (
            <div
              key={order.id}
              className={`rounded-xl border bg-card transition-all ${isDelivered ? "opacity-60 border-border" : "border-border shadow-sm"}`}
            >
              <button
                className="w-full text-left p-4"
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{orderPrimaryTime(order) || orderPrimaryDate(order)}</span>
                      {isDelivered ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-50 rounded-full px-2 py-0.5">
                          <CheckCircle2 className="w-3 h-3" /> {t("badge_delivered")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                          <Clock className="w-3 h-3" /> {t("badge_pending")}
                        </span>
                      )}
                      {order.paymentStatus === "unpaid" && (
                        <span className="text-[11px] font-medium text-red-600 bg-red-50 rounded-full px-2 py-0.5">{t("badge_unpaid")}</span>
                      )}
                    </div>
                    <p className="font-bold text-base leading-tight">{orderPrimaryRecipient(order)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{orderPrimaryAddress(order)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{order.items.length} {t("unit_items")}</p>
                    <p className="text-sm font-mono font-semibold">${order.finalPrice.toLocaleString()}</p>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border px-4 pb-4 space-y-4">
                  {/* Items */}
                  <div className="pt-3 space-y-1">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm">
                        <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1">{item.name}</span>
                        <span className="font-mono text-muted-foreground">× {item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {order.deliveryNotes && (
                    <div className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                      📋 {order.deliveryNotes}
                    </div>
                  )}

                  {/* Photos */}
                  {!isDelivered && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("label_upload_photos")}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Product photo */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium">{t("label_product_photo")}</label>
                          {orderPhotos.productPhoto ? (
                            <div className="relative">
                              <img src={orderPhotos.productPhoto} alt={t("label_product_photo")} className="w-full h-28 object-cover rounded-lg border border-border" />
                              <button
                                className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                                onClick={() => { deletePhoto(order.id, "productPhoto"); setPhotos(loadPhotos()); }}
                              >×</button>
                            </div>
                          ) : (
                            <label className={`flex flex-col items-center justify-center h-28 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors ${uploading === `${order.id}-productPhoto` ? "opacity-50" : ""}`}>
                              <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">{t("label_take_photo")}</span>
                              <input
                                type="file" accept="image/*" capture="environment" className="hidden"
                                ref={(el) => { productPhotoRef.current[order.id] = el; }}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) await handlePhotoUpload(order.id, "productPhoto", file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          )}
                        </div>

                        {/* Receipt photo */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium">{t("label_receipt_photo")}</label>
                          {orderPhotos.receiptPhoto ? (
                            <div className="relative">
                              <img src={orderPhotos.receiptPhoto} alt={t("label_receipt_photo")} className="w-full h-28 object-cover rounded-lg border border-border" />
                              <button
                                className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                                onClick={() => { deletePhoto(order.id, "receiptPhoto"); setPhotos(loadPhotos()); }}
                              >×</button>
                            </div>
                          ) : (
                            <label className={`flex flex-col items-center justify-center h-28 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors ${uploading === `${order.id}-receiptPhoto` ? "opacity-50" : ""}`}>
                              <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">{t("label_take_photo")}</span>
                              <input
                                type="file" accept="image/*" capture="environment" className="hidden"
                                ref={(el) => { receiptPhotoRef.current[order.id] = el; }}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) await handlePhotoUpload(order.id, "receiptPhoto", file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      <Button
                        className="w-full gap-2"
                        disabled={!hasAllPhotos}
                        onClick={() => handleMarkDelivered(order)}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {t("btn_complete_delivery")}
                      </Button>
                      {!hasAllPhotos && (
                        <p className="text-[11px] text-muted-foreground text-center">{t("msg_need_photos")}</p>
                      )}
                    </div>
                  )}

                  {isDelivered && order.deliveredAt && (
                    <p className="text-xs text-green-600 text-center">
                      {t("label_delivered_at")}{new Date(order.deliveredAt).toLocaleString("zh-HK")}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DriverApp;
