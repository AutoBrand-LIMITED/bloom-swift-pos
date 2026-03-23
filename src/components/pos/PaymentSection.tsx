import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, AlertTriangle, CalendarIcon, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { PaymentStatus } from "@/types/order";

interface PaymentSectionProps {
  subtotal: number;
  finalPrice: number;
  priceOverridden: boolean;
  onFinalPriceChange: (v: number) => void;
  onResetPrice: () => void;
  paymentStatus: PaymentStatus;
  onPaymentStatusChange: (s: PaymentStatus) => void;
  depositAmount: number;
  onDepositAmountChange: (v: number) => void;
  priceWarning: boolean;
}

const statusConfig: Record<PaymentStatus, { label: string; className: string }> = {
  unpaid: { label: "未付款", className: "bg-destructive text-destructive-foreground" },
  paid: { label: "已付款", className: "bg-success text-success-foreground" },
  deposit: { label: "已付訂金", className: "bg-warning text-warning-foreground" },
};

const PaymentSection = ({
  subtotal, finalPrice, priceOverridden,
  onFinalPriceChange, onResetPrice,
  paymentStatus, onPaymentStatusChange,
  depositAmount, onDepositAmountChange,
  priceWarning,
}: PaymentSectionProps) => (
  <div className="rounded-xl border border-border bg-card p-4 space-y-4">
    <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
      <CreditCard className="w-4 h-4" />
      付款
    </h2>

    {/* Price summary */}
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">小計</span>
        <span className="font-mono">${subtotal.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <Label className="text-sm font-semibold">最終價格</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">$</span>
          <Input
            type="number"
            value={finalPrice || ""}
            onChange={(e) => onFinalPriceChange(parseFloat(e.target.value) || 0)}
            className="w-28 text-right font-mono text-lg font-bold h-10"
            min={0}
          />
          {priceOverridden && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={onResetPrice}>
              重設
            </Button>
          )}
        </div>
      </div>
      {priceWarning && (
        <div className="flex items-center gap-1.5 text-warning text-xs">
          <AlertTriangle className="w-3.5 h-3.5" />
          價格為 $0，請確認是否正確
        </div>
      )}
    </div>

    {/* Payment status */}
    <div className="space-y-2">
      <Label className="text-xs">付款狀態</Label>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(statusConfig) as PaymentStatus[]).map((status) => {
          const cfg = statusConfig[status];
          const isActive = paymentStatus === status;
          return (
            <button
              key={status}
              onClick={() => onPaymentStatusChange(status)}
              className={`rounded-lg py-2.5 px-3 text-sm font-medium transition-all border-2 ${
                isActive
                  ? `${cfg.className} border-transparent shadow-md scale-[1.02]`
                  : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
              }`}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>
    </div>

    {/* Deposit amount */}
    {paymentStatus === "deposit" && (
      <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
        <Label className="text-xs">訂金金額 ($)</Label>
        <Input
          type="number"
          value={depositAmount || ""}
          onChange={(e) => onDepositAmountChange(parseFloat(e.target.value) || 0)}
          placeholder="輸入已付訂金"
          className="font-mono"
          min={0}
        />
        {depositAmount > 0 && (
          <p className="text-xs text-muted-foreground">
            尚欠 <span className="font-mono font-medium text-destructive">${(finalPrice - depositAmount).toLocaleString()}</span>
          </p>
        )}
      </div>
    )}

    {/* Unpaid warning */}
    {paymentStatus === "unpaid" && (
      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2 animate-in fade-in duration-200">
        <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-destructive">待跟進</p>
          <p className="text-xs text-destructive/80">此訂單尚未收款，請記得追客付款</p>
        </div>
      </div>
    )}
  </div>
);

export default PaymentSection;
