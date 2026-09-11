import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CreditCard, AlertTriangle, HandCoins } from "lucide-react";
import type { PaymentStatus } from "@/types/order";
import type { AccountingPaymentOption } from "@/lib/odoo-api";
import { formatMoney, normalizeWholeMoney } from "@/lib/money";

interface PaymentSectionProps {
  subtotal: number;
  finalPrice: number;
  priceOverridden: boolean;
  allowPriceOverride: boolean;
  onFinalPriceChange: (v: number) => void;
  onResetPrice: () => void;
  paymentStatus: PaymentStatus;
  onPaymentStatusChange: (s: PaymentStatus) => void;
  paymentMethod: string;
  onPaymentMethodChange: (v: string) => void;
  paymentReference: string;
  onPaymentReferenceChange: (v: string) => void;
  paymentOptions: AccountingPaymentOption[];
  paymentOptionsLoading: boolean;
  paymentOptionsError: string | null;
  depositAmount: number;
  onDepositAmountChange: (v: number) => void;
  customerCreditAvailable: number;
  customerCreditAmount: number;
  customerCreditLoading: boolean;
  customerCreditError: string | null;
  onCustomerCreditAmountChange: (v: number) => void;
  priceWarning: boolean;
}

const statusConfig: Record<PaymentStatus, { label: string; className: string }> = {
  unpaid: { label: "未付款", className: "bg-destructive text-destructive-foreground" },
  paid: { label: "立即付款", className: "bg-success text-success-foreground" },
  deposit: { label: "部分付款 / 訂金", className: "bg-warning text-warning-foreground" },
};

