import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, SlidersHorizontal, Clock, Plus, Trash2, RotateCcw, Save, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadSlots, saveSlots, resetSlots, type DeliverySlot } from "@/lib/delivery-slots";
import { useLanguage } from "@/contexts/LanguageContext";

const Settings = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [slots, setSlots] = useState<DeliverySlot[]>(() => loadSlots());

  const updateSlot = (id: string, field: "label" | "sublabel", value: string) =>
    setSlots(prev => prev.map(s => (s.id === id ? { ...s, [field]: value } : s)));

  const removeSlot = (id: string) =>
    setSlots(prev => prev.filter(s => s.id !== id));

  const addSlot = () => {
    setSlots(prev => {
      const newSlot: DeliverySlot = { id: crypto.randomUUID(), value: "", label: "", sublabel: "" };
      const specifiedIdx = prev.findIndex(s => s.specified);
      if (specifiedIdx === -1) return [...prev, newSlot];
      return [...prev.slice(0, specifiedIdx), newSlot, ...prev.slice(specifiedIdx)];
    });
  };

  const handleSave = () => {
    const cleaned = slots
      .filter(s => s.locked || s.label.trim())
      // value is the canonical string stored on past orders — fix it on first
      // save and keep it stable across later label edits so records don't orphan
      .map(s => (s.locked ? s : { ...s, label: s.label.trim(), value: s.value || s.label.trim(), sublabel: s.sublabel.trim() }));
    saveSlots(cleaned);
    setSlots(cleaned);
    toast.success(t("settings_saved"));
  };

  const handleReset = () => {
    resetSlots();
    setSlots(loadSlots());
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

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs border-dashed"
            onClick={addSlot}
          >
            <Plus className="w-3.5 h-3.5" />
            {t("settings_add_slot")}
          </Button>
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
