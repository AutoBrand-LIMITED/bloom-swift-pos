import { useState, useMemo } from "react";
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
  Flower2, Leaf, Package, Palette, Ruler, Wind, AlertTriangle, Sparkles, Plus, Minus, X, Tag, Heart,
} from "lucide-react";

// ─── Product Types ───────────────────────────────────────────
type ProductType = "bouquet" | "basket" | "stand" | "fruit_basket" | "preserved" | "potted" | "wreath";

const PRODUCT_TYPES: { id: ProductType; label: string; emoji: string }[] = [
  { id: "bouquet", label: "花束", emoji: "💐" },
  { id: "basket", label: "花籃", emoji: "🧺" },
  { id: "stand", label: "花牌 / 花架", emoji: "🎋" },
  { id: "fruit_basket", label: "果籃", emoji: "🍎" },
  { id: "preserved", label: "保鮮花 / 永生花", emoji: "🌹" },
  { id: "potted", label: "盆栽 / 盆花", emoji: "🪴" },
  { id: "wreath", label: "花環 / 花圈", emoji: "⭕" },
];

const OCCASIONS = ["生日", "婚禮", "開張", "慰問", "情人節", "母親節", "畢業", "週年紀念", "喬遷", "探病", "道歉", "白事", "日常"];

// ─── Category-based Options ──────────────────────────────────
const FLOWERS_BY_TYPE: Record<ProductType, { name: string; emoji: string }[]> = {
  bouquet: [
    { name: "紅玫瑰", emoji: "🌹" }, { name: "粉玫瑰", emoji: "🌷" }, { name: "白玫瑰", emoji: "🤍" },
    { name: "香檳玫瑰", emoji: "🥂" }, { name: "百合", emoji: "💐" }, { name: "繡球花", emoji: "💠" },
    { name: "向日葵", emoji: "🌻" }, { name: "牡丹", emoji: "🌺" }, { name: "鬱金香", emoji: "🌷" },
    { name: "蘭花", emoji: "🪻" }, { name: "康乃馨", emoji: "🌸" }, { name: "桔梗", emoji: "🔔" },
  ],
  basket: [
    { name: "百合", emoji: "💐" }, { name: "繡球花", emoji: "💠" }, { name: "康乃馨", emoji: "🌸" },
    { name: "太陽花", emoji: "🌻" }, { name: "蘭花", emoji: "🪻" }, { name: "玫瑰", emoji: "🌹" },
    { name: "非洲菊", emoji: "🌼" }, { name: "菊花", emoji: "🌼" },
  ],
  stand: [
    { name: "蘭花", emoji: "🪻" }, { name: "百合", emoji: "💐" }, { name: "太陽花", emoji: "🌻" },
    { name: "菊花", emoji: "🌼" }, { name: "劍蘭", emoji: "🌿" }, { name: "玫瑰", emoji: "🌹" },
    { name: "繡球花", emoji: "💠" },
  ],
  fruit_basket: [
    { name: "百合", emoji: "💐" }, { name: "康乃馨", emoji: "🌸" }, { name: "太陽花", emoji: "🌻" },
    { name: "非洲菊", emoji: "🌼" },
  ],
  preserved: [
    { name: "永生玫瑰", emoji: "🌹" }, { name: "永生繡球", emoji: "💠" }, { name: "永生康乃馨", emoji: "🌸" },
    { name: "乾燥滿天星", emoji: "✨" }, { name: "乾燥薰衣草", emoji: "💜" }, { name: "乾燥棉花", emoji: "☁️" },
    { name: "乾燥兔尾草", emoji: "🌾" },
  ],
  potted: [
    { name: "蘭花（蝴蝶蘭）", emoji: "🪻" }, { name: "多肉植物", emoji: "🌵" }, { name: "繡球花盆栽", emoji: "💠" },
    { name: "發財樹", emoji: "🌳" }, { name: "虎尾蘭", emoji: "🌿" }, { name: "琴葉榕", emoji: "🍃" },
  ],
  wreath: [
    { name: "玫瑰", emoji: "🌹" }, { name: "百合", emoji: "💐" }, { name: "菊花", emoji: "🌼" },
    { name: "繡球花", emoji: "💠" }, { name: "康乃馨", emoji: "🌸" }, { name: "蘭花", emoji: "🪻" },
  ],
};

