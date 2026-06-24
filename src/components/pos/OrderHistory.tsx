import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList, X, ShieldAlert } from "lucide-react";
import PrintButtons from "@/components/pos/PrintButtons";
import type { Order, PaymentStatus } from "@/types/order";

function isDispatchBlocked(order: Order): boolean {
  if (order.paymentStatus !== "unpaid") return false;
  if (!order.deliveryDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(order.deliveryDate);
  return delivery <= today;
}

interface OrderHistoryProps {
  orders: Order[];
  open: boolean;
  onClose: () => void;
}

const statusBadge: Record<PaymentStatus, { label: string; variant: "destructive" | "default" | "secondary" }> = {
  unpaid: { label: "未付款", variant: "destructive" },
  paid: { label: "已付款", variant: "default" },
  deposit: { label: "已付訂金", variant: "secondary" },
};

const OrderHistory = ({ orders, open, onClose }: OrderHistoryProps) => {
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
            訂單記錄 ({orders.length})
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
              <p className="text-xs font-semibold text-destructive">派送前警告</p>
              <p className="text-xs text-destructive/80">
                {orders.filter(isDispatchBlocked).length} 張訂單今日或之前送貨，但仍未收款。請先確認付款再派送。
              </p>
            </div>
          </div>
        )}
        <ScrollArea className="h-[calc(100vh-65px)]">
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">暫無訂單</p>
          ) : (
            <div className="p-4 space-y-3">
              {[...orders].reverse().map((order) => {
                const badge = statusBadge[order.paymentStatus];
                const blocked = isDispatchBlocked(order);
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
                        派送前必須收款
                      </div>
                    )}
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{order.customerName || order.phone}</p>
                        <p className="text-xs text-muted-foreground font-mono">{order.phone}</p>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
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
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default OrderHistory;
