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

interface PrintButtonsProps {
  order: Order;
  size?: "sm" | "default";
}

const PrintButtons = ({ order, size = "sm" }: PrintButtonsProps) => {
  const hasMessageCards = hasEnabledMessageCards(order);

  return (
    <div className="flex flex-wrap gap-1.5">
    <Button
      size={size}
      className="gap-1.5 text-xs"
      onClick={(e) => { e.stopPropagation(); printDocument(generateAllDocuments(order)); }}
    >
      <Printer className="w-3.5 h-3.5" /> 全部列印
    </Button>
    <Button
      variant="outline"
      size={size}
      className="gap-1.5 text-xs"
      onClick={(e) => { e.stopPropagation(); printDocument(generateReceipt(order)); }}
    >
      <Receipt className="w-3.5 h-3.5" /> 收據
    </Button>
    <Button
      variant="outline"
      size={size}
      className="gap-1.5 text-xs"
      onClick={(e) => { e.stopPropagation(); printDocument(generateDeliveryNote(order)); }}
    >
      <Truck className="w-3.5 h-3.5" /> 送貨單
    </Button>
    <Button
      variant="outline"
      size={size}
      className="gap-1.5 text-xs"
      onClick={(e) => { e.stopPropagation(); printDocument(generatePickingList(order)); }}
    >
      <ClipboardCheck className="w-3.5 h-3.5" /> 執貨單
    </Button>
    {hasMessageCards && (
      <Button
        variant="outline"
        size={size}
        className="gap-1.5 text-xs"
        onClick={(e) => { e.stopPropagation(); printDocument(generateMessageCards(order)); }}
      >
        <Gift className="w-3.5 h-3.5" /> 心意卡
      </Button>
    )}
    </div>
  );
};

export default PrintButtons;
