import { AlertCircle, ChevronDown, ChevronUp, Clock, History, MapPin, Package, Phone, RefreshCw, Truck, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useEffect, useMemo, useState } from "react";
import type { DemoCustomer } from "@/data/demo-customers";
import { getOdooCustomerHistory, hasOdooBackend } from "@/lib/odoo-api";
import CustomerFlags from "@/components/pos/CustomerFlags";
import type { DeliveryAddressSelection } from "@/lib/hk-address";

interface CustomerHistoryPanelProps {
  customer: DemoCustomer | null;
  onClose: () => void;
  onUseAddress?: (selection: DeliveryAddressSelection) => void;
}

const formatDateTime = (value?: string) => {
  if (!value) return "未有資料";
  return value.replace("T", " ").slice(0, 16);
};

const formatMoney = (value: number) =>
  `$${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;

const formatQuantity = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

const normalizeIdentityPart = (value?: string) =>
  value?.trim().replace(/\s+/g, " ").toLocaleLowerCase() ?? "";

const samePastAddressIdentity = (
  entry: {
    address: string;
    recipientType?: "personal" | "company";
    recipientCompanyName?: string;
    recipientName?: string;
    recipientPhone?: string;
    shippingPartnerId?: number;
  },
  history: DemoCustomer["history"][number],
  address: string,
) => {
  if (normalizeIdentityPart(entry.address) !== normalizeIdentityPart(address)) return false;
  const historyCompanyName = normalizeIdentityPart(history.recipientCompanyName);
  const historyRecipientType = history.recipientType
    || (historyCompanyName ? "company" : "personal");
  const entryRecipientType = entry.recipientType
    || (normalizeIdentityPart(entry.recipientCompanyName) ? "company" : "personal");
  if (entryRecipientType !== historyRecipientType) return false;
  if (
    normalizeIdentityPart(entry.recipientCompanyName) !== historyCompanyName
  ) return false;
  if (entry.shippingPartnerId || history.shippingPartnerId) {
    return Boolean(
      entry.shippingPartnerId
      && history.shippingPartnerId
      && entry.shippingPartnerId === history.shippingPartnerId,
    );
  }
  return normalizeIdentityPart(entry.recipientName) === normalizeIdentityPart(history.recipientName)
    && normalizeIdentityPart(entry.recipientPhone) === normalizeIdentityPart(history.recipientPhone);
};

const CustomerHistoryPanel = ({ customer, onClose, onUseAddress }: CustomerHistoryPanelProps) => {
  const [odooHistoryState, setOdooHistoryState] = useState<{
    customerId: string;
    data: Pick<DemoCustomer, "history" | "historyCount" | "totalSpent">;
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  useEffect(() => {
    setHistoryExpanded(false);
    setExpandedRecord(null);
  }, [customer?.id]);

  useEffect(() => {
    if (!customer?.odooPartnerId || !hasOdooBackend) {
      setHistoryLoading(false);
      setHistoryError(null);
      return;
    }

    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError(null);

    getOdooCustomerHistory(customer.odooPartnerId, controller.signal)
      .then((data) => setOdooHistoryState({ customerId: customer.id, data }))
      .catch(() => {
        if (!controller.signal.aborted) {
          setHistoryError("未能連接 Odoo，消費金額、訂單數及過往送貨資料暫時未能確認。");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });

    return () => controller.abort();
  }, [customer?.id, customer?.odooPartnerId, historyRefreshKey]);

  const odooHistory = customer && odooHistoryState?.customerId === customer.id
    ? odooHistoryState.data
    : null;
  const historyUnavailable = Boolean(historyError && !odooHistory);

  const displayCustomer = useMemo(() => {
    if (!customer) return null;
    return odooHistory ? { ...customer, ...odooHistory } : customer;
  }, [customer, odooHistory]);

  const totalSpent = displayCustomer?.totalSpent ?? displayCustomer?.history.reduce((s, h) => s + h.total, 0) ?? 0;
  const orderCount = displayCustomer?.historyCount ?? displayCustomer?.history.length ?? 0;

  const pastAddresses = useMemo(() => {
    if (!displayCustomer) return [];
    const addrs: {
      address: string;
      recipientType?: "personal" | "company";
      recipientCompanyName?: string;
      recipientName?: string;
      recipientPhone?: string;
      shippingPartnerId?: number;
      recipientContactNote?: string;
      date: string;
    }[] = [];
    for (const h of displayCustomer.history) {
      const addr = h.deliveryAddress?.trim();
      if (!addr) continue;
      const existing = addrs.find((entry) => samePastAddressIdentity(entry, h, addr));
      if (existing) {
        existing.recipientType ||= h.recipientType;
        existing.recipientCompanyName ||= h.recipientCompanyName;
        existing.recipientName ||= h.recipientName;
        existing.recipientPhone ||= h.recipientPhone;
        existing.recipientContactNote ||= h.recipientContactNote;
      } else {
        addrs.push({
          address: addr,
          recipientType: h.recipientType
            || (h.recipientCompanyName?.trim() ? "company" : "personal"),
          recipientCompanyName: h.recipientCompanyName,
          recipientName: h.recipientName,
          recipientPhone: h.recipientPhone,
          shippingPartnerId: h.shippingPartnerId,
          recipientContactNote: h.recipientContactNote,
          date: h.date,
        });
      }
    }
    return addrs;
  }, [displayCustomer]);

  if (!displayCustomer) return null;

  return (
    <div className="w-[360px] max-w-[85vw] shrink-0 border-r border-border bg-card flex flex-col h-[calc(100vh-49px)] sticky top-[49px] overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <History className="w-4 h-4 text-primary" />
          客戶記錄
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-label="關閉客戶記錄"
          title="關閉客戶記錄"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup
          key={displayCustomer.id}
          direction="vertical"
          autoSaveId="customer-history-panel-layout"
        >
          <ResizablePanel defaultSize={pastAddresses.length > 0 ? 55 : 35} minSize={22} maxSize={78}>
            <div className="h-full overflow-y-auto overscroll-contain">
              {/* Customer summary */}
              <div className="p-3 border-b border-border space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {displayCustomer.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{displayCustomer.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{displayCustomer.phone}</p>
                  </div>
                </div>
                <CustomerFlags tags={displayCustomer.tags} />
                {displayCustomer.commentText?.trim() && (
                  <div className="border-l-2 border-primary/40 pl-2">
                    <p className="text-[10px] font-semibold text-muted-foreground">長期備註</p>
                    <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed">
                      {displayCustomer.commentText}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-secondary/50 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">累計消費</p>
                    <p className="text-sm font-bold font-mono text-primary">
                      {historyLoading && !odooHistory
                        ? "載入中"
                        : historyUnavailable
                          ? "未確認"
                          : formatMoney(totalSpent)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">訂單數</p>
                    <p className="text-sm font-bold font-mono">
                      {historyLoading && !odooHistory
                        ? "載入中"
                        : historyUnavailable
                          ? "未確認"
                          : orderCount}
                    </p>
                  </div>
                </div>
                {historyError && (
                  <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-2.5">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                      <p className="text-[11px] leading-relaxed text-destructive">{historyError}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 min-h-9 gap-1.5 px-2.5 text-[11px]"
                      onClick={() => setHistoryRefreshKey((key) => key + 1)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      重新載入
                    </Button>
                  </div>
                )}
              </div>

              {/* Past addresses */}
              {pastAddresses.length > 0 && (
                <div className="p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> 過往送貨地址
                  </p>
                  {pastAddresses.slice(0, 3).map((a, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`使用過往地址 ${a.address}`}
                      onClick={() => onUseAddress?.({
                        address: a.address,
                        recipientType: a.recipientType,
                        ...(a.recipientCompanyName
                          ? { recipientCompanyName: a.recipientCompanyName }
                          : {}),
                        recipientName: a.recipientName,
                        recipientPhone: a.recipientPhone,
                        shippingPartnerId: a.shippingPartnerId,
                      })}
                      className="w-full text-left rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 p-2 transition-colors group"
                    >
                      <p className="text-xs leading-relaxed">{a.address}</p>
                      {a.recipientCompanyName && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          公司：{a.recipientCompanyName}
                        </p>
                      )}
                      {a.recipientName && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">收貨人：{a.recipientName}</p>
                      )}
                      {a.recipientPhone && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">電話：{a.recipientPhone}</p>
                      )}
                      {a.recipientContactNote && (
                        <p className="mt-1 whitespace-pre-wrap border-l-2 border-primary/30 pl-1.5 text-[10px] leading-relaxed text-muted-foreground">
                          收花人長期備註：{a.recipientContactNote}
                        </p>
                      )}
                      <p className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                        點擊使用此地址 →
                      </p>
                    </button>
                  ))}
                  {pastAddresses.length > 3 && (
                    <p className="text-[10px] text-muted-foreground">另有 {pastAddresses.length - 3} 個過往地址可喺消費紀錄入面查看</p>
                  )}
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle
            withHandle
            aria-label="上下拖拉以調整客戶資料與購買記錄高度"
            className="!h-4 cursor-row-resize bg-secondary/40 transition-colors hover:bg-primary/10"
          />

          {/* History list */}
          <ResizablePanel defaultSize={pastAddresses.length > 0 ? 45 : 65} minSize={22}>
            <div className="h-full overflow-y-auto overscroll-contain">
              <div className="p-3 space-y-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full justify-between gap-2 px-3 text-left"
            onClick={() => setHistoryExpanded((open) => !open)}
          >
            <span className="flex items-center gap-2 text-xs font-medium">
              <History className="w-3.5 h-3.5 text-primary" />
              {historyExpanded ? "隱藏過往消費紀錄" : "查看呢位客人過往消費紀錄"}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {historyLoading
                ? "載入中"
                : historyUnavailable
                  ? "未確認"
                  : `${orderCount} 筆`}
              {historyExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </Button>

          {historyExpanded && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">購買記錄</p>
              {orderCount > displayCustomer.history.length && displayCustomer.history.length > 0 && (
                <p className="text-[10px] text-muted-foreground mb-2">
                  顯示最近 {displayCustomer.history.length} / 共 {orderCount} 筆
                </p>
              )}
              {historyLoading && (
                <p className="text-xs text-muted-foreground py-2">正在載入 Odoo 購買記錄...</p>
              )}
              {!historyLoading && displayCustomer.history.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">未有最近購買記錄</p>
              )}
              {displayCustomer.history.map((h, i) => {
            const recordKey = String(h.id ?? `${h.invoiceNumber ?? h.date}-${i}`);
            const isExpanded = expandedRecord === recordKey;
            const hasLines = Boolean(h.lines?.length);
            const primaryDeliveryDate = h.deliveryDate || h.date;

            return (
              <div
                key={recordKey}
                className={`rounded-lg border p-2.5 space-y-2 ${
                  h.status === "unpaid" ? "border-destructive/30 bg-destructive/5" : "border-border bg-background"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold font-mono truncate">
                      {h.invoiceNumber ?? `訂單 ${i + 1}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Truck className="w-3 h-3" />
                      送貨：{formatDateTime(primaryDeliveryDate)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    {h.status === "unpaid" ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">未付</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">已付</span>
                    )}
                    <p className="text-sm font-mono font-bold">{formatMoney(h.total)}</p>
                  </div>
                </div>

                <div className="grid gap-1.5 text-[11px] text-muted-foreground">
                  <p className="flex items-start gap-1.5">
                    <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      落單：{formatDateTime(h.dateTime)}
                    </span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <User className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="break-words">
                      {h.recipientCompanyName
                        ? `收貨公司：${h.recipientCompanyName} · 聯絡人：${h.recipientName || "未有資料"}`
                        : `收花人：${h.recipientName || "未有資料"}`}
                    </span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <Phone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="break-all">
                      電話：{h.recipientPhone || displayCustomer.phone || "未有資料"}
                    </span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2 break-words">
                      地址：{h.deliveryAddress || "未有資料"}
                    </span>
                  </p>
                  {h.salesperson && (
                    <p className="flex items-start gap-1.5">
                      <User className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>銷售：{h.salesperson}</span>
                    </p>
                  )}
                </div>

                <div className="rounded-md bg-secondary/40 p-2">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
                    <Package className="w-3 h-3" />
                    購買內容
                  </p>
                  <p className="text-xs leading-relaxed line-clamp-2">{h.items}</p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  {h.deliveryDetailsMissing ? (
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                      部分送貨資料缺失
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      {hasLines ? `${h.lines?.length} 項商品` : "未有商品明細"}
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    {h.deliveryAddress && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-9 min-w-11 px-2 text-[11px]"
                        onClick={() => onUseAddress?.({
                          address: h.deliveryAddress!,
                          recipientType: h.recipientType
                            || (h.recipientCompanyName?.trim() ? "company" : "personal"),
                          ...(h.recipientCompanyName
                            ? { recipientCompanyName: h.recipientCompanyName }
                            : {}),
                          recipientName: h.recipientName,
                          recipientPhone: h.recipientPhone,
                          shippingPartnerId: h.shippingPartnerId,
                        })}
                      >
                        用地址
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-9 min-w-11 px-2 text-[11px] gap-1"
                      onClick={() => setExpandedRecord(isExpanded ? null : recordKey)}
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      詳情
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border pt-2 space-y-2">
                    <div className="grid gap-1 text-[11px]">
                      <p><span className="text-muted-foreground">Invoice：</span>{h.invoiceNumber ?? "未有資料"}</p>
                      <p><span className="text-muted-foreground">下單／付款人：</span>{h.customerName || displayCustomer.name || "未有資料"}</p>
                      <p><span className="text-muted-foreground">送花人：</span>{h.senderName || h.customerName || displayCustomer.name || "未有資料"}</p>
                      {h.recipientCompanyName && (
                        <p><span className="text-muted-foreground">收貨公司：</span>{h.recipientCompanyName}</p>
                      )}
                      <p><span className="text-muted-foreground">收花人：</span>{h.recipientName || "未有資料"}</p>
                      <p><span className="text-muted-foreground">收花電話：</span>{h.recipientPhone || "未有資料"}</p>
                      <p className="break-words"><span className="text-muted-foreground">送貨地址：</span>{h.deliveryAddress || "未有資料"}</p>
                      <p><span className="text-muted-foreground">銷售員：</span>{h.salesperson || "未有資料"}</p>
                      <p><span className="text-muted-foreground">送貨員：</span>{h.deliveryPerson || "舊資料未有記錄"}</p>
                      {(h.senderDoNumber || h.recipientDoNumber) && (
                        <p className="break-words">
                          <span className="text-muted-foreground">DO：</span>
                          {[h.senderDoNumber, h.recipientDoNumber].filter(Boolean).join(" / ")}
                        </p>
                      )}
                      {h.customerEmail && (
                        <p className="break-all">
                          <span className="text-muted-foreground">客戶電郵：</span>{h.customerEmail}
                        </p>
                      )}
                      {h.billingAddress && (
                        <p className="break-words">
                          <span className="text-muted-foreground">帳單地址：</span>{h.billingAddress}
                        </p>
                      )}
                      {h.customerGroup && (
                        <p className="break-words">
                          <span className="text-muted-foreground">Customer Group：</span>{h.customerGroup}
                        </p>
                      )}
                      {h.sourceReference && (
                        <p className="break-words">
                          <span className="text-muted-foreground">Reference：</span>{h.sourceReference}
                        </p>
                      )}
                      {h.department && (
                        <p className="break-words">
                          <span className="text-muted-foreground">Department：</span>{h.department}
                        </p>
                      )}
                      {h.terms && (
                        <p className="whitespace-pre-wrap break-words">
                          <span className="text-muted-foreground">Terms：</span>{h.terms}
                        </p>
                      )}
                      {h.senderNote && (
                        <p className="whitespace-pre-wrap break-words">
                          <span className="text-muted-foreground">送花人備註：</span>{h.senderNote}
                        </p>
                      )}
                      {h.deliveryNote && (
                        <p className="whitespace-pre-wrap break-words">
                          <span className="text-muted-foreground">送貨備註：</span>{h.deliveryNote}
                        </p>
                      )}
                      {h.recipientContactNote && (
                        <p className="whitespace-pre-wrap break-words">
                          <span className="text-muted-foreground">收花人長期備註：</span>{h.recipientContactNote}
                        </p>
                      )}
                      {h.internalNote && (
                        <p className="whitespace-pre-wrap break-words">
                          <span className="text-muted-foreground">內部備註：</span>{h.internalNote}
                        </p>
                      )}
                    </div>

                    {hasLines && (
                      <div className="space-y-1">
                        {h.lines?.map((line, lineIndex) => (
                          <div key={`${recordKey}-${lineIndex}`} className="rounded-md bg-secondary/30 p-2">
                            <div className="flex justify-between gap-2">
                              <p className="text-[11px] font-medium leading-relaxed break-words">{line.name}</p>
                              <p className="text-[11px] font-mono shrink-0">{formatMoney(line.subtotal)}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {[line.itemCode, `Qty ${formatQuantity(line.quantity)}`, line.packing].filter(Boolean).join(" · ")}
                            </p>
                            {line.remarks && (
                              <p className="mt-1 whitespace-pre-wrap break-words text-[10px]">
                                <span className="text-muted-foreground">Remarks：</span>{line.remarks}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
              })}
            </div>
          )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default CustomerHistoryPanel;
