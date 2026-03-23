import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Phone, ChevronDown } from "lucide-react";
import { DEMO_CUSTOMERS, type DemoCustomer } from "@/data/demo-customers";

interface CustomerSectionProps {
  phone: string;
  customerName: string;
  onPhoneChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onCustomerSelect: (c: DemoCustomer) => void;
  phoneError: boolean;
  selectedCustomer: DemoCustomer | null;
}

const CustomerSection = ({
  phone, customerName, onPhoneChange, onNameChange,
  onCustomerSelect, phoneError, selectedCustomer,
}: CustomerSectionProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = DEMO_CUSTOMERS.filter(
    (c) => c.name.includes(search) || c.phone.includes(search)
  );

  const handleSelect = (c: DemoCustomer) => {
    onCustomerSelect(c);
    setDropdownOpen(false);
    setSearch("");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
        <User className="w-4 h-4" />
        客戶資料
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs font-medium">
            電話號碼 <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="phone"
              placeholder="例如：9123 4567"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className={`pl-9 font-mono text-base ${phoneError ? "border-destructive ring-1 ring-destructive" : ""}`}
              maxLength={20}
            />
          </div>
          {phoneError && <p className="text-xs text-destructive">請輸入電話號碼</p>}
        </div>
        <div className="space-y-1.5 relative" ref={dropdownRef}>
          <Label className="text-xs font-medium">客戶名稱</Label>
          <div
            className="flex items-center border border-input rounded-md bg-background cursor-pointer hover:border-ring transition-colors"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <Input
              placeholder="選擇或輸入客戶名稱"
              value={dropdownOpen ? search : customerName}
              onChange={(e) => {
                if (dropdownOpen) {
                  setSearch(e.target.value);
                } else {
                  onNameChange(e.target.value);
                }
              }}
              onFocus={() => setDropdownOpen(true)}
              className="border-0 text-base focus-visible:ring-0"
              maxLength={100}
            />
            <ChevronDown className="w-4 h-4 mr-3 text-muted-foreground shrink-0" />
          </div>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">未搵到客戶</p>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={(e) => { e.stopPropagation(); handleSelect(c); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-accent/50 transition-colors border-b border-border last:border-0"
                    >
                      <div>
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 font-mono">{c.phone}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{c.history.length} 筆記錄</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
};

export default CustomerSection;
