import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDeliveryFee, getDeliveryFees, reorderDeliveryFees, updateDeliveryFee, type DeliveryFeeOption } from "@/lib/odoo-api";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; onChanged: () => void }
interface RowDraft { label: string; amount: string }

export default function DeliveryFeeManagementDialog({ open, onOpenChange, onChanged }: Props) {
  const [fees, setFees] = useState<DeliveryFeeOption[]>([]);
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({});
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const installFees = useCallback((rows: DeliveryFeeOption[]) => {
    setFees(rows);
    setDrafts(Object.fromEntries(rows.map((fee) => [fee.id, { label: fee.label, amount: String(fee.amount) }])));
  }, []);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { installFees(await getDeliveryFees(undefined, true)); }
    catch (err) { setError(err instanceof Error ? err.message : "未能載入送貨費"); }
    finally { setBusy(false); }
  }, [installFees]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  const dirtyIds = useMemo(() => new Set(fees.filter((fee) => {
    const draft = drafts[fee.id];
    return draft && (draft.label.trim() !== fee.label || Number(draft.amount) !== fee.amount);
  }).map((fee) => fee.id)), [drafts, fees]);

  const saveNew = async () => {
    const numeric = Number(amount);
    if (!label.trim() || !Number.isFinite(numeric) || numeric <= 0) return;
    setBusy(true); setError("");
    try {
      await createDeliveryFee({ label: label.trim(), amount: numeric, sequence: (fees.length + 1) * 10, active: true });
      setLabel(""); setAmount(""); await load(); onChanged(); toast.success("已新增送貨費");
    } catch (err) { setError(err instanceof Error ? err.message : "新增失敗"); }
    finally { setBusy(false); }
  };

  const saveRow = async (fee: DeliveryFeeOption) => {
    const draft = drafts[fee.id]; const numeric = Number(draft?.amount);
    if (!draft?.label.trim() || !Number.isFinite(numeric) || numeric <= 0) {
      setError("送貨費名稱不可留空，金額必須大於 0。"); return;
    }
    setBusy(true); setError("");
    try {
      const updated = await updateDeliveryFee(fee.id, { label: draft.label.trim(), amount: numeric });
      setFees((current) => current.map((row) => row.id === fee.id ? updated : row));
      setDrafts((current) => ({
        ...current,
        [fee.id]: { label: updated.label, amount: String(updated.amount) },
      }));
      onChanged(); toast.success("已儲存送貨費");
    } catch (err) { setError(err instanceof Error ? err.message : "更新失敗"); }
    finally { setBusy(false); }
  };

  const toggleActive = async (fee: DeliveryFeeOption) => {
    setBusy(true); setError("");
    try { await updateDeliveryFee(fee.id, { active: !fee.active }); await load(); onChanged(); }
    catch (err) { setError(err instanceof Error ? err.message : "更新失敗"); }
    finally { setBusy(false); }
  };

  const move = async (index: number, offset: number) => {
    const next = [...fees]; const target = index + offset;
    if (target < 0 || target >= next.length || dirtyIds.size > 0) return;
    [next[index], next[target]] = [next[target], next[index]];
    const reordered = next.map((fee, i) => ({ ...fee, sequence: (i + 1) * 10 }));
    setBusy(true); setError("");
    try {
      await reorderDeliveryFees(reordered.map((fee) => ({ id: fee.id, sequence: fee.sequence })));
      installFees(reordered); onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : "排序失敗"); }
    finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl">
    <DialogHeader><DialogTitle>送貨費設定</DialogTitle><DialogDescription>新增、修改、排序或停用送貨費。舊訂單會保留原有名稱及金額。</DialogDescription></DialogHeader>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="max-h-[50vh] space-y-2 overflow-y-auto">
      {fees.map((fee, index) => {
        const draft = drafts[fee.id] || { label: fee.label, amount: String(fee.amount) };
        const valid = draft.label.trim() && Number.isFinite(Number(draft.amount)) && Number(draft.amount) > 0;
        return <div key={fee.id} className="grid grid-cols-[1fr_110px_auto] items-center gap-2 rounded-md border p-2">
          <Input aria-label={`${fee.label}名稱`} value={draft.label} disabled={busy} onChange={(e) => setDrafts((current) => ({ ...current, [fee.id]: { ...draft, label: e.target.value } }))}/>
          <Input aria-label={`${fee.label}金額`} type="number" min="0.01" step="0.01" value={draft.amount} disabled={busy} onChange={(e) => setDrafts((current) => ({ ...current, [fee.id]: { ...draft, amount: e.target.value } }))}/>
          <div className="flex gap-1"><Button aria-label={`儲存 ${fee.label}`} size="icon" disabled={busy || !dirtyIds.has(fee.id) || !valid} onClick={() => void saveRow(fee)}><Save className="h-4 w-4"/></Button><Button aria-label="向上移" size="icon" variant="ghost" disabled={busy || dirtyIds.size > 0 || index === 0} onClick={() => void move(index, -1)}><ArrowUp className="h-4 w-4"/></Button><Button aria-label="向下移" size="icon" variant="ghost" disabled={busy || dirtyIds.size > 0 || index === fees.length - 1} onClick={() => void move(index, 1)}><ArrowDown className="h-4 w-4"/></Button><Button variant="outline" disabled={busy || dirtyIds.size > 0} onClick={() => void toggleActive(fee)}>{fee.active ? "停用" : "重新啟用"}</Button></div>
        </div>;
      })}
    </div>
    <div className="grid grid-cols-[1fr_120px_auto] items-end gap-2 border-t pt-4"><div><Label>新地區／項目</Label><Input value={label} onChange={(e) => setLabel(e.target.value)}/></div><div><Label>金額 ($)</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}/></div><Button disabled={busy || !label.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0} onClick={() => void saveNew()}>{busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>}新增</Button></div>
  </DialogContent></Dialog>;
}
