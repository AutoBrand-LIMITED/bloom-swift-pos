import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Lock, BarChart3, Users, Package, ArrowLeft, ShoppingBag, DollarSign, CheckCircle2, AlertCircle, User, Clock, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Order } from "@/types/order";
import { SALES_STAFF } from "@/types/order";
import { loadStoredCustomers } from "@/lib/customer-utils";
import { loadOrders } from "@/lib/orders";
import { useLanguage } from "@/contexts/LanguageContext";

type DatePreset = "all" | "today" | "week" | "month" | "custom";

function getDateRange(preset: DatePreset, customFrom: string, customTo: string): { from: string; to: string } | null {
  const today = new Date().toISOString().slice(0, 10);
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: today };
  }
  if (preset === "month") {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return { from: d.toISOString().slice(0, 10), to: today };
  }
  if (preset === "custom" && (customFrom || customTo)) return { from: customFrom, to: customTo };
  return null;
}

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string;
const UNSPECIFIED = "未指定";
const UNKNOWN = "未知";

const SalesReport = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (!authenticated) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center p-4"
        style={{ backgroundImage: "radial-gradient(ellipse at 50% 0%, hsl(152 45% 38% / 0.07) 0%, transparent 65%)" }}
      >
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <p className="text-[11px] font-bold tracking-widest uppercase text-primary/60 mb-1">Anglo Chinese Florist</p>
            <h1 className="text-xl font-bold tracking-tight">{t("title_analytics")}</h1>
          </div>

          {/* Form */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t("msg_enter_password")}</p>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("label_password")}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder={t("placeholder_password")}
                className={error ? "border-destructive" : ""}
                autoFocus
              />
              {error && <p className="text-xs text-destructive mt-1">{t("error_wrong_password")}</p>}
            </div>
            <Button onClick={handleLogin} className="w-full">{t("btn_login")}</Button>
          </div>

          <p className="text-center text-[10px] text-muted-foreground/50 mt-6">
            {t("title_report")} · Anglo Chinese Florist
          </p>
        </div>
      </div>
    );
  }

  return <ReportDashboard onBack={() => navigate("/")} />;
};

