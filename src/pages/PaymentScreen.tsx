import { useSearchParams } from "react-router-dom";
import { Flower2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const PaymentScreen = () => {
  const [params] = useSearchParams();
  const { t } = useLanguage();
  const raw = parseInt(params.get("amount") || "0", 10);
  const amount = Number.isNaN(raw) ? 0 : raw;
  const ref = params.get("ref") || "—";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 select-none">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <Flower2 className="w-7 h-7 text-primary" />
          <span className="text-lg font-bold tracking-tight">Anglo Chinese Florist</span>
        </div>

        {/* Amount */}
        <div className="rounded-2xl border border-border bg-card p-8 space-y-3 shadow-sm">
          <p className="text-[11px] text-muted-foreground/70 uppercase tracking-widest">{t("label_amount_due")}</p>
          <p className="text-6xl font-bold font-mono tracking-tight text-primary">
            ${amount.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground/50 tracking-widest">HKD</p>
        </div>

        {/* Reference */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">{t("label_reference")}</p>
          <p className="text-xl font-mono font-semibold tracking-widest text-foreground">{ref}</p>
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground">
          {t("hint_contact_staff")}
        </p>
      </div>
    </div>
  );
};

export default PaymentScreen;
