import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles, Plus, Minus, X, MousePointerClick, Star, Check,
  Tag, Heart, Flower2, Flower, Leaf, Apple, Package, Container, Palette, Ruler, Wind, AlertTriangle, FileText,
} from "lucide-react";
import VoiceInputButton from "@/components/pos/VoiceInputButton";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/i18n";

// ─── Product Types ───────────────────────────────────────────
type ProductType = "bouquet" | "basket" | "stand" | "fruit_basket" | "preserved" | "potted" | "wreath";

const PRODUCT_TYPE_EMOJIS: Record<ProductType, string> = {
  bouquet: "💐", basket: "🧺", stand: "🎋", fruit_basket: "🍎",
  preserved: "🌹", potted: "🪴", wreath: "⭕",
};
const PRODUCT_TYPE_KEYS: Record<ProductType, TranslationKey> = {
  bouquet: "pt_bouquet", basket: "pt_basket", stand: "pt_stand",
  fruit_basket: "pt_fruit_basket", preserved: "pt_preserved",
  potted: "pt_potted", wreath: "pt_wreath",
};

const OCCASIONS = ["生日", "婚禮", "開張", "慰問", "情人節", "母親節", "畢業", "週年紀念", "喬遷", "探病", "道歉", "白事", "日常"];
const OCCASION_KEYS: Record<string, TranslationKey> = {
  "生日": "occasion_birthday", "婚禮": "occ_wedding", "開張": "occ_opening",
  "慰問": "occ_condolence", "情人節": "occasion_valentines", "母親節": "occasion_mothers_day",
  "畢業": "occasion_graduation", "週年紀念": "occasion_anniversary", "喬遷": "occ_moving",
  "探病": "occ_hospital", "道歉": "occ_apology", "白事": "occ_funeral", "日常": "occ_everyday",
};

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
function ChipSelect({ options, items, value, onChange, highlighted }: {
  options?: string[];
  items?: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  highlighted?: string[];
}) {
  const display = items ?? (options ?? []).map((o) => ({ id: o, label: o }));
  return (
    <div className="flex flex-wrap gap-1.5">
      {display.map(({ id, label }) => {
        const selected = value === id;
        const isRecommended = highlighted?.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selected
                ? "bg-primary text-primary-foreground border-primary"
                : isRecommended
                  ? "border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary"
                  : "border-border bg-secondary/60 hover:bg-secondary"
            }`}
          >
            {isRecommended && !selected && <Star className="w-2.5 h-2.5 shrink-0 text-amber-400" />}{label}
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
            <span className="text-xs font-medium flex-1 flex items-center gap-1">
              {isRecommended && !sel && <Star className="w-2.5 h-2.5 shrink-0 text-amber-400" />}{f.name}
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

function Section({ icon: Icon, title, children, flush }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <section className={`space-y-3 pt-5 first:pt-0 ${flush ? "" : "border-t border-border first:border-0"}`}>
      <h3 className="flex items-center gap-2.5 text-xs font-semibold tracking-wide uppercase text-foreground/70">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary shrink-0">
          <Icon className="w-4 h-4" />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

// ─── Main Component ──────────────────────────────────────────
interface CustomOrderDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (summary: string) => void;
}

const CustomOrderDialog = ({ open, onClose, onConfirm }: CustomOrderDialogProps) => {
  const { t } = useLanguage();
  const [state, setState] = useState<CustomOrderState>(defaultState);

  const update = <K extends keyof CustomOrderState>(key: K, value: CustomOrderState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const pt = state.productType as ProductType;
  const rec = state.occasion ? OCCASION_RECOMMENDATIONS[state.occasion] : null;

  const productTypes = useMemo(() => (
    (Object.keys(PRODUCT_TYPE_KEYS) as ProductType[]).map((id) => ({
      id,
      label: t(PRODUCT_TYPE_KEYS[id]),
      emoji: PRODUCT_TYPE_EMOJIS[id],
    }))
  ), [t]);

  const occasionItems = useMemo(() => OCCASIONS.map((occ) => ({
    id: occ,
    label: OCCASION_KEYS[occ] ? t(OCCASION_KEYS[occ]) : occ,
  })), [t]);

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
    const ptLabel = productTypes.find((p) => p.id === state.productType)?.label || t("custom_order_title");
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
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent border-b border-border/60">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/12 text-primary shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <span className="flex-1">{t("custom_order_title")}</span>
            {totalFlowers > 0 && (
              <span className="flex items-baseline gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm font-semibold tabular-nums animate-in fade-in zoom-in-95 duration-200">
                <span className="font-mono">{totalFlowers}</span>
                <span className="text-xs font-normal opacity-80">{t("unit_flowers")}</span>
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="px-6 pb-4 max-h-[calc(90vh-160px)]">
          <div className="space-y-0 pr-2">
            {/* Step 1: Product Type */}
            <Section icon={Tag} title={t("cd_section_product_type")}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {productTypes.map((p) => {
                  const active = state.productType === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProductTypeChange(p.id)}
                      className={`group relative flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center min-h-[92px] transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out will-change-transform hover:-translate-y-0.5 ${
                        active
                          ? "border-primary bg-primary/[0.08] text-primary shadow-[0_4px_16px_-6px_hsl(152_45%_38%/0.4)]"
                          : "border-border hover:border-primary/40 hover:bg-secondary/40 hover:shadow-sm"
                      }`}
                    >
                      {active && (
                        <span className="absolute top-1.5 right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground animate-in zoom-in-50 duration-200">
                          <Check className="w-2.5 h-2.5" strokeWidth={3} />
                        </span>
                      )}
                      <span className={`text-2xl leading-none transition-transform duration-200 ease-out group-hover:scale-110 ${active ? "scale-110" : ""}`}>{p.emoji}</span>
                      <span className="text-xs font-semibold leading-tight">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Step 2: Occasion */}
            <Section icon={Heart} title={t("label_occasion")}>
              <ChipSelect items={occasionItems} value={state.occasion} onChange={(v) => update("occasion", v)} />
              {rec && (
                <p className="text-xs text-primary/90 mt-2 flex items-center gap-1.5 rounded-lg bg-primary/[0.06] px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" /> {t("cd_rec_prefix")}{occasionItems.find(o => o.id === state.occasion)?.label ?? state.occasion}{t("cd_rec_suffix")}
                </p>
              )}
            </Section>

            {/* Below sections only show when product type is selected */}
            {pt && (
              <>
                {/* Flowers */}
                {availableFlowers.length > 0 && (
                  <Section icon={Flower2} title={t("cd_section_main_flowers")}>
                    <FlowerPicker
                      flowers={availableFlowers}
                      selected={state.mainFlowers}
                      onToggle={(f) => toggleFlower("mainFlowers", f)}
                      onQtyChange={(name, qty) => updateFlowerQty("mainFlowers", name, qty)}
                      highlighted={rec?.suggestedFlowers}
                    />
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder={t("cd_placeholder_custom_flower")}
                        value={state.customFlower}
                        onChange={(e) => update("customFlower", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCustomFlower()}
                        className="text-sm"
                      />
                      <VoiceInputButton onResult={(text) => update("customFlower", text)} />
                      <Button variant="outline" size="sm" onClick={addCustomFlower} className="gap-1">
                        <Plus className="w-3.5 h-3.5" /> {t("cd_btn_add_flower")}
                      </Button>
                    </div>
                  </Section>
                )}

                {/* Fillers */}
                {availableFillers.length > 0 && (
                  <Section icon={Flower} title={t("cd_section_filler_flowers")}>
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
                  <Section icon={Leaf} title={t("cd_section_greens")}>
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
                  <Section icon={Apple} title={t("cd_section_fruits")}>
                    <FlowerPicker
                      flowers={FRUITS}
                      selected={state.fruits}
                      onToggle={(f) => toggleFlower("fruits", f)}
                      onQtyChange={(name, qty) => updateFlowerQty("fruits", name, qty)}
                    />
                  </Section>
                )}

                {/* Shape / Wrapping */}
                <Section icon={Package} title={t("cd_section_wrapping")}>
                  <div className="space-y-3">
                    {availableShapes.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_shape")}</Label>
                        <ChipSelect options={availableShapes} value={state.bouquetShape} onChange={(v) => update("bouquetShape", v)} />
                      </div>
                    )}
                    {availableWraps.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_wrapping")}</Label>
                        <ChipSelect options={availableWraps} value={state.wrapMaterial} onChange={(v) => update("wrapMaterial", v)} />
                      </div>
                    )}
                    {(pt === "bouquet") && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_wrap_color")}</Label>
                          <ChipSelect options={WRAP_COLORS} value={state.wrapColor} onChange={(v) => update("wrapColor", v)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_ribbon_color")}</Label>
                          <ChipSelect options={RIBBON_COLORS} value={state.ribbonColor} onChange={(v) => update("ribbonColor", v)} />
                        </div>
                      </>
                    )}
                  </div>
                </Section>

                {/* Vase (bouquet/basket only) */}
                {(pt === "bouquet" || pt === "basket") && (
                  <Section icon={Container} title={t("cd_section_vase")}>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_vase_type")}</Label>
                        <ChipSelect options={VASE_TYPES} value={state.vaseType} onChange={(v) => update("vaseType", v)} />
                      </div>
                      {state.vaseType && state.vaseType !== "無花器" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_vase_size")}</Label>
                          <ChipSelect options={VASE_SIZES} value={state.vaseSize} onChange={(v) => update("vaseSize", v)} />
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* Style */}
                <Section icon={Palette} title={t("cd_section_style")}>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_style_theme")}</Label>
                      <ChipSelect options={STYLE_THEMES} value={state.styleTheme} onChange={(v) => update("styleTheme", v)} highlighted={rec?.suggestedThemes} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_color_tone")}</Label>
                      <ChipSelect options={COLOR_TONES} value={state.colorTone} onChange={(v) => update("colorTone", v)} highlighted={rec?.suggestedColors} />
                    </div>
                  </div>
                </Section>

                {/* Size */}
                <Section icon={Ruler} title={t("cd_section_size")}>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_size")}</Label>
                      <ChipSelect options={availableSizes} value={state.bouquetSize} onChange={(v) => update("bouquetSize", v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_diameter")}</Label>
                        <Input type="number" placeholder={t("cd_placeholder_diameter")} value={state.estimatedDiameter}
                          onChange={(e) => update("estimatedDiameter", e.target.value)} className="text-sm font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_height")}</Label>
                        <Input type="number" placeholder={t("cd_placeholder_height")} value={state.estimatedHeight}
                          onChange={(e) => update("estimatedHeight", e.target.value)} className="text-sm font-mono" />
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Fragrance (not for preserved/potted) */}
                {pt !== "preserved" && pt !== "potted" && (
                  <Section icon={Wind} title={t("cd_section_fragrance")}>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_fragrance")}</Label>
                        <ChipSelect options={FRAGRANCE_PREFS} value={state.fragrance} onChange={(v) => update("fragrance", v)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">{t("cd_label_preservation")}</Label>
                        <ChipSelect options={PRESERVATION} value={state.preservationMethod} onChange={(v) => update("preservationMethod", v)} />
                      </div>
                    </div>
                  </Section>
                )}

                {/* Allergy */}
                <Section icon={AlertTriangle} title={t("cd_section_allergy")}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={state.hasAllergy} onCheckedChange={(v) => update("hasAllergy", v)} />
                      <Label className="text-xs">{t("cd_label_allergy_switch")}</Label>
                    </div>
                    {state.hasAllergy && (
                      <div className="flex gap-2">
                        <Textarea placeholder={t("cd_placeholder_allergy_notes")} value={state.allergyNotes}
                          onChange={(e) => update("allergyNotes", e.target.value)} className="text-sm min-h-[60px]" />
                        <VoiceInputButton onResult={(text) => update("allergyNotes", state.allergyNotes ? `${state.allergyNotes} ${text}` : text)} className="self-start" />
                      </div>
                    )}
                  </div>
                </Section>

                {/* Special notes */}
                <Section icon={FileText} title={t("cd_special_notes")} flush>
                  <div className="flex gap-2">
                    <Textarea placeholder={t("cd_placeholder_special_notes")} value={state.specialNotes}
                      onChange={(e) => update("specialNotes", e.target.value)} className="text-sm min-h-[60px]" />
                    <VoiceInputButton onResult={(text) => update("specialNotes", state.specialNotes ? `${state.specialNotes} ${text}` : text)} className="self-start" />
                  </div>
                </Section>
              </>
            )}

            {!pt && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/[0.06] text-primary/50">
                  <MousePointerClick className="w-7 h-7" />
                </span>
                <p className="text-sm text-muted-foreground max-w-[220px]">{t("cd_prompt_select_type")}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border bg-gradient-to-t from-secondary/40 to-transparent">
          <div className="flex w-full items-center justify-between">
            <Button variant="ghost" onClick={onClose} className="text-muted-foreground">{t("btn_cancel_edit")}</Button>
            <Button
              onClick={handleConfirm}
              disabled={!pt}
              className="gap-1.5 px-6 shadow-[0_4px_14px_-4px_hsl(152_45%_38%/0.5)] transition-transform duration-200 ease-out hover:-translate-y-0.5 disabled:shadow-none disabled:translate-y-0"
            >
              <Sparkles className="w-4 h-4" />
              {t("cd_btn_confirm")}
              {totalFlowers > 0 && <span className="font-mono opacity-90">· {totalFlowers}</span>}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomOrderDialog;
