import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Lock, BarChart3, Users, Package, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Order } from "@/types/order";
import { SALES_STAFF } from "@/types/order";
import { loadStoredCustomers } from "@/lib/customer-utils";

import { loadOrders } from "@/lib/orders";
import { useLanguage } from "@/contexts/LanguageContext";

const ADMIN_PASSWORD = "bloom2024";
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Lock className="w-10 h-10 mx-auto text-primary mb-2" />
            <CardTitle className="text-lg">{t("title_analytics")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("msg_enter_password")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("label_password")}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder={t("placeholder_password")}
                className={error ? "border-destructive" : ""}
              />
              {error && <p className="text-xs text-destructive">{t("error_wrong_password")}</p>}
            </div>
            <Button onClick={handleLogin} className="w-full">{t("btn_login")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ReportDashboard onBack={() => navigate("/")} />;
};

const ReportDashboard = ({ onBack }: { onBack: () => void }) => {
  const { t } = useLanguage();
  const orders = useMemo(() => loadOrders(), []);
  const customers = useMemo(() => loadStoredCustomers(), []);

  const totalRevenue = orders.reduce((s, o) => s + o.finalPrice, 0);
  const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
  const unpaidOrders = orders.filter((o) => o.paymentStatus === "unpaid");
  const depositOrders = orders.filter((o) => o.paymentStatus === "deposit");

  // Sales by staff
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

  // Product summary
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

  // Customer summary
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

  // Sales/Product: staff x product
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

  // Customer/Product
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
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold">{t("title_report")}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> {t("btn_back_pos")}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label={t("stat_total_orders")} value={orders.length.toString()} />
          <StatCard label={t("stat_total_revenue")} value={`$${totalRevenue.toLocaleString()}`} />
          <StatCard label={t("stat_paid")} value={paidOrders.length.toString()} />
          <StatCard label={t("stat_unpaid")} value={unpaidOrders.length.toString()} highlight />
        </div>

        {/* Report sections */}
        <Accordion type="multiple" className="space-y-2">
          {/* Sales Summary */}
          <AccordionItem value="sales" className="border rounded-xl bg-card px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("section_sales_summary")}</AccordionTrigger>
            <AccordionContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b"><th className="py-1.5">{t("col_staff")}</th><th className="text-right">{t("col_order_count")}</th><th className="text-right">{t("col_revenue")}</th></tr></thead>
                <tbody>
                  {salesByStaff.map(([id, d]) => (
                    <tr key={id} className="border-b border-border/50">
                      <td className="py-1.5">{d.name}</td>
                      <td className="text-right">{d.count}</td>
                      <td className="text-right font-mono">${d.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AccordionContent>
          </AccordionItem>

          {/* Customer Summary */}
          <AccordionItem value="customer" className="border rounded-xl bg-card px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("section_customer_summary")}</AccordionTrigger>
            <AccordionContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b"><th className="py-1.5">{t("col_customer")}</th><th className="text-right">{t("col_order_count")}</th><th className="text-right">{t("col_spending")}</th></tr></thead>
                <tbody>
                  {customerSummary.slice(0, 20).map(([key, d]) => (
                    <tr key={key} className="border-b border-border/50">
                      <td className="py-1.5">{d.name}</td>
                      <td className="text-right">{d.count}</td>
                      <td className="text-right font-mono">${d.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AccordionContent>
          </AccordionItem>

          {/* Product Summary */}
          <AccordionItem value="product" className="border rounded-xl bg-card px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("section_product_summary")}</AccordionTrigger>
            <AccordionContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b"><th className="py-1.5">{t("col_product")}</th><th className="text-right">{t("col_quantity")}</th><th className="text-right">{t("col_revenue")}</th></tr></thead>
                <tbody>
                  {productSummary.slice(0, 20).map(([name, d]) => (
                    <tr key={name} className="border-b border-border/50">
                      <td className="py-1.5">{name}</td>
                      <td className="text-right">{d.qty}</td>
                      <td className="text-right font-mono">${d.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AccordionContent>
          </AccordionItem>

          {/* Sales/Product Summary */}
          <AccordionItem value="sales-product" className="border rounded-xl bg-card px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("section_sales_product")}</AccordionTrigger>
            <AccordionContent className="space-y-3">
              {Object.entries(salesProductSummary).map(([staff, products]) => (
                <div key={staff}>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">{staff}</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(products).sort((a, b) => b[1].revenue - a[1].revenue).map(([pName, d]) => (
                        <tr key={pName} className="border-b border-border/30">
                          <td className="py-1">{pName}</td>
                          <td className="text-right">{d.qty}</td>
                          <td className="text-right font-mono">${d.revenue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* Customer/Product Summary */}
          <AccordionItem value="customer-product" className="border rounded-xl bg-card px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("section_customer_product")}</AccordionTrigger>
            <AccordionContent className="space-y-3">
              {Object.entries(customerProductSummary).slice(0, 15).map(([cust, products]) => (
                <div key={cust}>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">{cust}</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(products).sort((a, b) => b[1].revenue - a[1].revenue).map(([pName, d]) => (
                        <tr key={pName} className="border-b border-border/30">
                          <td className="py-1">{pName}</td>
                          <td className="text-right">{d.qty}</td>
                          <td className="text-right font-mono">${d.revenue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* S/C/Product Summary */}
          <AccordionItem value="scp" className="border rounded-xl bg-card px-4">
            <AccordionTrigger className="text-sm font-semibold">{t("section_scp_summary")}</AccordionTrigger>
            <AccordionContent className="space-y-4">
              {Object.entries(salesProductSummary).map(([staff, _]) => {
                // For each staff, show their customers and products
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
                    <p className="text-sm font-bold text-foreground mb-2">👤 {staff}</p>
                    {Object.entries(custMap).map(([cust, products]) => (
                      <div key={cust} className="ml-3 mb-2">
                        <p className="text-xs font-semibold text-muted-foreground">{cust === UNKNOWN ? t("text_not_specified") : cust}</p>
                        <table className="w-full text-sm">
                          <tbody>
                            {Object.entries(products).map(([pName, d]) => (
                              <tr key={pName} className="border-b border-border/20">
                                <td className="py-0.5 pl-2">{pName}</td>
                                <td className="text-right">{d.qty}</td>
                                <td className="text-right font-mono">${d.revenue.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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

const StatCard = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <Card className={highlight ? "border-destructive/50" : ""}>
    <CardContent className="p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold font-mono ${highlight ? "text-destructive" : ""}`}>{value}</p>
    </CardContent>
  </Card>
);

export default SalesReport;
