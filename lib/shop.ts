/**
 * The Creator API (Ztor's shop facade for partner sites), called straight from the browser —
 * and from server components for the public catalogue. Public reads need only the channel key
 * (= our client id); fan endpoints add the fan's Ztor access token. Request fields are snake_case,
 * `data` is the shop backend's camelCase, every 64-bit id is a string.
 */
import { config } from "./config.ts";

export class ShopError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public traceId?: string,
  ) {
    super(message);
  }
}

type Envelope<T> = { traceId: string; success: boolean; code: string; msg: string; data: T };

type Init = { method?: "GET" | "POST" | "PATCH" | "DELETE"; token?: string; body?: unknown; idempotencyKey?: string; lang?: string };

async function api<T>(path: string, init: Init = {}): Promise<T> {
  const headers: Record<string, string> = { "x-channel-key": config.clientId };
  if (init.lang) headers["accept-language"] = init.lang;
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey;
  const res = await fetch(`${config.api}/creator/v1${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!body || typeof body.success !== "boolean") throw new ShopError(res.status, "BAD_GATEWAY", `Unexpected answer from the shop API (HTTP ${res.status}).`);
  if (!res.ok || !body.success) throw new ShopError(res.status, body.code, body.msg || "The shop refused the request.", body.traceId);
  return body.data;
}

export const errorText = (error: unknown): string =>
  error instanceof ShopError ? `${error.message} (${error.code}${error.traceId ? ` · ${error.traceId}` : ""})` : error instanceof Error ? error.message : String(error);

export const isAuthError = (error: unknown): boolean => error instanceof ShopError && error.status === 401;

// ---- shapes (the subset this site renders; everything else passes through untouched)

export type Artist = { name: string; avatarUrl: string | null };
export type Page<T> = { pageNum: number; pageSize: number; total: number; pages: number; items: T[] };
export type ProductCard = {
  productId: string;
  title: string;
  coverUrl: string;
  currency: string;
  minPrice: number;
  maxPrice: number;
  availabilityStatus: string;
  sellable: boolean;
  requiresSelection: boolean;
  newProduct?: boolean;
  limited?: boolean;
  mainCategoryName?: string | null;
};
export type ProductOption = { optionId: string; optionName: string; values: { optionValueId: string; valueName: string; colorCode?: string | null }[] };
export type ProductSku = {
  skuId: string;
  label: string;
  effectivePrice: number;
  originalPrice: number | null;
  availabilityStatus: string;
  sellable: boolean;
  stockQuantity?: number | null;
  selectedOptions: { optionId: string; optionValueId: string; valueName: string }[];
};
export type ProductDetail = Omit<ProductCard, "coverUrl"> & {
  description: string | null;
  media: { type: "IMAGE" | "VIDEO"; url: string; sortOrder: number }[];
  attributes: { name: string; value: string }[];
  purchaseLimit: number;
  fulfillmentType: "SHIPPING" | "QR_PICKUP";
  pickup: { name: string; location: string; instruction: string; startAt: number; endAt: number } | null;
  options: ProductOption[];
  skus: ProductSku[];
  productStructure: "SINGLE" | "BUNDLE";
};
export type CartItem = {
  cartItemId: string;
  productId: string;
  quantity: number;
  itemStatus: "AVAILABLE" | "SOLD_OUT" | "PRODUCT_UNAVAILABLE" | "SKU_UNAVAILABLE" | "CONFIGURATION_CHANGED";
  title: string | null;
  coverUrl: string | null;
  unitPrice: number | null;
  lineSubtotal: number | null;
  maxQuantity: number | null;
  skuSelections: { skuId: string; skuLabel: string | null }[];
};
export type Cart = { lineCount: number; totalQuantity: number; shopGroups: { shopId: string; currency: string | null; subtotal: number | null; items: CartItem[] }[] };
export type PickupContact = { contactId: string; name: string; phone: string };
export type PaymentMethod = { methodCode: string; category: string; displayName: string };
export type Quote = { currency: string; canCreate: boolean; subtotal: number; discountAmount: number | null; payableAmount: number | null; confirmationHash: string | null };
export type PaymentStatus = "CREATING" | "READY" | "PAYMENT_PENDING" | "PAYMENT_UNKNOWN" | "PROCESSING" | "SUCCEEDED" | "COMPENSATING" | "CANCELED" | "EXPIRED";
export type PaymentResult = {
  checkoutGroupId: string;
  groupNo: string;
  currency: string;
  payableAmount: number | null;
  orders: { orderId: string; orderNo: string; payableAmount: number; paymentState: string }[];
  groupStatus: PaymentStatus;
  reasonCode: string | null;
  warnings: string[];
  paymentMethods: PaymentMethod[];
};
export type CheckoutSubmission = { group: PaymentResult; paymentAction: "ACTION_REQUIRED" | "ATTEMPT_FAILED" | "UNKNOWN" | "ALREADY_PAID" | "NOT_STARTED"; paymentUrl: string | null; paymentMessage: string | null };
export type OrderItem = { orderItemId: string; title: string | null; coverUrl: string | null; specification: string | null; quantity: number; currency: string; unitAmount: string; totalAmount: string; qrCodes?: { seq: number; status: string; qrContent: string | null }[] };
export type Order = { orderId: string; orderNo: string; shopName?: string | null; displayStatus: "PAID" | "COMPLETED"; fulfilmentStatus: string | null; currency: string; payableAmount: string; paidAt: number | null; items: OrderItem[]; pickupContact?: { name: string | null; phoneCode: string | null; phoneNumber: string | null } | null };
export type OrderGroup = { checkoutGroupId: string; createdAt: number; paymentReference: string; paymentCurrency: string; paymentPayableAmount: string; orders: Order[] };

export const isFinal = (status: PaymentStatus) => status === "SUCCEEDED" || status === "CANCELED" || status === "EXPIRED";

export function money(value: number | string | null | undefined, currency: string | null | undefined): string {
  if (value == null || !currency) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}

// ---- calls

export const shop = {
  artist: (lang?: string) => api<{ artists: Artist[] }>("/artist", { lang }).then((d) => d.artists ?? []),
  products: (pageNum = 1, pageSize = 48, lang?: string) => api<Page<ProductCard>>(`/products?pageNum=${pageNum}&pageSize=${pageSize}`, { lang }),
  product: (id: string, lang?: string) => api<ProductDetail>(`/products/${encodeURIComponent(id)}`, { lang }),

  cart: (token: string) => api<Cart>("/cart", { token }),
  addToCart: (token: string, body: { product_id: string; sku_id: string; qty: number }) => api<{ cartItemId: string }>("/cart/items", { method: "POST", token, body }),
  setQty: (token: string, id: string, qty: number) => api<unknown>(`/cart/items/${encodeURIComponent(id)}`, { method: "PATCH", token, body: { qty } }),
  removeLine: (token: string, id: string) => api<unknown>(`/cart/items/${encodeURIComponent(id)}`, { method: "DELETE", token }),

  pickupContacts: (token: string) => api<{ items: PickupContact[] }>("/pickup-contacts", { token }).then((d) => d.items ?? []),
  paymentMethods: (token: string) => api<{ methods: PaymentMethod[] }>("/checkout/payment-methods", { token }).then((d) => d.methods ?? []),
  quote: (token: string, cart_item_ids: string[]) => api<Quote>("/checkout/quote", { method: "POST", token, body: { cart_item_ids } }),
  checkout: (
    token: string,
    body: { cart_item_ids: string[]; payment_method: string; confirmation_hash: string; callback_url: string } & ({ pickup_contact_id: string } | { pickup_contact: { name: string; phone: string } }),
    idempotencyKey: string,
  ) => api<CheckoutSubmission>("/checkout", { method: "POST", token, body, idempotencyKey }),
  checkoutResult: (token: string, groupId: string) => api<PaymentResult>(`/checkout/${encodeURIComponent(groupId)}`, { token }),
  pay: (token: string, groupId: string, payment_method: string) => api<CheckoutSubmission>(`/checkout/${encodeURIComponent(groupId)}/pay`, { method: "POST", token, body: { payment_method } }),

  orders: (token: string, pageNum = 1) => api<Page<OrderGroup>>(`/orders?pageNum=${pageNum}&pageSize=20`, { token }),
  order: (token: string, orderId: string) => api<Order>(`/orders/${encodeURIComponent(orderId)}`, { token }),
};
