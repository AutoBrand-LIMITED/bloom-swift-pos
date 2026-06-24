import { Gift, Check } from "lucide-react";
import type { OrderItem } from "@/types/order";
import { useLanguage } from "@/contexts/LanguageContext";

interface AddOnsSectionProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
}

const ADDONS = [
  { name: "樓梯送貨（每層）", price: 50 },
  { name: "Soft Teddy", price: 180 },
  { name: "玻璃花樽 (6\"x16\"H或以下)", price: 250 },
  { name: "精美陶瓷花盆", price: 180 },
  { name: "日式花盆", price: 220 },
  { name: "竹編花籃", price: 150 },
  { name: "保鮮花處理", price: 80 },
  { name: "花束包裝升級", price: 60 },
  { name: "手寫賀卡", price: 30 },
  { name: "LED 燈串裝飾", price: 50 },
];

const AddOnsSection = ({ items, onItemsChange }: AddOnsSectionProps) => {
  const { t } = useLanguage();
  const addedNames = new Set(items.map((i) => i.name));

  const toggleAddon = (addon: { name: string; price: number }) => {
    if (addedNames.has(addon.name)) {
      onItemsChange(items.filter((i) => i.name !== addon.name));
    } else {
      onItemsChange([
        ...items,
        { id: crypto.randomUUID(), name: addon.name, price: addon.price, quantity: 1 },
      ]);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/85 flex items-center gap-2">
        <Gift className="w-4 h-4" />
        {t("section_addons")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {ADDONS.map((addon) => {
          const isAdded = addedNames.has(addon.name);
          return (
            <button
              key={addon.name}
              onClick={() => toggleAddon(addon)}
              aria-pressed={isAdded}
              aria-label={`${addon.name} $${addon.price}${isAdded ? " — 已加購" : ""}`}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                isAdded
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-accent/30"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium leading-tight">{addon.name}</p>
                <p className="text-xs font-mono text-muted-foreground tabular-nums">${addon.price}</p>
              </div>
              <div className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center transition-all ${
                isAdded ? "bg-primary" : "border border-border/60"
              }`}>
                {isAdded && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AddOnsSection;
