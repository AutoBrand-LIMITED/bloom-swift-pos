import { useState, useRef, useEffect, useMemo } from "react";
import StepBadge from "@/components/pos/StepBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, ClipboardList, Wallet, Wand2, Bookmark, Search, CornerDownLeft } from "lucide-react";
import VoiceInputButton from "@/components/pos/VoiceInputButton";
import CustomOrderDialog from "@/components/pos/CustomOrderDialog";
import type { OrderItem } from "@/types/order";
import { useLanguage } from "@/contexts/LanguageContext";
import { productLabel } from "@/lib/product-i18n";
import type { TranslationKey } from "@/lib/i18n";

const OCCASION_KEYS: TranslationKey[] = [
  "occasion_birthday", "occasion_mothers_day", "occasion_fathers_day",
  "occasion_valentines", "occasion_christmas", "occasion_anniversary",
  "occasion_graduation", "occasion_new_year", "occ_wedding", "occ_opening",
  "occ_condolence", "occ_moving", "occ_hospital", "occ_funeral", "occasion_other",
];

interface OrderItemsSectionProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  senderNotes: string;
  internalNotes: string;
  onSenderNotesChange: (v: string) => void;
  onInternalNotesChange: (v: string) => void;
  budget: number;
  onBudgetChange: (v: number) => void;
  subtotal: number;
  isComplete?: boolean;
  occasionTag?: string;
  onOccasionTagChange?: (key: string) => void;
  senderNotesPinned?: boolean;
  internalNotesPinned?: boolean;
  onSenderNotesPinnedChange?: (v: boolean) => void;
  onInternalNotesPinnedChange?: (v: boolean) => void;
}