const FILLERS_BY_TYPE: Record<ProductType, { name: string; emoji: string }[]> = {
  bouquet: [
    { name: "滿天星", emoji: "✨" }, { name: "情人草", emoji: "💕" }, { name: "臘梅", emoji: "🌼" },
    { name: "小雛菊", emoji: "🌼" }, { name: "勿忘我", emoji: "💙" }, { name: "薰衣草", emoji: "💜" }, { name: "洋甘菊", emoji: "🌼" },
  ],
  basket: [
    { name: "滿天星", emoji: "✨" }, { name: "小雛菊", emoji: "🌼" }, { name: "情人草", emoji: "💕" },
  ],
  stand: [
    { name: "滿天星", emoji: "✨" }, { name: "情人草", emoji: "💕" },
  ],
  fruit_basket: [
    { name: "滿天星", emoji: "✨" },
  ],
  preserved: [
    { name: "乾燥滿天星", emoji: "✨" }, { name: "乾燥情人草", emoji: "💕" }, { name: "乾燥小雛菊", emoji: "🌼" },
  ],
  potted: [],
  wreath: [
    { name: "滿天星", emoji: "✨" }, { name: "小雛菊", emoji: "🌼" },
  ],
};

const GREENS_BY_TYPE: Record<ProductType, { name: string; emoji: string }[]> = {
  bouquet: [
    { name: "尤加利葉", emoji: "🍃" }, { name: "銀葉", emoji: "🌿" }, { name: "腎蕨", emoji: "🌿" },
    { name: "龜背竹", emoji: "🍀" }, { name: "文竹", emoji: "🌾" }, { name: "春蘭葉", emoji: "🎋" },
  ],
  basket: [
    { name: "尤加利葉", emoji: "🍃" }, { name: "腎蕨", emoji: "🌿" }, { name: "龜背竹", emoji: "🍀" },
  ],
  stand: [
    { name: "龜背竹", emoji: "🍀" }, { name: "散尾葵", emoji: "🌴" }, { name: "腎蕨", emoji: "🌿" },
  ],
  fruit_basket: [
    { name: "尤加利葉", emoji: "🍃" },
  ],
  preserved: [
    { name: "乾燥尤加利", emoji: "🍃" },
  ],
  potted: [],
  wreath: [
    { name: "尤加利葉", emoji: "🍃" }, { name: "銀葉", emoji: "🌿" },
  ],
};

const SHAPES_BY_TYPE: Record<ProductType, string[]> = {
  bouquet: ["圓形花束", "長形花束", "瀑布形花束", "韓式單面花束", "螺旋花束", "自然風花束"],
  basket: ["圓形花籃", "橢圓形花籃", "提籃", "開放式花籃"],
  stand: ["三腳架", "雙層花牌", "單層花牌", "羅馬柱花架"],
  fruit_basket: ["圓形果籃", "提籃", "禮盒式"],
  preserved: ["玻璃罩", "禮盒", "花束式", "相框式"],
  potted: ["陶瓷盆", "水泥盆", "藤編盆", "自帶花盆"],
  wreath: ["圓形花環", "心形花環", "半月形", "十字架形"],
};

const WRAP_BY_TYPE: Record<ProductType, string[]> = {
  bouquet: ["牛皮紙", "霧面紙", "緞帶紙", "紗網", "絨布", "透明玻璃紙", "無包裝"],
  basket: ["無包裝", "玻璃紙外層", "緞帶裝飾"],
  stand: ["無包裝", "緞帶"],
  fruit_basket: ["玻璃紙", "禮盒包裝", "緞帶裝飾"],
  preserved: ["禮盒", "玻璃紙", "紗網"],
  potted: ["無包裝", "禮盒", "麻布袋"],
  wreath: ["無包裝", "緞帶裝飾"],
};

