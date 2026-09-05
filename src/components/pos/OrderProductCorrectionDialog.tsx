import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
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

const signedMoney = (minor: number) => `${minor > 0 ? "+" : ""}${money(minor)}`;

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

type ProductChange =
  | { kind: "replaced"; before: OrderItem; after: OrderItem; deltaMinor: number }
  | { kind: "removed"; before: OrderItem; deltaMinor: number }
  | { kind: "added"; after: OrderItem; deltaMinor: number }
  | { kind: "quantity"; before: OrderItem; after: OrderItem; deltaMinor: number };

const itemTotalMinor = (item: OrderItem) => Math.round(orderItemTotal(item) * 100);

const productIdentityChanged = (before: OrderItem, after: OrderItem) => (
  before.productId !== after.productId
  || before.name !== after.name
  || before.productCode !== after.productCode
  || before.price !== after.price
);

const buildProductChanges = (
  beforeItems: readonly OrderItem[],
  afterItems: readonly OrderItem[],
): ProductChange[] => {
  const beforeById = new Map(beforeItems.map((item) => [item.id, item]));
  const afterById = new Map(afterItems.map((item) => [item.id, item]));
  const changes: ProductChange[] = [];

  beforeItems.forEach((before) => {
    const after = afterById.get(before.id);
    if (!after) {
      changes.push({ kind: "removed", before, deltaMinor: -itemTotalMinor(before) });
      return;
    }
    const deltaMinor = itemTotalMinor(after) - itemTotalMinor(before);
    if (productIdentityChanged(before, after)) {
      changes.push({ kind: "replaced", before, after, deltaMinor });
    } else if (before.quantity !== after.quantity) {
      changes.push({ kind: "quantity", before, after, deltaMinor });
    }
  });

  afterItems.forEach((after) => {
    if (!beforeById.has(after.id)) {
      changes.push({ kind: "added", after, deltaMinor: itemTotalMinor(after) });
    }
  });
  return changes;
};

