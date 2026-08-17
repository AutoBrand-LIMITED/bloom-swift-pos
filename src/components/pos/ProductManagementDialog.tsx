import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  createOdooProduct,
  hasOdooBackend,
  searchManageableOdooProducts,
  updateOdooProduct,
  type OdooProduct,
  type OdooProductCategory,
  type OdooProductWritePayload,
} from "@/lib/odoo-api";

interface ProductManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: OdooProductCategory[];
  onCatalogChanged: () => void;
}

interface ProductFormState {
  id: number | null;
  name: string;
  productCode: string;
  price: string;
  categoryId: string;
  barcode: string;
  availableInPos: boolean;
  displaySequence: string;
  availableFrom: string;
  availableUntil: string;
}

const EMPTY_FORM: ProductFormState = {
  id: null,
  name: "",
  productCode: "",
  price: "",
  categoryId: "none",
  barcode: "",
  availableInPos: true,
  displaySequence: "100",
  availableFrom: "",
  availableUntil: "",
};

const formFromProduct = (product: OdooProduct): ProductFormState => ({
  id: product.id,
  name: product.name,
  productCode: product.productCode || "",
  price: String(product.price ?? 0),
  categoryId: product.categoryId ? String(product.categoryId) : "none",
  barcode: product.barcode || "",
  availableInPos: product.availableInPos,
  displaySequence: String(product.displaySequence ?? 100),
  availableFrom: product.availableFrom || "",
  availableUntil: product.availableUntil || "",
});

