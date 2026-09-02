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

interface BuildPartnerNoteMutationOptions {
  draft: string;
  currentComment?: string;
  targetPartnerId?: number;
  expectedWriteDate?: string;
}

export function buildPartnerNoteMutation({
  draft,
  currentComment = "",
  targetPartnerId,
  expectedWriteDate,
}: BuildPartnerNoteMutationOptions): PartnerNoteMutation | undefined {
  if (draft === currentComment) return undefined;

  return {
    commentText: draft,
    ...(targetPartnerId ? { targetPartnerId } : {}),
    ...(expectedWriteDate ? { expectedWriteDate } : {}),
  };
}
