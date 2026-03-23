import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Flower2, Leaf, Package, Palette, Ruler, Wind, AlertTriangle, Sparkles, Plus, Minus, X,
} from "lucide-react";
import VoiceInputButton from "@/components/pos/VoiceInputButton";

// ─── Data ────────────────────────────────────────────────────
const MAIN_FLOWERS = [
  { name: "紅玫瑰", emoji: "🌹" },
  { name: "粉玫瑰", emoji: "🌷" },
  { name: "白玫瑰", emoji: "🤍" },
  { name: "香檳玫瑰", emoji: "🥂" },
  { name: "百合", emoji: "💐" },
  { name: "繡球花", emoji: "💠" },
  { name: "向日葵", emoji: "🌻" },
  { name: "牡丹", emoji: "🌺" },
  { name: "鬱金香", emoji: "🌷" },
  { name: "蘭花", emoji: "🪻" },
  { name: "康乃馨", emoji: "🌸" },
  { name: "桔梗", emoji: "🔔" },
];

const FILLER_FLOWERS = [
  { name: "滿天星", emoji: "✨" },
  { name: "情人草", emoji: "💕" },
  { name: "臘梅", emoji: "🌼" },
  { name: "小雛菊", emoji: "🌼" },
  { name: "勿忘我", emoji: "💙" },
  { name: "薰衣草", emoji: "💜" },
  { name: "洋甘菊", emoji: "🌼" },
];

const GREENS = [
  { name: "尤加利葉", emoji: "🍃" },
  { name: "銀葉", emoji: "🌿" },
  { name: "腎蕨", emoji: "🌿" },
  { name: "龜背竹", emoji: "🍀" },
  { name: "文竹", emoji: "🌾" },
  { name: "春蘭葉", emoji: "🎋" },
];

const BOUQUET_SHAPES = ["圓形花束", "長形花束", "瀑布形花束", "韓式單面花束", "螺旋花束", "自然風花束"];
const WRAP_MATERIALS = ["牛皮紙", "霧面紙", "緞帶紙", "紗網", "絨布", "透明玻璃紙", "無包裝"];
const WRAP_COLORS = ["白色", "粉紅色", "米色", "黑色", "酒紅色", "灰色", "莫蘭迪綠", "奶茶色"];
const RIBBON_COLORS = ["白色", "粉紅色", "金色", "黑色", "酒紅色", "緞面米色", "無絲帶"];

const VASE_TYPES = ["無花器", "玻璃花樽", "陶瓷花盆", "木盒", "鐵桶", "藤籃", "壓克力盒"];
const VASE_SIZES = ["S (小)", "M (中)", "L (大)"];

const STYLE_THEMES = ["自然", "浪漫", "簡約", "奢華", "日式", "歐式", "復古", "現代"];
const OCCASIONS = ["生日", "婚禮", "開張", "慰問", "情人節", "母親節", "畢業", "週年紀念", "喬遷", "探病", "道歉", "日常"];
const COLOR_TONES = ["暖色系", "冷色系", "大地色", "粉嫩系", "紅白配", "全白", "混色", "漸變色"];

const BOUQUET_SIZES = ["迷你（10-15cm）", "標準（20-25cm）", "大型（30-40cm）", "巨型（50cm+）"];
const FRAGRANCE_PREFS = ["有香味", "無香味", "淡香", "濃香", "無所謂"];
const PRESERVATION = ["標準處理", "加保鮮劑", "附水袋", "冰袋保鮮"];

// ─── Types ───────────────────────────────────────────────────
interface FlowerSelection {
  name: string;
  emoji: string;
  quantity: number;
  color?: string;
}

interface CustomOrderState {
  // Flowers
  mainFlowers: FlowerSelection[];
  fillerFlowers: FlowerSelection[];
  greens: FlowerSelection[];
  customFlower: string;
  // Wrapping
  bouquetShape: string;
  wrapMaterial: string;
  wrapColor: string;
  ribbonColor: string;
  // Vase
  vaseType: string;
  vaseSize: string;
  // Style
  styleTheme: string;
  occasion: string;
  colorTone: string;
  // Size
  bouquetSize: string;
  estimatedDiameter: string;
  estimatedHeight: string;
  // Extra
  fragrance: string;
  allergyNotes: string;
  preservationMethod: string;
  hasAllergy: boolean;
  specialNotes: string;
}