const changeKindLabel = (change: ProductChange) => {
  switch (change.kind) {
    case "replaced": return "更換";
    case "removed": return "刪除";
    case "added": return "新增";
    case "quantity": return "數量";
  }
};

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
  const [replacementItemId, setReplacementItemId] = useState<string | null>(null);
  const [preview, setPreview] = useState<OrderProductCorrectionPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewRetry, setPreviewRetry] = useState(0);
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
    setReplacementItemId(null);
    setPreview(null);
    setPreviewRetry(0);
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

  const originalItems = useMemo(() => order ? cloneItems(order.items) : [], [order]);
  const productChanges = useMemo(
    () => buildProductChanges(originalItems, items),
    [items, originalItems],
  );
  const instantOldTotalMinor = useMemo(
    () => originalItems.reduce((total, item) => total + itemTotalMinor(item), 0),
    [originalItems],
  );
  const instantNewTotalMinor = useMemo(
    () => items.reduce((total, item) => total + itemTotalMinor(item), 0),
    [items],
  );
  const instantDeltaMinor = instantNewTotalMinor - instantOldTotalMinor;
  const resultOldTotalMinor = preview?.oldTotalMinor ?? instantOldTotalMinor;
  const resultNewTotalMinor = preview?.newTotalMinor ?? instantNewTotalMinor;
  const resultDeltaMinor = preview?.netDeltaMinor ?? instantDeltaMinor;
  const hasReplacement = productChanges.some((change) => change.kind === "replaced")
    || (
      productChanges.some((change) => change.kind === "removed")
      && productChanges.some((change) => change.kind === "added")
    );
  const changeSummaryLabels = [
    hasReplacement ? "更換商品" : "",
    productChanges.some((change) => change.kind === "removed") && !hasReplacement ? "刪除商品" : "",
    productChanges.some((change) => change.kind === "added") && !hasReplacement ? "新增商品" : "",
    productChanges.some((change) => change.kind === "quantity") ? "調整數量" : "",
  ].filter(Boolean);
  const previewBlockReason = !order?.odooOrderId || !order.writeDate
    ? "呢張訂單未有完整 Odoo 編輯資料，請重新載入後再試。"
    : items.some((item) => !item.productId)
      ? "尚有商品未連結 Odoo Product ID；請刪除或使用「更換」揀選正確商品。"
      : null;

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

  const selectProduct = (product: OdooProduct) => {
    if (replacementItemId) {
      replaceItems(items.map((item) => item.id === replacementItemId ? {
        ...item,
        name: product.name,
        price: product.price,
        catalogPrice: product.price,
        discountPercent: 0,
        priceOverrideReason: "",
        productId: product.id,
        productCode: product.productCode,
        categoryId: product.categoryId,
        categoryName: product.categoryName,
      } : item));
      setReplacementItemId(null);
      return;
    }
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

  useEffect(() => {
    if (!open || !changed || previewBlockReason || !order?.odooOrderId || !order.writeDate) {
      setPreviewing(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPreviewing(true);
      setError(null);
      previewOdooOrderProductCorrection(order.odooOrderId!, {
        items,
        ...(splits.length > 0 ? { splitAllocations: splits } : {}),
        expectedWriteDate: order.writeDate!,
      }, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setPreview(result);
          setRequestKey(crypto.randomUUID());
        })
        .catch((previewError: unknown) => {
          if (controller.signal.aborted) return;
          setPreview(null);
          setError(previewError instanceof Error ? previewError.message : "未能計算商品差額");
        })
        .finally(() => {
          if (!controller.signal.aborted) setPreviewing(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [changed, items, open, order?.odooOrderId, order?.writeDate, previewBlockReason, previewRetry, splits]);

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

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!submitting) onOpenChange(nextOpen);
    }}>
      <DialogContent className="flex h-[92dvh] max-h-[92dvh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 pb-4 pt-5">
          <DialogTitle>修改訂單商品 · {order?.odooOrderName || order?.id || ""}</DialogTitle>
          <DialogDescription>
            原發票及原訂單行保持不變；確認後 Odoo 會用 Credit Note／補充發票記錄差額。
          </DialogDescription>
        </DialogHeader>

        <div
          role="region"
          aria-label="商品修改內容"
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
        >
          <div className="space-y-5 p-5">
            <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="即時商品變動摘要">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  <h3 className="font-semibold">今次修改結果</h3>
                </div>
                {changed && (
                  <div className="flex flex-wrap gap-1.5">
                    {changeSummaryLabels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)}
                  </div>
                )}
              </div>

              {!changed ? (
                <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                  尚未修改商品；更換、刪除、加入或調整數量後，呢度會即時顯示差額。
                </p>
              ) : (
                <>
                  <div className={`flex items-start gap-3 rounded-lg border p-4 ${
                    resultDeltaMinor > 0
                      ? "border-amber-300 bg-amber-50 text-amber-950"
                      : resultDeltaMinor < 0
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : "border-sky-200 bg-sky-50 text-sky-950"
                  }`}>
                    {resultDeltaMinor > 0 ? (
                      <ArrowUpRight className="mt-0.5 h-5 w-5 shrink-0" />
                    ) : resultDeltaMinor < 0 ? (
                      <ArrowDownRight className="mt-0.5 h-5 w-5 shrink-0" />
                    ) : (
                      <ArrowRight className="mt-0.5 h-5 w-5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {resultDeltaMinor > 0
                          ? `多咗 ${money(resultDeltaMinor)}，需要向客戶補收`
                          : resultDeltaMinor < 0
                            ? `少咗 ${money(Math.abs(resultDeltaMinor))}，需要退款或保留 Customer Credit`
                            : "商品總額冇變，唔需要補收或退款"}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm opacity-80">
                        <span>修改前 {money(resultOldTotalMinor)}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                        <span>修改後 {money(resultNewTotalMinor)}</span>
                        {previewing ? (
                          <span className="inline-flex items-center gap-1"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Odoo 核對中</span>
                        ) : preview ? (
                          <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Odoo 已核對</span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 lg:grid-cols-2">
                    {productChanges.map((change, index) => (
                      <div key={`${change.kind}-${index}`} className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                        <Badge variant="secondary" className="shrink-0">{changeKindLabel(change)}</Badge>
                        <div className="min-w-0 flex-1">
                          {change.kind === "replaced" ? (
                            <p className="font-medium">
                              <span>{change.before.name} × {change.before.quantity}</span>
                              <ArrowRight className="mx-2 inline h-3.5 w-3.5" />
                              <span>{change.after.name} × {change.after.quantity}</span>
                            </p>
                          ) : change.kind === "removed" ? (
                            <p className="font-medium">{change.before.name} × {change.before.quantity}</p>
                          ) : change.kind === "added" ? (
                            <p className="font-medium">{change.after.name} × {change.after.quantity}</p>
                          ) : (
                            <p className="font-medium">{change.after.name}：{change.before.quantity} → {change.after.quantity}</p>
                          )}
                        </div>
                        <span className={`shrink-0 font-mono font-semibold ${
                          change.deltaMinor > 0 ? "text-amber-700" : change.deltaMinor < 0 ? "text-emerald-700" : "text-muted-foreground"
                        }`}>{signedMoney(change.deltaMinor)}</span>
                      </div>
                    ))}
                  </div>

                  {previewBlockReason && (
                    <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {previewBlockReason}
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="目前商品">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">修改後商品清單</h3>
                <Badge variant="outline">{items.length} 項</Badge>
              </div>
              {items.map((item) => (
                <div key={item.id} className={`rounded-lg border p-3 ${replacementItemId === item.id ? "border-primary bg-primary/5" : "bg-muted/20"}`}>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_10rem_8rem] sm:items-end">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        {replacementItemId === item.id && <Badge>選擇新商品中</Badge>}
                      </div>
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
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`更換 ${item.name}`}
                        onClick={() => {
                          setReplacementItemId(item.id);
                          setQuery("");
                        }}
                      >
                        <ArrowRightLeft className="mr-1.5 h-4 w-4" /> 更換
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        aria-label={`刪除 ${item.name}`}
                        disabled={items.length <= 1}
                        onClick={() => {
                          if (replacementItemId === item.id) setReplacementItemId(null);
                          replaceItems(items.filter((entry) => entry.id !== item.id));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-between border-t pt-2 text-xs">
                    <span className="text-muted-foreground">主要收貨點：{Math.max(0, item.quantity - allocatedQuantity(splits, item.id))}</span>
                    <span className="font-mono font-semibold">小計 HK${orderItemTotal(item).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="加入商品">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {replacementItemId ? <ArrowRightLeft className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
                  <h3 className="font-semibold">{replacementItemId ? "選擇替換商品" : "加入 Odoo 商品"}</h3>
                </div>
                {replacementItemId && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setReplacementItemId(null)}>
                    取消更換
                  </Button>
                )}
              </div>
              {replacementItemId && (
                <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  揀選下方商品後，會直接取代「<strong>{items.find((item) => item.id === replacementItemId)?.name}</strong>」，原有數量及收貨點分配會保留。
                </p>
              )}
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
                      onClick={() => selectProduct(product)}
                      aria-label={replacementItemId
                        ? `以 ${product.name} 更換目前商品`
                        : `加入 ${product.name}`}
                      className="min-h-20 touch-manipulation rounded-lg border p-3 text-left transition-colors active:scale-[0.99] active:border-primary active:bg-primary/5"
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
                <h3 className="font-semibold">Odoo 入帳結果（自動）</h3>
              </div>
              {!preview ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  {previewing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {!changed
                    ? "修改商品後，系統會自動核對 Credit Note／補充發票。"
                    : previewBlockReason
                      ? previewBlockReason
                      : previewing
                        ? "正在同 Odoo 自動核對會計差額…"
                        : "等待 Odoo 核對結果…"}
                </p>
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
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <span className="flex min-w-0 flex-1 items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </span>
                {changed && !previewBlockReason && !submitting && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setPreviewRetry((value) => value + 1)}>
                    重新核對
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-5 py-4 sm:items-center">
          <div className="mr-auto flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            {previewing ? (
              <><LoaderCircle className="h-4 w-4 animate-spin" /> 自動計算中…</>
            ) : preview ? (
              <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> 差額已由 Odoo 核對</>
            ) : changed ? (
              <><AlertCircle className="h-4 w-4" /> 等待差額核對</>
            ) : (
              "尚未修改商品"
            )}
          </div>
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>返回</Button>
          <Button disabled={!preview || !reason.trim() || submitting} onClick={() => void handleApply()}>
            {submitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            確認修改並入帳
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderProductCorrectionDialog;
