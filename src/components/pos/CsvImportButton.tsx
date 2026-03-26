import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { parseCsvToOrders } from "@/lib/csv-import";
import { extractCustomersFromOrders, loadStoredCustomers, mergeCustomers, saveCustomers } from "@/lib/customer-utils";
import type { Order } from "@/types/order";

interface CsvImportButtonProps {
  existingOrders: Order[];
  onImport: (orders: Order[]) => void;
  onCustomersUpdated?: () => void;
}

const STORAGE_KEY = "florist-pos-orders";

const CsvImportButton = ({ existingOrders, onImport, onCustomersUpdated }: CsvImportButtonProps) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const newOrders = parseCsvToOrders(text);

      if (newOrders.length === 0) {
        toast.error("CSV 檔案冇有效數據");
        return;
      }

      // Deduplicate by invoice number in notes
      const existingInvNos = new Set(
        existingOrders
          .map((o) => {
            const match = o.notes.match(/發票號碼: (INV-\d+)/);
            return match?.[1];
          })
          .filter(Boolean)
      );

      const filtered = newOrders.filter((o) => {
        const match = o.notes.match(/發票號碼: (INV-\d+)/);
        return !match?.[1] || !existingInvNos.has(match[1]);
      });

      if (filtered.length === 0) {
        toast.info("所有訂單已經存在，冇新數據需要匯入");
        return;
      }

      const merged = [...existingOrders, ...filtered];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      onImport(merged);

      // Sync customers from all orders
      const newCustomers = extractCustomersFromOrders(merged);
      const existingCustomers = loadStoredCustomers();
      const mergedCustomers = mergeCustomers(existingCustomers, newCustomers);
      saveCustomers(mergedCustomers);
      onCustomersUpdated?.();

      const customerCount = mergedCustomers.length;
      toast.success(`成功匯入 ${filtered.length} 張訂單，${customerCount} 位客戶`, {
        description: newOrders.length !== filtered.length
          ? `（${newOrders.length - filtered.length} 張重複訂單已跳過）`
          : undefined,
      });
    } catch (err) {
      console.error("CSV import error:", err);
      toast.error("匯入失敗，請檢查 CSV 格式");
    }

    // Reset input
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fileRef.current?.click()}
        className="gap-1.5 text-xs"
      >
        <Upload className="w-3.5 h-3.5" /> 匯入CSV
      </Button>
    </>
  );
};

export default CsvImportButton;
