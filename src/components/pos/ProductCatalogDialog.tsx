import { Loader2, RefreshCw, Search } from "lucide-react";

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
  orderItemCount: number;
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
  orderItemCount,
  loading,
  error,
  onRetry,
}: ProductCatalogDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
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
            訂單已有 {orderItemCount} 項
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

      <div className="min-h-0 overflow-y-auto overscroll-contain bg-background p-4 sm:p-6">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

      <DialogFooter className="flex-row items-center justify-between border-t border-border bg-card px-4 py-3 sm:justify-between sm:px-6">
        <span className="text-sm text-muted-foreground">撳商品即可加入訂單</span>
        <Button type="button" onClick={() => onOpenChange(false)}>完成</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ProductCatalogDialog;
