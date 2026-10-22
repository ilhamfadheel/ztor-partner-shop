// The Creator API (the partner shop facade on the Ztor gateway) and the fan's Ztor account, for the
// LLOUD pages. Same calls as lib/shop.ts and lib/account.ts: the channel key on every Creator API
// call, the fan's access token where the route needs one. Request fields are snake_case.
import config from '/lloud-config.js';
import { currentSession } from './session.js';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const langCookie = () => {
  const pair = (typeof document !== 'undefined' && typeof document.cookie === 'string' ? document.cookie : '').split('; ').find(c => c.startsWith('ztor_lang='));
  return pair ? pair.slice('ztor_lang='.length) : null;
};

/** The fan's bearer: required (401 SIGNED_OUT when signed out), optional, or never. */
async function bearer(auth) {
  if (!auth) return null;
  const session = await currentSession();
  if (session) return 'Bearer ' + session.accessToken;
  if (auth === 'required') throw new ApiError(401, 'SIGNED_OUT', 'Sign in to continue.');
  return null;
}

async function creator(path, { method = 'GET', body, auth, idempotencyKey } = {}) {
  const headers = { 'x-channel-key': config.clientId };
  const lang = langCookie();
  if (lang) headers['accept-language'] = lang;
  const token = await bearer(auth);
  if (token) headers.authorization = token;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const res = await fetch(`${config.api}/creator/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  if (res.status === 204) return undefined;
  const envelope = await res.json().catch(() => null);
  // Not the facade's envelope: the route isn't there (yet) on this gateway.
  if (!envelope || typeof envelope.success !== 'boolean') throw new ApiError(res.status, 'UNAVAILABLE', `This isn't available right now (HTTP ${res.status}).`);
  if (!res.ok || !envelope.success) throw new ApiError(res.status, envelope.code, envelope.msg || 'The shop refused the request.');
  return envelope.data;
}

async function account(path, { method = 'GET', body } = {}) {
  const headers = { authorization: await bearer('required') };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${config.api}/api/v1/account${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  const envelope = await res.json().catch(() => null);
  if (envelope && envelope.code === 200) return envelope.data;
  const data = envelope?.data && !Array.isArray(envelope.data) ? envelope.data : null;
  if (!data?.reason) throw new ApiError(res.status, 'UNAVAILABLE', `Your Ztor account isn't available here right now (HTTP ${res.status}).`);
  throw new ApiError(res.status, data.reason, data.message || envelope.msg || 'Your account refused the change.');
}

const id = value => encodeURIComponent(String(value));

export const api = {
  // Catalogue (channel key only).
  artist: () => creator('/artist').then(d => d?.artists ?? []),
  /** `q` = a phrase found inside product titles (any case, at most 100 characters). */
  products: (pageNum = 1, pageSize = 50, q = '') => creator(`/products?pageNum=${pageNum}&pageSize=${pageSize}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  product: productId => creator(`/products/${id(productId)}`),
  // Bag (fan).
  cart: () => creator('/cart', { auth: 'required' }),
  addToCart: (productId, skuId, qty) => creator('/cart/items', { method: 'POST', auth: 'required', body: { product_id: productId, sku_id: skuId, qty } }),
  setQty: (cartItemId, qty) => creator(`/cart/items/${id(cartItemId)}`, { method: 'PATCH', auth: 'required', body: { qty } }),
  removeLine: cartItemId => creator(`/cart/items/${id(cartItemId)}`, { method: 'DELETE', auth: 'required' }),
  // Checkout (fan).
  pickupContacts: () => creator('/pickup-contacts', { auth: 'required' }).then(d => d?.items ?? []),
  addPickupContact: (name, phone) => creator('/pickup-contacts', { method: 'POST', auth: 'required', body: { name, phone } }),
  updatePickupContact: (contactId, name, phone) => creator(`/pickup-contacts/${id(contactId)}`, { method: 'PUT', auth: 'required', body: { name, phone } }),
  deletePickupContact: contactId => creator(`/pickup-contacts/${id(contactId)}`, { method: 'DELETE', auth: 'required' }),
  paymentMethods: () => creator('/checkout/payment-methods', { auth: 'required' }).then(d => d?.methods ?? []),
  quote: cartItemIds => creator('/checkout/quote', { method: 'POST', auth: 'required', body: { cart_item_ids: cartItemIds } }),
  checkout: (body, idempotencyKey) => creator('/checkout', { method: 'POST', auth: 'required', body, idempotencyKey }),
  checkoutResult: groupId => creator(`/checkout/${id(groupId)}`, { auth: 'required' }),
  pay: (groupId, paymentMethod) => creator(`/checkout/${id(groupId)}/pay`, { method: 'POST', auth: 'required', body: { payment_method: paymentMethod } }),
  orders: (pageNum = 1) => creator(`/orders?pageNum=${pageNum}&pageSize=20`, { auth: 'required' }),
  order: orderId => creator(`/orders/${id(orderId)}`, { auth: 'required' }),
  // Loyalty points and the Media Vault.
  me: () => creator('/loyalty/me', { auth: 'required' }),
  history: (before, take = 20) => creator(`/loyalty/me/history?take=${take}${before ? '&before=' + id(before) : ''}`, { auth: 'required' }),
  board: (take = 50) => creator(`/loyalty/board?take=${take}`, { auth: 'optional' }).then(d => d?.items ?? []),
  rules: () => creator('/loyalty/rules'),
  eggs: () => creator('/vault/eggs', { auth: 'optional' }).then(d => d?.eggs ?? []),
  openReward: rewardId => creator(`/vault/rewards/${id(rewardId)}/open`, { method: 'POST', auth: 'required' }),
  // The fan's Ztor account (profile only; everything else is managed on Ztor).
  account: () => account(''),
  updateAccount: patch => account('', { method: 'PATCH', body: patch }),
  async uploadAvatar(file) {
    if (!['image/jpeg', 'image/png'].includes(file.type)) throw new ApiError(400, 'VALIDATION', 'Use a JPG or PNG picture.');
    if (file.size > 5 * 1024 * 1024) throw new ApiError(400, 'VALIDATION', 'Use a picture up to 5 MB.');
    const upload = await account('/avatar/upload-url', { method: 'POST', body: { contentType: file.type } });
    const put = await fetch(upload.uploadUrl, { method: upload.method ?? 'PUT', headers: upload.headers ?? { 'Content-Type': file.type }, body: file });
    if (!put.ok) throw new ApiError(put.status, 'UPLOAD_FAILED', `The picture didn't upload (HTTP ${put.status}). Try again.`);
    return this.updateAccount({ avatarUrl: upload.publicUrl });
  },
};
