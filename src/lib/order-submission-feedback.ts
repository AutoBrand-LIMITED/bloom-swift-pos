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

export function showOrderSubmissionFailure(): void {
  toast.error("下單失敗");
}
