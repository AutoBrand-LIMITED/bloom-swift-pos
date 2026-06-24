import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Gift } from "lucide-react";
import StepBadge from "@/components/pos/StepBadge";
import VoiceInputButton from "@/components/pos/VoiceInputButton";
import { useLanguage } from "@/contexts/LanguageContext";

interface GiftCardSectionProps {
  enabled: boolean;
  message: string;
  onEnabledChange: (v: boolean) => void;
  onMessageChange: (v: string) => void;
  isComplete?: boolean;
}

const GiftCardSection = ({ enabled, message, onEnabledChange, onMessageChange, isComplete }: GiftCardSectionProps) => {
  const { t } = useLanguage();
  const [preview, setPreview] = useState(false);
  const TEMPLATES = [
    t("template_birthday"),
    t("template_congrats"),
    t("template_thanks"),
    t("template_recovery"),
    t("template_valentine"),
  ];

  return (
    <div className={`rounded-xl p-4 space-y-3 border transition-colors ${isComplete ? "bg-primary/[0.04] border-primary/20" : "bg-card border-border"}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/85 flex items-center gap-2">
          <StepBadge n={5} done={!!isComplete} />
          <Gift className="w-4 h-4" />
          {t("section_gift_card")}
        </h2>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled && (
        <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Quick templates — horizontal scroll, no wrap */}
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-0.5">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl}
                onClick={() => onMessageChange(message ? message + "\n\n" + tmpl : tmpl)}
                className="shrink-0 rounded-lg border border-border/70 bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary whitespace-nowrap"
              >
                {tmpl}
              </button>
            ))}
          </div>

          {/* Card composer */}
          <div className="rounded-lg border border-border overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
              <span className="text-xs font-medium text-foreground/70">{t("label_card_content")}</span>
              <div className="flex items-center gap-1">
                <VoiceInputButton
                  onResult={(text) => onMessageChange(message ? `${message} ${text}` : text)}
                  className="h-7 w-7"
                />
                <button
                  onClick={() => setPreview(!preview)}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
                    preview
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  {preview ? t("btn_edit") : t("btn_preview")}
                </button>
              </div>
            </div>

            {/* Body */}
            {preview ? (
              <div className="p-4 min-h-[120px] prose prose-sm max-w-none bg-card text-sm">
                <MarkdownPreview content={message} noContentLabel={t("msg_no_content")} />
              </div>
            ) : (
              <Textarea
                placeholder={t("placeholder_card")}
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                className="min-h-[120px] font-mono text-sm border-0 rounded-none focus-visible:ring-0 bg-card resize-none"
                maxLength={1000}
              />
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-t border-border">
              <p className="text-[10px] text-muted-foreground">{t("hint_markdown")}</p>
              <span className="text-[10px] text-muted-foreground tabular-nums font-mono">{message.length}/1000</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Simple markdown to HTML renderer (bold, italic, line breaks) */
const MarkdownPreview = ({ content, noContentLabel }: { content: string; noContentLabel: string }) => {
  if (!content.trim()) {
    return <p className="text-muted-foreground italic">{noContentLabel}</p>;
  }

  const html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\n/g, "<br />");

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

export default GiftCardSection;
