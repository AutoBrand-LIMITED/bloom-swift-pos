import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, SlidersHorizontal, Clock, Plus, Trash2, RotateCcw, Save, Lock, Truck, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadSlots, saveSlots, resetSlots, type DeliverySlot } from "@/lib/delivery-slots";
import { loadDrivers, saveDrivers, resetDrivers, type Driver } from "@/lib/drivers";
import { loadOccasionReminders, saveOccasionReminders, OCCASION_KEYS, type ReminderOption, type OccasionReminderMap } from "@/lib/occasion-reminders";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/i18n";

const REMINDER_OPTIONS: { value: ReminderOption; key: TranslationKey }[] = [
  { value: "none", key: "reminder_none" },
  { value: "same_day", key: "reminder_same_day" },
  { value: "1_day_before", key: "reminder_1_day" },
  { value: "3_days_before", key: "reminder_3_days" },
  { value: "1_week_before", key: "reminder_1_week" },
];

const Settings = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [slots, setSlots] = useState<DeliverySlot[]>(() => loadSlots());
  const [drivers, setDrivers] = useState<Driver[]>(() => loadDrivers());
  const [reminders, setReminders] = useState<OccasionReminderMap>(() => loadOccasionReminders());

  // --- Slots ---
  const updateSlot = (id: string, field: "label" | "sublabel", value: string) =>
    setSlots(prev => prev.map(s => (s.id === id ? { ...s, [field]: value } : s)));
  const removeSlot = (id: string) => setSlots(prev => prev.filter(s => s.id !== id));
  const addSlot = () => {
    setSlots(prev => {
      const newSlot: DeliverySlot = { id: crypto.randomUUID(), value: "", label: "", sublabel: "" };
      const specifiedIdx = prev.findIndex(s => s.specified);
      if (specifiedIdx === -1) return [...prev, newSlot];
      return [...prev.slice(0, specifiedIdx), newSlot, ...prev.slice(specifiedIdx)];
    });
  };

  // --- Drivers ---
  const updateDriver = (id: string, name: string) =>
    setDrivers(prev => prev.map(d => (d.id === id ? { ...d, name } : d)));
  const removeDriver = (id: string) => setDrivers(prev => prev.filter(d => d.id !== id));
  const addDriver = () =>
    setDrivers(prev => [...prev, { id: crypto.randomUUID(), name: "", casual: true }]);

  // --- Occasion reminders ---
  const setOccasionReminder = (occasion: string, value: ReminderOption) =>
    setReminders(prev => ({ ...prev, [occasion]: value }));

  const handleSave = () => {
    const cleanedSlots = slots
      .filter(s => s.locked || s.label.trim())
      // value is the canonical string stored on past orders — fix it on first
      // save and keep it stable across later label edits so records don't orphan
      .map(s => (s.locked ? s : { ...s, label: s.label.trim(), value: s.value || s.label.trim(), sublabel: s.sublabel.trim() }));
    saveSlots(cleanedSlots);
    setSlots(cleanedSlots);

    const cleanedDrivers = drivers.filter(d => d.name.trim()).map(d => ({ ...d, name: d.name.trim() }));
    saveDrivers(cleanedDrivers);
    setDrivers(cleanedDrivers);

    saveOccasionReminders(reminders);

    toast.success(t("settings_saved"));
  };

  const handleReset = () => {
    resetSlots();
    resetDrivers();
    saveOccasionReminders({});
    setSlots(loadSlots());
    setDrivers(loadDrivers());
    setReminders({});
    toast.info(t("settings_reset_done"));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-br from-primary/[0.06] via-card/80 to-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight leading-none">{t("settings_title")}</h1>
            <p className="text-[11px] text-muted-foreground leading-none mt-1">{t("settings_slots_desc")}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-28">
        {/* Delivery slots */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/85 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t("settings_slots_section")}
          </h2>

          <div className="space-y-2.5">
            {slots.map((slot) => {
              const builtIn = !!slot.locked;
              return (
                <div
                  key={slot.id}
                  className={`rounded-lg border p-3 ${builtIn ? "border-border bg-secondary/30" : "border-primary/20 bg-primary/[0.03]"}`}
                >
                  {builtIn ? (
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground shrink-0">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {slot.labelKey ? t(slot.labelKey) : slot.label}
                          <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                            {slot.sublabelKey ? t(slot.sublabelKey) : slot.sublabel}
                          </span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {slot.specified ? t("settings_specified_hint") : t("settings_locked_hint")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">{t("settings_slot_label")}</Label>
                        <Input
                          value={slot.label}
                          onChange={(e) => updateSlot(slot.id, "label", e.target.value)}
                          placeholder={t("placeholder_slot_label")}
                          className="text-sm h-9"
                          maxLength={40}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">{t("settings_slot_sublabel")}</Label>
                        <Input
                          value={slot.sublabel}
                          onChange={(e) => updateSlot(slot.id, "sublabel", e.target.value)}
                          placeholder={t("placeholder_slot_sub")}
                          className="text-sm h-9"
                          maxLength={40}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeSlot(slot.id)}
                        aria-label={t("settings_remove_slot")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-dashed" onClick={addSlot}>
            <Plus className="w-3.5 h-3.5" />
            {t("settings_add_slot")}
          </Button>
        </section>

        {/* Drivers */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/85 flex items-center gap-2">
            <Truck className="w-4 h-4" />
            {t("settings_drivers_section")}
          </h2>
          <p className="text-xs text-muted-foreground -mt-1">{t("settings_drivers_desc")}</p>

          <div className="space-y-2">
            {drivers.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {d.name.trim() ? d.name[0] : "?"}
                </span>
                <Input
                  value={d.name}
                  onChange={(e) => updateDriver(d.id, e.target.value)}
                  placeholder={t("placeholder_driver_name")}
                  className="text-sm h-9"
                  maxLength={40}
                />
                {d.casual && (
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-500/10 rounded-full px-2 py-1 shrink-0">
                    {t("settings_driver_casual")}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                  onClick={() => removeDriver(d.id)}
                  aria-label={t("settings_remove_driver")}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-dashed" onClick={addDriver}>
            <Plus className="w-3.5 h-3.5" />
            {t("settings_add_driver")}
          </Button>
        </section>

        {/* Occasion reminder timing */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/85 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            {t("settings_reminders_section")}
          </h2>
          <p className="text-xs text-muted-foreground -mt-1">{t("settings_reminders_desc")}</p>

          <div className="space-y-1.5">
            {OCCASION_KEYS.map((occ) => (
              <div key={occ} className="flex items-center gap-3">
                <span className="text-sm flex-1 min-w-0 truncate">{t(occ)}</span>
                <Select
                  value={reminders[occ] ?? "none"}
                  onValueChange={(v) => setOccasionReminder(occ, v as ReminderOption)}
                >
                  <SelectTrigger className="h-8 text-xs w-40 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{t(o.key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Sticky actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" /> {t("settings_reset")}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave}>
            <Save className="w-4 h-4" /> {t("settings_save")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
