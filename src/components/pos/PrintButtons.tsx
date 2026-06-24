import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Receipt, Truck, ClipboardCheck, MessageSquare, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  generateReceipt,
  generateDeliveryNote,
  generatePickingList,
  generateMessageCard,
  printDocument,
  printBatch,
} from "@/lib/print-utils";
import type { Order } from "@/types/order";
import { useLanguage } from "@/contexts/LanguageContext";

interface PrintButtonsProps {
  order: Order;
  size?: "sm" | "default";
}

const PrintButtons = ({ order, size = "sm" }: PrintButtonsProps) => {
  const { t } = useLanguage();
  const hasCard = order.giftCardEnabled && !!order.giftCardMessage;
  const [selected, setSelected] = useState({
    pickingSlip: true,
    deliveryNote: true,
    receipt: false,
    messageCard: hasCard,
  });

  useEffect(() => {
    setSelected((prev) => ({ ...prev, messageCard: hasCard }));
  }, [hasCard]);

  const toggle = (key: keyof typeof selected) =>
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleBatchPrint = () => {
    const docs: string[] = [];
    if (selected.pickingSlip) docs.push(generatePickingList(order));
    if (selected.deliveryNote) docs.push(generateDeliveryNote(order));
    if (selected.receipt) docs.push(generateReceipt(order));
    if (selected.messageCard && hasCard) docs.push(generateMessageCard(order));
    if (docs.length > 0) printBatch(docs);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        variant="outline"
        size={size}
        className="gap-1.5 text-xs"
        onClick={(e) => { e.stopPropagation(); printDocument(generatePickingList(order)); }}
      >
        <ClipboardCheck className="w-3.5 h-3.5" /> {t("btn_picking_slip")}
      </Button>
      <Button
        variant="outline"
        size={size}
        className="gap-1.5 text-xs"
        onClick={(e) => { e.stopPropagation(); printDocument(generateDeliveryNote(order)); }}
      >
        <Truck className="w-3.5 h-3.5" /> {t("btn_delivery_note")}
      </Button>
      <Button
        variant="outline"
        size={size}
        className="gap-1.5 text-xs"
        onClick={(e) => { e.stopPropagation(); printDocument(generateReceipt(order)); }}
      >
        <Receipt className="w-3.5 h-3.5" /> {t("btn_receipt")}
      </Button>
      {hasCard && (
        <Button
          variant="outline"
          size={size}
          className="gap-1.5 text-xs"
          onClick={(e) => { e.stopPropagation(); printDocument(generateMessageCard(order)); }}
        >
          <MessageSquare className="w-3.5 h-3.5" /> {t("btn_card")}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            size={size}
            className="gap-1.5 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <Printer className="w-3.5 h-3.5" /> {t("btn_print_all")} <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuCheckboxItem
            checked={selected.pickingSlip}
            onCheckedChange={() => toggle("pickingSlip")}
          >
            {t("btn_picking_slip")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={selected.deliveryNote}
            onCheckedChange={() => toggle("deliveryNote")}
          >
            {t("btn_delivery_note")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={selected.receipt}
            onCheckedChange={() => toggle("receipt")}
          >
            {t("btn_receipt")}
          </DropdownMenuCheckboxItem>
          {hasCard && (
            <DropdownMenuCheckboxItem
              checked={selected.messageCard}
              onCheckedChange={() => toggle("messageCard")}
            >
              {t("btn_card")}
            </DropdownMenuCheckboxItem>
          )}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <Button size="sm" className="w-full text-xs" onClick={handleBatchPrint}>
              {t("btn_print_selected")}
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default PrintButtons;
