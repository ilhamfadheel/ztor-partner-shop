/**
 * Whether a product or SKU can be bought now, by Ztor's own rule (Ztor_WebV2 lib/eshop/selection.ts
 * productBadge): sold out when it isn't sellable or has no stock left. `availabilityStatus` alone is
 * not enough — Shopping can answer AVAILABLE with stock while `sellable` is false.
 */
export const isSoldOut = (item: { sellable: boolean; stockQuantity?: number | null }): boolean => !item.sellable || item.stockQuantity === 0;
