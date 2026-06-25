import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, AlertTriangle, CalendarIcon, Store, MessageCircle, Apple, Wallet, Banknote, ExternalLink, Receipt } from "lucide-react";
import StepBadge from "@/components/pos/StepBadge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { PaymentStatus, PaymentRecord, PaymentEntryType } from "@/types/order";
import { useLanguage } from "@/contexts/LanguageContext";

interface PaymentSectionProps {
  subtotal: number;
  finalPrice: number;
  priceOverridden: boolean;
  onFinalPriceChange: (v: number) => void;
  onResetPrice: () => void;
  paymentStatus: PaymentStatus;
  onPaymentStatusChange: (s: PaymentStatus) => void;
  paymentMethod: string;
  onPaymentMethodChange: (v: string) => void;
  depositAmount: number;
  onDepositAmountChange: (v: number) => void;
  followUpDate: Date | undefined;
  onFollowUpDateChange: (d: Date | undefined) => void;
  reminderOption: string;
  onReminderOptionChange: (v: string) => void;
  priceWarning: boolean;
  orderId?: string;
  invoiceRef?: string;
  payments?: PaymentRecord[];
  isComplete?: boolean;
}

const PAYMENT_TYPE_KEY: Record<PaymentEntryType, "pay_type_deposit" | "pay_type_balance" | "pay_type_full"> = {
  deposit: "pay_type_deposit",
  balance: "pay_type_balance",
  full: "pay_type_full",
};

const STATUS_CLASSNAMES: Record<PaymentStatus, string> = {
  unpaid: "bg-destructive text-destructive-foreground",
  paid: "bg-success text-success-foreground",
  deposit: "bg-warning text-warning-foreground",
};

