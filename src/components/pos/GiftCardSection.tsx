import { useState } from "react";
import { Label } from "@/components/ui/label";
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
    <div className="rounded-xl bg-card p-4 space-y-3 border border-border">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/70 flex items-center gap-2">
          <StepBadge n={5} done={!!isComplete} />
          <Gift className="w-4 h-4" />
          {t("section_gift_card")}
        </h2>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Quick templates */}
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t}
                onClick={() => onMessageChange(message ? message + "\n\n" + t : t)}
                className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                {t}
              </button>
            ))}
          </div>

          {/* Markdown editor */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("label_card_content")}</Label>
              <div className="flex items-center gap-2">
                <VoiceInputButton
                  onResult={(text) => onMessageChange(message ? `${message} ${text}` : text)}
                  className="h-7 w-7"
                />
                <button
                  onClick={() => setPreview(!preview)}
                  className="text-xs text-primary hover:underline"
                >
                  {preview ? t("btn_edit") : t("btn_preview")}
                </button>
              </div>
            </div>

            {preview ? (
              <div className="rounded-lg border border-border bg-accent/30 p-4 min-h-[100px] prose prose-sm max-w-none">
                <MarkdownPreview content={message} noContentLabel={t("msg_no_content")} />
              </div>
            ) : (
              <Textarea
                placeholder={t("placeholder_card")}
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                className="text-sm min-h-[100px] font-mono"
                maxLength={1000}
              />
            )}
            <p className="text-[10px] text-muted-foreground">
              {t("hint_markdown")}
            </p>
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
