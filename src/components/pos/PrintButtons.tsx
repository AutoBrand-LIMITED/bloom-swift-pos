import { Button } from "@/components/ui/button";
import { Printer, Receipt, Truck, ClipboardCheck } from "lucide-react";
import {
  generateAllDocuments,
  generateReceipt,
  generateDeliveryNote,
  generatePickingList,
  printDocument,
} from "@/lib/print-utils";
import type { Order } from "@/types/order";

interface PrintButtonsProps {
  order: Order;
  size?: "sm" | "default";
}

const PrintButtons = ({ order, size = "sm" }: PrintButtonsProps) => (
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
  </div>
);

export default PrintButtons;
