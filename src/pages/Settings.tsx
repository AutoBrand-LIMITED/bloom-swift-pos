import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Clock, Plus, Trash2, RotateCcw, Save, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadSlots, saveSlots, resetSlots, type DeliverySlot } from "@/lib/delivery-slots";
import { useLanguage } from "@/contexts/LanguageContext";

const Settings = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [slots, setSlots] = useState<DeliverySlot[]>(() => loadSlots());

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

  const handleSave = () => {
    const cleanedSlots = slots
      .filter(s => s.locked || s.label.trim())
      // value is the canonical string stored on past orders — fix it on first
      // save and keep it stable across later label edits so records don't orphan
      .map(s => (s.locked ? s : { ...s, label: s.label.trim(), value: s.value || s.label.trim(), sublabel: s.sublabel.trim() }));
    saveSlots(cleanedSlots);
    setSlots(cleanedSlots);
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
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold tracking-tight leading-none">{t("settings_title")}</h1>
            <p className="text-[11px] text-muted-foreground leading-none mt-1">{t("settings_slots_desc")}</p>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={handleSave}>
            <Save className="w-3.5 h-3.5" /> {t("settings_save")}
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-primary/70">
            {t("settings_slots_section")}
          </span>
        </div>

        <div className="space-y-2">
          {slots.map((slot) => {
            const builtIn = !!slot.locked;
            const isSpecified = !!slot.specified;
            return (
              <div
                key={slot.id}
                className={`rounded-xl border transition-colors ${
                  isSpecified
                    ? "border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/10"
                    : builtIn
                    ? "border-border bg-card"
                    : "border-primary/20 bg-primary/[0.025]"
                }`}
              >
                {builtIn ? (
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Time label — dominant */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[15px] font-semibold leading-tight ${isSpecified ? "text-amber-800 dark:text-amber-300" : "text-foreground"}`}>
                        {slot.labelKey ? t(slot.labelKey) : slot.label}
                      </p>
                      <p className={`text-xs mt-0.5 font-mono ${isSpecified ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                        {slot.sublabelKey ? t(slot.sublabelKey) : slot.sublabel}
                      </p>
                    </div>
                    {/* Lock badge */}
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      isSpecified
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-800/30 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      <Lock className="w-2.5 h-2.5" />
                      {isSpecified ? t("settings_specified_hint") : t("settings_locked_hint")}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-3">
                    <div className="flex-1 min-w-0">
                      <Input
                        value={slot.label}
                        onChange={(e) => updateSlot(slot.id, "label", e.target.value)}
                        placeholder={t("placeholder_slot_label")}
                        className="text-sm h-8 border-0 bg-transparent px-0 focus-visible:ring-0 font-medium placeholder:text-muted-foreground/50"
                        maxLength={40}
                      />
                    </div>
                    <div className="w-px h-5 bg-border shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Input
                        value={slot.sublabel}
                        onChange={(e) => updateSlot(slot.id, "sublabel", e.target.value)}
                        placeholder={t("placeholder_slot_sub")}
                        className="text-xs h-8 border-0 bg-transparent px-0 focus-visible:ring-0 text-muted-foreground placeholder:text-muted-foreground/40 font-mono"
                        maxLength={40}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/50 hover:text-destructive shrink-0"
                      onClick={() => removeSlot(slot.id)}
                      aria-label={t("settings_remove_slot")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={addSlot}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/[0.02] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t("settings_add_slot")}
        </button>

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> {t("settings_reset")}
          </button>
        </div>
      </main>
    </div>
  );
};

export default Settings;
