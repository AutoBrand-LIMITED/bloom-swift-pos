import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, AlertCircle, Plus, X, Bookmark, Truck, MapPin, MoreHorizontal } from "lucide-react";
import StepBadge from "@/components/pos/StepBadge";
import VoiceInputButton from "@/components/pos/VoiceInputButton";
import type { Delivery } from "@/types/order";
import { loadDrivers } from "@/lib/drivers";
import { loadSlots } from "@/lib/delivery-slots";
import { useLanguage } from "@/contexts/LanguageContext";

const SPECIFIED_VALUE = "指定時間";

const REGION_EN: Record<string, string> = {
  "香港島": "Hong Kong Island",
  "九龍": "Kowloon",
  "新界": "New Territories",
  "離島": "Outlying Islands",
};

const DISTRICT_EN: Record<string, string> = {
  "中西區": "Central & Western", "灣仔區": "Wan Chai", "東區": "Eastern", "南區": "Southern",
  "油尖旺區": "Yau Tsim Mong", "深水埗區": "Sham Shui Po", "九龍城區": "Kowloon City",
  "黃大仙區": "Wong Tai Sin", "觀塘區": "Kwun Tong",
  "荃灣區": "Tsuen Wan", "葵青區": "Kwai Tsing", "屯門區": "Tuen Mun", "元朗區": "Yuen Long",
  "北區": "North", "大埔區": "Tai Po", "沙田區": "Sha Tin", "西貢區": "Sai Kung",
  "離島區": "Islands",
};

const AREA_EN: Record<string, string> = {
  "中環": "Central", "上環": "Sheung Wan", "西營盤": "Sai Ying Pun", "堅尼地城": "Kennedy Town",
  "山頂": "The Peak", "半山": "Mid-Levels", "灣仔": "Wan Chai", "銅鑼灣": "Causeway Bay",
  "跑馬地": "Happy Valley", "大坑": "Tai Hang", "天后": "Tin Hau", "北角": "North Point",
  "鰂魚涌": "Quarry Bay", "太古": "Taikoo", "西灣河": "Sai Wan Ho", "筲箕灣": "Shau Kei Wan",
  "柴灣": "Chai Wan", "香港仔": "Aberdeen", "鴨脷洲": "Ap Lei Chau", "黃竹坑": "Wong Chuk Hang",
  "淺水灣": "Repulse Bay", "赤柱": "Stanley", "尖沙咀": "Tsim Sha Tsui", "佐敦": "Jordan",
  "油麻地": "Yau Ma Tei", "旺角": "Mong Kok", "太子": "Prince Edward", "大角咀": "Tai Kok Tsui",
  "深水埗": "Sham Shui Po", "長沙灣": "Cheung Sha Wan", "荔枝角": "Lai Chi Kok",
  "石硤尾": "Shek Kip Mei", "又一村": "Yau Yat Tsuen", "紅磡": "Hung Hom",
  "土瓜灣": "To Kwa Wan", "九龍城": "Kowloon City", "何文田": "Ho Man Tin", "九龍塘": "Kowloon Tong",
  "黃大仙": "Wong Tai Sin", "鑽石山": "Diamond Hill", "慈雲山": "Tsz Wan Shan",
  "彩虹": "Choi Hung", "新蒲崗": "San Po Kong", "觀塘": "Kwun Tong", "牛頭角": "Ngau Tau Kok",
  "九龍灣": "Kowloon Bay", "藍田": "Lam Tin", "秀茂坪": "Sau Mau Ping", "油塘": "Yau Tong",
  "荃灣": "Tsuen Wan", "深井": "Sham Tseng", "青龍頭": "Tsing Lung Tau", "馬灣": "Ma Wan",
  "葵芳": "Kwai Fong", "葵涌": "Kwai Chung", "青衣": "Tsing Yi",
  "屯門市中心": "Tuen Mun Town Centre", "屯門碼頭": "Tuen Mun Ferry Pier",
  "蝴蝶邨": "Butterfly Estate", "三聖": "Sam Shing",
  "元朗": "Yuen Long", "天水圍": "Tin Shui Wai", "錦田": "Kam Tin", "流浮山": "Lau Fau Shan",
  "上水": "Sheung Shui", "粉嶺": "Fanling", "沙頭角": "Sha Tau Kok", "古洞": "Kwu Tung",
  "大埔": "Tai Po", "大埔墟": "Tai Po Market", "太和": "Tai Wo", "大美督": "Tai Mei Tuk",
  "沙田": "Sha Tin", "火炭": "Fo Tan", "大圍": "Tai Wai", "馬鞍山": "Ma On Shan", "石門": "Shek Mun",
  "將軍澳": "Tseung Kwan O", "坑口": "Hang Hau", "寶琳": "Po Lam",
  "西貢市中心": "Sai Kung Town", "清水灣": "Clear Water Bay",
  "東涌": "Tung Chung", "大嶼山": "Lantau Island", "長洲": "Cheung Chau",
  "南丫島": "Lamma Island", "愉景灣": "Discovery Bay", "機場": "Airport",
};

