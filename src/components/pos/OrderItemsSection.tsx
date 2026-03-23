import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Package, Truck, Zap, Wallet } from "lucide-react";
import type { OrderItem } from "@/types/order";

interface OrderItemsSectionProps {
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  deliveryFee: number;
  urgentFee: number;
  onDeliveryFeeChange: (v: number) => void;
  onUrgentFeeChange: (v: number) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  budget: number;
  onBudgetChange: (v: number) => void;
  subtotal: number;
}

const OrderItemsSection = ({
  items, onItemsChange,
  deliveryFee, urgentFee,
  onDeliveryFeeChange, onUrgentFeeChange,
  notes, onNotesChange,
  budget, onBudgetChange, subtotal,
}: OrderItemsSectionProps) => {
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const PRESETS = [
    { name: "玫瑰花束", price: 680 },
    { name: "向日葵花束", price: 480 },
    { name: "百合花束", price: 580 },
    { name: "繡球花束", price: 780 },
    { name: "鮮花籃", price: 880 },
    { name: "蘭花盆栽", price: 1200 },
    { name: "多肉植物", price: 280 },
    { name: "花藝佈置", price: 0 },
    { name: "園藝保養", price: 0 },
    { name: "套票（100支花）", price: 8800 },
  ];

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
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
          <Package className="w-4 h-4" />
          訂單內容
        </h2>
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => addPreset(p)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <Plus className="w-3 h-3" />
            {p.name} {p.price > 0 && <span className="font-mono opacity-70">${p.price}</span>}
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
                placeholder="項目名稱"
                maxLength={100}
              />
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={item.price || ""}
                  onChange={(e) => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                  className="w-24 text-sm h-9 font-mono bg-card text-right"
                  placeholder="價格"
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
          <Label className="text-xs">新增項目</Label>
          <Input
            placeholder="例如：玫瑰花束、植物盆栽"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            className="text-sm"
            maxLength={100}
          />
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-xs">價格 ($)</Label>
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
          <Plus className="w-4 h-4" /> 加入
        </Button>
      </div>

      {/* Quick add fees */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" /> 送貨費
          </Label>
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
            <Zap className="w-3.5 h-3.5" /> 急單費
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

      {/* Notes */}
      <div className="space-y-1 pt-2 border-t border-border">
        <Label className="text-xs">備註</Label>
        <Textarea
          placeholder="例如：紅白配、不要滿天星、附卡片寫..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="text-sm min-h-[60px]"
          maxLength={500}
        />
      </div>
    </div>
  );
};

export default OrderItemsSection;
