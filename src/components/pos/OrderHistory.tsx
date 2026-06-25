import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, X, Search, Pencil, RefreshCw, Calendar, Phone, Receipt, Wallet, ChevronDown, History as HistoryIcon, Plus, SlidersHorizontal, CheckSquare, Square, Printer } from "lucide-react";
import { generatePickingList, generateDeliveryNote, printBatch } from "@/lib/print-utils";
import PrintButtons from "@/components/pos/PrintButtons";
import type { Order, PaymentStatus, PaymentEntryType, AuditAction } from "@/types/order";
import { SALES_STAFF } from "@/types/order";
import { useLanguage } from "@/contexts/LanguageContext";
import { productLabel } from "@/lib/product-i18n";
import type { TranslationKey } from "@/lib/i18n";

function orderDeliveryDates(o: Order): string[] {
  const dates = (o.deliveries?.map(d => d.deliveryDate).filter(Boolean) ?? []);
  if (dates.length === 0 && o.deliveryDate) dates.push(o.deliveryDate);
  return dates;
}

function highlight(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const lower = text.toLowerCase();
  const lowerQ = trimmed.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let cursor = 0, idx: number;
  while ((idx = lower.indexOf(lowerQ, cursor)) !== -1) {
    if (idx > cursor) nodes.push(text.slice(cursor, idx));
    nodes.push(<mark key={idx} className="bg-primary/20 text-foreground rounded-sm not-italic">{text.slice(idx, idx + trimmed.length)}</mark>);
    cursor = idx + trimmed.length;
  }
  nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const PAYMENT_TYPE_KEY: Record<PaymentEntryType, TranslationKey> = {
  deposit: "pay_type_deposit",
  balance: "pay_type_balance",
  full: "pay_type_full",
};

const AUDIT_KEY: Record<AuditAction, TranslationKey> = {
  created: "audit_created",
  amended: "audit_amended",
  balance_settled: "audit_balance_settled",
  note_added: "audit_note_added",
};

interface OrderHistoryProps {
  orders: Order[];
  open: boolean;
  onClose: () => void;
  onEdit?: (order: Order) => void;
  onReorder?: (order: Order) => void;
  onSettleBalance?: (order: Order) => void;
  onAddNote?: (order: Order, note: string) => void;
}

const STATUS_STYLES: Record<PaymentStatus, string> = {
  unpaid: "bg-red-50 text-red-700 border border-red-200",
  paid: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  deposit: "bg-amber-50 text-amber-700 border border-amber-200",
};

const OCCASION_KEYS: TranslationKey[] = [
  "occasion_birthday", "occasion_mothers_day", "occasion_fathers_day",
  "occasion_valentines", "occasion_christmas", "occasion_anniversary",
  "occasion_graduation", "occasion_new_year", "occasion_other",
];

const OrderHistory = ({ orders, open, onClose, onEdit, onReorder, onSettleBalance, onAddNote }: OrderHistoryProps) => {
  const { t, lang } = useLanguage();
  const [searchText, setSearchText] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [occasionFilter, setOccasionFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // How many orders were ever delivered to each recipient (across all orders)
  const recipientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      const names = new Set(
        (o.deliveries?.map(d => d.recipientName) ?? [o.recipientName])
          .map(n => (n ?? "").trim().toLowerCase())
          .filter(Boolean)
      );
      for (const n of names) counts[n] = (counts[n] ?? 0) + 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (staffFilter !== "all") {
      result = result.filter(o => o.salesId === staffFilter);
    }

    if (paymentFilter !== "all") {
      result = result.filter(o => o.paymentStatus === paymentFilter);
    }

    if (occasionFilter !== "all") {
      result = result.filter(o => o.occasionTag === occasionFilter);
    }

    if (periodFilter !== "all") {
      const cutoff = periodFilter === "today"
        ? new Date().toISOString().slice(0, 10)
        : periodFilter === "last7"
        ? daysAgo(7)
        : daysAgo(30);
      result = result.filter(o => {
        const date = (o.createdAt || "").slice(0, 10);
        return periodFilter === "today" ? date === cutoff : date >= cutoff;
      });
    }

    // Delivery-date range filter
    if (dateFrom || dateTo || upcomingOnly) {
      const today = new Date().toISOString().slice(0, 10);
      result = result.filter(o => {
        const dates = orderDeliveryDates(o);
        if (dates.length === 0) return false;
        return dates.some(d => {
          if (dateFrom && d < dateFrom) return false;
          if (dateTo && d > dateTo) return false;
          if (upcomingOnly && d < today) return false;
          return true;
        });
      });
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(o =>
        o.customerName?.toLowerCase().includes(q) ||
        o.phone?.includes(q) ||
        o.invoiceNumber?.toLowerCase().includes(q) ||
        o.recipientName?.toLowerCase().includes(q) ||
        o.deliveries?.some(d =>
          d.recipientName?.toLowerCase().includes(q) || d.recipientPhone?.includes(q)
        )
      );
    }

    return result;
  }, [orders, staffFilter, paymentFilter, occasionFilter, periodFilter, dateFrom, dateTo, upcomingOnly, searchText]);

  const driverGroups = useMemo(() => {
    const sorted = [...filteredOrders].sort((a, b) => {
      const da = a.deliveryDate || "";
      const db = b.deliveryDate || "";
      if (da !== db) return da.localeCompare(db);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const groups: Record<string, Order[]> = {};
    for (const order of sorted) {
      const driver = order.deliveryPerson?.trim() || "未分配";
      if (!groups[driver]) groups[driver] = [];
      groups[driver].push(order);
    }

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "未分配") return 1;
      if (b === "未分配") return -1;
      return a.localeCompare(b);
    });
  }, [filteredOrders]);

  const hasFilters = staffFilter !== "all" || periodFilter !== "all" || occasionFilter !== "all"
    || paymentFilter !== "all" || dateFrom !== "" || dateTo !== "" || upcomingOnly || searchText.trim() !== "";
  const clearAll = () => {
    setSearchText(""); setStaffFilter("all"); setPeriodFilter("all");
    setOccasionFilter("all"); setPaymentFilter("all"); setDateFrom(""); setDateTo(""); setUpcomingOnly(false);
  };

  const toggleSelectMode = () => {
    setSelectMode(v => !v);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedOrders = filteredOrders.filter(o => selectedIds.has(o.id));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border-l border-border h-full animate-in slide-in-from-right duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              {t("panel_order_history")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
              {filteredOrders.length} / {orders.length}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 text-xs px-2 gap-1.5 ${selectMode ? "text-primary" : "text-muted-foreground"}`}
              onClick={toggleSelectMode}
            >
              {selectMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{selectMode ? t("btn_cancel_select") : t("btn_select_mode")}</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 pt-3 pb-3 space-y-2 shrink-0 border-b border-border bg-muted/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder={t("placeholder_search_history")}
              className="pl-8 h-9 text-sm bg-card"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                aria-label={t("btn_clear_search")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="h-8 text-xs flex-1 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("label_all_staff")}</SelectItem>
                {SALES_STAFF.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="h-8 text-xs flex-1 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filter_all")}</SelectItem>
                <SelectItem value="today">{t("filter_today")}</SelectItem>
                <SelectItem value="last7">{t("filter_last7")}</SelectItem>
                <SelectItem value="last30">{t("filter_last30")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 text-xs px-2 shrink-0 ${showFilters ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => setShowFilters(s => !s)}
              aria-label={t("btn_more_filters")}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </Button>
          </div>

          {showFilters && (
            <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="h-8 text-xs bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filter_all_status")}</SelectItem>
                  <SelectItem value="paid">{t("status_paid_short")}</SelectItem>
                  <SelectItem value="unpaid">{t("status_unpaid_short")}</SelectItem>
                  <SelectItem value="deposit">{t("status_deposit_short")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={occasionFilter} onValueChange={setOccasionFilter}>
                <SelectTrigger className="h-8 text-xs bg-card">
                  <SelectValue placeholder={t("label_all_occasions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("label_all_occasions")}</SelectItem>
                  {OCCASION_KEYS.map(k => (
                    <SelectItem key={k} value={k}>{t(k)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-0.5">
                  <label className="text-[10px] text-muted-foreground">{t("label_filter_date_from")}</label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs bg-card" />
                </div>
                <div className="flex-1 space-y-0.5">
                  <label className="text-[10px] text-muted-foreground">{t("label_filter_date_to")}</label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs bg-card" />
                </div>
              </div>
              <button
                onClick={() => setUpcomingOnly(v => !v)}
                className={`w-full rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                  upcomingOnly ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {t("filter_upcoming")}
              </button>
            </div>
          )}

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs text-muted-foreground"
              onClick={clearAll}
            >
              {t("btn_clear_filters")}
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <ClipboardList className="w-8 h-8 opacity-30" />
              <p className="text-sm">{hasFilters ? t("msg_no_orders_filtered") : t("msg_no_orders")}</p>
              {hasFilters && (
                <button onClick={clearAll} className="text-xs text-primary underline underline-offset-2 hover:no-underline mt-1">
                  {t("btn_clear_filters")}
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {driverGroups.map(([driver, driverOrders]) => (
                <div key={driver}>
                  {/* Driver group header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-0.5 h-4 rounded-full bg-primary/40 shrink-0" />
                    <span className="text-xs font-bold text-foreground/70 uppercase tracking-wider">
                      {driver === "未分配" ? t("text_unassigned") : driver}
                    </span>
                    <span className="ml-auto text-xs font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground tabular-nums">
                      {driverOrders.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {driverOrders.map((order) => {
                      const badgeLabel = t(
                        order.paymentStatus === "unpaid" ? "status_unpaid"
                        : order.paymentStatus === "paid" ? "status_paid"
                        : "status_deposit"
                      );
                      const extraDeliveries = (order.deliveries?.length ?? 0) > 1
                        ? order.deliveries!.slice(1)
                        : [];
                      const primaryDate = order.deliveries?.[0]?.deliveryDate || order.deliveryDate || "";
                      const primaryTime = order.deliveries?.[0]?.deliveryTime || order.deliveryTime || "";
                      const primaryRecipient = (order.deliveries?.[0]?.recipientName || order.recipientName || "").trim();
                      const recipientCount = primaryRecipient ? (recipientCounts[primaryRecipient.toLowerCase()] ?? 0) : 0;
                      const depositPaid = (order.payments ?? []).filter(p => p.type === "deposit").reduce((s, p) => s + p.amount, 0);
                      const balanceDue = order.finalPrice - depositPaid;
                      const isOpen = openId === order.id;
                      const isExpanded = expandedId === order.id;
                      const canSettle = order.paymentStatus === "unpaid" || order.paymentStatus === "deposit";

                      const dotColor = order.paymentStatus === "paid"
                        ? "bg-emerald-500"
                        : order.paymentStatus === "unpaid"
                        ? "bg-red-500"
                        : "bg-amber-500";

                      const isSelected = selectedIds.has(order.id);

                      return (
                        <div
                          key={order.id}
                          className={`rounded-lg overflow-hidden border transition-colors ${
                            isSelected ? "border-primary/50 bg-primary/[0.03]" : "border-border"
                          }`}
                        >
                          {/* Compact row — always visible */}
                          <button
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                              isOpen && !selectMode ? "bg-secondary/40" : "hover:bg-secondary/30"
                            }`}
                            onClick={() => {
                              if (selectMode) { toggleSelect(order.id); return; }
                              if (isOpen) { setOpenId(null); setExpandedId(null); }
                              else { setOpenId(order.id); setExpandedId(null); }
                            }}
                          >
                            {selectMode && (
                              <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                isSelected ? "bg-primary border-primary" : "border-border bg-card"
                              }`}>
                                {isSelected && <CheckSquare className="w-3 h-3 text-primary-foreground" />}
                              </span>
                            )}
                            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold truncate leading-tight">
                                  {highlight(order.customerName || order.phone, searchText)}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono text-xs font-bold tabular-nums">${order.finalPrice.toLocaleString()}</span>
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_STYLES[order.paymentStatus]}`}>
                                    {badgeLabel}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                {primaryDate && (
                                  <span className="text-[11px] text-muted-foreground tabular-nums">
                                    {primaryDate}{primaryTime && ` · ${primaryTime}`}
                                  </span>
                                )}
                                {primaryRecipient && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {primaryDate && " → "}<span className="text-foreground/60">{primaryRecipient}</span>
                                  </span>
                                )}
                                {(order.deliveries?.length ?? 0) > 1 && (
                                  <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5 ml-1">
                                    +{(order.deliveries!.length - 1)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                          </button>

                          {/* Expanded detail */}
                          {isOpen && (
                            <div className="px-3 pb-3 pt-2 space-y-2.5 border-t border-border/50 bg-muted/20 animate-in fade-in slide-in-from-top-2 duration-200">
                              {/* Invoice + phone */}
                              <div className="flex items-center justify-between gap-2">
                                {order.invoiceNumber
                                  ? <span className="text-[10px] font-mono font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5">{order.invoiceNumber}</span>
                                  : <span />
                                }
                                <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                                  <Phone className="w-3 h-3 shrink-0" />{order.phone}
                                </span>
                              </div>

                              {/* Extra deliveries only — first already shown in compact row */}
                              {extraDeliveries.length > 0 && (
                                <div className="space-y-1">
                                  {extraDeliveries.map((d, i) => (
                                    <div key={d.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                      <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/50" />
                                      <span>
                                        [{i + 2}] {d.deliveryDate}
                                        {d.deliveryTime && <span className="text-muted-foreground/60"> · {d.deliveryTime}</span>}
                                        {d.recipientName && <span> → <span className="text-foreground/70">{d.recipientName}</span></span>}
                                        {d.deliveryPerson && <span className="text-muted-foreground/60"> ({d.deliveryPerson})</span>}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Items */}
                              <div className="rounded-lg bg-muted/50 px-2.5 py-2 space-y-0.5">
                                {order.items.map((item) => (
                                  <div key={item.id} className="flex justify-between items-baseline">
                                    <span className="text-xs text-foreground/80">{productLabel(item.name, lang)} × {item.quantity}</span>
                                    <span className="text-xs font-mono text-foreground/70 tabular-nums">${(item.price * item.quantity).toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Deposit / balance due */}
                              {order.paymentStatus === "deposit" && (
                                <div className="flex items-center justify-between text-xs rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
                                  <span className="text-amber-700">{t("pay_type_deposit")} ${depositPaid.toLocaleString()}</span>
                                  <span className="font-mono font-semibold text-destructive">{t("label_remaining_due")} ${balanceDue.toLocaleString()}</span>
                                </div>
                              )}

                              {/* Timestamp + total */}
                              <div className="flex items-center justify-between pt-0.5 border-t border-border/60">
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {new Date(order.createdAt).toLocaleString(lang === "zh" ? "zh-HK" : "en-US")}
                                </span>
                                <span className="font-mono font-bold text-sm tabular-nums">${order.finalPrice.toLocaleString()}</span>
                              </div>

                              {/* Settle balance / mark paid */}
                              {canSettle && onSettleBalance && (
                                <Button
                                  size="sm"
                                  className="w-full h-9 text-xs gap-1.5 bg-primary"
                                  onClick={() => onSettleBalance(order)}
                                >
                                  <Wallet className="w-3.5 h-3.5" />
                                  {order.paymentStatus === "deposit" ? t("btn_settle_balance") : t("btn_mark_paid")}
                                </Button>
                              )}

                              {/* Print buttons */}
                              <PrintButtons order={order} compact />

                              {/* Edit / Reorder */}
                              {(onEdit || onReorder) && (
                                <div className="flex gap-2 pt-0.5">
                                  {onEdit && (
                                    <Button
                                      variant="outline"
                                      className="flex-1 h-9 text-xs gap-1.5"
                                      onClick={() => { onEdit(order); onClose(); }}
                                    >
                                      <Pencil className="w-3.5 h-3.5" /> {t("btn_edit_order")}
                                    </Button>
                                  )}
                                  {onReorder && (
                                    <Button
                                      variant="ghost"
                                      className="flex-1 h-9 text-xs gap-1.5"
                                      onClick={() => { onReorder(order); onClose(); }}
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" /> {t("btn_reorder")}
                                    </Button>
                                  )}
                                </div>
                              )}

                              {/* Audit log toggle */}
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : order.id)}
                                className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground pt-0.5"
                              >
                                <HistoryIcon className="w-3 h-3" />
                                {t("label_audit_log")}
                                <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`} />
                              </button>

                              {isExpanded && (
                                <div className="space-y-2.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                  {order.payments && order.payments.length > 0 && (
                                    <div className="rounded-lg border border-border bg-secondary/30 p-2 space-y-1">
                                      <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                                        <Receipt className="w-3 h-3" /> {t("payment_ledger")}
                                      </p>
                                      {order.payments.map((p, i) => (
                                        <div key={i} className="flex items-center justify-between text-[11px]">
                                          <span className="text-muted-foreground">
                                            {t(PAYMENT_TYPE_KEY[p.type])} · {new Date(p.at).toLocaleString(lang === "zh" ? "zh-HK" : "en-US")}
                                          </span>
                                          <span className="font-mono font-medium tabular-nums">${p.amount.toLocaleString()}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {order.auditLog && order.auditLog.length > 0 && (
                                    <div className="space-y-1">
                                      {order.auditLog.map((a, i) => {
                                        const staff = SALES_STAFF.find(s => s.id === a.staffId);
                                        return (
                                          <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                            <span className="w-1 h-1 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                                            <span>
                                              <span className="font-medium text-foreground/70">{t(AUDIT_KEY[a.action])}</span>
                                              {a.detail ? ` · ${a.detail}` : ""}
                                              {" · "}{new Date(a.at).toLocaleString(lang === "zh" ? "zh-HK" : "en-US")}
                                              {staff ? ` · ${staff.name}` : ""}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {onAddNote && (
                                    <div className="flex items-start gap-1.5">
                                      <Textarea
                                        value={noteDrafts[order.id] ?? ""}
                                        onChange={e => setNoteDrafts(prev => ({ ...prev, [order.id]: e.target.value }))}
                                        placeholder={t("placeholder_add_note")}
                                        className="text-xs min-h-[36px] flex-1"
                                        maxLength={300}
                                      />
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-9 w-9 shrink-0"
                                        disabled={!(noteDrafts[order.id] ?? "").trim()}
                                        onClick={() => {
                                          onAddNote(order, noteDrafts[order.id] ?? "");
                                          setNoteDrafts(prev => ({ ...prev, [order.id]: "" }));
                                        }}
                                        aria-label={t("btn_add_note")}
                                      >
                                        <Plus className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Bulk print bar */}
        {selectMode && (
          <div className="shrink-0 border-t border-border bg-card px-4 py-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{selectedOrders.length}</span> {t("label_x_selected")}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-9 text-xs gap-1.5"
                disabled={selectedOrders.length === 0}
                onClick={() => printBatch(selectedOrders.map(generatePickingList))}
              >
                <Printer className="w-3.5 h-3.5" />
                {t("btn_print_picking_slips")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-9 text-xs gap-1.5"
                disabled={selectedOrders.length === 0}
                onClick={() => printBatch(selectedOrders.map(generateDeliveryNote))}
              >
                <Printer className="w-3.5 h-3.5" />
                {t("btn_print_delivery_notes")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
