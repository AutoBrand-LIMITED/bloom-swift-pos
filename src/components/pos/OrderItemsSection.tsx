import { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Settings2,
  Maximize2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import CustomOrderDialog from "@/components/pos/CustomOrderDialog";
import ProductManagementDialog from "@/components/pos/ProductManagementDialog";
import ProductCatalogDialog from "@/components/pos/ProductCatalogDialog";
import DeliveryFeeManagementDialog from "@/components/pos/DeliveryFeeManagementDialog";
import {
  getOdooProductCategories,
  getOdooProducts,
  getDeliveryFees,
  hasOdooBackend,
  type OdooProduct,
  type OdooProductCategory,
  type DeliveryFeeOption,
} from "@/lib/odoo-api";
import type { OrderItem } from "@/types/order";
import {
  normalizeDiscountPercent,
  normalizeFixedDiscount,
  orderItemTotal,
  orderLineAdjustmentRequiresReason,
} from "@/lib/order-pricing";
import { formatMoney, normalizeWholeMoney } from "@/lib/money";

interface OrderItemsSectionProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  deliveryFee: number;
  deliveryFeeOptionId?: number;
  deliveryFeeLabel?: string;
  canManageProducts?: boolean;
  canManageDeliveryFees?: boolean;
  deliveryFeeEnabled?: boolean;
  urgentFee: number;
  onDeliveryFeeChange: (v: number) => void;
  onDeliveryFeeSelectionChange?: (option?: DeliveryFeeOption) => void;
  onUrgentFeeChange: (v: number) => void;
  onCustomOrderSummary: (summary: string) => void;
  budget: number;
  onBudgetChange: (v: number) => void;
  subtotal: number;
}

const DEMO_DELIVERY_FEES: DeliveryFeeOption[] = [
  { id: 1, label: "香港島第 1 區", amount: 80, sequence: 10, active: true },
  { id: 2, label: "香港島第 2 區", amount: 100, sequence: 20, active: true },
  { id: 3, label: "香港島第 3 區", amount: 120, sequence: 30, active: true },
  { id: 4, label: "九龍", amount: 130, sequence: 40, active: true },
  { id: 5, label: "新界", amount: 250, sequence: 50, active: true },
];

