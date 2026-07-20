import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Trash2,
  Package,
  Truck,
  Zap,
  Wallet,
  Sparkles,
  Search,
  Loader2,
  RefreshCw,
  Maximize2,
  Minimize2,
  GripHorizontal,
  Settings2,
} from "lucide-react";
import CustomOrderDialog from "@/components/pos/CustomOrderDialog";
import ProductManagementDialog from "@/components/pos/ProductManagementDialog";
import {
  getOdooProductCategories,
  getOdooProducts,
  hasOdooBackend,
  type OdooProduct,
  type OdooProductCategory,
} from "@/lib/odoo-api";
import type { OrderItem } from "@/types/order";
import {
  hasOrderLinePriceAdjustment,
  normalizeDiscountPercent,
  orderItemTotal,
} from "@/lib/order-pricing";

interface OrderItemsSectionProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  deliveryFee: number;
  urgentFee: number;
  onDeliveryFeeChange: (v: number) => void;
  onUrgentFeeChange: (v: number) => void;
  onCustomOrderSummary: (summary: string) => void;
  budget: number;
  onBudgetChange: (v: number) => void;
  subtotal: number;
}

const OrderItemsSection = ({
  items, onItemsChange,
  deliveryFee, urgentFee,
  onDeliveryFeeChange, onUrgentFeeChange,
  onCustomOrderSummary,
  budget, onBudgetChange, subtotal,
}: OrderItemsSectionProps) => {
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [customOrderOpen, setCustomOrderOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<OdooProduct[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<OdooProductCategory[]>([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | "all">("all");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogExpanded, setCatalogExpanded] = useState(false);
  const [catalogHeight, setCatalogHeight] = useState(480);
  const [productManagerOpen, setProductManagerOpen] = useState(false);

  const loadCatalog = useCallback(async (signal?: AbortSignal) => {
    if (!hasOdooBackend) return;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const [products, categories] = await Promise.all([
        getOdooProducts(signal),
        getOdooProductCategories(signal),
      ]);
      setCatalogProducts(products);
      setCatalogCategories(categories);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setCatalogError(error instanceof Error ? error.message : "未能載入 Odoo 商品");
    } finally {
      if (!signal?.aborted) setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadCatalog(controller.signal);
    return () => controller.abort();
  }, [loadCatalog]);

  const filteredCatalogProducts = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    return catalogProducts.filter((product) => {
      if (activeCategory !== "all" && product.categoryId !== activeCategory) return false;
      if (!query) return true;
      return [
        product.name,
        product.productCode || "",
        product.categoryName || "",
        product.barcode || "",
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [activeCategory, catalogProducts, catalogQuery]);

  const displayedCatalogProducts = catalogExpanded
    ? filteredCatalogProducts
    : filteredCatalogProducts.slice(0, 60);

  const startCatalogResize = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = catalogHeight;
    const maxHeight = Math.max(420, Math.round(window.innerHeight * 0.82));

    const resize = (moveEvent: MouseEvent) => {
      const nextHeight = Math.min(Math.max(startHeight + moveEvent.clientY - startY, 380), maxHeight);
      setCatalogHeight(nextHeight);
    };

    const stopResize = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResize);
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResize, { once: true });
  }, [catalogHeight]);

  const addCatalogProduct = (product: OdooProduct) => {
    onItemsChange([
      ...items,
      {
        id: crypto.randomUUID(),
        name: product.name,
        price: product.price || 0,
        quantity: 1,
        catalogPrice: product.price || 0,
        discountPercent: 0,
        priceOverrideReason: "",
        productId: product.id,
        productCode: product.productCode,
        categoryId: product.categoryId,
        categoryName: product.categoryName,
      },
    ]);
  };

  const addItem = () => {
    if (!newName.trim()) return;
    const price = parseFloat(newPrice) || 0;
    onItemsChange([
      ...items,
      { id: crypto.randomUUID(), name: newName.trim(), price, quantity: 1 },
    ]);
    setNewName("");
    setNewPrice("");
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof OrderItem, value: string | number) => {
    onItemsChange(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
          <Package className="w-4 h-4" />
          訂單內容
        </h2>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setCustomOrderOpen(true)}
        >
          <Sparkles className="w-3.5 h-3.5" /> 客制訂單
        </Button>
      </div>

      <CustomOrderDialog
        open={customOrderOpen}
        onClose={() => setCustomOrderOpen(false)}
        onConfirm={(summary) => {
          onCustomOrderSummary(summary);
          setCustomOrderOpen(false);
        }}
      />

      <ProductManagementDialog
        open={productManagerOpen}
        onOpenChange={setProductManagerOpen}
        categories={catalogCategories}
        onCatalogChanged={() => void loadCatalog()}
      />

      {/* Budget */}
      <div className="space-y-2 rounded-lg bg-secondary/50 p-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <Label className="text-xs font-medium">客人預算</Label>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              value={budget || ""}
              onChange={(e) => onBudgetChange(parseFloat(e.target.value) || 0)}
              placeholder="輸入預算"
              className="w-28 h-8 text-sm font-mono text-right bg-card"
              min={0}
            />
          </div>
        </div>
        {budget > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">已用 ${subtotal.toLocaleString()}</span>
              <span className={`font-mono font-medium ${budget - subtotal < 0 ? "text-destructive" : "text-primary"}`}>
                {budget - subtotal >= 0
                  ? `剩餘 $${(budget - subtotal).toLocaleString()}`
                  : `超出 $${(subtotal - budget).toLocaleString()}`}
              </span>
            </div>
            <Progress
              value={Math.min((subtotal / budget) * 100, 100)}
              className={`h-2 ${subtotal > budget ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
            />
          </div>
        )}
      </div>

      {/* Odoo product catalog */}
      <div
        className={`rounded-lg border border-border bg-background p-3 ${
          catalogExpanded ? "flex min-h-[380px] flex-col overflow-hidden" : "space-y-2"
        }`}
        style={catalogExpanded ? { height: catalogHeight } : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-medium">Odoo 商品</Label>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {catalogLoading && (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                載入中
              </span>
            )}
            {!catalogLoading && catalogProducts.length > 0 && (
              <span>{filteredCatalogProducts.length} / {catalogProducts.length}</span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setProductManagerOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              管理
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setCatalogExpanded((expanded) => !expanded)}
            >
              {catalogExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {catalogExpanded ? "收合" : "展開"}
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={catalogQuery}
            onChange={(event) => setCatalogQuery(event.target.value)}
            placeholder="搜尋 product code / 商品名稱"
            className="h-9 pl-9 text-sm"
            maxLength={80}
          />
        </div>

        {catalogCategories.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 pr-1 ${catalogExpanded ? "max-h-44 overflow-y-auto" : "max-h-32 overflow-hidden"}`}>
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary/60 hover:bg-secondary"
              }`}
            >
              全部
            </button>
            {catalogCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeCategory === category.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/60 hover:bg-secondary"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}

        {!hasOdooBackend ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            未設定 Odoo backend，請用下方手動新增項目。
          </div>
        ) : catalogError ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3">
            <p className="text-sm text-destructive">{catalogError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => void loadCatalog()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重試
            </Button>
          </div>
        ) : displayedCatalogProducts.length > 0 ? (
          <div className={`grid grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 ${
            catalogExpanded ? "min-h-0 flex-1 auto-rows-min" : "max-h-80"
          }`}>
            {displayedCatalogProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addCatalogProduct(product)}
                className="min-h-[76px] rounded-lg border border-border bg-secondary/45 px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/10"
                title={`${product.productCode ? `${product.productCode} — ` : ""}${product.name}`}
              >
                <span className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</span>
                <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">{product.productCode || product.categoryName || "Odoo"}</span>
                  <span className="font-mono text-foreground">${product.price.toLocaleString()}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            未找到商品，請改用其他 keyword 或下方手動新增。
          </div>
        )}

        {catalogExpanded && (
          <button
            type="button"
            aria-label="調整商品目錄高度"
            onMouseDown={startCatalogResize}
            className="mt-2 flex h-6 w-full cursor-row-resize items-center justify-center rounded-md border border-dashed border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"
          >
            <GripHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Item list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const adjusted = hasOrderLinePriceAdjustment(item);
            return (
              <div key={item.id} className="space-y-2 rounded-lg bg-secondary/50 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px_92px_72px_40px] sm:items-end">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">商品名稱</Label>
                    <Input
                      value={item.name}
                      onChange={(event) => updateItem(item.id, "name", event.target.value)}
                      className="h-9 bg-card text-sm"
                      placeholder="項目名稱"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">成交單價 ($)</Label>
                    <Input
                      aria-label={`${item.name} 成交單價`}
                      type="number"
                      value={item.price || ""}
                      onChange={(event) => updateItem(item.id, "price", parseFloat(event.target.value) || 0)}
                      className="h-9 bg-card text-right font-mono text-sm"
                      min={0}
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">折扣 (%)</Label>
                    <Input
                      aria-label={`${item.name} 折扣`}
                      type="number"
                      value={item.discountPercent || ""}
                      onChange={(event) => updateItem(
                        item.id,
                        "discountPercent",
                        normalizeDiscountPercent(parseFloat(event.target.value) || 0),
                      )}
                      className="h-9 bg-card text-right font-mono text-sm"
                      min={0}
                      max={100}
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">數量</Label>
                    <Input
                      aria-label={`${item.name} 數量`}
                      type="number"
                      value={item.quantity}
                      onChange={(event) => updateItem(item.id, "quantity", Math.max(1, parseInt(event.target.value) || 1))}
                      className="h-9 bg-card text-center font-mono text-sm"
                      min={1}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`刪除 ${item.name}`}
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {item.catalogPrice !== undefined
                      ? `Odoo 原價 $${item.catalogPrice.toLocaleString()}`
                      : "手動項目"}
                  </span>
                  <span className="font-mono font-semibold">小計 ${orderItemTotal(item).toLocaleString()}</span>
                </div>

                {adjusted && (
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-amber-700">
                      改價／折扣原因 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      aria-label={`${item.name} 改價原因`}
                      value={item.priceOverrideReason || ""}
                      onChange={(event) => updateItem(item.id, "priceOverrideReason", event.target.value)}
                      className="h-9 border-amber-300 bg-card text-sm"
                      placeholder="例如：VIP 優惠、經理批准、花材替換"
                      maxLength={300}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      只影響今張訂單，唔會修改 Odoo 商品原價。
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add new item */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">新增項目</Label>
          <Input
            placeholder="例如：玫瑰花束、植物盆栽"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            className="text-sm"
            maxLength={100}
          />
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-xs">價格 ($)</Label>
          <Input
            type="number"
            placeholder="0"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            className="text-sm font-mono"
            min={0}
          />
        </div>
        <Button onClick={addItem} size="default" variant="outline" className="gap-1.5">
          <Plus className="w-4 h-4" /> 加入
        </Button>
      </div>

      {/* Quick add fees */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" /> 送貨費
          </Label>
          <Input
            type="number"
            value={deliveryFee || ""}
            onChange={(e) => onDeliveryFeeChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="text-sm font-mono"
            min={0}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> 急單費
          </Label>
          <Input
            type="number"
            value={urgentFee || ""}
            onChange={(e) => onUrgentFeeChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="text-sm font-mono"
            min={0}
          />
        </div>
      </div>

    </div>
  );
};

export default OrderItemsSection;
