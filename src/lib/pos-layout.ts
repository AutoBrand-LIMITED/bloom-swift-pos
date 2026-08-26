export const checkoutBarLeftOffset = (
  hasSelectedCustomer: boolean,
  customerHistoryOpen: boolean,
) => {
  if (!hasSelectedCustomer) return 0;
  return customerHistoryOpen ? "min(360px, 85vw)" : "3.5rem";
};

export const mobileCheckoutBarClassName =
  "fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/90 backdrop-blur-md transition-[left] lg:left-[var(--checkout-bar-left)] xl:hidden";