const SIZES_BY_TYPE: Record<ProductType, string[]> = {
  bouquet: ["迷你（10-15cm）", "標準（20-25cm）", "大型（30-40cm）", "巨型（50cm+）"],
  basket: ["小型花籃", "標準花籃", "大型花籃", "巨型花籃"],
  stand: ["標準花牌（5尺）", "大型花牌（6尺）", "雙層花牌"],
  fruit_basket: ["小型", "標準", "豪華"],
  preserved: ["迷你", "標準", "大型"],
  potted: ["S (小)", "M (中)", "L (大)", "XL (特大)"],
  wreath: ["小型（30cm）", "標準（45cm）", "大型（60cm+）"],
};

// Occasion-based recommendations
const OCCASION_RECOMMENDATIONS: Record<string, {
  suggestedFlowers: string[];
  suggestedColors: string[];
  suggestedThemes: string[];
}> = {
  "生日": { suggestedFlowers: ["紅玫瑰", "粉玫瑰", "向日葵", "繡球花"], suggestedColors: ["粉嫩系", "暖色系", "混色"], suggestedThemes: ["浪漫", "簡約"] },
  "婚禮": { suggestedFlowers: ["白玫瑰", "香檳玫瑰", "百合", "牡丹"], suggestedColors: ["全白", "粉嫩系"], suggestedThemes: ["浪漫", "奢華", "歐式"] },
  "開張": { suggestedFlowers: ["太陽花", "蘭花", "百合", "劍蘭"], suggestedColors: ["暖色系", "紅白配"], suggestedThemes: ["奢華", "現代"] },
  "慰問": { suggestedFlowers: ["百合", "康乃馨", "繡球花"], suggestedColors: ["暖色系", "粉嫩系"], suggestedThemes: ["自然", "簡約"] },
  "情人節": { suggestedFlowers: ["紅玫瑰", "粉玫瑰", "鬱金香"], suggestedColors: ["暖色系", "粉嫩系", "紅白配"], suggestedThemes: ["浪漫", "奢華"] },
  "母親節": { suggestedFlowers: ["康乃馨", "百合", "繡球花"], suggestedColors: ["粉嫩系", "暖色系"], suggestedThemes: ["自然", "浪漫"] },
  "畢業": { suggestedFlowers: ["向日葵", "繡球花", "玫瑰"], suggestedColors: ["暖色系", "混色"], suggestedThemes: ["簡約", "現代"] },
  "週年紀念": { suggestedFlowers: ["紅玫瑰", "香檳玫瑰", "牡丹"], suggestedColors: ["暖色系", "粉嫩系"], suggestedThemes: ["浪漫", "奢華"] },
  "喬遷": { suggestedFlowers: ["蘭花", "百合", "向日葵"], suggestedColors: ["暖色系", "大地色"], suggestedThemes: ["自然", "現代"] },
  "探病": { suggestedFlowers: ["百合", "康乃馨", "非洲菊"], suggestedColors: ["暖色系", "粉嫩系"], suggestedThemes: ["自然", "簡約"] },
  "道歉": { suggestedFlowers: ["白玫瑰", "百合", "繡球花"], suggestedColors: ["全白", "冷色系"], suggestedThemes: ["簡約"] },
  "白事": { suggestedFlowers: ["白菊花", "百合", "白玫瑰"], suggestedColors: ["全白", "冷色系"], suggestedThemes: ["簡約"] },
  "日常": { suggestedFlowers: ["向日葵", "小雛菊", "繡球花"], suggestedColors: ["混色", "暖色系"], suggestedThemes: ["自然", "簡約"] },
};