const HK_DISTRICTS: Record<string, Record<string, string[]>> = {
  "香港島": {
    "中西區": ["中環", "上環", "西營盤", "堅尼地城", "山頂", "半山"],
    "灣仔區": ["灣仔", "銅鑼灣", "跑馬地", "大坑", "天后"],
    "東區": ["北角", "鰂魚涌", "太古", "西灣河", "筲箕灣", "柴灣"],
    "南區": ["香港仔", "鴨脷洲", "黃竹坑", "淺水灣", "赤柱"],
  },
  "九龍": {
    "油尖旺區": ["尖沙咀", "佐敦", "油麻地", "旺角", "太子", "大角咀"],
    "深水埗區": ["深水埗", "長沙灣", "荔枝角", "石硤尾", "又一村"],
    "九龍城區": ["紅磡", "土瓜灣", "九龍城", "何文田", "九龍塘"],
    "黃大仙區": ["黃大仙", "鑽石山", "慈雲山", "彩虹", "新蒲崗"],
    "觀塘區": ["觀塘", "牛頭角", "九龍灣", "藍田", "秀茂坪", "油塘"],
  },
  "新界": {
    "荃灣區": ["荃灣", "深井", "青龍頭", "馬灣"],
    "葵青區": ["葵芳", "葵涌", "青衣"],
    "屯門區": ["屯門市中心", "屯門碼頭", "蝴蝶邨", "三聖"],
    "元朗區": ["元朗", "天水圍", "錦田", "流浮山"],
    "北區": ["上水", "粉嶺", "沙頭角", "古洞"],
    "大埔區": ["大埔", "大埔墟", "太和", "大美督"],
    "沙田區": ["沙田", "火炭", "大圍", "馬鞍山", "石門"],
    "西貢區": ["將軍澳", "坑口", "寶琳", "西貢市中心", "清水灣"],
  },
  "離島": {
    "離島區": ["東涌", "大嶼山", "長洲", "南丫島", "愉景灣", "機場"],
  },
};

export function newDelivery(): Delivery {
  return {
    id: crypto.randomUUID(),
    deliveryDate: "",
    deliveryTime: "",
    deliveryRegion: "",
    deliveryDistrict: "",
    deliveryArea: "",
    deliveryDetail: "",
    recipientName: "",
    recipientPhone: "",
    deliveryPerson: "",
    failedDeliveryAction: "none",
  };
}

interface DeliverySectionProps {
  deliveries: Delivery[];
  onDeliveriesChange: (d: Delivery[]) => void;
  isComplete?: boolean;
  deliveryFee: number;
  urgentFee: number;
  onDeliveryFeeChange: (v: number) => void;
  onUrgentFeeChange: (v: number) => void;
  deliveryNotes: string;
  onDeliveryNotesChange: (v: string) => void;
  deliveryNotesPinned?: boolean;
  onDeliveryNotesPinnedChange?: (v: boolean) => void;
}

