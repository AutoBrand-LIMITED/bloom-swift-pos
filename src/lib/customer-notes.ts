import type { CustomerTag } from "@/data/demo-customers";
import type { PartnerNoteMutation } from "@/types/order";

export const MANAGED_CUSTOMER_FLAG_NAMES = [
  "VIP",
  "Late Payer",
  "Difficult Customer",
  "Special Handling",
] as const;

const managedFlagNames = new Set<string>(MANAGED_CUSTOMER_FLAG_NAMES);

export function getManagedCustomerFlags(tags: CustomerTag[] = []): CustomerTag[] {
  return tags.filter((tag) => tag.managed === true || managedFlagNames.has(tag.name));
}

export function appendPersistentNote(current: string, note: string): string {
  const existing = current.trim();
  const incoming = note.trim();
  if (!incoming) return existing;
  if (!existing) return incoming;
  if (existing === incoming || existing.split(/\n{2,}/).includes(incoming)) return existing;
  return `${existing}\n\n${incoming}`;
}

interface BuildPartnerNoteMutationOptions {
  draft: string;
  currentComment?: string;
  appendNote?: string;
  shouldAppend?: boolean;
  targetPartnerId?: number;
  expectedWriteDate?: string;
}

export function buildPartnerNoteMutation({
  draft,
  currentComment = "",
  appendNote = "",
  shouldAppend = false,
  targetPartnerId,
  expectedWriteDate,
}: BuildPartnerNoteMutationOptions): PartnerNoteMutation | undefined {
  const finalComment = shouldAppend ? appendPersistentNote(draft, appendNote) : draft;
  if (finalComment === currentComment) return undefined;

  return {
    commentText: finalComment,
    ...(targetPartnerId ? { targetPartnerId } : {}),
    ...(expectedWriteDate ? { expectedWriteDate } : {}),
  };
}