const defaultState: CustomOrderState = {
  mainFlowers: [],
  fillerFlowers: [],
  greens: [],
  customFlower: "",
  bouquetShape: "",
  wrapMaterial: "",
  wrapColor: "",
  ribbonColor: "",
  vaseType: "",
  vaseSize: "",
  styleTheme: "",
  occasion: "",
  colorTone: "",
  bouquetSize: "",
  estimatedDiameter: "",
  estimatedHeight: "",
  fragrance: "",
  allergyNotes: "",
  preservationMethod: "",
  hasAllergy: false,
  specialNotes: "",
};

// ─── Helpers ─────────────────────────────────────────────────
function ChipSelect({ options, value, onChange, multi = false }: {
  options: string[];
  value: string | string[];
  onChange: (v: string) => void;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const selected = multi ? (value as string[]).includes(opt) : value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selected
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-secondary/60 hover:bg-secondary"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function FlowerPicker({ flowers, selected, onToggle, onQtyChange }: {
  flowers: { name: string; emoji: string }[];
  selected: FlowerSelection[];
  onToggle: (f: { name: string; emoji: string }) => void;
  onQtyChange: (name: string, qty: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {flowers.map((f) => {
        const sel = selected.find((s) => s.name === f.name);
        return (
          <div
            key={f.name}
            className={`relative flex items-center gap-2 rounded-lg border p-2 transition-colors cursor-pointer ${
              sel ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
            }`}
            onClick={() => !sel && onToggle(f)}
          >
            <span className="text-lg">{f.emoji}</span>
            <span className="text-xs font-medium flex-1">{f.name}</span>
            {sel ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-secondary"
                  onClick={() => {
                    if (sel.quantity <= 1) onToggle(f);
                    else onQtyChange(f.name, sel.quantity - 1);
                  }}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-mono w-6 text-center">{sel.quantity}</span>
                <button
                  type="button"
                  className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-secondary"
                  onClick={() => onQtyChange(f.name, sel.quantity + 1)}
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  className="h-5 w-5 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 ml-1"
                  onClick={() => onToggle(f)}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────
function Section({ icon: Icon, title, children }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
        <Icon className="w-4 h-4 text-primary" />
        {title}
      </h3>
      {children}
      <Separator />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────
interface CustomOrderDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (summary: string) => void;
}

const CustomOrderDialog = ({ open, onClose, onConfirm }: CustomOrderDialogProps) => {
  const [state, setState] = useState<CustomOrderState>(defaultState);

  const update = <K extends keyof CustomOrderState>(key: K, value: CustomOrderState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const toggleFlower = (
    category: "mainFlowers" | "fillerFlowers" | "greens",
    flower: { name: string; emoji: string }
  ) => {
    setState((prev) => {
      const list = prev[category];
      const exists = list.find((f) => f.name === flower.name);
      return {
        ...prev,
        [category]: exists
          ? list.filter((f) => f.name !== flower.name)
          : [...list, { ...flower, quantity: 1 }],
      };
    });
  };

  const updateFlowerQty = (
    category: "mainFlowers" | "fillerFlowers" | "greens",
    name: string,
    qty: number
  ) => {
    setState((prev) => ({
      ...prev,
      [category]: prev[category].map((f) => (f.name === name ? { ...f, quantity: qty } : f)),
    }));
  };

  const addCustomFlower = () => {
    if (!state.customFlower.trim()) return;
    setState((prev) => ({
      ...prev,
      mainFlowers: [...prev.mainFlowers, { name: prev.customFlower.trim(), emoji: "🌼", quantity: 1 }],
      customFlower: "",
    }));
  };

  // Build summary text
  const buildSummary = (): string => {
    const lines: string[] = [];
    lines.push("【客制訂單詳情】");

    const allFlowers = [...state.mainFlowers, ...state.fillerFlowers, ...state.greens];
    if (allFlowers.length > 0) {
      lines.push("\n🌸 花材：");
      allFlowers.forEach((f) => lines.push(`  ${f.emoji} ${f.name} x${f.quantity}`));
    }

    if (state.bouquetShape) lines.push(`\n📦 花束形狀：${state.bouquetShape}`);
    if (state.wrapMaterial) lines.push(`   包裝紙：${state.wrapMaterial}`);
    if (state.wrapColor) lines.push(`   包裝顏色：${state.wrapColor}`);
    if (state.ribbonColor) lines.push(`   絲帶：${state.ribbonColor}`);

    if (state.vaseType && state.vaseType !== "無花器") {
      lines.push(`\n🏺 花器：${state.vaseType}${state.vaseSize ? ` (${state.vaseSize})` : ""}`);
    }

    if (state.styleTheme) lines.push(`\n🎨 風格：${state.styleTheme}`);
    if (state.occasion) lines.push(`   場合：${state.occasion}`);
    if (state.colorTone) lines.push(`   色調：${state.colorTone}`);

    if (state.bouquetSize) lines.push(`\n📐 大小：${state.bouquetSize}`);
    if (state.estimatedDiameter) lines.push(`   直徑：${state.estimatedDiameter}cm`);
    if (state.estimatedHeight) lines.push(`   高度：${state.estimatedHeight}cm`);

    if (state.fragrance) lines.push(`\n🌬️ 香味：${state.fragrance}`);
    if (state.preservationMethod && state.preservationMethod !== "標準處理") {
      lines.push(`   保鮮：${state.preservationMethod}`);
    }
    if (state.hasAllergy && state.allergyNotes) lines.push(`\n⚠️ 過敏提醒：${state.allergyNotes}`);
    if (state.specialNotes) lines.push(`\n📝 特殊備註：${state.specialNotes}`);

    return lines.join("\n");
  };

  const handleConfirm = () => {
    const summary = buildSummary();
    onConfirm(summary);
    setState(defaultState);
  };

  const handleClose = () => {
    onClose();
  };

  const totalFlowers = state.mainFlowers.reduce((s, f) => s + f.quantity, 0)
    + state.fillerFlowers.reduce((s, f) => s + f.quantity, 0)
    + state.greens.reduce((s, f) => s + f.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            快速客制訂單
            {totalFlowers > 0 && (
              <Badge variant="secondary" className="ml-2 font-mono">{totalFlowers} 支花材</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="px-6 pb-4 max-h-[calc(90vh-160px)]">
          <div className="space-y-5 pr-2">
            {/* 1. Main flowers */}
            <Section icon={Flower2} title="主花選擇">
              <FlowerPicker
                flowers={MAIN_FLOWERS}
                selected={state.mainFlowers}
                onToggle={(f) => toggleFlower("mainFlowers", f)}
                onQtyChange={(name, qty) => updateFlowerQty("mainFlowers", name, qty)}
              />
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="自訂花材名稱..."
                  value={state.customFlower}
                  onChange={(e) => update("customFlower", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomFlower()}
                  className="text-sm"
                />
                <VoiceInputButton onResult={(text) => update("customFlower", text)} />
                <Button variant="outline" size="sm" onClick={addCustomFlower} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> 加入
                </Button>
              </div>
            </Section>

            {/* 2. Filler flowers */}
            <Section icon={Flower2} title="配花 / 襯花">
              <FlowerPicker
                flowers={FILLER_FLOWERS}
                selected={state.fillerFlowers}
                onToggle={(f) => toggleFlower("fillerFlowers", f)}
                onQtyChange={(name, qty) => updateFlowerQty("fillerFlowers", name, qty)}
              />
            </Section>

            {/* 3. Greens */}
            <Section icon={Leaf} title="綠葉 / 葉材">
              <FlowerPicker
                flowers={GREENS}
                selected={state.greens}
                onToggle={(f) => toggleFlower("greens", f)}
                onQtyChange={(name, qty) => updateFlowerQty("greens", name, qty)}
              />
            </Section>

            {/* 4. Wrapping */}
            <Section icon={Package} title="包裝風格">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">花束形狀</Label>
                  <ChipSelect options={BOUQUET_SHAPES} value={state.bouquetShape} onChange={(v) => update("bouquetShape", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">包裝紙材質</Label>
                  <ChipSelect options={WRAP_MATERIALS} value={state.wrapMaterial} onChange={(v) => update("wrapMaterial", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">包裝紙顏色</Label>
                  <ChipSelect options={WRAP_COLORS} value={state.wrapColor} onChange={(v) => update("wrapColor", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">絲帶顏色</Label>
                  <ChipSelect options={RIBBON_COLORS} value={state.ribbonColor} onChange={(v) => update("ribbonColor", v)} />
                </div>
              </div>
            </Section>

            {/* 5. Vase */}
            <Section icon={Package} title="花器 / 底盤">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">花器類型</Label>
                  <ChipSelect options={VASE_TYPES} value={state.vaseType} onChange={(v) => update("vaseType", v)} />
                </div>
                {state.vaseType && state.vaseType !== "無花器" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">花器尺寸</Label>
                    <ChipSelect options={VASE_SIZES} value={state.vaseSize} onChange={(v) => update("vaseSize", v)} />
                  </div>
                )}
              </div>
            </Section>

            {/* 6. Style */}
            <Section icon={Palette} title="整體風格">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">風格主題</Label>
                  <ChipSelect options={STYLE_THEMES} value={state.styleTheme} onChange={(v) => update("styleTheme", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">場合</Label>
                  <ChipSelect options={OCCASIONS} value={state.occasion} onChange={(v) => update("occasion", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">色調</Label>
                  <ChipSelect options={COLOR_TONES} value={state.colorTone} onChange={(v) => update("colorTone", v)} />
                </div>
              </div>
            </Section>

            {/* 7. Size */}
            <Section icon={Ruler} title="尺寸規格">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">花束大小</Label>
                  <ChipSelect options={BOUQUET_SIZES} value={state.bouquetSize} onChange={(v) => update("bouquetSize", v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">預計直徑 (cm)</Label>
                    <Input
                      type="number"
                      placeholder="例：25"
                      value={state.estimatedDiameter}
                      onChange={(e) => update("estimatedDiameter", e.target.value)}
                      className="text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">預計高度 (cm)</Label>
                    <Input
                      type="number"
                      placeholder="例：40"
                      value={state.estimatedHeight}
                      onChange={(e) => update("estimatedHeight", e.target.value)}
                      className="text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* 8. Fragrance & Preservation */}
            <Section icon={Wind} title="香味 & 保鮮">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">香味偏好</Label>
                  <ChipSelect options={FRAGRANCE_PREFS} value={state.fragrance} onChange={(v) => update("fragrance", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">保鮮處理</Label>
                  <ChipSelect options={PRESERVATION} value={state.preservationMethod} onChange={(v) => update("preservationMethod", v)} />
                </div>
              </div>
            </Section>

            {/* 9. Allergy */}
            <Section icon={AlertTriangle} title="過敏提醒">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch checked={state.hasAllergy} onCheckedChange={(v) => update("hasAllergy", v)} />
                  <Label className="text-xs">客人有花粉過敏或其他過敏</Label>
                </div>
                {state.hasAllergy && (
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="請列明需要避開嘅花材或過敏原..."
                      value={state.allergyNotes}
                      onChange={(e) => update("allergyNotes", e.target.value)}
                      className="text-sm min-h-[60px]"
                    />
                    <VoiceInputButton
                      onResult={(text) => update("allergyNotes", state.allergyNotes ? `${state.allergyNotes} ${text}` : text)}
                      className="self-start"
                    />
                  </div>
                )}
              </div>
            </Section>

            {/* 10. Special notes */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                📝 特殊備註
              </Label>
              <div className="flex gap-2">
                <Textarea
                  placeholder="例如：花頭要開、去刺、花腳要長..."
                  value={state.specialNotes}
                  onChange={(e) => update("specialNotes", e.target.value)}
                  className="text-sm min-h-[60px]"
                />
                <VoiceInputButton
                  onResult={(text) => update("specialNotes", state.specialNotes ? `${state.specialNotes} ${text}` : text)}
                  className="self-start"
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border bg-secondary/30">
          <div className="flex w-full items-center justify-between">
            <Button variant="ghost" onClick={handleClose}>取消</Button>
            <Button onClick={handleConfirm} className="gap-1.5 px-6">
              <Sparkles className="w-4 h-4" />
              確認客制 ({totalFlowers} 支花材)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomOrderDialog;
