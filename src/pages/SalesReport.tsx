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

const ADMIN_PASSWORD = "bloom2024";
const STORAGE_KEY = "florist-pos-orders";

function loadOrders(): Order[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

const SalesReport = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const navigate = useNavigate();

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
            <CardTitle className="text-lg">分析報告系統</CardTitle>
            <p className="text-sm text-muted-foreground">請輸入管理員密碼</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">密碼</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="輸入密碼"
                className={error ? "border-destructive" : ""}
              />
              {error && <p className="text-xs text-destructive">密碼錯誤，請重試</p>}
            </div>
            <Button onClick={handleLogin} className="w-full">登入</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ReportDashboard onBack={() => navigate("/")} />;
};

const ReportDashboard = ({ onBack }: { onBack: () => void }) => {
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
      const sid = o.salesId || "未指定";
      const staff = SALES_STAFF.find((s) => s.id === sid);
      if (!map[sid]) map[sid] = { count: 0, revenue: 0, name: staff?.name || sid };
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
      const key = o.phone || o.customerName || "未知";
      if (!map[key]) map[key] = { name: o.customerName || key, count: 0, revenue: 0 };
      map[key].count++;
      map[key].revenue += o.finalPrice;
    }
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [orders]);

  // Sales/Product: staff x product
  const salesProductSummary = useMemo(() => {
    const map: Record<string, Record<string, { qty: number; revenue: number }>> = {};
    for (const o of orders) {
      const sid = o.salesId || "未指定";
      const staff = SALES_STAFF.find((s) => s.id === sid);
      const sName = staff?.name || sid;
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
      const cKey = o.customerName || o.phone || "未知";
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
            <h1 className="text-lg font-bold">分析報告</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> 返回 POS
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="總訂單" value={orders.length.toString()} />
          <StatCard label="總收入" value={`$${totalRevenue.toLocaleString()}`} />
          <StatCard label="已付款" value={paidOrders.length.toString()} />
          <StatCard label="未付款" value={unpaidOrders.length.toString()} highlight />
        </div>

        {/* Report sections */}
        <Accordion type="multiple" className="space-y-2">
          {/* Sales Summary */}
          <AccordionItem value="sales" className="border rounded-xl bg-card px-4">
            <AccordionTrigger className="text-sm font-semibold">Sales Summary</AccordionTrigger>
            <AccordionContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b"><th className="py-1.5">員工</th><th className="text-right">訂單數</th><th className="text-right">收入</th></tr></thead>
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
            <AccordionTrigger className="text-sm font-semibold">Customer Summary</AccordionTrigger>
            <AccordionContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b"><th className="py-1.5">客戶</th><th className="text-right">訂單數</th><th className="text-right">消費</th></tr></thead>
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
            <AccordionTrigger className="text-sm font-semibold">Product Summary</AccordionTrigger>
            <AccordionContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground border-b"><th className="py-1.5">產品</th><th className="text-right">數量</th><th className="text-right">收入</th></tr></thead>
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
            <AccordionTrigger className="text-sm font-semibold">Sales/Product Summary</AccordionTrigger>
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
            <AccordionTrigger className="text-sm font-semibold">Customer/Product Summary</AccordionTrigger>
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
            <AccordionTrigger className="text-sm font-semibold">S/C/Product Summary</AccordionTrigger>
            <AccordionContent className="space-y-4">
              {Object.entries(salesProductSummary).map(([staff, _]) => {
                // For each staff, show their customers and products
                const staffOrders = orders.filter((o) => {
                  const sid = o.salesId || "未指定";
                  const s = SALES_STAFF.find((st) => st.id === sid);
                  return (s?.name || sid) === staff;
                });
                const custMap: Record<string, Record<string, { qty: number; revenue: number }>> = {};
                for (const o of staffOrders) {
                  const cKey = o.customerName || o.phone || "未知";
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
                        <p className="text-xs font-semibold text-muted-foreground">{cust}</p>
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
