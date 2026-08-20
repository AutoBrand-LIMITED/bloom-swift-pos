import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
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
import { cn } from "@/lib/utils";
import {
  createOdooProduct,
  hasOdooBackend,
  reorderOdooProducts,
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

interface DragSession {
  productId: number;
  pointerId: number;
  captureTarget: HTMLDivElement;
  startX: number;
  startY: number;
  active: boolean;
  timer: number | null;
  clientX: number;
  clientY: number;
  destinationIndex: number | null;
}

const mergeCategoryOrderIntoGlobal = (
  globalProducts: OdooProduct[],
  categoryProducts: OdooProduct[],
) => {
  const categoryProductIds = new Set(categoryProducts.map((product) => product.id));
  let categoryIndex = 0;
  const merged = globalProducts.map((product) => {
    if (!categoryProductIds.has(product.id)) return product;
    const replacement = categoryProducts[categoryIndex];
    categoryIndex += 1;
    return replacement ?? product;
  });

  if (categoryIndex < categoryProducts.length) {
    merged.push(...categoryProducts.slice(categoryIndex));
  }
  return merged;
};

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
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sortMode, setSortMode] = useState(false);
  const [sortSaving, setSortSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [draggedProductId, setDraggedProductId] = useState<number | null>(null);
  const [dragDestinationIndex, setDragDestinationIndex] = useState<number | null>(null);
  const [positionEditorProductId, setPositionEditorProductId] = useState<number | null>(null);
  const [positionInput, setPositionInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const creatingProductRef = useRef(false);
  const sortSnapshotRef = useRef<OdooProduct[]>([]);
  const globalSortSnapshotRef = useRef<OdooProduct[]>([]);
  const dragSessionRef = useRef<DragSession | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const productCardRefs = useRef(new Map<number, HTMLElement>());
  const flipPositionsRef = useRef<Map<number, DOMRect> | null>(null);

  const loadProducts = useCallback(async (
    signal?: AbortSignal,
    searchQuery = "",
    categoryKey = "all",
  ) => {
    if (!hasOdooBackend) return [];
    setLoading(true);
    setError(null);
    try {
      const categoryId = categoryKey === "all"
        ? undefined
        : categoryKey === "uncategorized"
          ? 0
          : Number(categoryKey);
      const rows = await searchManageableOdooProducts(searchQuery, signal, categoryId);
      setProducts(rows);
      return rows;
    } catch (loadError) {
      if ((loadError as Error).name === "AbortError") return [];
      setError(loadError instanceof Error ? loadError.message : "未能載入商品");
      return [];
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    creatingProductRef.current = false;
    setEditorOpen(false);
    setSortMode(false);
    setActiveCategory("all");
    setQuery("");
    const controller = new AbortController();
    void loadProducts(controller.signal, "", "all");
    return () => controller.abort();
  }, [loadProducts, open]);

  const selectCategory = (categoryKey: string) => {
    if (sortMode || categoryKey === activeCategory) return;
    setActiveCategory(categoryKey);
    setError(null);
    setSavedMessage(null);
    void loadProducts(undefined, query, categoryKey);
  };

  const setFormField = <K extends keyof ProductFormState>(field: K, value: ProductFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSavedMessage(null);
  };

  const startCreate = () => {
    creatingProductRef.current = true;
    setForm({ ...EMPTY_FORM });
    setEditorOpen(true);
    setError(null);
    setSavedMessage(null);
  };

  const selectProduct = (product: OdooProduct) => {
    creatingProductRef.current = false;
    setForm(formFromProduct(product));
    setEditorOpen(true);
    setError(null);
    setSavedMessage(null);
  };

  const closeEditor = () => {
    setEditorOpen(false);
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

  const startSorting = async () => {
    setError(null);
    setSavedMessage(null);
    let sortableProducts = products;
    if (query.trim()) {
      setQuery("");
      sortableProducts = await loadProducts(undefined, "", activeCategory);
    }

    let globalProducts = sortableProducts;
    if (activeCategory !== "all") {
      try {
        globalProducts = await searchManageableOdooProducts("", undefined, undefined);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "未能載入全域商品排序");
        return;
      }
    }

    sortSnapshotRef.current = [...sortableProducts];
    globalSortSnapshotRef.current = [...globalProducts];
    setPositionEditorProductId(null);
    setSortMode(true);
  };

  const cancelSorting = () => {
    finishDrag();
    setProducts(sortSnapshotRef.current);
    setSortMode(false);
    setPositionEditorProductId(null);
    setSavedMessage(null);
  };

  const captureProductPositions = useCallback(() => {
    const positions = new Map<number, DOMRect>();
    productCardRefs.current.forEach((element, productId) => {
      positions.set(productId, element.getBoundingClientRect());
      element.getAnimations?.().forEach((animation) => animation.cancel());
    });
    return positions;
  }, []);

  const moveProductToIndex = useCallback((productId: number, destinationIndex: number) => {
    const positions = captureProductPositions();
    setProducts((current) => {
      const fromIndex = current.findIndex((product) => product.id === productId);
      if (fromIndex < 0) return current;
      const reordered = [...current];
      const [moved] = reordered.splice(fromIndex, 1);
      const toIndex = Math.max(0, Math.min(reordered.length, destinationIndex));
      if (fromIndex === toIndex) return current;
      flipPositionsRef.current = positions;
      reordered.splice(toIndex, 0, moved);
      return reordered;
    });
  }, [captureProductPositions]);

  const moveProductBy = (productId: number, delta: number) => {
    const fromIndex = products.findIndex((product) => product.id === productId);
    if (fromIndex < 0) return;
    moveProductToIndex(productId, fromIndex + delta);
    setSavedMessage("商品位置已調整，完成後請儲存排序。");
  };

  const moveProductToEdge = (productId: number, destinationIndex: number) => {
    moveProductToIndex(productId, destinationIndex);
    setSavedMessage("商品位置已調整，完成後請儲存排序。");
  };

  const openPositionEditor = (productId: number) => {
    const currentIndex = products.findIndex((product) => product.id === productId);
    setPositionEditorProductId(productId);
    setPositionInput(currentIndex >= 0 ? String(currentIndex + 1) : "");
  };

  const applyPositionEditor = () => {
    if (positionEditorProductId === null) return;
    const requestedPosition = Number.parseInt(positionInput, 10);
    if (!Number.isFinite(requestedPosition) || requestedPosition < 1 || requestedPosition > products.length) {
      setError(`請輸入 1 至 ${products.length} 之間嘅位置。`);
      return;
    }
    moveProductToIndex(positionEditorProductId, requestedPosition - 1);
    setPositionEditorProductId(null);
    setError(null);
    setSavedMessage("商品位置已調整，完成後請儲存排序。");
  };

  const activateDrag = (session: DragSession) => {
    if (dragSessionRef.current !== session) return;
    session.active = true;
    session.timer = null;
    setDraggedProductId(session.productId);
    setDragDestinationIndex(session.destinationIndex);
    setSavedMessage("放開後先套用新位置，完成後請儲存排序。");
  };

  useLayoutEffect(() => {
    const previousPositions = flipPositionsRef.current;
    if (!previousPositions) return;
    flipPositionsRef.current = null;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const activeProductId = dragSessionRef.current?.productId;
    productCardRefs.current.forEach((element, productId) => {
      if (productId === activeProductId) return;
      const previous = previousPositions.get(productId);
      if (!previous) return;
      const current = element.getBoundingClientRect();
      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

      element.animate?.(
        [
          { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    });
  }, [products]);

  const finishDrag = useCallback((pointerId?: number, commitMove = false, updateState = true) => {
    const session = dragSessionRef.current;
    if (!session || (pointerId !== undefined && session.pointerId !== pointerId)) return;

    dragSessionRef.current = null;
    if (commitMove && session.active && session.destinationIndex !== null) {
      moveProductToIndex(session.productId, session.destinationIndex);
    }
    if (session.timer !== null) window.clearTimeout(session.timer);
    if (
      typeof session.captureTarget.hasPointerCapture === "function"
      && session.captureTarget.hasPointerCapture(session.pointerId)
    ) {
      try {
        session.captureTarget.releasePointerCapture(session.pointerId);
      } catch {
        // Pointer capture may already have been released by the browser.
      }
    }
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    if (updateState) {
      setDraggedProductId(null);
      setDragDestinationIndex(null);
    }
  }, [moveProductToIndex]);

  useEffect(() => {
    if (!open) finishDrag();
  }, [finishDrag, open]);

  useEffect(() => {
    const handlePointerUp = (event: PointerEvent) => finishDrag(event.pointerId, true);
    const handlePointerCancel = (event: PointerEvent) => finishDrag(event.pointerId);
    const handleWindowBlur = () => finishDrag();
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("blur", handleWindowBlur);
      finishDrag(undefined, false, false);
    };
  }, [finishDrag]);

  const moveToPointerTarget = useCallback((session: DragSession) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const candidates = Array.from(
      container.querySelectorAll<HTMLElement>("[data-product-sort-id]"),
    ).filter((element) => Number(element.dataset.productSortId) !== session.productId);
    let destinationIndex = candidates.findIndex((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.height > 0 && session.clientY < bounds.top + bounds.height / 2;
    });
    if (destinationIndex < 0) destinationIndex = candidates.length;
    if (session.destinationIndex === destinationIndex) return;
    session.destinationIndex = destinationIndex;
    setDragDestinationIndex(destinationIndex);
  }, []);

  const startAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current !== null) return;

    const tick = () => {
      const session = dragSessionRef.current;
      const container = scrollContainerRef.current;
      if (!session?.active || !container) {
        autoScrollFrameRef.current = null;
        return;
      }

      const bounds = container.getBoundingClientRect();
      const edgeSize = Math.min(120, bounds.height * 0.24);
      let speed = 0;
      if (session.clientY < bounds.top + edgeSize) {
        speed = -Math.ceil(((bounds.top + edgeSize - session.clientY) / edgeSize) * 24);
      } else if (session.clientY > bounds.bottom - edgeSize) {
        speed = Math.ceil(((session.clientY - (bounds.bottom - edgeSize)) / edgeSize) * 24);
      }

      if (speed !== 0) {
        container.scrollTop += speed;
        moveToPointerTarget(session);
      }
      autoScrollFrameRef.current = window.requestAnimationFrame(tick);
    };

    autoScrollFrameRef.current = window.requestAnimationFrame(tick);
  }, [moveToPointerTarget]);

  const handleDragPointerDown = (productId: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!sortMode) return;
    const captureTarget = scrollContainerRef.current;
    if (!captureTarget) return;
    finishDrag();
    if (typeof captureTarget.setPointerCapture === "function") {
      try {
        captureTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture can fail if the pointer ended between dispatch and this handler.
      }
    }
    const session: DragSession = {
      productId,
      pointerId: event.pointerId,
      captureTarget,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      timer: null,
      clientX: event.clientX,
      clientY: event.clientY,
      destinationIndex: products.findIndex((product) => product.id === productId),
    };
    dragSessionRef.current = session;
    if (event.pointerType === "mouse") {
      activateDrag(session);
      return;
    }
    session.timer = window.setTimeout(() => activateDrag(session), 450);
  };

  const handleDragPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    session.clientX = event.clientX;
    session.clientY = event.clientY;
    if (!session.active) {
      const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
      if (distance > 10 && session.timer) {
        window.clearTimeout(session.timer);
        session.timer = null;
      }
      return;
    }
    event.preventDefault();
    moveToPointerTarget(session);
    startAutoScroll();
  };

  const handleDragKeyDown = (productId: number, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const keyDelta: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
    };
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      moveProductToIndex(productId, event.key === "Home" ? 0 : products.length - 1);
      setSavedMessage("商品位置已調整，完成後請儲存排序。");
      return;
    }
    const delta = keyDelta[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    moveProductBy(productId, delta);
  };

  const saveSorting = async () => {
    finishDrag();
    const globallyOrderedProducts = activeCategory === "all"
      ? products
      : mergeCategoryOrderIntoGlobal(globalSortSnapshotRef.current, products);
    const originalSequence = new Map(
      globalSortSnapshotRef.current.map((product) => [product.id, product.displaySequence])
    );
    const sequencedProducts = globallyOrderedProducts
      .map((product, index) => ({ product, displaySequence: (index + 1) * 10 }))
    const updates = sequencedProducts.filter(
      ({ product, displaySequence }) => originalSequence.get(product.id) !== displaySequence,
    );

    setSortSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      if (updates.length > 0) {
        await reorderOdooProducts(updates.map(({ product, displaySequence }) => ({
          id: product.id,
          displaySequence,
        })));
      }
      const savedSequences = new Map(
        sequencedProducts.map(({ product, displaySequence }) => [product.id, displaySequence]),
      );
      setProducts((current) => current.map((product) => ({
        ...product,
        displaySequence: savedSequences.get(product.id) ?? product.displaySequence,
      })));
      setSortMode(false);
      setPositionEditorProductId(null);
      setSavedMessage("商品排序已儲存");
      onCatalogChanged();
    } catch (sortError) {
      setError(sortError instanceof Error ? sortError.message : "未能儲存商品排序");
      await loadProducts(undefined, "", activeCategory);
    } finally {
      setSortSaving(false);
    }
  };

  const activeCategoryLabel = useMemo(() => {
    if (activeCategory === "all") return "全部商品";
    if (activeCategory === "uncategorized") return "未分類";
    return categories.find((category) => String(category.id) === activeCategory)?.name ?? "商品分類";
  }, [activeCategory, categories]);
  const productCountLabel = useMemo(
    () => `${activeCategoryLabel} · ${products.length} 件商品`,
    [activeCategoryLabel, products.length],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) finishDrag();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="block h-[92vh] max-h-[980px] w-[calc(100vw-1rem)] max-w-[1240px] overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            商品管理
          </DialogTitle>
          <DialogDescription>
            快速管理 POS 商品。需要修改資料時，撳商品右上角三點。
          </DialogDescription>
        </DialogHeader>

        <div className="flex h-[calc(100%-81px)] min-h-0 flex-col">
          <div className="border-b border-border bg-background px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void loadProducts(undefined, query, activeCategory);
                  }}
                  placeholder="搜尋名稱 / code / barcode"
                  className="h-11 pl-9"
                  disabled={sortMode}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-1.5"
                  onClick={() => void loadProducts(undefined, query, activeCategory)}
                  disabled={sortMode || loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  搜尋
                </Button>
                {!sortMode && (
                  <>
                    <Button type="button" variant="outline" className="h-11 gap-1.5" onClick={() => void startSorting()}>
                      <SlidersHorizontal className="h-4 w-4" />
                      調整排序
                    </Button>
                    <Button type="button" className="col-span-2 h-11 gap-1.5" onClick={startCreate}>
                      <Plus className="h-4 w-4" />
                      新增商品
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div
              aria-label="商品分類"
              className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
            >
              <Button
                type="button"
                size="sm"
                variant={activeCategory === "all" ? "default" : "outline"}
                className="shrink-0"
                aria-pressed={activeCategory === "all"}
                disabled={sortMode}
                onClick={() => selectCategory("all")}
              >
                全部
              </Button>
              {categories.map((category) => {
                const categoryKey = String(category.id);
                return (
                  <Button
                    key={category.id}
                    type="button"
                    size="sm"
                    variant={activeCategory === categoryKey ? "default" : "outline"}
                    className="shrink-0"
                    aria-pressed={activeCategory === categoryKey}
                    disabled={sortMode}
                    onClick={() => selectCategory(categoryKey)}
                  >
                    {category.name}
                  </Button>
                );
              })}
              <Button
                type="button"
                size="sm"
                variant={activeCategory === "uncategorized" ? "default" : "outline"}
                className="shrink-0"
                aria-pressed={activeCategory === "uncategorized"}
                disabled={sortMode}
                onClick={() => selectCategory("uncategorized")}
              >
                未分類
              </Button>
            </div>
            <div className="mt-2 flex min-h-6 items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {sortMode
                  ? activeCategory === "all"
                    ? "正在調整全域次序：拖住手柄上下移動，或用按鈕指定位置。"
                    : `正在調整「${activeCategoryLabel}」相對次序：拖住手柄上下移動，或用按鈕指定位置。`
                  : productCountLabel}
              </span>
              {savedMessage && !editorOpen && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {savedMessage}
                </span>
              )}
            </div>
          </div>

          <div
            ref={scrollContainerRef}
            className="min-h-0 flex-1 overflow-y-auto bg-secondary/15 px-4 py-4 sm:px-5"
            onPointerMove={handleDragPointerMove}
            onPointerUp={(event) => finishDrag(event.pointerId, true)}
            onPointerCancel={(event) => finishDrag(event.pointerId)}
            onLostPointerCapture={(event) => finishDrag(event.pointerId)}
          >
            {error && !editorOpen && (
              <div className="mb-3 rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }, (_, index) => (
                  <div key={index} className="h-36 animate-pulse rounded-xl border border-border bg-background" />
                ))}
              </div>
            ) : products.length > 0 && sortMode ? (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
                {products.map((product, index) => {
                  const insertionIndex = products
                    .slice(0, index)
                    .filter((candidate) => candidate.id !== draggedProductId).length;
                  const showIndicator = draggedProductId !== null
                    && product.id !== draggedProductId
                    && dragDestinationIndex === insertionIndex;
                  const isFirst = index === 0;
                  const isLast = index === products.length - 1;

                  return (
                    <Fragment key={product.id}>
                      {showIndicator && (
                        <div
                          data-testid="product-drop-indicator"
                          className="h-1 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                        />
                      )}
                      <article
                        ref={(element) => {
                          if (element) productCardRefs.current.set(product.id, element);
                          else productCardRefs.current.delete(product.id);
                        }}
                        data-product-sort-id={product.id}
                        className={cn(
                          "rounded-xl border border-border bg-background p-3 shadow-sm transition-[border-color,box-shadow,opacity]",
                          draggedProductId === product.id && "border-primary opacity-55 shadow-md",
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 px-2 text-sm font-semibold text-primary">
                              {index + 1}
                            </span>
                            <button
                              type="button"
                              aria-label={`移動 ${product.name}`}
                              className="flex h-11 w-11 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground active:cursor-grabbing active:bg-primary/10 active:text-primary"
                              onPointerDown={(event) => handleDragPointerDown(product.id, event)}
                              onKeyDown={(event) => handleDragKeyDown(product.id, event)}
                            >
                              <GripVertical className="h-5 w-5" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-foreground">{product.name}</span>
                              <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                                {product.productCode || "未有 code"} · {product.categoryName || "未分類"}
                              </span>
                            </div>
                            <div className="hidden shrink-0 text-right md:block">
                              <span className="block font-mono text-sm font-semibold">${product.price.toLocaleString()}</span>
                              <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                                {product.availableInPos ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                {product.availableInPos ? "顯示" : "隱藏"}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-11 w-11"
                              aria-label={`置頂 ${product.name}`}
                              title="置頂"
                              disabled={isFirst}
                              onClick={() => moveProductToEdge(product.id, 0)}
                            >
                              <ChevronsUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-11 w-11"
                              aria-label={`向上移動 ${product.name}`}
                              title="向上移一格"
                              disabled={isFirst}
                              onClick={() => moveProductBy(product.id, -1)}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-11 w-11"
                              aria-label={`向下移動 ${product.name}`}
                              title="向下移一格"
                              disabled={isLast}
                              onClick={() => moveProductBy(product.id, 1)}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-11 w-11"
                              aria-label={`置底 ${product.name}`}
                              title="置底"
                              disabled={isLast}
                              onClick={() => moveProductToEdge(product.id, products.length - 1)}
                            >
                              <ChevronsDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 px-3"
                              aria-label={`移到指定位置 ${product.name}`}
                              onClick={() => openPositionEditor(product.id)}
                            >
                              移到…
                            </Button>
                          </div>
                        </div>

                        {positionEditorProductId === product.id && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                            <Label htmlFor={`product-position-${product.id}`} className="text-sm">
                              移到第
                            </Label>
                            <Input
                              id={`product-position-${product.id}`}
                              aria-label={`移動 ${product.name} 至位置`}
                              type="number"
                              min={1}
                              max={products.length}
                              value={positionInput}
                              onChange={(event) => setPositionInput(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") applyPositionEditor();
                                if (event.key === "Escape") setPositionEditorProductId(null);
                              }}
                              className="h-11 w-24"
                              autoFocus
                            />
                            <span className="text-sm text-muted-foreground">位（共 {products.length} 件）</span>
                            <Button type="button" className="h-11" onClick={applyPositionEditor}>確定</Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-11"
                              onClick={() => setPositionEditorProductId(null)}
                            >
                              取消
                            </Button>
                          </div>
                        )}
                      </article>
                    </Fragment>
                  );
                })}
                {draggedProductId !== null
                  && dragDestinationIndex === products.length - 1
                  && (
                    <div
                      data-testid="product-drop-indicator"
                      className="h-1 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                    />
                  )}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <article
                    key={product.id}
                    ref={(element) => {
                      if (element) productCardRefs.current.set(product.id, element);
                      else productCardRefs.current.delete(product.id);
                    }}
                    data-product-sort-id={product.id}
                    className={cn(
                      "group relative flex min-h-36 flex-col rounded-xl border border-border bg-background p-4 shadow-sm transition-[border-color,box-shadow,transform,opacity]",
                      !sortMode && "hover:border-primary/45 hover:shadow-md",
                      sortMode && "border-dashed",
                      draggedProductId === product.id && "z-10 scale-[1.02] border-primary opacity-70 shadow-lg"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="line-clamp-2 text-[15px] font-semibold leading-5 text-foreground">
                          {product.name}
                        </span>
                        <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                          {product.productCode || product.categoryName || "未分類"}
                        </span>
                      </div>

                      <button
                        type="button"
                        aria-label={`商品設定 ${product.name}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => selectProduct(product)}
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                      <div className="min-w-0 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          {product.availableInPos ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          {product.availableInPos ? "顯示於 POS" : "已隱藏"}
                        </span>
                        {(product.availableFrom || product.availableUntil) && (
                          <span className="mt-1 block truncate">
                            {product.availableFrom || "不限"} 至 {product.availableUntil || "不限"}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-lg font-semibold text-foreground">
                        ${product.price.toLocaleString()}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-4 text-center">
                <Search className="h-7 w-7 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">未找到商品</p>
                <p className="mt-1 text-xs text-muted-foreground">改用其他名稱、code 或 barcode 再搜尋。</p>
              </div>
            )}
          </div>

          {sortMode && (
            <div className="flex items-center justify-between gap-3 border-t border-border bg-background px-4 py-3 sm:px-5">
              <p className="hidden text-sm text-muted-foreground sm:block">
                {activeCategory === "all"
                  ? "「全部」係全域順序；各分類會沿用同一套次序。"
                  : `只會改「${activeCategoryLabel}」商品之間嘅相對次序，唔會建立另一套排序。`}
              </p>
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" className="h-11" onClick={cancelSorting} disabled={sortSaving}>
                  取消
                </Button>
                <Button type="button" className="h-11 gap-1.5" onClick={() => void saveSorting()} disabled={sortSaving}>
                  {sortSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  儲存排序
                </Button>
              </div>
            </div>
          )}
        </div>

        {editorOpen && (
          <>
            <button
              type="button"
              aria-label="關閉商品設定"
              className="absolute inset-0 z-20 bg-black/25"
              onClick={closeEditor}
            />
            <aside
              aria-label={form.id ? `編輯 ${form.name}` : "新增商品"}
              className="absolute inset-y-0 right-0 z-30 flex w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 pr-4">
                <div>
                  <h3 className="text-lg font-semibold">{form.id ? "編輯商品" : "新增商品"}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">商品排序請返回商品列表用拖拉方式調整。</p>
                </div>
                <button
                  type="button"
                  aria-label="關閉編輯畫面"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={closeEditor}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
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
                    <Select value={form.categoryId} onValueChange={(value) => setFormField("categoryId", value)}>
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

                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3 sm:col-span-2">
                    <div>
                      <Label className="text-sm">顯示於 POS</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        關閉後商品仍保留喺 Odoo，但唔會出現喺 POS 商品列表。
                      </p>
                    </div>
                    <Switch checked={form.availableInPos} onCheckedChange={(checked) => setFormField("availableInPos", checked)} />
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
              </div>

              <div className="flex justify-end gap-2 border-t border-border bg-background px-5 py-4">
                <Button type="button" variant="outline" className="h-11" onClick={closeEditor}>
                  取消
                </Button>
                <Button type="button" className="h-11 gap-1.5" disabled={saving} onClick={() => void saveProduct()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  儲存到 Odoo
                </Button>
              </div>
            </aside>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProductManagementDialog;
