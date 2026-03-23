import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList, X } from "lucide-react";
import PrintButtons from "@/components/pos/PrintButtons";
import type { Order, PaymentStatus } from "@/types/order";

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
        <ScrollArea className="h-[calc(100vh-65px)]">
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">暫無訂單</p>
          ) : (
            <div className="p-4 space-y-3">
              {[...orders].reverse().map((order) => {
                const badge = statusBadge[order.paymentStatus];
                return (
                  <div
                    key={order.id}
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
