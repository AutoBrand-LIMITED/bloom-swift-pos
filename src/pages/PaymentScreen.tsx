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
    <div className="relative min-h-screen flex flex-col items-center justify-center p-8 select-none overflow-hidden bg-background">
      {/* Atmosphere — soft radial blooms */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/[0.08] blur-3xl" />
        <div className="absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-primary/[0.06] blur-3xl" />
      </div>

      <div className="relative w-full max-w-xs space-y-6 text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-primary/10 text-primary shrink-0">
            <Flower2 className="w-6 h-6" />
          </span>
          <span className="text-2xl font-bold tracking-tight">Anglo Chinese Florist</span>
        </div>

        {/* Amount */}
        <div className="relative rounded-3xl border border-border/70 bg-card/90 backdrop-blur-sm px-8 py-12 space-y-3 shadow-xl shadow-primary/5">
          <p className="text-[11px] text-muted-foreground/70 uppercase tracking-[0.2em]">{t("label_amount_due")}</p>
          <p className="text-7xl font-bold font-mono tracking-tight text-primary [text-shadow:0_2px_24px_hsl(152_45%_38%/0.25)]">
            ${amount.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground/60 tracking-[0.3em] font-medium">HKD</p>
        </div>

        {/* Reference */}
        <div className="space-y-1 pt-2">
          <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em]">{t("label_reference")}</p>
          <p className="text-xl font-mono font-semibold tracking-[0.2em] text-foreground">{ref}</p>
        </div>

        {/* Footer note */}
        <p className="text-sm text-muted-foreground pt-4">
          {t("hint_contact_staff")}
        </p>
      </div>
    </div>
  );
};

export default PaymentScreen;
