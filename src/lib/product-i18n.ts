import type { Lang } from "@/lib/i18n";

// Canonical product/flower/term names are stored in Cantonese (order records,
// recommendations lookups). This map drives English display only. Unmapped
// names (e.g. custom user input) render as-is.
const PRODUCT_EN: Record<string, string> = {
  // Preset products
  "玫瑰花束": "Rose Bouquet", "向日葵花束": "Sunflower Bouquet", "百合花束": "Lily Bouquet",
  "繡球花束": "Hydrangea Bouquet", "混合野花束": "Mixed Wildflower Bouquet", "牡丹花束": "Peony Bouquet",
  "鬱金香花束": "Tulip Bouquet", "鮮花籃": "Fresh Flower Basket", "果籃連鮮花": "Fruit & Flower Basket",
  "蘭花籃": "Orchid Basket", "祝賀花籃": "Congratulatory Basket", "蘭花盆栽": "Potted Orchid",
  "多肉植物": "Succulent", "幸福樹": "Happiness Tree", "觀葉植物": "Foliage Plant",
  "蝴蝶蘭（雙株）": "Phalaenopsis (Double)", "喪禮花圈（白）": "Funeral Wreath (White)",
  "喪禮花圈（混色）": "Funeral Wreath (Mixed)", "靈前擺設": "Memorial Arrangement",
  "花藝佈置": "Floral Decoration", "園藝保養": "Garden Maintenance",
  "套票（100支花）": "Package (100 stems)", "禮品套裝": "Gift Set",
  // Add-ons
  "樓梯送貨（每層）": "Stair delivery (per floor)", "毛公仔": "Soft Teddy",
  "玻璃花樽 (6\"x16\"H或以下)": "Glass vase (≤6\"x16\"H)", "精美陶瓷花盆": "Ceramic pot",
  "日式花盆": "Japanese pot", "竹編花籃": "Bamboo basket", "保鮮花處理": "Flower preservation",
  "花束包裝升級": "Wrap upgrade", "手寫賀卡": "Handwritten card", "LED 燈串裝飾": "LED string lights",
  // Fees
  "送貨費": "Delivery Fee", "急單費": "Urgent Fee",
};

export const productLabel = (name: string, lang: Lang): string =>
  lang === "en" ? PRODUCT_EN[name] ?? name : name;
