import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Truck, CheckCircle2, Clock, Camera, Package } from "lucide-react";
import { toast } from "sonner";
import { DRIVERS } from "@/types/order";
import type { Order } from "@/types/order";
import { loadOrders, updateOrder, loadPhotos, savePhoto, deletePhoto, compressImage } from "@/lib/orders";
import type { OrderPhotos } from "@/lib/orders";

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

const DATE_LABELS: Record<DateFilter, string> = { today: "今天", tomorrow: "明天", all: "全部" };

const DriverApp = () => {
  const navigate = useNavigate();
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
    setUploading(`${orderId}-${photoKey}`);
    try {
      const dataUrl = await compressImage(file);
      savePhoto(orderId, photoKey, dataUrl);
      setPhotos(loadPhotos());
      toast.success("相片已儲存");
    } catch {
      toast.error("相片儲存失敗");
    } finally {
      setUploading(null);
    }
  };

  const handleMarkDelivered = (order: Order) => {
    const orderPhotos = photos[order.id];
    if (!orderPhotos?.productPhoto || !orderPhotos?.receiptPhoto) {
      toast.error("請先上傳兩張相片");
      return;
    }
    try {
      updateOrder(order.id, { deliveryStatus: "delivered", deliveredAt: new Date().toISOString() });
      setOrders(loadOrders());
      toast.success(`${orderPrimaryRecipient(order)} — 已送達 ✓`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "儲存失敗");
    }
  };

  if (!selectedDriver) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> 返回
          </Button>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <h1 className="text-sm font-bold">送貨員登入</h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center flex-1 p-8 gap-8">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">請選擇你的名字</p>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            {DRIVERS.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDriver(d.name)}
                className="rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all p-8 text-center font-bold text-lg active:scale-95"
              >
                🚚 {d.name}
              </button>
            ))}
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
            <ArrowLeft className="w-3.5 h-3.5" /> 換人
          </Button>
          <span className="font-bold text-sm">{selectedDriver}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {pendingCount} 待送 · {deliveredCount} 已送
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
                {DATE_LABELS[f]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {sortedOrders.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">沒有送貨訂單</p>
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
                          <CheckCircle2 className="w-3 h-3" /> 已送達
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                          <Clock className="w-3 h-3" /> 待送
                        </span>
                      )}
                      {order.paymentStatus === "unpaid" && (
                        <span className="text-[11px] font-medium text-red-600 bg-red-50 rounded-full px-2 py-0.5">未付款</span>
                      )}
                    </div>
                    <p className="font-bold text-base leading-tight">{orderPrimaryRecipient(order)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{orderPrimaryAddress(order)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{order.items.length} 項</p>
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
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">上傳相片</p>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Product photo */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium">貨品相片</label>
                          {orderPhotos.productPhoto ? (
                            <div className="relative">
                              <img src={orderPhotos.productPhoto} alt="貨品" className="w-full h-28 object-cover rounded-lg border border-border" />
                              <button
                                className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                                onClick={() => { deletePhoto(order.id, "productPhoto"); setPhotos(loadPhotos()); }}
                              >×</button>
                            </div>
                          ) : (
                            <label className={`flex flex-col items-center justify-center h-28 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors ${uploading === `${order.id}-productPhoto` ? "opacity-50" : ""}`}>
                              <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">拍照</span>
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
                          <label className="text-xs font-medium">簽收相片</label>
                          {orderPhotos.receiptPhoto ? (
                            <div className="relative">
                              <img src={orderPhotos.receiptPhoto} alt="簽收" className="w-full h-28 object-cover rounded-lg border border-border" />
                              <button
                                className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                                onClick={() => { deletePhoto(order.id, "receiptPhoto"); setPhotos(loadPhotos()); }}
                              >×</button>
                            </div>
                          ) : (
                            <label className={`flex flex-col items-center justify-center h-28 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-primary transition-colors ${uploading === `${order.id}-receiptPhoto` ? "opacity-50" : ""}`}>
                              <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">拍照</span>
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
                        完成送貨
                      </Button>
                      {!hasAllPhotos && (
                        <p className="text-[11px] text-muted-foreground text-center">需要上傳貨品及簽收相片才能完成</p>
                      )}
                    </div>
                  )}

                  {isDelivered && order.deliveredAt && (
                    <p className="text-xs text-green-600 text-center">
                      已送達：{new Date(order.deliveredAt).toLocaleString("zh-HK")}
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
