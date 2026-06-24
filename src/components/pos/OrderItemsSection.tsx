import { useState } from "react";
import StepBadge from "@/components/pos/StepBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Package, Wallet, Wand2, Bookmark } from "lucide-react";
import VoiceInputButton from "@/components/pos/VoiceInputButton";
import CustomOrderDialog from "@/components/pos/CustomOrderDialog";
import type { OrderItem } from "@/types/order";
import { useLanguage } from "@/contexts/LanguageContext";

// Preset product names: Cantonese canonical (stored in cart) → English display.
const PRESET_EN: Record<string, string> = {
  "玫瑰花束": "Rose Bouquet", "向日葵花束": "Sunflower Bouquet", "百合花束": "Lily Bouquet",
  "繡球花束": "Hydrangea Bouquet", "混合野花束": "Mixed Wildflower Bouquet", "牡丹花束": "Peony Bouquet",
  "鬱金香花束": "Tulip Bouquet", "鮮花籃": "Fresh Flower Basket", "果籃連鮮花": "Fruit & Flower Basket",
  "蘭花籃": "Orchid Basket", "祝賀花籃": "Congratulatory Basket", "蘭花盆栽": "Potted Orchid",
  "多肉植物": "Succulent", "幸福樹": "Happiness Tree", "觀葉植物": "Foliage Plant",
  "蝴蝶蘭（雙株）": "Phalaenopsis (Double)", "喪禮花圈（白）": "Funeral Wreath (White)",
  "喪禮花圈（混色）": "Funeral Wreath (Mixed)", "靈前擺設": "Memorial Arrangement",
  "花藝佈置": "Floral Decoration", "園藝保養": "Garden Maintenance",
  "套票（100支花）": "Package (100 stems)", "禮品套裝": "Gift Set",
};
const presetLabel = (name: string, lang: string): string => (lang === "en" ? PRESET_EN[name] ?? name : name);

interface OrderItemsSectionProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  deliveryFee: number;
  urgentFee: number;
  onDeliveryFeeChange: (v: number) => void;
  onUrgentFeeChange: (v: number) => void;
  senderNotes: string;
  deliveryNotes: string;
  internalNotes: string;
  onSenderNotesChange: (v: string) => void;
  onDeliveryNotesChange: (v: string) => void;
  onInternalNotesChange: (v: string) => void;
  budget: number;
  onBudgetChange: (v: number) => void;
  subtotal: number;
  isComplete?: boolean;
  senderNotesPinned?: boolean;
  deliveryNotesPinned?: boolean;
  internalNotesPinned?: boolean;
  onSenderNotesPinnedChange?: (v: boolean) => void;
  onDeliveryNotesPinnedChange?: (v: boolean) => void;
  onInternalNotesPinnedChange?: (v: boolean) => void;
}

