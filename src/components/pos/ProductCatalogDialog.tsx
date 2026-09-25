import { Loader2, Minus, Plus, RefreshCw, Search, ShoppingCart, Trash2 } from "lucide-react";

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
import { formatMoney } from "@/lib/money";
import type { OdooProduct, OdooProductCategory } from "@/lib/odoo-api";
import { orderItemTotal } from "@/lib/order-pricing";
import type { OrderItem } from "@/types/order";

interface ProductCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: OdooProduct[];
  totalCount: number;
  categories: OdooProductCategory[];
  query: string;
  onQueryChange: (query: string) => void;
  activeCategory: number | "all";
  onActiveCategoryChange: (category: number | "all") => void;
  onSelectProduct: (product: OdooProduct) => void;
  orderItems: OrderItem[];
  onItemQuantityChange: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const ProductCatalogDialog = ({
  open,
  onOpenChange,
  products,
  totalCount,
  categories,
  query,
  onQueryChange,
  activeCategory,
  onActiveCategoryChange,
  onSelectProduct,
  orderItems,
  onItemQuantityChange,
  onRemoveItem,
  loading,
  error,
  onRetry,
}: ProductCatalogDialogProps) => {
  const productTotal = orderItems.reduce((total, item) => total + orderItemTotal(item), 0);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="grid h-[92dvh] max-h-[92dvh] w-[calc(100vw-1rem)] max-w-[1500px] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
      <DialogHeader className="border-b border-border px-4 py-4 pr-12 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <DialogTitle>商品 Full View</DialogTitle>
            <DialogDescription className="mt-1">
              搜尋或按分類揀商品；撳商品後可以繼續加入其他商品。
            </DialogDescription>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
            訂單已有 {orderItems.length} 項
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="搜尋 product code / 商品名稱"
              aria-label="Full View 搜尋商品"
              className="h-11 bg-background pl-9 text-base"
              maxLength={80}
            />
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">
            {loading ? "載入中" : `${products.length} / ${totalCount}`}
          </span>
        </div>

        {categories.length > 0 && (
          <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1" aria-label="Full View 商品分類">
            <button
              type="button"
              onClick={() => onActiveCategoryChange("all")}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary/60 hover:bg-secondary"
              }`}
            >
              全部
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onActiveCategoryChange(category.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
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
      </div>

      <div className="flex min-h-0 flex-col bg-background lg:flex-row">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {loading ? (
            <div className="grid h-full min-h-48 place-items-center text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> 載入商品中
              </span>
            </div>
          ) : error ? (
            <div className="grid h-full min-h-48 place-items-center">
              <div className="space-y-3 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button type="button" variant="outline" onClick={onRetry} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> 重試
                </Button>
              </div>
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelectProduct(product)}
                  className="group flex min-h-28 flex-col justify-between rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:bg-primary/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`加入商品 ${product.name}`}
                >
                  <span className="line-clamp-2 text-base font-semibold leading-snug group-hover:text-primary">
                    {product.name}
                  </span>
                  <span className="mt-4 flex items-end justify-between gap-3">
                    <span className="min-w-0 truncate text-sm text-muted-foreground">
                      {product.productCode || product.categoryName || "Odoo"}
                    </span>
                    <span className="shrink-0 font-mono text-lg font-semibold">
                      ${formatMoney(product.price)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid h-full min-h-48 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              未找到商品，請改用其他 keyword 或分類。
            </div>
          )}
        </div>

        <aside className="flex max-h-[36dvh] shrink-0 flex-col border-t border-border bg-card lg:max-h-none lg:w-96 lg:border-l lg:border-t-0" aria-label="已選商品">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 font-semibold">
              <ShoppingCart className="h-4 w-4 text-primary" />
              已選商品
            </div>
            <span className="text-sm text-muted-foreground">{orderItems.length} 項</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            {orderItems.length > 0 ? (
              <div className="space-y-2">
                {orderItems.map((item) => (
                  <article key={item.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{item.name}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {item.productCode || "自訂項目"} · 單價 ${formatMoney(item.price)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                        aria-label={`刪除已選商品 ${item.name}`}
                        onClick={() => onRemoveItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-md border border-border bg-card">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-r-none"
                          aria-label={`減少 ${item.name} 數量`}
                          disabled={item.quantity <= 1}
                          onClick={() => onItemQuantityChange(item.id, Math.max(1, item.quantity - 1))}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={item.quantity}
                          aria-label={`${item.name} 數量`}
                          onChange={(event) => onItemQuantityChange(
                            item.id,
                            Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                          )}
                          className="h-8 w-12 rounded-none border-y-0 px-1 text-center font-mono text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-l-none"
                          aria-label={`增加 ${item.name} 數量`}
                          onClick={() => onItemQuantityChange(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <span className="font-mono text-sm font-semibold">
                        ${formatMoney(orderItemTotal(item))}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid h-full min-h-28 place-items-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
                尚未選擇商品
              </div>
            )}
          </div>

          <div className="border-t border-border bg-secondary/30 px-4 py-4">
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm text-muted-foreground">商品總額</span>
              <span className="font-mono text-2xl font-semibold">${formatMoney(productTotal)}</span>
            </div>
          </div>
        </aside>
      </div>

      <DialogFooter className="flex-row items-center justify-between border-t border-border bg-card px-4 py-3 sm:justify-between sm:px-6">
        <span className="text-sm text-muted-foreground">撳商品即可加入訂單</span>
        <Button type="button" onClick={() => onOpenChange(false)}>完成</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
};

export default ProductCatalogDialog;
