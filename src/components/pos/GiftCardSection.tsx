import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { renderSafeMarkdown } from "@/lib/safe-markdown";
import { Gift } from "lucide-react";

interface GiftCardSectionProps {
  title?: string;
  enabled: boolean;
  message: string;
  onEnabledChange: (v: boolean) => void;
  onMessageChange: (v: string) => void;
}

const GiftCardSection = ({
  title = "送禮卡片",
  enabled,
  message,
  onEnabledChange,
  onMessageChange,
}: GiftCardSectionProps) => {
  const [preview, setPreview] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
          <Gift className="w-4 h-4" />
          {title}
        </h2>
        <Switch
          aria-label={`${title}開關`}
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>

      {enabled && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Markdown editor */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">卡片內容（支援 Markdown）</Label>
              <button
                type="button"
                onClick={() => setPreview(!preview)}
                className="text-xs text-primary hover:underline"
              >
                {preview ? "編輯" : "預覽"}
              </button>
            </div>

            {preview ? (
              <div className="rounded-lg border border-border bg-accent/30 p-4 min-h-[100px] prose prose-sm max-w-none">
                <MarkdownPreview content={message} />
              </div>
            ) : (
              <Textarea
                aria-label={`${title}內容`}
                placeholder={"親愛的 ___：\n\n祝你生日快樂！\n\n**愛你的** ___"}
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                className="text-sm min-h-[100px] font-mono"
                maxLength={1000}
              />
            )}
            <p className="text-[10px] text-muted-foreground">
              支援 **粗體**、*斜體*、換行等 Markdown 語法
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/** Simple markdown to HTML renderer (bold, italic, line breaks) */
const MarkdownPreview = ({ content }: { content: string }) => {
  if (!content.trim()) {
    return <p className="text-muted-foreground italic">未有內容</p>;
  }

  return <div dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(content) }} />;
};

export default GiftCardSection;
