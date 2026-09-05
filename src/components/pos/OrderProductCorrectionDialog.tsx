import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calculator,
  LoaderCircle,
  Minus,
  PackagePlus,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  applyOdooOrderProductCorrection,
  getOdooProducts,
  previewOdooOrderProductCorrection,
  type OdooProduct,
  type OrderProductCorrectionPreview,
  type OrderProductCorrectionSplit,
} from "@/lib/odoo-api";
import type { OrderRecordView } from "@/lib/order-records";
import { orderItemTotal } from "@/lib/order-pricing";
import type { OrderItem } from "@/types/order";

interface OrderProductCorrectionDialogProps {
  order: OrderRecordView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const money = (minor: number) => `${minor < 0 ? "-" : ""}HK$${(Math.abs(minor) / 100).toLocaleString("en-HK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const cloneItems = (items: readonly OrderItem[]): OrderItem[] => items.map((item) => ({
  ...item,
  quantity: Math.max(1, Math.round(item.quantity)),
}));

const initialSplits = (order: OrderRecordView): OrderProductCorrectionSplit[] => (
  (order.deliverySplits || []).map((split) => ({
    id: split.id,
    itemAllocations: split.itemAllocations.map((allocation) => ({ ...allocation })),
  }))
);

const clampSplitAllocations = (
  splits: readonly OrderProductCorrectionSplit[],
  items: readonly OrderItem[],
): OrderProductCorrectionSplit[] => {
  const available = new Map(items.map((item) => [item.id, item.quantity]));
  const names = new Map(items.map((item) => [item.id, item.name]));
  return splits.map((split) => ({
    ...split,
    itemAllocations: split.itemAllocations.flatMap((allocation) => {
      const remaining = available.get(allocation.itemId) || 0;
      const quantity = Math.min(remaining, Math.max(0, Math.round(allocation.quantity)));
      if (quantity <= 0 || !names.has(allocation.itemId)) return [];
      available.set(allocation.itemId, remaining - quantity);
      return [{
        itemId: allocation.itemId,
        itemName: names.get(allocation.itemId) || allocation.itemName,
        quantity,
      }];
    }),
  }));
};

const allocationQuantity = (
  split: OrderProductCorrectionSplit,
  itemId: string,
) => split.itemAllocations.find((allocation) => allocation.itemId === itemId)?.quantity || 0;

const allocatedQuantity = (
  splits: readonly OrderProductCorrectionSplit[],
  itemId: string,
) => splits.reduce((total, split) => total + allocationQuantity(split, itemId), 0);

const OrderProductCorrectionDialog = ({
  order,
  open,
  onOpenChange,
  onSaved,
}: OrderProductCorrectionDialogProps) => {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [splits, setSplits] = useState<OrderProductCorrectionSplit[]>([]);
  const [catalog, setCatalog] = useState<OdooProduct[]>([]);
  const [query, setQuery] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OrderProductCorrectionPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [settlement, setSettlement] = useState<"customer_credit" | "refund_pending">(
    "customer_credit",
  );
  const [requestKey, setRequestKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !order) return;
    setItems(cloneItems(order.items));
    setSplits(initialSplits(order));
    setQuery("");
    setPreview(null);
    setReason("");
    setSettlement("customer_credit");
    setRequestKey("");
    setError(null);
  }, [open, order]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setCatalogLoading(true);
    setCatalogError(null);
    getOdooProducts(controller.signal)
      .then((products) => {
        if (!controller.signal.aborted) setCatalog(products);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setCatalogError(loadError instanceof Error ? loadError.message : "未能載入 Odoo 商品");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCatalogLoading(false);
      });
    return () => controller.abort();
  }, [open]);

  const filteredCatalog = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return catalog.slice(0, 30);
    return catalog.filter((product) => [
      product.name,
      product.productCode || "",
      product.categoryName || "",
      product.barcode || "",
    ].some((value) => value.toLocaleLowerCase().includes(normalized))).slice(0, 30);
  }, [catalog, query]);

  const changed = useMemo(() => {
    if (!order) return false;
    return JSON.stringify(items) !== JSON.stringify(cloneItems(order.items))
      || JSON.stringify(splits) !== JSON.stringify(initialSplits(order));
  }, [items, order, splits]);

  const invalidatePreview = () => {
    setPreview(null);
    setRequestKey("");
    setError(null);
  };

  const replaceItems = (nextItems: OrderItem[]) => {
    setItems(nextItems);
    setSplits((current) => clampSplitAllocations(current, nextItems));
    invalidatePreview();
  };

  const addProduct = (product: OdooProduct) => {
    replaceItems([
      ...items,
      {
        id: crypto.randomUUID(),
        name: product.name,
        price: product.price,
        quantity: 1,
        catalogPrice: product.price,
        discountPercent: 0,
        priceOverrideReason: "",
        productId: product.id,
        productCode: product.productCode,
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        packing: "",
        remarks: "",
      },
    ]);
  };

  const updateItem = (id: string, changes: Partial<OrderItem>) => {
    replaceItems(items.map((item) => item.id === id ? { ...item, ...changes } : item));
  };

  const setAllocation = (splitId: string, item: OrderItem, raw: string) => {
    const requested = Math.max(0, Math.round(Number(raw) || 0));
    const usedElsewhere = splits
      .filter((split) => split.id !== splitId)
      .reduce((total, split) => total + allocationQuantity(split, item.id), 0);
    const quantity = Math.min(requested, Math.max(0, item.quantity - usedElsewhere));
    setSplits((current) => current.map((split) => {
      if (split.id !== splitId) return split;
      const remaining = split.itemAllocations.filter(
        (allocation) => allocation.itemId !== item.id,
      );
      return {
        ...split,
        itemAllocations: quantity > 0
          ? [...remaining, { itemId: item.id, itemName: item.name, quantity }]
          : remaining,
      };
    }));
    invalidatePreview();
  };

  const handlePreview = async () => {
    if (!order?.odooOrderId || !order.writeDate) {
      setError("呢張訂單未有完整 Odoo 編輯資料，請重新載入後再試。");
      return;
    }
    if (!changed) {
      setError("商品內容未有更改。");
      return;
    }
    if (items.some((item) => !item.productId)) {
      setError("舊單有商品未連結 Odoo Product ID，請先由管理員修正商品 mapping。");
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const result = await previewOdooOrderProductCorrection(order.odooOrderId, {
        items,
        ...(splits.length > 0 ? { splitAllocations: splits } : {}),
        expectedWriteDate: order.writeDate,
      });
      setPreview(result);
      setRequestKey(crypto.randomUUID());
    } catch (previewError) {
      setPreview(null);
      setError(previewError instanceof Error ? previewError.message : "未能計算商品差額");
    } finally {
      setPreviewing(false);
    }
  };

  const handleApply = async () => {
    if (!order?.odooOrderId || !preview) return;
    if (!reason.trim()) {
      setError("請填寫商品修改原因。");
      return;
    }
    const stableRequestKey = requestKey || crypto.randomUUID();
    if (!requestKey) setRequestKey(stableRequestKey);
    setSubmitting(true);
    setError(null);
    try {
      const result = await applyOdooOrderProductCorrection(order.odooOrderId, {
        items,
        ...(splits.length > 0 ? { splitAllocations: splits } : {}),
        expectedWriteDate: preview.sourceRevision,
        requestKey: stableRequestKey,
        reason: reason.trim(),
        settlementDisposition: settlement,
      });
      const documents = [
        result.creditNote?.name,
        result.supplementInvoice?.name,
      ].filter(Boolean).join("、");
      toast.success(
        `商品修改已入帳：${result.correction.name}${documents ? `（${documents}）` : ""}`,
      );
      onSaved();
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "未能完成商品修改");
    } finally {
      setSubmitting(false);
    }
  };

  const canPreview = Boolean(
    order?.odooOrderId
    && order.writeDate
    && items.length > 0
    && changed
    && !previewing
    && !submitting,
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!submitting) onOpenChange(nextOpen);
    }}>
      <DialogContent className="flex max-h-[92dvh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 pb-4 pt-5">
          <DialogTitle>修改訂單商品 · {order?.odooOrderName || order?.id || ""}</DialogTitle>
          <DialogDescription>
            原發票及原訂單行保持不變；確認後 Odoo 會用 Credit Note／補充發票記錄差額。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-5">
            <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="目前商品">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">目前商品</h3>
                <Badge variant="outline">{items.length} 項</Badge>
              </div>
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border bg-muted/20 p-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_10rem_3rem] sm:items-end">
                    <div className="min-w-0">
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[item.productCode, item.categoryName].filter(Boolean).join(" · ") || "未有 Product ID"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">成交單價</Label>
                      <p className="mt-2 font-mono">HK${item.price.toFixed(2)}</p>
                    </div>
                    <div>
                      <Label htmlFor={`correction-quantity-${item.id}`} className="text-xs text-muted-foreground">數量</Label>
                      <div className="mt-1 flex items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`減少 ${item.name} 數量`}
                          disabled={item.quantity <= 1}
                          onClick={() => updateItem(item.id, { quantity: item.quantity - 1 })}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          id={`correction-quantity-${item.id}`}
                          aria-label={`${item.name} 數量`}
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => updateItem(item.id, {
                            quantity: Math.max(1, Math.round(Number(event.target.value) || 1)),
                          })}
                          className="mx-1 h-10 w-16 text-center font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`增加 ${item.name} 數量`}
                          onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      aria-label={`刪除 ${item.name}`}
                      disabled={items.length <= 1}
                      onClick={() => replaceItems(items.filter((entry) => entry.id !== item.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 flex justify-between border-t pt-2 text-xs">
                    <span className="text-muted-foreground">主要收貨點：{Math.max(0, item.quantity - allocatedQuantity(splits, item.id))}</span>
                    <span className="font-mono font-semibold">小計 HK${orderItemTotal(item).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="加入商品">
              <div className="flex items-center gap-2">
                <PackagePlus className="h-4 w-4" />
                <h3 className="font-semibold">加入 Odoo 商品</h3>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                  placeholder="搜尋 Product Code、名稱或 Barcode"
                  aria-label="搜尋可加入商品"
                />
              </div>
              {catalogLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> 載入商品中…</p>
              ) : catalogError ? (
                <p role="alert" className="text-sm text-destructive">{catalogError}</p>
              ) : (
                <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCatalog.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product)}
                      className="rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
                      <span className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
                        <span>{product.productCode || product.categoryName || "Odoo"}</span>
                        <span className="font-mono text-foreground">HK${product.price.toFixed(2)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {splits.length > 0 && (
              <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="額外收貨點商品分配">
                <div>
                  <h3 className="font-semibold">額外收貨點商品分配</h3>
                  <p className="mt-1 text-xs text-muted-foreground">未分配數量會留喺主要收貨點；收貨點身份及順序唔會改。</p>
                </div>
                {splits.map((split, splitIndex) => (
                  <div key={split.id} className="space-y-2 rounded-lg border bg-muted/20 p-3">
                    <p className="text-sm font-medium">額外收貨點 {splitIndex + 2}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((item) => (
                        <Label key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-background p-2 text-sm">
                          <span className="min-w-0 truncate">{item.name}</span>
                          <Input
                            type="number"
                            min={0}
                            max={item.quantity}
                            value={allocationQuantity(split, item.id) || ""}
                            onChange={(event) => setAllocation(split.id, item, event.target.value)}
                            className="h-9 w-20 text-center font-mono"
                            aria-label={`額外收貨點 ${splitIndex + 2} ${item.name} 數量`}
                          />
                        </Label>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="商品差額計算">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                <h3 className="font-semibold">Odoo 差額計算</h3>
              </div>
              {!preview ? (
                <p className="text-sm text-muted-foreground">完成商品修改後，先計算差額再確認入帳。</p>
              ) : (
                <>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["修改前總額", money(preview.oldTotalMinor)],
                      ["修改後總額", money(preview.newTotalMinor)],
                      ["Credit Note", money(preview.creditAmountMinor)],
                      ["補充發票", money(preview.chargeAmountMinor)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-muted/40 p-3">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="mt-1 font-mono font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className={`rounded-lg border p-3 text-sm ${
                    preview.netDeltaMinor > 0
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : preview.netDeltaMinor < 0
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                        : "bg-muted/30"
                  }`}>
                    淨差額：<strong>{preview.netDeltaMinor > 0 ? "+" : ""}{money(preview.netDeltaMinor)}</strong>
                    <span className="ml-3">修改後尚欠：<strong>{money(preview.amountResidualMinor)}</strong></span>
                    {preview.customerCreditMinor > 0 && (
                      <span className="ml-3">客戶結餘：<strong>{money(preview.customerCreditMinor)}</strong></span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-correction-reason">修改原因 *</Label>
                    <Textarea
                      id="product-correction-reason"
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        setRequestKey("");
                      }}
                      maxLength={1000}
                      placeholder="例如：客戶要求將玫瑰花束改為兩份"
                    />
                  </div>
                  {preview.customerCreditMinor > 0 && (
                    <RadioGroup
                      value={settlement}
                      onValueChange={(value) => {
                        setSettlement(value as "customer_credit" | "refund_pending");
                        setRequestKey("");
                      }}
                      className="grid gap-2 sm:grid-cols-2"
                      aria-label="多收款項處理方式"
                    >
                      <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                        <RadioGroupItem value="customer_credit" className="mt-0.5" />
                        <span><strong>保留 Customer Credit</strong><span className="mt-1 block text-xs text-muted-foreground">保留喺 Odoo 客戶應收帳，之後可套用。</span></span>
                      </Label>
                      <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                        <RadioGroupItem value="refund_pending" className="mt-0.5" />
                        <span><strong>標記待退款</strong><span className="mt-1 block text-xs text-muted-foreground">只記錄待會計處理，唔會假裝銀行已退款。</span></span>
                      </Label>
                    </RadioGroup>
                  )}
                </>
              )}
            </section>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 border-t px-5 py-4">
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>返回</Button>
          <Button variant="outline" disabled={!canPreview} onClick={() => void handlePreview()}>
            {previewing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
            重新計算差額
          </Button>
          <Button disabled={!preview || submitting} onClick={() => void handleApply()}>
            {submitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            確認修改並入帳
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderProductCorrectionDialog;
