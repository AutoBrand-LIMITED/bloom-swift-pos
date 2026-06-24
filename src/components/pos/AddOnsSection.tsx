import { Gift, Check, Truck, PawPrint, Container, Flower2, Sprout, ShoppingBasket, Droplets, Package, PenLine, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OrderItem } from "@/types/order";
import { useLanguage } from "@/contexts/LanguageContext";

interface AddOnsSectionProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
}

const ADDONS: { name: string; price: number; icon: LucideIcon; color: string }[] = [
  { name: "樓梯送貨（每層）", price: 50, icon: Truck, color: "text-sky-500" },
  { name: "Soft Teddy", price: 180, icon: PawPrint, color: "text-rose-400" },
  { name: "玻璃花樽 (6\"x16\"H或以下)", price: 250, icon: Container, color: "text-cyan-500" },
  { name: "精美陶瓷花盆", price: 180, icon: Flower2, color: "text-pink-500" },
  { name: "日式花盆", price: 220, icon: Sprout, color: "text-emerald-500" },
  { name: "竹編花籃", price: 150, icon: ShoppingBasket, color: "text-amber-600" },
  { name: "保鮮花處理", price: 80, icon: Droplets, color: "text-blue-500" },
  { name: "花束包裝升級", price: 60, icon: Package, color: "text-orange-500" },
  { name: "手寫賀卡", price: 30, icon: PenLine, color: "text-violet-500" },
  { name: "LED 燈串裝飾", price: 50, icon: Lightbulb, color: "text-yellow-500" },
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
          const Icon = addon.icon;
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
              <Icon className={`w-4 h-4 shrink-0 ${addon.color}`} />
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