const ReportDashboard = ({ onBack }: { onBack: () => void }) => {
  const { t } = useLanguage();
  const allOrders = useMemo(() => loadOrders(), []);
  const customers = useMemo(() => loadStoredCustomers(), []);

  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const orders = useMemo(() => {
    const range = getDateRange(datePreset, customFrom, customTo);
    if (!range) return allOrders;
    return allOrders.filter((o) => {
      const d = o.createdAt.slice(0, 10);
      return (!range.from || d >= range.from) && (!range.to || d <= range.to);
    });
  }, [allOrders, datePreset, customFrom, customTo]);

  const totalRevenue = orders.reduce((s, o) => s + o.finalPrice, 0);
  const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
  const unpaidOrders = orders.filter((o) => o.paymentStatus === "unpaid");
  const depositOrders = orders.filter((o) => o.paymentStatus === "deposit");

  const salesByStaff = useMemo(() => {
    const map: Record<string, { count: number; revenue: number; name: string }> = {};
    for (const o of orders) {
      const sid = o.salesId || UNSPECIFIED;
      const staff = SALES_STAFF.find((s) => s.id === sid);
      const displayName = staff?.name || (sid === UNSPECIFIED ? t("text_not_specified") : sid);
      if (!map[sid]) map[sid] = { count: 0, revenue: 0, name: displayName };
      map[sid].count++;
      map[sid].revenue += o.finalPrice;
    }
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [orders]);

  const productSummary = useMemo(() => {
    const map: Record<string, { qty: number; revenue: number }> = {};
    for (const o of orders) {
      for (const item of o.items) {
        if (!map[item.name]) map[item.name] = { qty: 0, revenue: 0 };
        map[item.name].qty += item.quantity;
        map[item.name].revenue += item.price * item.quantity;
      }
    }
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [orders]);

  const customerSummary = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const o of orders) {
      const key = o.phone || o.customerName || UNKNOWN;
      if (!map[key]) map[key] = { name: o.customerName || (key === UNKNOWN ? t("text_not_specified") : key), count: 0, revenue: 0 };
      map[key].count++;
      map[key].revenue += o.finalPrice;
    }
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [orders]);

  const salesProductSummary = useMemo(() => {
    const map: Record<string, Record<string, { qty: number; revenue: number }>> = {};
    for (const o of orders) {
      const sid = o.salesId || UNSPECIFIED;
      const staff = SALES_STAFF.find((s) => s.id === sid);
      const sName = staff?.name || (sid === UNSPECIFIED ? t("text_not_specified") : sid);
      if (!map[sName]) map[sName] = {};
      for (const item of o.items) {
        if (!map[sName][item.name]) map[sName][item.name] = { qty: 0, revenue: 0 };
        map[sName][item.name].qty += item.quantity;
        map[sName][item.name].revenue += item.price * item.quantity;
      }
    }
    return map;
  }, [orders]);

  const customerProductSummary = useMemo(() => {
    const map: Record<string, Record<string, { qty: number; revenue: number }>> = {};
    for (const o of orders) {
      const cKey = o.customerName || o.phone || UNKNOWN;
      if (!map[cKey]) map[cKey] = {};
      for (const item of o.items) {
        if (!map[cKey][item.name]) map[cKey][item.name] = { qty: 0, revenue: 0 };
        map[cKey][item.name].qty += item.quantity;
        map[cKey][item.name].revenue += item.price * item.quantity;
      }
    }
    return map;
  }, [orders]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" /> {t("btn_back_pos")}
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold tracking-tight leading-none">{t("title_report")}</h1>
            <p className="text-[11px] text-muted-foreground leading-none mt-1">Anglo Chinese Florist</p>
          </div>
          <BarChart3 className="w-4 h-4 text-primary/50 shrink-0" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Date filter */}
        <div className="flex flex-wrap gap-2 items-center">
          {(["all", "today", "week", "month", "custom"] as DatePreset[]).map((p) => {
            const labels: Record<DatePreset, string> = {
              all: t("report_filter_all"),
              today: t("filter_today"),
              week: t("report_filter_week"),
              month: t("report_filter_month"),
              custom: t("report_filter_custom"),
            };
            return (
              <button
                key={p}
                onClick={() => setDatePreset(p)}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  datePreset === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-accent"
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
          <CalendarDays className="w-3.5 h-3.5 text-muted-foreground ml-1" />
        </div>
        {datePreset === "custom" && (
          <div className="flex flex-wrap gap-2 items-center -mt-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg border border-border bg-card text-foreground"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg border border-border bg-card text-foreground"
            />
          </div>
        )}

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={t("stat_total_orders")} value={orders.length.toString()} icon={<ShoppingBag className="w-3.5 h-3.5" />} />
          <StatCard label={t("stat_total_revenue")} value={`$${totalRevenue.toLocaleString()}`} icon={<DollarSign className="w-3.5 h-3.5" />} accent="primary" />
          <StatCard label={t("stat_paid")} value={paidOrders.length.toString()} icon={<CheckCircle2 className="w-3.5 h-3.5" />} accent="success" />
          <StatCard label={t("stat_unpaid")} value={unpaidOrders.length.toString()} icon={<AlertCircle className="w-3.5 h-3.5" />} accent="danger" />
        </div>

        {depositOrders.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span><span className="font-semibold">{depositOrders.length}</span> {t("stat_unpaid")} (deposit)</span>
          </div>
        )}

        {/* Report sections */}
        <Accordion type="multiple" className="space-y-2">
          <AccordionItem value="sales" className="border border-border rounded-xl bg-card overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-primary" />
                {t("section_sales_summary")}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <ReportTable
                head={[t("col_staff"), t("col_order_count"), t("col_revenue")]}
                rows={salesByStaff.map(([id, d]) => [d.name, d.count.toString(), `$${d.revenue.toLocaleString()}`])}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="customer" className="border border-border rounded-xl bg-card overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-primary" />
                {t("section_customer_summary")}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <ReportTable
                head={[t("col_customer"), t("col_order_count"), t("col_spending")]}
                rows={customerSummary.slice(0, 20).map(([key, d]) => [d.name, d.count.toString(), `$${d.revenue.toLocaleString()}`])}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="product" className="border border-border rounded-xl bg-card overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-primary" />
                {t("section_product_summary")}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <ReportTable
                head={[t("col_product"), t("col_quantity"), t("col_revenue")]}
                rows={productSummary.slice(0, 20).map(([name, d]) => [name, d.qty.toString(), `$${d.revenue.toLocaleString()}`])}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sales-product" className="border border-border rounded-xl bg-card overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
              {t("section_sales_product")}
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              {Object.entries(salesProductSummary).map(([staff, products]) => (
                <div key={staff}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">{staff}</p>
                  <ReportTable
                    rows={Object.entries(products).sort((a, b) => b[1].revenue - a[1].revenue).map(([pName, d]) => [pName, d.qty.toString(), `$${d.revenue.toLocaleString()}`])}
                  />
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="customer-product" className="border border-border rounded-xl bg-card overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
              {t("section_customer_product")}
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              {Object.entries(customerProductSummary).slice(0, 15).map(([cust, products]) => (
                <div key={cust}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-2">{cust}</p>
                  <ReportTable
                    rows={Object.entries(products).sort((a, b) => b[1].revenue - a[1].revenue).map(([pName, d]) => [pName, d.qty.toString(), `$${d.revenue.toLocaleString()}`])}
                  />
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="scp" className="border border-border rounded-xl bg-card overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
              {t("section_scp_summary")}
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-5">
              {Object.entries(salesProductSummary).map(([staff]) => {
                const staffOrders = orders.filter((o) => {
                  const sid = o.salesId || UNSPECIFIED;
                  const s = SALES_STAFF.find((st) => st.id === sid);
                  return (s?.name || sid) === staff;
                });
                const custMap: Record<string, Record<string, { qty: number; revenue: number }>> = {};
                for (const o of staffOrders) {
                  const cKey = o.customerName || o.phone || UNKNOWN;
                  if (!custMap[cKey]) custMap[cKey] = {};
                  for (const item of o.items) {
                    if (!custMap[cKey][item.name]) custMap[cKey][item.name] = { qty: 0, revenue: 0 };
                    custMap[cKey][item.name].qty += item.quantity;
                    custMap[cKey][item.name].revenue += item.price * item.quantity;
                  }
                }
                return (
                  <div key={staff}>
                    <p className="text-sm font-bold flex items-center gap-1.5 mb-2">
                      <User className="w-3.5 h-3.5 text-primary" /> {staff}
                    </p>
                    {Object.entries(custMap).map(([cust, products]) => (
                      <div key={cust} className="ml-4 mb-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                          {cust === UNKNOWN ? t("text_not_specified") : cust}
                        </p>
                        <ReportTable
                          rows={Object.entries(products).map(([pName, d]) => [pName, d.qty.toString(), `$${d.revenue.toLocaleString()}`])}
                          compact
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </main>
    </div>
  );
};

const accentMap = {
  primary: { value: "text-primary", dot: "bg-primary" },
  success: { value: "text-emerald-700", dot: "bg-emerald-500" },
  danger: { value: "text-destructive", dot: "bg-destructive" },
} as const;

const StatCard = ({
  label, value, icon, accent,
}: {
  label: string; value: string; icon?: React.ReactNode; accent?: keyof typeof accentMap;
}) => {
  const colors = accent ? accentMap[accent] : null;
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
        {colors && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />}
        {label}
      </p>
      <p className={`text-3xl font-bold font-mono leading-none ${colors ? colors.value : "text-foreground"}`}>{value}</p>
      {icon && <span className="text-muted-foreground/40 mt-1">{icon}</span>}
    </div>
  );
};

const ReportTable = ({
  head, rows, compact = false,
}: {
  head?: string[]; rows: string[][]; compact?: boolean;
}) => (
  <table className="w-full text-sm">
    {head && (
      <thead>
        <tr className="border-b border-border">
          {head.map((h, i) => (
            <th key={i} className={`py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 ${i > 0 ? "text-right" : "text-left"}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
    )}
    <tbody>
      {rows.map((row, ri) => (
        <tr key={ri} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
          {row.map((cell, ci) => (
            <td key={ci} className={`${compact ? "py-0.5" : "py-1.5"} ${ci > 0 ? "text-right font-mono text-xs" : ""}`}>
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

export default SalesReport;