const OrderItemsSection = ({
  items, onItemsChange,
  senderNotes, internalNotes,
  onSenderNotesChange, onInternalNotesChange,
  budget, onBudgetChange, subtotal, isComplete,
  occasionTag, onOccasionTagChange,
  senderNotesPinned, internalNotesPinned,
  onSenderNotesPinnedChange, onInternalNotesPinnedChange,
}: OrderItemsSectionProps) => {
  const { t, lang } = useLanguage();
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [customOrderOpen, setCustomOrderOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [codeQuery, setCodeQuery] = useState("");
  const codeSearchRef = useRef<HTMLInputElement>(null);

  const CATEGORIES = [
    { id: "all", label: t("cat_all") },
    { id: "bouquet", label: t("cat_bouquet") },
    { id: "basket", label: t("cat_basket") },
    { id: "plant", label: t("cat_plant") },
    { id: "wreath", label: t("cat_wreath") },
    { id: "other", label: t("cat_other") },
  ];

  const PRESETS = [
    { code: "B01", name: "玫瑰花束", price: 680, category: "bouquet" },
    { code: "B02", name: "向日葵花束", price: 480, category: "bouquet" },
    { code: "B03", name: "百合花束", price: 580, category: "bouquet" },
    { code: "B04", name: "繡球花束", price: 780, category: "bouquet" },
    { code: "B05", name: "混合野花束", price: 520, category: "bouquet" },
    { code: "B06", name: "牡丹花束", price: 980, category: "bouquet" },
    { code: "B07", name: "鬱金香花束", price: 620, category: "bouquet" },
    { code: "K01", name: "鮮花籃", price: 880, category: "basket" },
    { code: "K02", name: "果籃連鮮花", price: 1200, category: "basket" },
    { code: "K03", name: "蘭花籃", price: 1400, category: "basket" },
    { code: "K04", name: "祝賀花籃", price: 980, category: "basket" },
    { code: "P01", name: "蘭花盆栽", price: 1200, category: "plant" },
    { code: "P02", name: "多肉植物", price: 280, category: "plant" },
    { code: "P03", name: "幸福樹", price: 680, category: "plant" },
    { code: "P04", name: "觀葉植物", price: 480, category: "plant" },
    { code: "P05", name: "蝴蝶蘭（雙株）", price: 1800, category: "plant" },
    { code: "W01", name: "喪禮花圈（白）", price: 1200, category: "wreath" },
    { code: "W02", name: "喪禮花圈（混色）", price: 1400, category: "wreath" },
    { code: "W03", name: "靈前擺設", price: 2200, category: "wreath" },
    { code: "O01", name: "花藝佈置", price: 0, category: "other" },
    { code: "O02", name: "園藝保養", price: 0, category: "other" },
    { code: "O03", name: "套票（100支花）", price: 8800, category: "other" },
    { code: "O04", name: "禮品套裝", price: 680, category: "other" },
  ];

  const visiblePresets = selectedCategory === "all"
    ? PRESETS
    : PRESETS.filter((p) => p.category === selectedCategory);

  const addPreset = (preset: { name: string; price: number }) => {
    onItemsChange([
      ...items,
      { id: crypto.randomUUID(), name: preset.name, price: preset.price, quantity: 1 },
    ]);
  };

  // Quick code/name search — for experienced staff
  const codeMatches = useMemo(() => {
    const q = codeQuery.trim().toLowerCase();
    if (!q) return [];
    return PRESETS.filter((p) =>
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      productLabel(p.name, "en").toLowerCase().includes(q)
    ).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeQuery]);

  const addFromSearch = (preset: { name: string; price: number }) => {
    addPreset(preset);
    setCodeQuery("");
  };

  // Press "/" to focus the quick-search (unless already typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (typing) return;
      e.preventDefault();
      codeSearchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    <div className={`rounded-xl p-4 space-y-4 border transition-colors ${isComplete ? "bg-primary/[0.04] border-primary/20" : "bg-card border-border"}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/85 flex items-center gap-2">
          <StepBadge n={3} done={!!isComplete} />
          <ClipboardList className="w-4 h-4" />
          {t("section_order_items")}
          {items.length > 0 && (
            <span className="ml-1 text-xs sm:text-[11px] font-normal normal-case text-muted-foreground">
              {items.length} {t("unit_items")} · ${subtotal.toLocaleString()}
            </span>
          )}
        </h2>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setCustomOrderOpen(true)}
        >
          <Wand2 className="w-3.5 h-3.5" /> {t("btn_custom_order")}
        </Button>
      </div>

      <CustomOrderDialog
        open={customOrderOpen}
        onClose={() => setCustomOrderOpen(false)}
        onConfirm={(summary) => {
          onSenderNotesChange(senderNotes ? `${senderNotes}\n\n${summary}` : summary);
          setCustomOrderOpen(false);
        }}
      />

      {/* Budget */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary shrink-0" />
            <Label className="text-xs font-medium">{t("label_budget")}</Label>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              value={budget || ""}
              onChange={(e) => onBudgetChange(parseFloat(e.target.value) || 0)}
              placeholder={t("placeholder_budget")}
              className="w-28 h-9 text-sm font-mono text-center"
              min={0}
            />
          </div>
        </div>
        {budget > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t("label_used")} ${subtotal.toLocaleString()}</span>
              <span className={`font-mono font-medium ${budget - subtotal < 0 ? "text-destructive" : "text-primary"}`}>
                {budget - subtotal >= 0
                  ? `${t("label_remaining")} $${(budget - subtotal).toLocaleString()}`
                  : `${t("label_exceeded")} $${(subtotal - budget).toLocaleString()}`}
              </span>
            </div>
            <Progress
              value={Math.min((subtotal / budget) * 100, 100)}
              className={`h-2 ${subtotal > budget ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
            />
          </div>
        )}
      </div>

      {/* Quick code / name search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={codeSearchRef}
          value={codeQuery}
          onChange={(e) => setCodeQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && codeMatches[0]) {
              e.preventDefault();
              addFromSearch(codeMatches[0]);
            } else if (e.key === "Escape") {
              setCodeQuery("");
            }
          }}
          placeholder={t("placeholder_code_search")}
          className="pl-8 pr-12 h-9 text-sm font-mono"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground border border-border rounded px-1 py-0.5 pointer-events-none">/</kbd>
        {codeQuery.trim() && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            {codeMatches.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">{t("msg_no_match")}</p>
            ) : (
              codeMatches.map((p, i) => (
                <button
                  key={p.code}
                  onClick={() => addFromSearch(p)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 ${
                    i === 0 ? "bg-primary/[0.04]" : ""
                  }`}
                >
                  <span className="font-mono text-xs font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0">{p.code}</span>
                  <span className="flex-1 min-w-0 truncate">{productLabel(p.name, lang)}</span>
                  {p.price > 0 && <span className="font-mono text-xs text-muted-foreground tabular-nums shrink-0">${p.price}</span>}
                  {i === 0 && <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Quick presets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {visiblePresets.map((p) => (
          <button
            key={p.name}
            onClick={() => addPreset(p)}
            className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-left text-xs transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
          >
            <span className="min-w-0 flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary-foreground/70 shrink-0">{p.code}</span>
              <span className="font-medium leading-snug truncate">{productLabel(p.name, lang)}</span>
            </span>
            {p.price > 0 && (
              <span className="shrink-0 font-mono tabular-nums text-muted-foreground group-hover:text-primary-foreground/70">
                ${p.price}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Item list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 bg-secondary/50 rounded-lg p-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <Input
                value={item.name}
                onChange={(e) => updateItem(item.id, "name", e.target.value)}
                className="flex-1 text-sm h-9 bg-card"
                placeholder={t("placeholder_item_name")}
                maxLength={100}
              />
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={item.price || ""}
                  onChange={(e) => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                  className="w-24 text-sm h-9 font-mono bg-card text-right"
                  placeholder={t("placeholder_price")}
                  min={0}
                />
              </div>
              <span className="text-xs text-muted-foreground">×</span>
              <Input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(item.id, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 text-sm h-9 font-mono bg-card text-center"
                min={1}
              />
              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => removeItem(item.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new item */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs font-medium">{t("label_add_item")}</Label>
          <div className="flex gap-1.5">
            <Input
              placeholder={t("placeholder_add_item")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              className="text-sm h-9"
              maxLength={100}
            />
            <VoiceInputButton onResult={(text) => setNewName((prev) => prev ? `${prev} ${text}` : text)} className="h-9 w-9" />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 sm:w-28 sm:flex-none space-y-1">
            <Label className="text-xs font-medium">{t("placeholder_price")} ($)</Label>
            <Input
              type="number"
              placeholder="0"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              className="text-sm font-mono h-9"
              min={0}
            />
          </div>
          <Button onClick={addItem} size="sm" variant="outline" className="h-9 gap-1.5 px-3 shrink-0">
            <Plus className="w-4 h-4" /> {t("btn_add")}
          </Button>
        </div>
      </div>

      {/* Occasion */}
      {onOccasionTagChange && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
          <Label className="text-xs font-medium shrink-0">
            {t("label_occasion")}
          </Label>
          <div className="flex gap-1.5 flex-wrap">
            {OCCASION_KEYS.map(key => (
              <button
                key={key}
                onClick={() => onOccasionTagChange(occasionTag === key ? "" : key)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  occasionTag === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-3 pt-2 border-t border-border">
        {/* Sender notes */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1 text-foreground font-medium">
              {t("label_sender_notes")}
              <span className="text-xs sm:text-[10px] text-muted-foreground font-normal">{t("hint_sender_notes")}</span>
            </Label>
            <div className="flex items-center gap-1">
              {onSenderNotesPinnedChange && (
                <button
                  onClick={() => onSenderNotesPinnedChange(!senderNotesPinned)}
                  title={t("label_pin_note")}
                  className={`p-1 rounded transition-colors ${senderNotesPinned ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Bookmark className="w-3.5 h-3.5" fill={senderNotesPinned ? "currentColor" : "none"} />
                </button>
              )}
              <VoiceInputButton
                onResult={(text) => onSenderNotesChange(senderNotes ? `${senderNotes} ${text}` : text)}
                className="h-7 w-7"
              />
            </div>
          </div>
          <Textarea
            placeholder={t("placeholder_sender_notes")}
            value={senderNotes}
            onChange={(e) => onSenderNotesChange(e.target.value)}
            className="text-sm min-h-[56px]"
            maxLength={500}
          />
        </div>

        {/* Internal notes */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1 text-foreground font-medium">
              {t("label_internal_notes")}
              <span className="text-xs sm:text-[10px] text-muted-foreground font-normal">{t("hint_internal_notes")}</span>
            </Label>
            <div className="flex items-center gap-1">
              {onInternalNotesPinnedChange && (
                <button
                  onClick={() => onInternalNotesPinnedChange(!internalNotesPinned)}
                  title={t("label_pin_note")}
                  className={`p-1 rounded transition-colors ${internalNotesPinned ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Bookmark className="w-3.5 h-3.5" fill={internalNotesPinned ? "currentColor" : "none"} />
                </button>
              )}
              <VoiceInputButton
                onResult={(text) => onInternalNotesChange(internalNotes ? `${internalNotes} ${text}` : text)}
                className="h-7 w-7"
              />
            </div>
          </div>
          <Textarea
            placeholder={t("placeholder_internal_notes")}
            value={internalNotes}
            onChange={(e) => onInternalNotesChange(e.target.value)}
            className="text-sm min-h-[56px] border-purple-200"
            maxLength={500}
          />
        </div>
      </div>
    </div>
  );
};

export default OrderItemsSection;
