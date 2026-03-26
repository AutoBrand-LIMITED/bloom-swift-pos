import { History, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";
import type { DemoCustomer } from "@/data/demo-customers";

interface CustomerHistoryPanelProps {
  customer: DemoCustomer | null;
  onClose: () => void;
  onUseAddress?: (address: string, recipientName?: string) => void;
}

const CustomerHistoryPanel = ({ customer, onClose, onUseAddress }: CustomerHistoryPanelProps) => {
  const totalSpent = customer?.history.reduce((s, h) => s + h.total, 0) ?? 0;
  const unpaidCount = customer?.history.filter((h) => h.status === "unpaid").length ?? 0;
  const unpaidTotal = customer?.history
    .filter((h) => h.status === "unpaid")
    .reduce((s, h) => s + h.total, 0) ?? 0;

  const pastAddresses = useMemo(() => {
    if (!customer) return [];
    const seen = new Set<string>();
    const addrs: { address: string; recipientName?: string; date: string }[] = [];
    for (const h of customer.history) {
      const addr = h.deliveryAddress?.trim();
      if (addr && !seen.has(addr)) {
        seen.add(addr);
        addrs.push({ address: addr, recipientName: h.recipientName, date: h.date });
      }
    }
    return addrs;
  }, [customer]);

  if (!customer) return null;
  const unpaidCount = customer.history.filter((h) => h.status === "unpaid").length;
  const unpaidTotal = customer.history
    .filter((h) => h.status === "unpaid")
    .reduce((s, h) => s + h.total, 0);

  // Extract unique past addresses
  const pastAddresses = useMemo(() => {
    const seen = new Set<string>();
    const addrs: { address: string; recipientName?: string; date: string }[] = [];
    for (const h of customer.history) {
      const addr = h.deliveryAddress?.trim();
      if (addr && !seen.has(addr)) {
        seen.add(addr);
        addrs.push({ address: addr, recipientName: h.recipientName, date: h.date });
      }
    }
    return addrs;
  }, [customer.history]);

  return (
    <div className="w-72 shrink-0 border-r border-border bg-card flex flex-col h-[calc(100vh-49px)] sticky top-[49px]">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <History className="w-4 h-4 text-primary" />
          客戶記錄
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Customer summary */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {customer.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold">{customer.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{customer.phone}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-secondary/50 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">累計消費</p>
            <p className="text-sm font-bold font-mono text-primary">${totalSpent.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">訂單數</p>
            <p className="text-sm font-bold font-mono">{customer.history.length}</p>
          </div>
        </div>
        {unpaidCount > 0 && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2 flex items-center justify-between">
            <span className="text-xs text-destructive font-medium">{unpaidCount} 筆未付款</span>
            <span className="text-xs font-mono font-bold text-destructive">${unpaidTotal.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Past addresses */}
      {pastAddresses.length > 0 && (
        <div className="p-3 border-b border-border space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3 h-3" /> 過往送貨地址
          </p>
          {pastAddresses.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onUseAddress?.(a.address, a.recipientName)}
              className="w-full text-left rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 p-2 transition-colors group"
            >
              <p className="text-xs leading-relaxed">{a.address}</p>
              {a.recipientName && (
                <p className="text-[10px] text-muted-foreground mt-0.5">收貨人：{a.recipientName}</p>
              )}
              <p className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                點擊使用此地址 →
              </p>
            </button>
          ))}
        </div>
      )}

      {/* History list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">購買記錄</p>
          {customer.history.map((h, i) => (
            <div
              key={i}
              className={`rounded-lg border p-2.5 space-y-1 ${
                h.status === "unpaid" ? "border-destructive/30 bg-destructive/5" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">{h.date}</span>
                {h.status === "unpaid" ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">未付</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">已付</span>
                )}
              </div>
              <p className="text-xs">{h.items}</p>
              {h.deliveryAddress && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5 inline" /> {h.deliveryAddress}
                </p>
              )}
              <p className="text-xs font-mono font-semibold text-right">${h.total.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default CustomerHistoryPanel;