const OrderItemsSection = ({
  items, onItemsChange,
  deliveryFee, deliveryFeeOptionId, deliveryFeeLabel,
  canManageProducts = false, canManageDeliveryFees = false,
  deliveryFeeEnabled = true, urgentFee,
  onDeliveryFeeChange, onDeliveryFeeSelectionChange, onUrgentFeeChange,
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
  const [catalogFullViewOpen, setCatalogFullViewOpen] = useState(false);
  const [productManagerOpen, setProductManagerOpen] = useState(false);
  const [deliveryFeeManagerOpen, setDeliveryFeeManagerOpen] = useState(false);
  const [deliveryFeeOptions, setDeliveryFeeOptions] = useState<DeliveryFeeOption[]>(
    hasOdooBackend ? [] : DEMO_DELIVERY_FEES,
  );
  const [deliveryFeeLoading, setDeliveryFeeLoading] = useState(hasOdooBackend);
  const [deliveryFeeError, setDeliveryFeeError] = useState<string | null>(null);
  const [deliveryFeeRefreshKey, setDeliveryFeeRefreshKey] = useState(0);
  const [budgetExpanded, setBudgetExpanded] = useState(false);
  const [manualItemExpanded, setManualItemExpanded] = useState(false);
  const [expandedItemRemarks, setExpandedItemRemarks] = useState<Set<string>>(() => new Set());
  const selectedDeliveryFee = deliveryFeeOptions.find((option) => option.id === deliveryFeeOptionId);
  const hasLegacyDeliveryFee = deliveryFee > 0 && (
    !selectedDeliveryFee
    || selectedDeliveryFee.amount !== deliveryFee
    || Boolean(deliveryFeeLabel && selectedDeliveryFee.label !== deliveryFeeLabel)
  );

  useEffect(() => {
    if (!hasOdooBackend) return;
    const controller = new AbortController();
    setDeliveryFeeLoading(true); setDeliveryFeeError(null);
    getDeliveryFees(controller.signal).then(setDeliveryFeeOptions).catch((error) => {
      if ((error as Error).name !== "AbortError") setDeliveryFeeError(error instanceof Error ? error.message : "未能載入送貨費");
    }).finally(() => { if (!controller.signal.aborted) setDeliveryFeeLoading(false); });
    return () => controller.abort();
  }, [deliveryFeeRefreshKey]);

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

  useEffect(() => {
    if (catalogProducts.length === 0) return;
    const fixedPriceByProductId = new Map(
      catalogProducts.map((product) => [product.id, product.fixedPrice !== false]),
    );
    let changed = false;
    const synchronizedItems = items.map((item) => {
      if (!item.productId || !fixedPriceByProductId.has(item.productId)) return item;
      const fixedPrice = fixedPriceByProductId.get(item.productId)!;
      if (item.fixedPrice === fixedPrice) return item;
      changed = true;
      return { ...item, fixedPrice };
    });
    if (changed) onItemsChange(synchronizedItems);
  }, [catalogProducts, items, onItemsChange]);

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

  const addCatalogProduct = (product: OdooProduct) => {
    onItemsChange([
      ...items,
      {
        id: crypto.randomUUID(),
        name: product.name,
        price: product.price || 0,
        quantity: 1,
        catalogPrice: product.price || 0,
        fixedPrice: product.fixedPrice !== false,
        discountType: "percent",
        discountPercent: 0,
        discountAmount: 0,
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
    const price = normalizeWholeMoney(parseFloat(newPrice) || 0);
    onItemsChange([
      ...items,
      { id: crypto.randomUUID(), name: newName.trim(), price, quantity: 1 },
    ]);
    setNewName("");
    setNewPrice("");
    setManualItemExpanded(false);
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter((i) => i.id !== id));
    setExpandedItemRemarks((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const updateItem = (id: string, field: keyof OrderItem, value: string | number) => {
    onItemsChange(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const updateDiscountType = (id: string, discountType: "percent" | "fixed") => {
    onItemsChange(items.map((item) => item.id === id ? {
      ...item,
      discountType,
      discountPercent: 0,
      discountAmount: 0,
    } : item));
  };

  const toggleItemRemarks = (id: string) => {
    setExpandedItemRemarks((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

      {canManageProducts && (
        <ProductManagementDialog
          open={productManagerOpen}
          onOpenChange={setProductManagerOpen}
          categories={catalogCategories}
          onCatalogChanged={() => void loadCatalog()}
        />
      )}

      <ProductCatalogDialog
        open={catalogFullViewOpen}
        onOpenChange={setCatalogFullViewOpen}
        products={filteredCatalogProducts}
        totalCount={catalogProducts.length}
        categories={catalogCategories}
        query={catalogQuery}
        onQueryChange={setCatalogQuery}
        activeCategory={activeCategory}
        onActiveCategoryChange={setActiveCategory}
        onSelectProduct={addCatalogProduct}
        orderItems={items}
        onItemQuantityChange={(itemId, quantity) => updateItem(itemId, "quantity", quantity)}
        onRemoveItem={removeItem}
        loading={catalogLoading}
        error={catalogError}
        onRetry={() => void loadCatalog()}
      />

      {/* Budget */}
      <div className="rounded-lg border border-border bg-secondary/30">
        <button
          type="button"
          className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left"
          aria-expanded={budgetExpanded}
          aria-controls="customer-budget-content"
          onClick={() => setBudgetExpanded((expanded) => !expanded)}
        >
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">客人預算</span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {budget > 0 ? `$${formatMoney(budget)}` : "未設定"}
          </span>
          {budgetExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {budgetExpanded && (
          <div id="customer-budget-content" className="space-y-2 border-t border-border px-3 py-3">
            <div className="flex items-center justify-end gap-1">
              <Label htmlFor="customer-budget" className="mr-auto text-xs text-muted-foreground">
                預算金額
              </Label>
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                id="customer-budget"
                type="number"
                value={budget || ""}
                onChange={(e) => onBudgetChange(normalizeWholeMoney(parseFloat(e.target.value) || 0))}
                placeholder="輸入預算"
                className="h-9 w-32 bg-card text-right font-mono text-sm"
                min={0}
              />
            </div>
            {budget > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">已用 ${formatMoney(subtotal)}</span>
                  <span className={`font-mono font-medium ${budget - subtotal < 0 ? "text-destructive" : "text-primary"}`}>
                    {budget - subtotal >= 0
                      ? `剩餘 $${formatMoney(budget - subtotal)}`
                      : `超出 $${formatMoney(subtotal - budget)}`}
                  </span>
                </div>
                <Progress
                  value={Math.min((subtotal / budget) * 100, 100)}
                  className={`h-2 ${subtotal > budget ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Odoo product catalog */}
      <div className="space-y-2 rounded-lg border border-border bg-background p-3">
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
              onClick={() => setCatalogFullViewOpen(true)}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Full View
            </Button>
            {canManageProducts && (
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
            )}
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
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
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
        ) : filteredCatalogProducts.length > 0 ? (
          <div className="grid max-h-80 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {filteredCatalogProducts.map((product) => (
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
                  <span className="font-mono text-foreground">${formatMoney(product.price)}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            未找到商品，請改用其他 keyword 或下方手動新增。
          </div>
        )}

      </div>

      {/* Item list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const requiresAdjustmentReason = orderLineAdjustmentRequiresReason(item);
            const remarksExpanded = expandedItemRemarks.has(item.id);
            const hasRemarks = Boolean(item.remarks?.trim());
            return (
              <div key={item.id} className="space-y-2 rounded-lg bg-secondary/50 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_112px_104px_112px_72px_40px] sm:items-end">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">商品名稱</Label>
                    <Input
                      value={item.name}
                      readOnly
                      disabled
                      aria-label={`${item.name} 商品名稱（不可修改）`}
                      className="h-9 bg-muted/60 text-sm opacity-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">成交單價 ($)</Label>
                    <Input
                      aria-label={`${item.name} 成交單價`}
                      type="number"
                      value={item.price || ""}
                      onChange={(event) => updateItem(
                        item.id,
                        "price",
                        normalizeWholeMoney(parseFloat(event.target.value) || 0),
                      )}
                      className="h-9 bg-card text-right font-mono text-sm"
                      min={0}
                      step="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">折扣方式</Label>
                    <Select
                      value={item.discountType || "percent"}
                      onValueChange={(value: "percent" | "fixed") => updateDiscountType(item.id, value)}
                    >
                      <SelectTrigger aria-label={`${item.name} 折扣方式`} className="h-9 bg-card text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">百分比</SelectItem>
                        <SelectItem value="fixed">固定金額</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      {item.discountType === "fixed" ? "折扣金額 ($)" : "折扣 (%)"}
                    </Label>
                    {item.discountType === "fixed" ? (
                      <Input
                        aria-label={`${item.name} 固定金額折扣`}
                        type="number"
                        value={item.discountAmount || ""}
                        onChange={(event) => updateItem(
                          item.id,
                          "discountAmount",
                          normalizeFixedDiscount(
                            parseFloat(event.target.value) || 0,
                            item.price * item.quantity,
                          ),
                        )}
                        className="h-9 bg-card text-right font-mono text-sm"
                        min={0}
                        max={item.price * item.quantity}
                        step="1"
                        placeholder="0"
                      />
                    ) : (
                      <Select
                        value={String(normalizeDiscountPercent(item.discountPercent))}
                        onValueChange={(value) => updateItem(item.id, "discountPercent", Number(value))}
                      >
                        <SelectTrigger aria-label={`${item.name} 百分比折扣`} className="h-9 bg-card font-mono text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 21 }, (_, index) => index * 5).map((value) => (
                            <SelectItem key={value} value={String(value)}>{value}%</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
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
                      ? `Odoo 原價 $${formatMoney(item.catalogPrice)} · ${
                        item.fixedPrice === false
                          ? "浮動價格，可直接改價"
                          : "固定價格，改價須填原因"
                      }`
                      : "手動項目"}
                  </span>
                  <span className="font-mono font-semibold">小計 ${formatMoney(orderItemTotal(item))}</span>
                </div>

                <div className="rounded-lg border border-border bg-card/60">
                  <button
                    type="button"
                    className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left"
                    aria-expanded={remarksExpanded}
                    aria-controls={`item-remarks-${item.id}`}
                    aria-label={`${item.name} 項目備註 ${hasRemarks ? "已填寫" : "未填寫"}`}
                    onClick={() => toggleItemRemarks(item.id)}
                  >
                    <span className="text-xs font-medium">項目備註</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {hasRemarks ? "已填寫" : "未填寫"}
                    </span>
                    {remarksExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {remarksExpanded && (
                    <div id={`item-remarks-${item.id}`} className="border-t border-border p-3">
                      <Textarea
                        aria-label={`${item.name} 項目備註內容`}
                        value={item.remarks || ""}
                        onChange={(event) => updateItem(item.id, "remarks", event.target.value)}
                        className="min-h-20 resize-y bg-card text-sm"
                        placeholder="可自由填寫只適用於此項目嘅備註"
                        maxLength={1000}
                      />
                    </div>
                  )}
                </div>

                {requiresAdjustmentReason && (
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
      <div className="rounded-lg border border-border bg-secondary/20">
        <button
          type="button"
          className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left"
          aria-expanded={manualItemExpanded}
          aria-controls="manual-item-content"
          onClick={() => setManualItemExpanded((expanded) => !expanded)}
        >
          <Plus className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">新增項目</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {newName.trim() ? "未加入" : "選填"}
          </span>
          {manualItemExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {manualItemExpanded && (
          <div id="manual-item-content" className="flex items-end gap-2 border-t border-border p-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">項目名稱</Label>
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
                aria-label="新增項目價格"
                placeholder="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
                className="text-sm font-mono"
                min={0}
                step="1"
              />
            </div>
            <Button onClick={addItem} size="default" variant="outline" className="gap-1.5">
              <Plus className="w-4 h-4" /> 加入
            </Button>
          </div>
        )}
      </div>

      {/* Quick add fees */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" /> 送貨費
          </Label>
          <div className="flex gap-2">
            <Select
              value={!hasLegacyDeliveryFee && deliveryFeeOptionId ? `fee:${deliveryFeeOptionId}` : hasLegacyDeliveryFee ? "legacy" : undefined}
              onValueChange={(value) => {
                const option = deliveryFeeOptions.find((entry) => `fee:${entry.id}` === value);
                if (!option) return;
                onDeliveryFeeChange(option.amount); onDeliveryFeeSelectionChange?.(option);
              }}
              disabled={!deliveryFeeEnabled || deliveryFeeLoading || Boolean(deliveryFeeError)}
            >
              <SelectTrigger aria-label="送貨費" className="min-w-0 flex-1 text-sm">
                <SelectValue placeholder={deliveryFeeEnabled ? "選擇地區及送貨費" : "此收貨方式不適用"} />
              </SelectTrigger>
              <SelectContent>
                {hasLegacyDeliveryFee && (
                  <SelectItem value="legacy" disabled>
                    {deliveryFeeLabel || "舊有送貨費"} — {formatMoney(deliveryFee)}（請重新選擇）
                  </SelectItem>
                )}
                {deliveryFeeOptions.map((option) => (
                  <SelectItem key={option.id} value={`fee:${option.id}`}>
                    {option.label} — {formatMoney(option.amount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {deliveryFeeEnabled && deliveryFee > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 px-2 text-xs text-muted-foreground"
                aria-label="清除送貨費"
                onClick={() => { onDeliveryFeeChange(0); onDeliveryFeeSelectionChange?.(undefined); }}
              >
                清除
              </Button>
            )}
            {canManageDeliveryFees && <Button type="button" variant="outline" size="icon" aria-label="管理送貨費" onClick={() => setDeliveryFeeManagerOpen(true)}><Settings2 className="h-4 w-4"/></Button>}
          </div>
          {deliveryFeeError && <button type="button" className="text-left text-xs text-destructive underline" onClick={() => setDeliveryFeeRefreshKey((key) => key + 1)}>送貨費載入失敗，按此重試</button>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> 急單費
          </Label>
          <Input
            type="number"
            value={urgentFee || ""}
            onChange={(e) => onUrgentFeeChange(normalizeWholeMoney(parseFloat(e.target.value) || 0))}
            placeholder="0"
            className="text-sm font-mono"
            min={0}
            step="1"
          />
        </div>
      </div>
      <DeliveryFeeManagementDialog open={deliveryFeeManagerOpen} onOpenChange={setDeliveryFeeManagerOpen} onChanged={() => setDeliveryFeeRefreshKey((key) => key + 1)}/>

    </div>
  );
};

export default OrderItemsSection;
