import { useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import CustomerHistoryPanel from "@/components/pos/CustomerHistoryPanel";
import type { DemoCustomer } from "@/data/demo-customers";
import type { DeliveryAddressSelection } from "@/lib/hk-address";

const INLINE_HISTORY_QUERY = "(min-width: 1280px), (min-width: 1024px) and (orientation: landscape)";

const usesInlineHistory = () => (
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia(INLINE_HISTORY_QUERY).matches
);

interface CustomerHistoryDockProps {
  customer: DemoCustomer;
  onOpenChange?: (open: boolean) => void;
  onUseAddress?: (selection: DeliveryAddressSelection) => void;
  addressTargetLabel?: string;
}

const CustomerHistoryDock = ({
  customer,
  onOpenChange,
  onUseAddress,
  addressTargetLabel,
}: CustomerHistoryDockProps) => {
  const [inlineHistory, setInlineHistory] = useState(usesInlineHistory);
  const [open, setOpen] = useState(usesInlineHistory);

  useEffect(() => {
    const media = window.matchMedia(INLINE_HISTORY_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setInlineHistory(event.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    setOpen(inlineHistory);
    onOpenChange?.(inlineHistory);
  }, [customer.id, inlineHistory, onOpenChange]);

  const setDockOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  if (open) {
    return (
      <CustomerHistoryPanel
        customer={customer}
        onClose={() => setDockOpen(false)}
        onUseAddress={onUseAddress}
        addressTargetLabel={addressTargetLabel}
        inline={inlineHistory}
      />
    );
  }

  return (
    <aside
      aria-label="已摺疊的客戶記錄"
      className={inlineHistory
        ? "sticky top-[49px] z-auto flex h-[calc(100vh-49px)] w-14 shrink-0 justify-center border-r border-border bg-card/80 pt-3 backdrop-blur-sm"
        : "fixed bottom-24 left-3 z-50 flex justify-center rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur-sm"}
    >
      <Button
        type="button"
        variant="outline"
        className={inlineHistory
          ? "h-auto min-h-11 w-11 flex-col gap-2 px-1 py-3 text-xs touch-manipulation"
          : "min-h-11 gap-2 px-3 py-2 text-xs touch-manipulation"}
        aria-label={`打開 ${customer.name} 客戶記錄`}
        title="打開客戶記錄"
        onClick={() => setDockOpen(true)}
      >
        <PanelLeftOpen className="h-4 w-4" />
        <span className={inlineHistory ? "[writing-mode:vertical-rl] tracking-widest" : undefined}>
          客戶記錄
        </span>
      </Button>
    </aside>
  );
};

export default CustomerHistoryDock;