function DeliveryCard({
  delivery,
  index,
  total,
  onChange,
  onRemove,
}: {
  delivery: Delivery;
  index: number;
  total: number;
  onChange: (updated: Delivery) => void;
  onRemove: () => void;
}) {
  const { t, lang } = useLanguage();
  // Read fresh each render (localStorage is cheap) so slot/driver edits in
  // /settings take effect without unmounting the form.
  const slots = loadSlots();
  const drivers = loadDrivers();
  const set = <K extends keyof Delivery>(key: K, val: Delivery[K]) =>
    onChange({ ...delivery, [key]: val });

  const districts = delivery.deliveryRegion
    ? Object.keys(HK_DISTRICTS[delivery.deliveryRegion] || {})
    : [];
  const areas =
    delivery.deliveryRegion && delivery.deliveryDistrict
      ? HK_DISTRICTS[delivery.deliveryRegion]?.[delivery.deliveryDistrict] || []
      : [];

  const handleRegionChange = (v: string) =>
    onChange({ ...delivery, deliveryRegion: v, deliveryDistrict: "", deliveryArea: "" });

  const handleDistrictChange = (v: string) =>
    onChange({ ...delivery, deliveryDistrict: v, deliveryArea: "" });

  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [slotOverflowOpen, setSlotOverflowOpen] = useState(false);
  const [pinnedSlotId, setPinnedSlotId] = useState<string | null>(delivery.deliverySlotId ?? null);
  const [pendingHour, setPendingHour] = useState("12");
  const [pendingMinute, setPendingMinute] = useState("00");
  const [pendingPeriod, setPendingPeriod] = useState<"AM" | "PM">("AM");

  const isSpecified =
    delivery.deliveryTime === SPECIFIED_VALUE || delivery.deliveryTime.startsWith("指定");
  const specifiedTime = isSpecified
    ? delivery.deliveryTime.replace(`${SPECIFIED_VALUE} `, "").replace(SPECIFIED_VALUE, "")
    : "";

  const format12h = (time24: string) => {
    if (!time24) return "";
    const [h, m] = time24.split(":").map(Number);
    const period = h < 12 ? "AM" : "PM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  };

  const openTimeModal = () => {
    if (specifiedTime) {
      const [h, m] = specifiedTime.split(":").map(Number);
      setPendingPeriod(h < 12 ? "AM" : "PM");
      setPendingHour(String(h % 12 || 12));
      setPendingMinute(String(m).padStart(2, "0"));
    } else {
      setPendingHour("12");
      setPendingMinute("00");
      setPendingPeriod("AM");
    }
    setTimeModalOpen(true);
  };

  const handleSlotSelect = (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;
    if (slot.specified) {
      set("deliverySlotId", slotId);
      openTimeModal();
    } else {
      set("deliveryTime", slot.value);
      set("deliverySlotId", slotId);
    }
  };

  const handleTimeConfirm = () => {
    let h = parseInt(pendingHour) % 12;
    if (pendingPeriod === "PM") h += 12;
    const time24 = `${String(h).padStart(2, "0")}:${pendingMinute}`;
    set("deliveryTime", `${SPECIFIED_VALUE} ${time24}`);
    setTimeModalOpen(false);
  };

  const dl = (zh: string, map: Record<string, string>) =>
    lang === "en" ? (map[zh] ?? zh) : zh;

  const fullAddress = [
    delivery.deliveryRegion,
    delivery.deliveryDistrict,
    delivery.deliveryArea,
    delivery.deliveryDetail,
  ]
    .filter(Boolean)
    .join(" ");

  const displayAddress = [
    dl(delivery.deliveryRegion, REGION_EN),
    dl(delivery.deliveryDistrict, DISTRICT_EN),
    dl(delivery.deliveryArea, AREA_EN),
    delivery.deliveryDetail,
  ]
    .filter(Boolean)
    .join(", ");

  const mapQuery = encodeURIComponent(fullAddress + " 香港");

  return (
    <div className="space-y-3">
      {/* Recipient header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">
          {t("label_recipient")} {index + 1}
          {total > 1 && (
            <span className="ml-1.5 font-mono text-xs sm:text-[10px] text-muted-foreground">
              ({String(index + 1).padStart(2, "0")})
            </span>
          )}
        </p>
        {total > 1 && (
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive transition-colors"
            aria-label={t("aria_remove_recipient")}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Date + Time slot */}
      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3 items-start">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t("label_delivery_date")}</Label>
          <Input
            type="date"
            value={delivery.deliveryDate}
            onChange={(e) => set("deliveryDate", e.target.value)}
            className="text-sm w-full"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t("label_delivery_time")}</Label>
          {(() => {
            const MAX_INLINE = 4;
            // If pinned slot would land in overflow, swap it into the last inline position
            const effectivePinId = pinnedSlotId ?? delivery.deliverySlotId ?? null;
            let displaySlots = slots;
            if (slots.length > MAX_INLINE && effectivePinId) {
              const pinnedIdx = slots.findIndex(s => s.id === effectivePinId);
              if (pinnedIdx >= MAX_INLINE - 1) {
                const d = [...slots];
                [d[MAX_INLINE - 2], d[pinnedIdx]] = [d[pinnedIdx], d[MAX_INLINE - 2]];
                displaySlots = d;
              }
            }
            const inlineSlots = displaySlots.length <= MAX_INLINE ? displaySlots : displaySlots.slice(0, MAX_INLINE - 1);
            const overflowSlots = displaySlots.length <= MAX_INLINE ? [] : displaySlots.slice(MAX_INLINE - 1);
            const hasOverflow = overflowSlots.length > 0;
            // Prefer stored slot ID; fall back to first value match for old orders
            const activeSlotId = delivery.deliverySlotId ??
              slots.find(s =>
                delivery.deliveryTime === s.value ||
                (!!s.specified && delivery.deliveryTime.startsWith(SPECIFIED_VALUE + " "))
              )?.id;
            const inlineActive = inlineSlots.some(s => s.id === activeSlotId);
            const overflowActive = !inlineActive && overflowSlots.some(s => s.id === activeSlotId);

            const renderSlotBtn = (slot: typeof slots[0]) => {
              const active = slot.id === activeSlotId;
              const label = slot.labelKey ? t(slot.labelKey) : slot.label;
              const sublabel = slot.specified && specifiedTime
                ? format12h(specifiedTime)
                : slot.sublabelKey ? t(slot.sublabelKey) : slot.sublabel;
              return (
                <button
                  key={slot.id}
                  onClick={() => { handleSlotSelect(slot.id); setSlotOverflowOpen(false); }}
                  className={cn(
                    "flex-1 min-w-0 rounded-lg h-10 px-2 text-center text-xs font-medium border transition-all flex flex-col items-center justify-center overflow-hidden",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
                  )}
                >
                  <div className="w-full truncate text-center">{label}</div>
                  <div className={`text-[9px] w-full truncate text-center ${active ? "opacity-80" : "text-muted-foreground"}`}>{sublabel}</div>
                </button>
              );
            };

            return (
              <div className="flex gap-1.5">
                {inlineSlots.map(renderSlotBtn)}
                {hasOverflow && (
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setSlotOverflowOpen(v => !v)}
                      className={cn(
                        "rounded-lg h-10 w-10 border transition-all flex items-center justify-center",
                        overflowActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
                      )}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {slotOverflowOpen && (
                      <>
                      <div className="fixed inset-0 z-40" onClick={() => setSlotOverflowOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[180px] animate-in fade-in slide-in-from-top-2 duration-150">
                        {overflowSlots.map(slot => {
                          const active = slot.id === activeSlotId;
                          const label = slot.labelKey ? t(slot.labelKey) : slot.label;
                          const sublabel = slot.specified && specifiedTime
                            ? format12h(specifiedTime)
                            : slot.sublabelKey ? t(slot.sublabelKey) : slot.sublabel;
                          return (
                            <button
                              key={slot.id}
                              onClick={() => { setPinnedSlotId(slot.id); handleSlotSelect(slot.id); setSlotOverflowOpen(false); }}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors border-b border-border last:border-0",
                                active ? "bg-primary/10 text-primary" : "hover:bg-accent/50"
                              )}
                            >
                              <span className="truncate mr-2">{label}</span>
                              <span className={`text-[9px] shrink-0 ${active ? "opacity-80" : "text-muted-foreground"}`}>{sublabel}</span>
                            </button>
                          );
                        })}
                      </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <Dialog open={timeModalOpen} onOpenChange={setTimeModalOpen}>
            <DialogContent className="max-w-[280px] p-6">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" /> {t("slot_specified_label")}
                </DialogTitle>
              </DialogHeader>

              {/* Time picker */}
              <div className="flex flex-col gap-3 py-1">
                <div className="flex items-center justify-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={pendingHour}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, "");
                      const n = parseInt(v);
                      if (v === "" || (n >= 1 && n <= 12)) setPendingHour(v);
                    }}
                    onBlur={e => {
                      const n = parseInt(e.target.value);
                      if (!n || n < 1) setPendingHour("1");
                      else if (n > 12) setPendingHour("12");
                    }}
                    className="w-14 h-12 text-center font-mono text-xl font-semibold rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-2xl font-mono font-bold text-muted-foreground/60 leading-none pb-0.5">:</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={pendingMinute}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                      const n = parseInt(v);
                      if (v === "" || (n >= 0 && n <= 59)) setPendingMinute(v);
                    }}
                    onBlur={e => {
                      const n = parseInt(e.target.value);
                      setPendingMinute(isNaN(n) ? "00" : String(Math.min(59, Math.max(0, n))).padStart(2, "0"));
                    }}
                    className="w-14 h-12 text-center font-mono text-xl font-semibold rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />

                  {/* AM / PM segmented */}
                  <div className="flex flex-col gap-1 ml-1">
                    {(["AM", "PM"] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setPendingPeriod(p)}
                        className={cn(
                          "w-12 py-1.5 rounded-md text-xs font-bold tracking-wide transition-colors",
                          pendingPeriod === p
                            ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setTimeModalOpen(false)}>
                  {t("btn_cancel")}
                </Button>
                <Button size="sm" className="flex-1" onClick={handleTimeConfirm}>
                  {t("btn_confirm")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">{t("label_delivery_address")}</Label>
        <div className="grid grid-cols-3 gap-2">
          <Select value={delivery.deliveryRegion} onValueChange={handleRegionChange}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={t("placeholder_region")} />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(HK_DISTRICTS).map((r) => (
                <SelectItem key={r} value={r}>{dl(r, REGION_EN)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={delivery.deliveryDistrict}
            onValueChange={handleDistrictChange}
            disabled={!delivery.deliveryRegion}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={t("placeholder_district")} />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>{dl(d, DISTRICT_EN)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={delivery.deliveryArea}
            onValueChange={(v) => set("deliveryArea", v)}
            disabled={!delivery.deliveryDistrict}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={t("placeholder_area")} />
            </SelectTrigger>
            <SelectContent>
              {areas.map((a) => (
                <SelectItem key={a} value={a}>{dl(a, AREA_EN)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder={t("placeholder_detail")}
          value={delivery.deliveryDetail}
          onChange={(e) => set("deliveryDetail", e.target.value)}
          className="text-sm"
          maxLength={200}
        />
        {fullAddress && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" />{displayAddress}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0 ml-2"
            >
              View on Map ↗
            </a>
          </div>
        )}
      </div>

      {/* Recipient + Driver */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t("label_recipient_name")}</Label>
          <Input
            placeholder={t("placeholder_recipient_name")}
            value={delivery.recipientName}
            onChange={(e) => set("recipientName", e.target.value)}
            className="text-sm"
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t("label_recipient_phone")}</Label>
          <Input
            placeholder={t("placeholder_recipient_phone")}
            value={delivery.recipientPhone}
            onChange={(e) => set("recipientPhone", e.target.value)}
            className="text-sm font-mono"
            maxLength={20}
          />
        </div>
      </div>

      {/* Relationship + Birthday */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t("label_relationship")}</Label>
          <Select value={delivery.recipientRelationship || ""} onValueChange={(v) => set("recipientRelationship", v)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={t("placeholder_relationship")} />
            </SelectTrigger>
            <SelectContent>
              {(["rel_mother","rel_father","rel_wife","rel_husband","rel_girlfriend","rel_boyfriend","rel_friend","rel_colleague","rel_boss","rel_other"] as const).map((k) => (
                <SelectItem key={k} value={k}>{t(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t("label_birthday")}</Label>
          <Input
            placeholder={t("placeholder_birthday")}
            value={delivery.recipientBirthday || ""}
            onChange={(e) => set("recipientBirthday", e.target.value)}
            className="text-sm font-mono"
            maxLength={5}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t("label_driver")}</Label>
          <Select value={delivery.deliveryPerson} onValueChange={(v) => set("deliveryPerson", v)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={t("placeholder_select_driver")} />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((d) => (
                <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t("label_failed_delivery")}</Label>
          <Select
            value={delivery.failedDeliveryAction}
            onValueChange={(v) => set("failedDeliveryAction", v)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={t("placeholder_select_action")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("action_none")}</SelectItem>
              <SelectItem value="leave_door">{t("action_leave_door")}</SelectItem>
              <SelectItem value="leave_security">{t("action_leave_security")}</SelectItem>
              <SelectItem value="leave_neighbor">{t("action_leave_neighbor")}</SelectItem>
              <SelectItem value="return">{t("action_return")}</SelectItem>
              <SelectItem value="reschedule">{t("action_reschedule")}</SelectItem>
              <SelectItem value="call_sender">{t("action_call_sender")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

const DeliverySection = ({
  deliveries, onDeliveriesChange, isComplete,
  deliveryFee, urgentFee, onDeliveryFeeChange, onUrgentFeeChange,
  deliveryNotes, onDeliveryNotesChange, deliveryNotesPinned, onDeliveryNotesPinnedChange,
}: DeliverySectionProps) => {
  const { t } = useLanguage();
  const update = (index: number, updated: Delivery) => {
    const next = deliveries.map((d, i) => (i === index ? updated : d));
    onDeliveriesChange(next);
  };

  const addRecipient = () => onDeliveriesChange([...deliveries, newDelivery()]);

  const removeRecipient = (index: number) =>
    onDeliveriesChange(deliveries.filter((_, i) => i !== index));

  return (
    <div className={`rounded-xl p-4 space-y-4 border transition-colors ${isComplete ? "bg-primary/[0.04] border-primary/20" : "bg-card border-border"}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm sm:text-[13px] font-semibold tracking-wide uppercase text-foreground/85 flex items-center gap-2">
          <StepBadge n={4} done={!!isComplete} />
          <Truck className="w-4 h-4" />
          {t("section_delivery")}
          {deliveries.length > 1 && (
            <span className="ml-1 text-xs sm:text-[11px] font-normal normal-case text-muted-foreground">
              {deliveries.length} {t("text_recipients")}
            </span>
          )}
        </h2>
      </div>

      {deliveries.map((d, i) => (
        <div key={d.id} className="animate-in fade-in slide-in-from-top-2 duration-200">
          {i > 0 && <div className="border-t border-dashed border-border pt-4" />}
          <DeliveryCard
            delivery={d}
            index={i}
            total={deliveries.length}
            onChange={(updated) => update(i, updated)}
            onRemove={() => removeRecipient(i)}
          />
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 text-xs border-dashed"
        onClick={addRecipient}
      >
        <Plus className="w-3.5 h-3.5" />
        {t("btn_add_recipient")}
      </Button>

      {/* Fees */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="space-y-1">
          <Label className="text-xs font-medium">{t("label_delivery_fee")}</Label>
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
          <Label className="text-xs font-medium">{t("label_urgent_fee")}</Label>
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

      {/* Delivery notes */}
      <div className="space-y-1 pt-2 border-t border-border">
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
    </div>
  );
};

export default DeliverySection;