const WRAP_COLORS = ["白色", "粉紅色", "米色", "黑色", "酒紅色", "灰色", "莫蘭迪綠", "奶茶色"];
const RIBBON_COLORS = ["白色", "粉紅色", "金色", "黑色", "酒紅色", "緞面米色", "無絲帶"];
const VASE_TYPES = ["無花器", "玻璃花樽", "陶瓷花盆", "木盒", "鐵桶", "藤籃", "壓克力盒"];
const VASE_SIZES = ["S (小)", "M (中)", "L (大)"];
const STYLE_THEMES = ["自然", "浪漫", "簡約", "奢華", "日式", "歐式", "復古", "現代"];
const COLOR_TONES = ["暖色系", "冷色系", "大地色", "粉嫩系", "紅白配", "全白", "混色", "漸變色"];
const FRAGRANCE_PREFS = ["有香味", "無香味", "淡香", "濃香", "無所謂"];
const PRESERVATION = ["標準處理", "加保鮮劑", "附水袋", "冰袋保鮮"];

// Fruit basket extras
const FRUITS = [
  { name: "蘋果", emoji: "🍎" }, { name: "橙", emoji: "🍊" }, { name: "提子", emoji: "🍇" },
  { name: "芒果", emoji: "🥭" }, { name: "士多啤梨", emoji: "🍓" }, { name: "藍莓", emoji: "🫐" },
  { name: "奇異果", emoji: "🥝" }, { name: "車厘子", emoji: "🍒" },
];

// ─── Types ───────────────────────────────────────────────────
interface FlowerSelection {
  name: string;
  emoji: string;
  quantity: number;
}

interface CustomOrderState {
  productType: ProductType | "";
  occasion: string;
  mainFlowers: FlowerSelection[];
  fillerFlowers: FlowerSelection[];
  greens: FlowerSelection[];
  fruits: FlowerSelection[];
  customFlower: string;
  bouquetShape: string;
  wrapMaterial: string;
  wrapColor: string;
  ribbonColor: string;
  vaseType: string;
  vaseSize: string;
  styleTheme: string;
  colorTone: string;
  bouquetSize: string;
  estimatedDiameter: string;
  estimatedHeight: string;
  fragrance: string;
  allergyNotes: string;
  preservationMethod: string;
  hasAllergy: boolean;
  specialNotes: string;
}