const PaymentSection = ({
  subtotal, finalPrice, priceOverridden,
  allowPriceOverride,
  onFinalPriceChange, onResetPrice,
  paymentStatus, onPaymentStatusChange,
  paymentMethod, onPaymentMethodChange,
  paymentReference, onPaymentReferenceChange,
  paymentOptions, paymentOptionsLoading, paymentOptionsError,
  depositAmount, onDepositAmountChange,
  customerCreditAvailable, customerCreditAmount,
  customerCreditLoading, customerCreditError,
  onCustomerCreditAmountChange,
  priceWarning,
}: PaymentSectionProps) => {
  const maximumCredit = Math.max(0, Math.min(customerCreditAvailable, finalPrice));
  const externalPaymentAmount = paymentStatus === "paid"
    ? Math.max(0, finalPrice - customerCreditAmount)
    : paymentStatus === "deposit"
      ? depositAmount
      : 0;
  const shouldShowCredit = customerCreditLoading
    || Boolean(customerCreditError)
    || customerCreditAvailable > 0
    || customerCreditAmount > 0;

  return (
  <div className="rounded-xl border border-border bg-card p-4 space-y-4">
    <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
      <CreditCard className="w-4 h-4" />
      付款
    </h2>

    {/* Price summary */}
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">小計</span>
        <span className="font-mono">${formatMoney(subtotal)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <Label className="text-sm font-semibold">最終價格</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">$</span>
          <Input
            aria-label="最終價格"
            type="number"
            value={finalPrice || ""}
            onChange={(e) => onFinalPriceChange(normalizeWholeMoney(parseFloat(e.target.value) || 0))}
            className="w-28 text-right font-mono text-lg font-bold h-10"
            min={0}
            step="1"
            readOnly={!allowPriceOverride}
            aria-readonly={!allowPriceOverride}
          />
          {allowPriceOverride && priceOverridden && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={onResetPrice}>
              重設
            </Button>
          )}
        </div>
      </div>
      {priceWarning && (
        <div className="flex items-center gap-1.5 text-destructive text-xs">
          <AlertTriangle className="w-3.5 h-3.5" />
          訂單總額必須大過 $0，未能提交
        </div>
      )}
    </div>

    {shouldShowCredit && (
      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <HandCoins className="h-4 w-4 shrink-0 text-emerald-700" />
            <div>
              <Label htmlFor="use-customer-credit" className="text-sm font-medium">
                使用 Customer Credit
              </Label>
              <p className="text-xs text-muted-foreground">
                {customerCreditLoading
                  ? "正在查詢可用餘額..."
                  : `可用餘額 $${formatMoney(customerCreditAvailable)}`}
              </p>
            </div>
          </div>
          <Switch
            id="use-customer-credit"
            aria-label="使用 Customer Credit"
            checked={customerCreditAmount > 0}
            disabled={customerCreditLoading || Boolean(customerCreditError) || maximumCredit <= 0}
            onCheckedChange={(checked) => onCustomerCreditAmountChange(checked ? maximumCredit : 0)}
          />
        </div>
        {customerCreditError && (
          <p role="alert" className="text-xs text-destructive">
            {customerCreditError}
          </p>
        )}
        {customerCreditAmount > 0 && (
          <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
            <Label htmlFor="customer-credit-amount" className="text-xs">
              今次使用 Customer Credit 金額 ($)
            </Label>
            <Input
              id="customer-credit-amount"
              aria-label="今次使用 Customer Credit 金額"
              type="number"
              value={customerCreditAmount || ""}
              onChange={(event) => onCustomerCreditAmountChange(
                normalizeWholeMoney(parseFloat(event.target.value) || 0),
              )}
              className="font-mono"
              min={0}
              max={maximumCredit}
              step="1"
            />
            <p className="text-xs text-muted-foreground">
              最多可用 ${formatMoney(maximumCredit)}；提交時會由 Odoo 再核對餘額。
            </p>
          </div>
        )}
      </div>
    )}

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

    {/* Payment method - show for paid and deposit */}
    {(paymentStatus === "paid" || paymentStatus === "deposit") && externalPaymentAmount > 0 && (
      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
        <Label className="text-xs">付款方式</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {paymentOptions.map((m) => (
            <button
              key={m.code}
              onClick={() => onPaymentMethodChange(m.code)}
              className={`rounded-lg py-2 px-2 text-xs font-medium transition-all border ${
                paymentMethod === m.code
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {paymentOptionsLoading && <p className="text-xs text-muted-foreground">正在檢查 Odoo 收款設定...</p>}
        {!paymentOptionsLoading && paymentOptions.length === 0 && (
          <p className="text-xs text-destructive">
            {paymentOptionsError || "Odoo Accounting 收款設定尚未準備好"}
          </p>
        )}
        {!paymentOptionsLoading && paymentOptions.length > 0 && paymentOptionsError && (
          <p className="text-xs text-amber-700">
            {paymentOptionsError}；現正沿用上次成功取得嘅付款方式，你仍然可以繼續收款。
          </p>
        )}
        <div className="space-y-1 pt-1">
          <Label htmlFor="payment-reference" className="text-xs">付款參考編號（建議填寫）</Label>
          <Input
            id="payment-reference"
            value={paymentReference}
            onChange={(event) => onPaymentReferenceChange(event.target.value)}
            placeholder="收據、卡機、FPS 或銀行參考編號"
            maxLength={120}
          />
          <p className="text-xs text-muted-foreground">
            留空時系統會自動產生 POS 參考編號，唔會阻礙收款。
          </p>
        </div>
      </div>
    )}

    {/* Deposit amount */}
    {paymentStatus === "deposit" && (
      <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
        <Label className="text-xs">訂金金額 ($)</Label>
        <Input
          aria-label="訂金金額"
          type="number"
          value={depositAmount || ""}
          onChange={(e) => onDepositAmountChange(normalizeWholeMoney(parseFloat(e.target.value) || 0))}
          placeholder="輸入已付訂金"
          className="font-mono"
          min={0}
          step="1"
        />
        {(depositAmount > 0 || customerCreditAmount > 0) && (
          <p className="text-xs text-muted-foreground">
            尚欠 <span className="font-mono font-medium text-destructive">
              ${formatMoney(Math.max(0, finalPrice - customerCreditAmount - depositAmount))}
            </span>
          </p>
        )}
      </div>
    )}

  </div>
  );
};

export default PaymentSection;
