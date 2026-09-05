import { useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import CustomerHistoryPanel from "@/components/pos/CustomerHistoryPanel";
import type { DemoCustomer } from "@/data/demo-customers";
import type { DeliveryAddressSelection } from "@/lib/hk-address";

const DESKTOP_DOCK_QUERY = "(min-width: 1280px)";

const usesDesktopDock = () => (
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia(DESKTOP_DOCK_QUERY).matches
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
  const [desktopDock, setDesktopDock] = useState(usesDesktopDock);
  const [open, setOpen] = useState(usesDesktopDock);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_DOCK_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setDesktopDock(event.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    setOpen(desktopDock);
    onOpenChange?.(desktopDock);
  }, [customer.id, desktopDock, onOpenChange]);

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
      />
    );
  }

  return (
    <aside
      aria-label="已摺疊的客戶記錄"
      className="fixed bottom-24 left-3 z-50 flex justify-center rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur-sm xl:sticky xl:top-[49px] xl:bottom-auto xl:left-auto xl:z-auto xl:h-[calc(100vh-49px)] xl:w-14 xl:shrink-0 xl:rounded-none xl:border-y-0 xl:border-l-0 xl:bg-card/80 xl:pt-3 xl:shadow-none"
    >
      <Button
        type="button"
        variant="outline"
        className="min-h-11 gap-2 px-3 py-2 text-xs touch-manipulation xl:h-auto xl:w-11 xl:flex-col xl:px-1 xl:py-3"
        aria-label={`打開 ${customer.name} 客戶記錄`}
        title="打開客戶記錄"
        onClick={() => setDockOpen(true)}
      >
        <PanelLeftOpen className="h-4 w-4" />
        <span className="xl:[writing-mode:vertical-rl] xl:tracking-widest">
          客戶記錄
        </span>
      </Button>
    </aside>
  );
};

export default CustomerHistoryDock;