const defaultState: CustomOrderState = {
  productType: "",
  occasion: "",
  mainFlowers: [],
  fillerFlowers: [],
  greens: [],
  fruits: [],
  customFlower: "",
  bouquetShape: "",
  wrapMaterial: "",
  wrapColor: "",
  ribbonColor: "",
  vaseType: "",
  vaseSize: "",
  styleTheme: "",
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
function ChipSelect({ options, value, onChange, highlighted }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  highlighted?: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const selected = value === opt;
        const isRecommended = highlighted?.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selected
                ? "bg-primary text-primary-foreground border-primary"
                : isRecommended
                  ? "border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary"
                  : "border-border bg-secondary/60 hover:bg-secondary"
            }`}
          >
            {isRecommended && !selected ? "⭐ " : ""}{opt}
          </button>
        );
      })}
    </div>
  );
}

function FlowerPicker({ flowers, selected, onToggle, onQtyChange, highlighted }: {
  flowers: { name: string; emoji: string }[];
  selected: FlowerSelection[];
  onToggle: (f: { name: string; emoji: string }) => void;
  onQtyChange: (name: string, qty: number) => void;
  highlighted?: string[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {flowers.map((f) => {
        const sel = selected.find((s) => s.name === f.name);
        const isRecommended = highlighted?.includes(f.name);
        return (
          <div
            key={f.name}
            className={`relative flex items-center gap-2 rounded-lg border p-2 transition-colors cursor-pointer ${
              sel
                ? "border-primary bg-primary/5"
                : isRecommended
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                  : "border-border hover:bg-secondary/50"
            }`}
            onClick={() => !sel && onToggle(f)}
          >
            <span className="text-lg">{f.emoji}</span>
            <span className="text-xs font-medium flex-1">
              {isRecommended && !sel ? "⭐ " : ""}{f.name}
            </span>
            {sel ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-secondary"
                  onClick={() => { if (sel.quantity <= 1) onToggle(f); else onQtyChange(f.name, sel.quantity - 1); }}>
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-mono w-6 text-center">{sel.quantity}</span>
                <button type="button" className="h-6 w-6 rounded-full border border-border flex items-center justify-center hover:bg-secondary"
                  onClick={() => onQtyChange(f.name, sel.quantity + 1)}>
                  <Plus className="w-3 h-3" />
                </button>
                <button type="button" className="h-5 w-5 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 ml-1"
                  onClick={() => onToggle(f)}>
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

  const pt = state.productType as ProductType;
  const rec = state.occasion ? OCCASION_RECOMMENDATIONS[state.occasion] : null;

  const availableFlowers = pt ? FLOWERS_BY_TYPE[pt] : [];
  const availableFillers = pt ? FILLERS_BY_TYPE[pt] : [];
  const availableGreens = pt ? GREENS_BY_TYPE[pt] : [];
  const availableShapes = pt ? SHAPES_BY_TYPE[pt] : [];
  const availableWraps = pt ? WRAP_BY_TYPE[pt] : [];
  const availableSizes = pt ? SIZES_BY_TYPE[pt] : [];

  const toggleFlower = (category: "mainFlowers" | "fillerFlowers" | "greens" | "fruits", flower: { name: string; emoji: string }) => {
    setState((prev) => {
      const list = prev[category];
      const exists = list.find((f) => f.name === flower.name);
      return { ...prev, [category]: exists ? list.filter((f) => f.name !== flower.name) : [...list, { ...flower, quantity: 1 }] };
    });
  };

  const updateFlowerQty = (category: "mainFlowers" | "fillerFlowers" | "greens" | "fruits", name: string, qty: number) => {
    setState((prev) => ({ ...prev, [category]: prev[category].map((f) => (f.name === name ? { ...f, quantity: qty } : f)) }));
  };

  const addCustomFlower = () => {
    if (!state.customFlower.trim()) return;
    setState((prev) => ({ ...prev, mainFlowers: [...prev.mainFlowers, { name: prev.customFlower.trim(), emoji: "🌼", quantity: 1 }], customFlower: "" }));
  };

  const handleProductTypeChange = (id: ProductType) => {
    setState((prev) => ({
      ...prev,
      productType: id,
      mainFlowers: [], fillerFlowers: [], greens: [], fruits: [],
      bouquetShape: "", wrapMaterial: "", bouquetSize: "",
    }));
  };

  const totalFlowers = state.mainFlowers.reduce((s, f) => s + f.quantity, 0)
    + state.fillerFlowers.reduce((s, f) => s + f.quantity, 0)
    + state.greens.reduce((s, f) => s + f.quantity, 0);

  const buildSummary = (): string => {
    const lines: string[] = [];
    const ptLabel = PRODUCT_TYPES.find((p) => p.id === state.productType)?.label || "客制訂單";
    lines.push(`【${ptLabel} — 客制詳情】`);
    if (state.occasion) lines.push(`場合：${state.occasion}`);

    const allFlowers = [...state.mainFlowers, ...state.fillerFlowers, ...state.greens];
    if (allFlowers.length > 0) {
      lines.push("\n🌸 花材：");
      allFlowers.forEach((f) => lines.push(`  ${f.emoji} ${f.name} x${f.quantity}`));
    }
    if (state.fruits.length > 0) {
      lines.push("\n🍎 生果：");
      state.fruits.forEach((f) => lines.push(`  ${f.emoji} ${f.name} x${f.quantity}`));
    }

    if (state.bouquetShape) lines.push(`\n📦 形狀：${state.bouquetShape}`);
    if (state.wrapMaterial) lines.push(`   包裝：${state.wrapMaterial}`);
    if (state.wrapColor) lines.push(`   包裝顏色：${state.wrapColor}`);
    if (state.ribbonColor) lines.push(`   絲帶：${state.ribbonColor}`);

    if (state.vaseType && state.vaseType !== "無花器") {
      lines.push(`\n🏺 花器：${state.vaseType}${state.vaseSize ? ` (${state.vaseSize})` : ""}`);
    }

    if (state.styleTheme) lines.push(`\n🎨 風格：${state.styleTheme}`);
    if (state.colorTone) lines.push(`   色調：${state.colorTone}`);
    if (state.bouquetSize) lines.push(`\n📐 大小：${state.bouquetSize}`);
    if (state.estimatedDiameter) lines.push(`   直徑：${state.estimatedDiameter}cm`);
    if (state.estimatedHeight) lines.push(`   高度：${state.estimatedHeight}cm`);
    if (state.fragrance) lines.push(`\n🌬️ 香味：${state.fragrance}`);
    if (state.preservationMethod && state.preservationMethod !== "標準處理") lines.push(`   保鮮：${state.preservationMethod}`);
    if (state.hasAllergy && state.allergyNotes) lines.push(`\n⚠️ 過敏提醒：${state.allergyNotes}`);
    if (state.specialNotes) lines.push(`\n📝 特殊備註：${state.specialNotes}`);

    return lines.join("\n");
  };

  const handleConfirm = () => {
    onConfirm(buildSummary());
    setState(defaultState);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
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
            {/* Step 1: Product Type */}
            <Section icon={Tag} title="產品類型">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRODUCT_TYPES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProductTypeChange(p.id)}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
                      state.productType === p.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-secondary/50"
                    }`}
                  >
                    <span className="text-lg">{p.emoji}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Step 2: Occasion */}
            <Section icon={Heart} title="場合">
              <ChipSelect options={OCCASIONS} value={state.occasion} onChange={(v) => update("occasion", v)} />
              {rec && (
                <p className="text-xs text-primary/80 mt-1">
                  ⭐ 系統已根據「{state.occasion}」推薦適合嘅花材同色調
                </p>
              )}
            </Section>

            {/* Below sections only show when product type is selected */}
            {pt && (
              <>
                {/* Flowers */}
                {availableFlowers.length > 0 && (
                  <Section icon={Flower2} title="主花選擇">
                    <FlowerPicker
                      flowers={availableFlowers}
                      selected={state.mainFlowers}
                      onToggle={(f) => toggleFlower("mainFlowers", f)}
                      onQtyChange={(name, qty) => updateFlowerQty("mainFlowers", name, qty)}
                      highlighted={rec?.suggestedFlowers}
                    />
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="自訂花材名稱..."
                        value={state.customFlower}
                        onChange={(e) => update("customFlower", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCustomFlower()}
                        className="text-sm"
                      />
                      <Button variant="outline" size="sm" onClick={addCustomFlower} className="gap-1">
                        <Plus className="w-3.5 h-3.5" /> 加入
                      </Button>
                    </div>
                  </Section>
                )}

                {/* Fillers */}
                {availableFillers.length > 0 && (
                  <Section icon={Flower2} title="配花 / 襯花">
                    <FlowerPicker
                      flowers={availableFillers}
                      selected={state.fillerFlowers}
                      onToggle={(f) => toggleFlower("fillerFlowers", f)}
                      onQtyChange={(name, qty) => updateFlowerQty("fillerFlowers", name, qty)}
                    />
                  </Section>
                )}

                {/* Greens */}
                {availableGreens.length > 0 && (
                  <Section icon={Leaf} title="綠葉 / 葉材">
                    <FlowerPicker
                      flowers={availableGreens}
                      selected={state.greens}
                      onToggle={(f) => toggleFlower("greens", f)}
                      onQtyChange={(name, qty) => updateFlowerQty("greens", name, qty)}
                    />
                  </Section>
                )}

                {/* Fruits (only for fruit basket) */}
                {pt === "fruit_basket" && (
                  <Section icon={Package} title="生果選擇">
                    <FlowerPicker
                      flowers={FRUITS}
                      selected={state.fruits}
                      onToggle={(f) => toggleFlower("fruits", f)}
                      onQtyChange={(name, qty) => updateFlowerQty("fruits", name, qty)}
                    />
                  </Section>
                )}

                {/* Shape / Wrapping */}
                <Section icon={Package} title="形狀 & 包裝">
                  <div className="space-y-3">
                    {availableShapes.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">形狀</Label>
                        <ChipSelect options={availableShapes} value={state.bouquetShape} onChange={(v) => update("bouquetShape", v)} />
                      </div>
                    )}
                    {availableWraps.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">包裝</Label>
                        <ChipSelect options={availableWraps} value={state.wrapMaterial} onChange={(v) => update("wrapMaterial", v)} />
                      </div>
                    )}
                    {(pt === "bouquet") && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">包裝顏色</Label>
                          <ChipSelect options={WRAP_COLORS} value={state.wrapColor} onChange={(v) => update("wrapColor", v)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">絲帶顏色</Label>
                          <ChipSelect options={RIBBON_COLORS} value={state.ribbonColor} onChange={(v) => update("ribbonColor", v)} />
                        </div>
                      </>
                    )}
                  </div>
                </Section>

                {/* Vase (bouquet/basket only) */}
                {(pt === "bouquet" || pt === "basket") && (
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
                )}

                {/* Style */}
                <Section icon={Palette} title="整體風格">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">風格主題</Label>
                      <ChipSelect options={STYLE_THEMES} value={state.styleTheme} onChange={(v) => update("styleTheme", v)} highlighted={rec?.suggestedThemes} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">色調</Label>
                      <ChipSelect options={COLOR_TONES} value={state.colorTone} onChange={(v) => update("colorTone", v)} highlighted={rec?.suggestedColors} />
                    </div>
                  </div>
                </Section>

                {/* Size */}
                <Section icon={Ruler} title="尺寸規格">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">大小</Label>
                      <ChipSelect options={availableSizes} value={state.bouquetSize} onChange={(v) => update("bouquetSize", v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">預計直徑 (cm)</Label>
                        <Input type="number" placeholder="例：25" value={state.estimatedDiameter}
                          onChange={(e) => update("estimatedDiameter", e.target.value)} className="text-sm font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">預計高度 (cm)</Label>
                        <Input type="number" placeholder="例：40" value={state.estimatedHeight}
                          onChange={(e) => update("estimatedHeight", e.target.value)} className="text-sm font-mono" />
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Fragrance (not for preserved/potted) */}
                {pt !== "preserved" && pt !== "potted" && (
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
                )}

                {/* Allergy */}
                <Section icon={AlertTriangle} title="過敏提醒">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={state.hasAllergy} onCheckedChange={(v) => update("hasAllergy", v)} />
                      <Label className="text-xs">客人有花粉過敏或其他過敏</Label>
                    </div>
                    {state.hasAllergy && (
                      <Textarea placeholder="請列明需要避開嘅花材或過敏原..." value={state.allergyNotes}
                        onChange={(e) => update("allergyNotes", e.target.value)} className="text-sm min-h-[60px]" />
                    )}
                  </div>
                </Section>

                {/* Special notes */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">📝 特殊備註</Label>
                  <Textarea placeholder="例如：花頭要開、去刺、花腳要長..." value={state.specialNotes}
                    onChange={(e) => update("specialNotes", e.target.value)} className="text-sm min-h-[60px]" />
                </div>
              </>
            )}

            {!pt && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                👆 請先選擇產品類型
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border bg-secondary/30">
          <div className="flex w-full items-center justify-between">
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button onClick={handleConfirm} disabled={!pt} className="gap-1.5 px-6">
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
