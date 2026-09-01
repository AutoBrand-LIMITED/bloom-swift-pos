import { toast } from "sonner";

import { generateAllDocuments, generateReceipt, printDocument } from "@/lib/print-utils";
import type { Order } from "@/types/order";

export function showOrderSubmissionSuccess(order: Order): void {
  toast.success("訂單已完成", {
    duration: 15_000,
    description: "選擇要列印嘅單據：",
    action: {
      label: "收據",
      onClick: () => printDocument(generateReceipt(order)),
    },
    cancel: {
      label: "全部列印",
      onClick: () => printDocument(generateAllDocuments(order)),
    },
  });
}

const SUBMISSION_ERROR_TRANSLATIONS: Record<string, string> = {
  "Reload the selected recipient before saving its occasions.": (
    "收件人資料或重要日子版本已更新，請重新選擇收件人後再下單。"
  ),
  "Reload the selected split recipient before saving its occasions.": (
    "其中一個收貨點嘅收件人或重要日子版本已更新，請重新選擇後再下單。"
  ),
};

export function submissionFailureDescription(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const message = error.message.trim();
  if (!message) return null;
  return SUBMISSION_ERROR_TRANSLATIONS[message] || message.slice(0, 500);
}

export function showOrderSubmissionFailure(error?: unknown): void {
  const description = submissionFailureDescription(error);
  if (!description) {
    toast.error("下單失敗");
    return;
  }
  toast.error("下單失敗", {
    description,
    duration: 15_000,
  });
}
