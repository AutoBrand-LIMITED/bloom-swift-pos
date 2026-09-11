import { CalendarDays, ChevronRight, Package, Phone, ShoppingBag, Store, Truck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { orderItemTotal } from "@/lib/order-pricing";
import { formatMoney } from "@/lib/money";
import type { FulfillmentType, OrderItem, PaymentStatus } from "@/types/order";
import type { WorkflowSectionId } from "@/components/pos/PosWorkflowTabs";

interface OrderSummaryPanelProps {
  customerName: string;
  phone: string;
  recipientName: string;
  recipientPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryDate: string;
  deliveryTime: string;
  items: OrderItem[];
  deliveryFee: number;
  urgentFee: number;
  finalPrice: number;
  paymentStatus: PaymentStatus;
  completedCount: number;
  requiredSectionCount: number;
  isSubmitting: boolean;
  isSavingIncomplete: boolean;
  onSubmit: () => void;
  onSaveIncomplete: () => void;
  onNavigate: (section: WorkflowSectionId) => void;
}

const paymentLabels: Record<PaymentStatus, string> = {
  unpaid: "未付款",
  paid: "立即付款",
  deposit: "已付訂金",
};

const SummaryLink = ({
  label,
  section,
  onNavigate,
}: {
  label: string;
  section: WorkflowSectionId;
  onNavigate: (section: WorkflowSectionId) => void;
}) => (
  <button
    type="button"
    onClick={() => onNavigate(section)}
    className="flex min-h-11 touch-manipulation items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10"
  >
    {label}
    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
  </button>
);

const OrderSummaryPanel = ({
  customerName,
  phone,
  recipientName,
  recipientPhone,
  fulfillmentType,
  deliveryDate,
  deliveryTime,
  items,
  deliveryFee,
  urgentFee,
  finalPrice,
  paymentStatus,
  completedCount,
  requiredSectionCount,
  isSubmitting,
  isSavingIncomplete,
  onSubmit,
  onSaveIncomplete,
  onNavigate,
}: OrderSummaryPanelProps) => {
  const completionPercent = Math.round((completedCount / requiredSectionCount) * 100);
  const FulfillmentIcon = fulfillmentType === "grab_and_go"
    ? ShoppingBag
    : fulfillmentType === "pickup"
      ? Store
      : Truck;
  const fulfillmentHeading = fulfillmentType === "grab_and_go"
    ? "即買即走"
    : fulfillmentType === "pickup"
      ? "預約自取"
      : "收貨及送貨";

  return (
    <aside aria-label="訂單摘要" className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">訂單摘要</p>
            <p className="mt-1 text-sm font-semibold">已完成 {completedCount} / {requiredSectionCount} 個必填步驟</p>
          </div>
          <span className="font-mono text-sm font-semibold text-primary">{completionPercent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-1 border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <UserRound className="h-4 w-4" aria-hidden="true" />
            下單人
          </p>
          <SummaryLink label="修改" section="customer" onNavigate={onNavigate} />
        </div>
        <p className="truncate text-sm font-semibold">{customerName.trim() || "尚未填寫"}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          {phone.trim() || "尚未填寫電話"}
        </p>
      </div>

      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Package className="h-4 w-4" aria-hidden="true" />
            商品 ({items.length})
          </p>
          <SummaryLink label="修改" section="items" onNavigate={onNavigate} />
        </div>
        {items.length > 0 ? (
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">數量 {item.quantity}</p>
                </div>
                <span className="shrink-0 font-mono">${formatMoney(orderItemTotal(item))}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-muted/50 px-3 py-3 text-xs text-muted-foreground">尚未加入商品</p>
        )}
        {(deliveryFee > 0 || urgentFee > 0) && (
          <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            {deliveryFee > 0 && <p className="flex justify-between"><span>送貨費</span><span>${formatMoney(deliveryFee)}</span></p>}
            {urgentFee > 0 && <p className="flex justify-between"><span>急單費</span><span>${formatMoney(urgentFee)}</span></p>}
          </div>
        )}
      </div>

      <div className="space-y-2 border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <FulfillmentIcon className="h-4 w-4" aria-hidden="true" />
            {fulfillmentHeading}
          </p>
          <SummaryLink label="修改" section="delivery" onNavigate={onNavigate} />
        </div>
        {fulfillmentType === "delivery" && (
          <>
            <p className="truncate text-sm font-semibold">{recipientName.trim() || "尚未填寫收貨人"}</p>
            {recipientPhone.trim() && <p className="text-xs text-muted-foreground">{recipientPhone}</p>}
          </>
        )}
        {fulfillmentType === "grab_and_go" ? (
          <p className="text-sm text-muted-foreground">毋須安排日期、時間或收貨資料</p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {[deliveryDate, deliveryTime].filter(Boolean).join(" · ")
              || (fulfillmentType === "pickup" ? "尚未選擇取貨時間" : "尚未選擇送貨時間")}
          </p>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{paymentLabels[paymentStatus]}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">訂單總計</p>
          </div>
          <p className="font-mono text-3xl font-bold tracking-tight">${formatMoney(finalPrice)}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onSaveIncomplete}
          disabled={isSubmitting || isSavingIncomplete}
          className="mt-4 min-h-12 w-full touch-manipulation text-base font-semibold"
        >
          {isSavingIncomplete ? "儲存中" : "儲存未完成訂單"}
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={onSubmit}
          disabled={isSubmitting || isSavingIncomplete}
          className="mt-2 min-h-12 w-full touch-manipulation text-base font-semibold shadow-md"
        >
          {isSubmitting ? "下單中" : "確認訂單"}
        </Button>
      </div>
    </aside>
  );
};

export default OrderSummaryPanel;