const PaymentSection = ({
  subtotal, finalPrice, priceOverridden,
  onFinalPriceChange, onResetPrice,
  paymentStatus, onPaymentStatusChange,
  paymentMethod, onPaymentMethodChange,
  depositAmount, onDepositAmountChange,
  followUpDate, onFollowUpDateChange,
  reminderOption, onReminderOptionChange,
  priceWarning, orderId, invoiceRef, payments, isComplete,
}: PaymentSectionProps) => {
  const { t } = useLanguage();

  const PAYMENT_METHODS = [
    { value: "terminal", label: t("method_terminal"), icon: <Store className="w-3.5 h-3.5" /> },
    { value: "whatsapp_link", label: t("method_whatsapp"), icon: <MessageCircle className="w-3.5 h-3.5" /> },
    { value: "apple_pay", label: t("method_apple_pay"), icon: <Apple className="w-3.5 h-3.5" /> },
    { value: "google_pay", label: t("method_google_pay"), icon: <Wallet className="w-3.5 h-3.5" /> },
    { value: "stripe_card", label: t("method_stripe"), icon: <CreditCard className="w-3.5 h-3.5" /> },
    { value: "cash", label: t("method_cash"), icon: <Banknote className="w-3.5 h-3.5" /> },
  ];

  const openPaymentScreen = () => {
    const ref = invoiceRef || (orderId ? orderId.slice(-8).toUpperCase() : "—");
    const url = `/payment?amount=${finalPrice}&ref=${ref}`;
    window.open(url, "_blank", "width=480,height=680,toolbar=no,menubar=no");
  };

  return (
  <div className={`rounded-xl p-4 space-y-4 border transition-colors ${isComplete ? "bg-primary/[0.04] border-primary/20" : "bg-card border-border"}`}>
    <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/85 flex items-center gap-2">
      <StepBadge n={6} done={!!isComplete} />
      <CreditCard className="w-4 h-4" />
      {t("section_payment")}
    </h2>

    {/* Price summary */}
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t("label_subtotal")}</span>
        <span className="font-mono">${subtotal.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <Label className="text-sm font-semibold">{t("label_final_price")}</Label>
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
              {t("btn_reset")}
            </Button>
          )}
        </div>
      </div>
      {priceWarning && (
        <div className="flex items-center gap-1.5 text-warning text-xs">
          <AlertTriangle className="w-3.5 h-3.5" />
          {t("toast_warn_zero_price")}
        </div>
      )}
    </div>

    {/* Payment status */}
    <div className="space-y-2">
      <Label className="text-xs font-medium">{t("label_payment_status")}</Label>
      <div className="grid grid-cols-3 gap-2">
        {(["unpaid", "paid", "deposit"] as PaymentStatus[]).map((status) => {
          const label = t(status === "unpaid" ? "status_unpaid" : status === "paid" ? "status_paid" : "status_deposit");
          const isActive = paymentStatus === status;
          return (
            <button
              key={status}
              onClick={() => onPaymentStatusChange(status)}
              className={`rounded-lg py-2.5 px-3 text-sm font-medium transition-all border-2 ${
                isActive
                  ? `${STATUS_CLASSNAMES[status]} border-transparent shadow-md scale-[1.02]`
                  : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>

    {/* Payment method - show for paid and deposit */}
    {(paymentStatus === "paid" || paymentStatus === "deposit") && (
      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
        <Label className="text-xs font-medium">{t("label_payment_method")}</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.value}
              onClick={() => onPaymentMethodChange(m.value)}
              className={`rounded-lg py-2 px-2 text-xs font-medium transition-all border flex items-center justify-center gap-1.5 ${
                paymentMethod === m.value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>
    )}

    {/* Customer-facing payment screen button */}
    {finalPrice > 0 && (
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 text-xs"
        onClick={openPaymentScreen}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        {t("btn_payment_screen")}
      </Button>
    )}

    {/* Deposit amount */}
    {paymentStatus === "deposit" && (
      <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
        <Label className="text-xs font-medium">{t("label_deposit_amount")}</Label>
        <Input
          type="number"
          value={depositAmount || ""}
          onChange={(e) => onDepositAmountChange(parseFloat(e.target.value) || 0)}
          placeholder={t("placeholder_deposit")}
          className="font-mono"
          min={0}
        />
        {depositAmount > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("label_remaining_due")} <span className="font-mono font-medium text-destructive">${(finalPrice - depositAmount).toLocaleString()}</span>
          </p>
        )}
      </div>
    )}

    {/* Payment ledger — individual timestamps per deposit / balance / full (SOP §2.4) */}
    {payments && payments.length > 0 && (
      <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
        <p className="text-xs font-semibold text-foreground/70 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> {t("payment_ledger")}
        </p>
        <div className="space-y-1.5">
          {payments.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span className={`font-medium px-1.5 py-0.5 rounded ${
                  p.type === "deposit" ? "bg-warning/15 text-warning"
                  : p.type === "balance" ? "bg-primary/10 text-primary"
                  : "bg-success/15 text-success"
                }`}>
                  {t(PAYMENT_TYPE_KEY[p.type])}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {format(new Date(p.at), "yyyy-MM-dd HH:mm")}
                </span>
              </span>
              <span className="font-mono font-semibold tabular-nums">${p.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Follow-up settings for unpaid / deposit */}
    {(paymentStatus === "unpaid" || paymentStatus === "deposit") && (
      <div className="space-y-3 pt-2 border-t border-border animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-center gap-2 text-sm font-medium">
          {t("label_followup")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t("label_followup_date")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left text-sm font-normal",
                    !followUpDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {followUpDate ? format(followUpDate, "yyyy-MM-dd") : t("placeholder_select_date")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={followUpDate}
                  onSelect={onFollowUpDateChange}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t("label_reminder")}</Label>
            <Select value={reminderOption} onValueChange={onReminderOptionChange}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={t("placeholder_select_reminder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("reminder_none")}</SelectItem>
                <SelectItem value="same_day">{t("reminder_same_day")}</SelectItem>
                <SelectItem value="1_day_before">{t("reminder_1_day")}</SelectItem>
                <SelectItem value="3_days_before">{t("reminder_3_days")}</SelectItem>
                <SelectItem value="1_week_before">{t("reminder_1_week")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {followUpDate && (
          <p className="text-xs text-muted-foreground">
            📅 {t("text_will_follow_up")} <span className="font-medium text-foreground">{format(followUpDate, "yyyy-MM-dd")}</span>
            {reminderOption && reminderOption !== "none" && (
              <span>
                {" "}· 🔔 {
                  reminderOption === "same_day" ? t("reminder_same_day") :
                  reminderOption === "1_day_before" ? t("reminder_1_day") :
                  reminderOption === "3_days_before" ? t("reminder_3_days") : t("reminder_1_week")
                }
              </span>
            )}
          </p>
        )}
      </div>
    )}

    {/* Unpaid warning */}
    {paymentStatus === "unpaid" && (
      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2 animate-in fade-in duration-200">
        <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-destructive">{t("warning_unpaid_badge")}</p>
          <p className="text-xs text-destructive/80">{t("warning_unpaid_desc")}</p>
        </div>
      </div>
    )}
  </div>
  );
};

export default PaymentSection;
