import { useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import CustomerHistoryPanel from "@/components/pos/CustomerHistoryPanel";
import type { DemoCustomer } from "@/data/demo-customers";
import type { DeliveryAddressSelection } from "@/lib/hk-address";

interface CustomerHistoryDockProps {
  customer: DemoCustomer;
  onOpenChange?: (open: boolean) => void;
  onUseAddress?: (selection: DeliveryAddressSelection) => void;
}

const CustomerHistoryDock = ({
  customer,
  onOpenChange,
  onUseAddress,
}: CustomerHistoryDockProps) => {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
    onOpenChange?.(true);
  }, [customer.id, onOpenChange]);

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
      />
    );
  }

  return (
    <aside
      aria-label="已摺疊的客戶記錄"
      className="sticky top-[49px] z-auto flex h-[calc(100vh-49px)] w-14 shrink-0 justify-center border-r border-border bg-card/80 pt-3 backdrop-blur-sm"
    >
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-11 w-11 flex-col gap-2 px-1 py-3 text-xs"
        aria-label={`打開 ${customer.name} 客戶記錄`}
        title="打開客戶記錄"
        onClick={() => setDockOpen(true)}
      >
        <PanelLeftOpen className="h-4 w-4" />
        <span className="[writing-mode:vertical-rl] tracking-widest">
          客戶記錄
        </span>
      </Button>
    </aside>
  );
};

export default CustomerHistoryDock;