const OrderItemsSection = ({
  items, onItemsChange,
  deliveryFee, urgentFee,
  onDeliveryFeeChange, onUrgentFeeChange,
  senderNotes, deliveryNotes, internalNotes,
  onSenderNotesChange, onDeliveryNotesChange, onInternalNotesChange,
  budget, onBudgetChange, subtotal, isComplete,
  senderNotesPinned, deliveryNotesPinned, internalNotesPinned,
  onSenderNotesPinnedChange, onDeliveryNotesPinnedChange, onInternalNotesPinnedChange,
}: OrderItemsSectionProps) => {
  const { t, lang } = useLanguage();
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [customOrderOpen, setCustomOrderOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const CATEGORIES = [
    { id: "all", label: t("cat_all") },
    { id: "bouquet", label: t("cat_bouquet") },
    { id: "basket", label: t("cat_basket") },
    { id: "plant", label: t("cat_plant") },
    { id: "wreath", label: t("cat_wreath") },
    { id: "other", label: t("cat_other") },
  ];

  const PRESETS = [
    { name: "玫瑰花束", price: 680, category: "bouquet" },
    { name: "向日葵花束", price: 480, category: "bouquet" },
    { name: "百合花束", price: 580, category: "bouquet" },
    { name: "繡球花束", price: 780, category: "bouquet" },
    { name: "混合野花束", price: 520, category: "bouquet" },
    { name: "牡丹花束", price: 980, category: "bouquet" },
    { name: "鬱金香花束", price: 620, category: "bouquet" },
    { name: "鮮花籃", price: 880, category: "basket" },
    { name: "果籃連鮮花", price: 1200, category: "basket" },
    { name: "蘭花籃", price: 1400, category: "basket" },
    { name: "祝賀花籃", price: 980, category: "basket" },
    { name: "蘭花盆栽", price: 1200, category: "plant" },
    { name: "多肉植物", price: 280, category: "plant" },
    { name: "幸福樹", price: 680, category: "plant" },
    { name: "觀葉植物", price: 480, category: "plant" },
    { name: "蝴蝶蘭（雙株）", price: 1800, category: "plant" },
    { name: "喪禮花圈（白）", price: 1200, category: "wreath" },
    { name: "喪禮花圈（混色）", price: 1400, category: "wreath" },
    { name: "靈前擺設", price: 2200, category: "wreath" },
    { name: "花藝佈置", price: 0, category: "other" },
    { name: "園藝保養", price: 0, category: "other" },
    { name: "套票（100支花）", price: 8800, category: "other" },
    { name: "禮品套裝", price: 680, category: "other" },
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
          <Package className="w-4 h-4" />
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
      <div className="space-y-2 rounded-lg bg-secondary/50 p-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <Label className="text-xs font-medium">{t("label_budget")}</Label>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              value={budget || ""}
              onChange={(e) => onBudgetChange(parseFloat(e.target.value) || 0)}
              placeholder={t("placeholder_budget")}
              className="w-28 h-8 text-sm font-mono text-center bg-card"
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
            <span className="font-medium leading-snug">{presetLabel(p.name, lang)}</span>
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
            <div key={item.id} className="flex items-center gap-2 bg-secondary/50 rounded-lg p-2.5">
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
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">{t("label_add_item")}</Label>
          <div className="flex gap-1.5">
            <Input
              placeholder={t("placeholder_add_item")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              className="text-sm"
              maxLength={100}
            />
            <VoiceInputButton onResult={(text) => setNewName((prev) => prev ? `${prev} ${text}` : text)} />
          </div>
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-xs">{t("placeholder_price")} ($)</Label>
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
          <Plus className="w-4 h-4" /> {t("btn_add")}
        </Button>
      </div>

      {/* Quick add fees */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="space-y-1">
          <Label className="text-xs">{t("label_delivery_fee")}</Label>
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
            {t("label_urgent_fee")}
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

      {/* 3 note types */}
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

        {/* Delivery notes */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1 text-foreground font-medium">
              {t("label_delivery_notes")}
              <span className="text-xs sm:text-[10px] text-muted-foreground font-normal">{t("hint_delivery_notes")}</span>
            </Label>
            <div className="flex items-center gap-1">
              {onDeliveryNotesPinnedChange && (
                <button
                  onClick={() => onDeliveryNotesPinnedChange(!deliveryNotesPinned)}
                  title={t("label_pin_note")}
                  className={`p-1 rounded transition-colors ${deliveryNotesPinned ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Bookmark className="w-3.5 h-3.5" fill={deliveryNotesPinned ? "currentColor" : "none"} />
                </button>
              )}
              <VoiceInputButton
                onResult={(text) => onDeliveryNotesChange(deliveryNotes ? `${deliveryNotes} ${text}` : text)}
                className="h-7 w-7"
              />
            </div>
          </div>
          <Textarea
            placeholder={t("placeholder_delivery_notes")}
            value={deliveryNotes}
            onChange={(e) => onDeliveryNotesChange(e.target.value)}
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