const ProductManagementDialog = ({
  open,
  onOpenChange,
  categories,
  onCatalogChanged,
}: ProductManagementDialogProps) => {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<OdooProduct[]>([]);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const creatingProductRef = useRef(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.id) || null,
    [form.id, products]
  );

  const loadProducts = useCallback(async (signal?: AbortSignal) => {
    if (!hasOdooBackend) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await searchManageableOdooProducts(query, signal);
      setProducts(rows);
      setForm((current) => {
        if (creatingProductRef.current || current.id || rows.length === 0) return current;
        return formFromProduct(rows[0]);
      });
    } catch (loadError) {
      if ((loadError as Error).name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "未能載入商品");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (!open) return;
    creatingProductRef.current = false;
    const controller = new AbortController();
    void loadProducts(controller.signal);
    return () => controller.abort();
  }, [loadProducts, open]);

  const setFormField = <K extends keyof ProductFormState>(field: K, value: ProductFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSavedMessage(null);
  };

  const startCreate = () => {
    creatingProductRef.current = true;
    setForm({ ...EMPTY_FORM });
    setError(null);
    setSavedMessage(null);
  };

  const selectProduct = (product: OdooProduct) => {
    creatingProductRef.current = false;
    setForm(formFromProduct(product));
    setError(null);
    setSavedMessage(null);
  };

  const payloadFromForm = (): OdooProductWritePayload => ({
    name: form.name.trim(),
    price: Number(form.price) || 0,
    productCode: form.productCode.trim() || null,
    categoryId: form.categoryId === "none" ? null : Number(form.categoryId),
    barcode: form.barcode.trim() || null,
    availableInPos: form.availableInPos,
    displaySequence: Number(form.displaySequence) || 0,
    availableFrom: form.availableFrom || null,
    availableUntil: form.availableUntil || null,
  });

  const saveProduct = async () => {
    const payload = payloadFromForm();
    if (!payload.name) {
      setError("商品名稱必須填寫。");
      return;
    }
    if (payload.availableFrom && payload.availableUntil && payload.availableFrom > payload.availableUntil) {
      setError("開始顯示日期不可遲過結束顯示日期。");
      return;
    }

    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const saved = form.id
        ? await updateOdooProduct(form.id, payload)
        : await createOdooProduct(payload);
      setProducts((current) => {
        const exists = current.some((product) => product.id === saved.id);
        return exists
          ? current.map((product) => (product.id === saved.id ? saved : product))
          : [saved, ...current];
      });
      creatingProductRef.current = false;
      setForm(formFromProduct(saved));
      setSavedMessage(form.id ? "商品已更新" : "商品已建立");
      onCatalogChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "未能儲存商品");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            商品管理
          </DialogTitle>
          <DialogDescription>
            新增商品、改售價、改分類，或控制商品是否顯示於 POS。
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-0 md:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-border p-4 md:border-b-0 md:border-r">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void loadProducts();
                  }}
                  placeholder="搜尋名稱 / code / barcode"
                  className="pl-9"
                />
              </div>
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => void loadProducts()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                搜尋
              </Button>
            </div>

            <Button type="button" variant="secondary" className="mt-3 w-full gap-1.5" onClick={startCreate}>
              <Plus className="h-4 w-4" />
              新增商品
            </Button>

            <div className="mt-3 max-h-[54vh] space-y-2 overflow-y-auto pr-1">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => selectProduct(product)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    selectedProduct?.id === product.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/35 hover:border-primary/60"
                  }`}
                >
                  <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">{product.productCode || product.categoryName || "未分類"}</span>
                    <span className="font-mono text-foreground">${product.price.toLocaleString()}</span>
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    {product.availableInPos ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {product.availableInPos ? "顯示於 POS" : "已隱藏"}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    排序 {product.displaySequence ?? 100}
                    {product.availableFrom || product.availableUntil
                      ? ` · ${product.availableFrom || "不限"} 至 ${product.availableUntil || "不限"}`
                      : " · 長期顯示"}
                  </span>
                </button>
              ))}
              {!loading && products.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">
                  未找到商品。
                </div>
              )}
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="product-manager-name">商品名稱</Label>
                <Input
                  id="product-manager-name"
                  value={form.name}
                  onChange={(event) => setFormField("name", event.target.value)}
                  placeholder="例如：玫瑰花束"
                  maxLength={140}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-manager-code">Product Code</Label>
                <Input
                  id="product-manager-code"
                  value={form.productCode}
                  onChange={(event) => setFormField("productCode", event.target.value)}
                  placeholder="例如：FB-ROSE"
                  maxLength={64}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-manager-price">售價 ($)</Label>
                <Input
                  id="product-manager-price"
                  type="number"
                  value={form.price}
                  onChange={(event) => setFormField("price", event.target.value)}
                  placeholder="0"
                  min={0}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label>分類</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(value) => setFormField("categoryId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇分類" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未分類</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-manager-barcode">Barcode</Label>
                <Input
                  id="product-manager-barcode"
                  value={form.barcode}
                  onChange={(event) => setFormField("barcode", event.target.value)}
                  placeholder="可留空"
                  maxLength={64}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-manager-sequence">POS 排序</Label>
                <Input
                  id="product-manager-sequence"
                  type="number"
                  value={form.displaySequence}
                  onChange={(event) => setFormField("displaySequence", event.target.value)}
                  min={0}
                  max={9999}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">數字越細，商品越前。</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-manager-available-from">開始顯示日期</Label>
                <Input
                  id="product-manager-available-from"
                  type="date"
                  value={form.availableFrom}
                  onChange={(event) => setFormField("availableFrom", event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-manager-available-until">結束顯示日期</Label>
                <Input
                  id="product-manager-available-until"
                  type="date"
                  value={form.availableUntil}
                  onChange={(event) => setFormField("availableUntil", event.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-3 sm:col-span-2">
                <div>
                  <Label className="text-sm">顯示於 POS</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    關閉後商品仍保留喺 Odoo，但唔會出現喺 POS 商品列表。
                  </p>
                </div>
                <Switch
                  checked={form.availableInPos}
                  onCheckedChange={(checked) => setFormField("availableInPos", checked)}
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {savedMessage && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                {savedMessage}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={startCreate}>
                清空表單
              </Button>
              <Button type="button" className="gap-1.5" disabled={saving} onClick={() => void saveProduct()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                儲存到 Odoo
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductManagementDialog;
