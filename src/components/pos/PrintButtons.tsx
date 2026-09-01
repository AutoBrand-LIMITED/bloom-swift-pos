import { Button } from "@/components/ui/button";
import { Printer, Receipt, Truck, ClipboardCheck, Gift } from "lucide-react";
import {
  generateAllDocuments,
  generateReceipt,
  generateDeliveryNote,
  generateMessageCards,
  generatePickingList,
  hasEnabledMessageCards,
  printDocument,
} from "@/lib/print-utils";
import type { Order } from "@/types/order";
import { toast } from "sonner";

interface PrintButtonsProps {
  order: Order;
  size?: "sm" | "default";
}

const PrintButtons = ({ order, size = "sm" }: PrintButtonsProps) => {
  const hasMessageCards = hasEnabledMessageCards(order);
  const safePrint = (generate: () => string) => {
    try {
      printDocument(generate());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "文件產生失敗，請聯絡管理員。");
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
    <Button
      size={size}
      className="gap-1.5 text-xs"
      onClick={(e) => { e.stopPropagation(); safePrint(() => generateAllDocuments(order)); }}
    >
      <Printer className="w-3.5 h-3.5" /> 全部列印
    </Button>
    <Button
      variant="outline"
      size={size}
      className="gap-1.5 text-xs"
      onClick={(e) => { e.stopPropagation(); safePrint(() => generateReceipt(order)); }}
    >
      <Receipt className="w-3.5 h-3.5" /> 收據
    </Button>
    <Button
      variant="outline"
      size={size}
      className="gap-1.5 text-xs"
      onClick={(e) => { e.stopPropagation(); safePrint(() => generateDeliveryNote(order)); }}
    >
      <Truck className="w-3.5 h-3.5" /> 送貨單
    </Button>
    <Button
      variant="outline"
      size={size}
      className="gap-1.5 text-xs"
      onClick={(e) => { e.stopPropagation(); safePrint(() => generatePickingList(order)); }}
    >
      <ClipboardCheck className="w-3.5 h-3.5" /> 執貨單
    </Button>
    {hasMessageCards && (
      <Button
        variant="outline"
        size={size}
        className="gap-1.5 text-xs"
        onClick={(e) => { e.stopPropagation(); safePrint(() => generateMessageCards(order)); }}
      >
        <Gift className="w-3.5 h-3.5" /> 心意卡
      </Button>
    )}
    </div>
  );
};

export default PrintButtons;
