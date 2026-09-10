import type { DeliverySplit, Order, OrderItem } from "@/types/order";
import { cloneRecipientOccasions } from "@/lib/recipient-occasions";

interface ClonedOrderContent {
  items: OrderItem[];
  deliverySplits: DeliverySplit[];
}

export const cloneOrderContent = (
  order: Pick<Order, "items" | "deliverySplits">,
  createId: () => string = () => crypto.randomUUID(),
): ClonedOrderContent => {
  const itemIds = new Map<string, string>();
  const items = order.items.map((item) => {
    const id = createId();
    itemIds.set(item.id, id);
    return { ...item, id };
  });

  const deliverySplits = (order.deliverySplits || []).map((split) => ({
    ...split,
    id: createId(),
    ...(split.recipientOccasions !== undefined
      ? { recipientOccasions: cloneRecipientOccasions(split.recipientOccasions) }
      : {}),
    itemAllocations: split.itemAllocations.map((allocation) => ({
      ...allocation,
      itemId: itemIds.get(allocation.itemId) || allocation.itemId,
    })),
  }));

  return { items, deliverySplits };
};
