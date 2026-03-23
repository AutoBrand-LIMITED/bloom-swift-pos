import { Gift, Plus, Check } from "lucide-react";
import type { OrderItem } from "@/types/order";

interface AddOnsSectionProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
}

const ADDONS = [
  { name: "精美陶瓷花盆", price: 180, emoji: "🏺" },
  { name: "日式花盆", price: 220, emoji: "🪴" },
  { name: "竹編花籃", price: 150, emoji: "🧺" },
  { name: "玻璃花瓶", price: 120, emoji: "🫙" },
  { name: "保鮮花處理", price: 80, emoji: "💎" },
  { name: "花束包裝升級", price: 60, emoji: "🎀" },
  { name: "手寫賀卡", price: 30, emoji: "✉️" },
  { name: "LED 燈串裝飾", price: 50, emoji: "✨" },
];

const AddOnsSection = ({ items, onItemsChange }: AddOnsSectionProps) => {
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
      <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
        <Gift className="w-4 h-4" />
        加購推薦
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ADDONS.map((addon) => {
          const isAdded = addedNames.has(addon.name);
          return (
            <button
              key={addon.name}
              onClick={() => toggleAddon(addon)}
              className={`relative rounded-lg border p-3 text-left transition-all ${
                isAdded
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-accent/30"
              }`}
            >
              {isAdded && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <span className="text-lg">{addon.emoji}</span>
              <p className="text-xs font-medium mt-1 leading-tight">{addon.name}</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">${addon.price}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AddOnsSection;
