import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { parseCsvToOrders } from "@/lib/csv-import";
import { extractCustomersFromOrders, loadStoredCustomers, mergeCustomers, saveCustomers } from "@/lib/customer-utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface CsvImportButtonProps {
  onCustomersUpdated?: () => void;
}

const CsvImportButton = ({ onCustomersUpdated }: CsvImportButtonProps) => {
  const { t, lang } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsedOrders = parseCsvToOrders(text);

      if (parsedOrders.length === 0) {
        toast.error(t("csv_no_data"));
        return;
      }

      // Only extract customers + history, do NOT add to orders
      const newCustomers = extractCustomersFromOrders(parsedOrders);
      const existingCustomers = loadStoredCustomers();
      const mergedCustomers = mergeCustomers(existingCustomers, newCustomers);
      saveCustomers(mergedCustomers);
      onCustomersUpdated?.();

      const totalRecords = parsedOrders.reduce((sum, o) => sum + o.items.length, 0);
      const successMsg = lang === "zh"
        ? `成功匯入 ${mergedCustomers.length} 位客戶，共 ${totalRecords} 筆歷史記錄`
        : `Imported ${mergedCustomers.length} customers, ${totalRecords} records`;
      toast.success(successMsg);
    } catch (err) {
      toast.error(t("csv_import_failed"));
    }

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
        <Upload className="w-3.5 h-3.5" /> <span className="hidden lg:inline">{lang === "zh" ? "匯入CSV" : "Import CSV"}</span>
      </Button>
    </>
  );
};

export default CsvImportButton;
