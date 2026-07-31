export const checkoutBarLeftOffset = (
  hasSelectedCustomer: boolean,
  customerHistoryOpen: boolean,
) => {
  if (!hasSelectedCustomer) return 0;
  return customerHistoryOpen ? "min(360px, 85vw)" : "3.5rem";
};
