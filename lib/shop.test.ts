import assert from "node:assert/strict";
import { test } from "node:test";
import { shop, ShopError } from "./shop.ts";

test("the product list sends a search as q, encoded, and leaves q off without one", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify({ traceId: "t", success: true, code: "OK", msg: "", data: { pageNum: 1, pageSize: 48, total: 0, pages: 0, items: [] } }));
  }) as typeof fetch;
  await shop.products(1, 48, undefined, "tour tee & cap");
  await shop.products(1, 48);
  assert.match(urls[0], /\/creator\/v1\/products\?pageNum=1&pageSize=48&q=tour%20tee%20%26%20cap$/);
  assert.match(urls[1], /\/creator\/v1\/products\?pageNum=1&pageSize=48$/);
});

test("notifications: the fan's page, then marking some or all read", async () => {
  const calls: Array<{ url: string; method: string; body: unknown; auth: string | null }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined, auth: headers.get("authorization") });
    return new Response(JSON.stringify({ traceId: "t", success: true, code: "0", msg: "", data: { unread: 0 } }));
  }) as typeof fetch;
  await shop.notifications("tok", 2, 10);
  await shop.readNotifications("tok", ["7", "8"]);
  await shop.readAllNotifications("tok");
  assert.match(calls[0].url, /\/creator\/v1\/notifications\?pageNum=2&pageSize=10$/);
  assert.deepEqual(calls.slice(1).map((c) => [c.method, c.url.replace(/^.*\/creator\/v1/, ""), c.body]), [
    ["POST", "/notifications/read", { notification_ids: ["7", "8"] }],
    ["POST", "/notifications/read-all", undefined],
  ]);
  assert.ok(calls.every((c) => c.auth === "Bearer tok"));
});

test("browser calls carry the fan's saved language; an explicit lang still wins", async () => {
  const langs: Array<string | null> = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    langs.push(new Headers(init.headers).get("accept-language"));
    return new Response(JSON.stringify({ traceId: "t", success: true, code: "OK", msg: "", data: { artists: [] } }));
  }) as typeof fetch;
  (globalThis as { document?: unknown }).document = { cookie: "other=1; ztor_lang=zh-hk" };
  try {
    await shop.artist();
    await shop.artist("en-us");
  } finally {
    delete (globalThis as { document?: unknown }).document;
  }
  await shop.artist(); // no document (the server side): no header unless passed
  assert.deepEqual(langs, ["zh-hk", "en-us", null]);
});

test("claimInvite names the invitation as the friend, with the code as code", async () => {
  const calls: Array<{ url: string; method: string; body: unknown; auth: string | null }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined, auth: new Headers(init.headers).get("authorization") });
    return new Response(JSON.stringify({ traceId: "t", success: true, code: "0", msg: "", data: { counted: true, alreadyCounted: false } }));
  }) as typeof fetch;
  assert.deepEqual(await shop.claimInvite("tok", "7KQ2-M9XA"), { counted: true, alreadyCounted: false });
  assert.deepEqual(calls.map((c) => [c.method, c.url.replace(/^.*\/creator\/v1/, ""), c.body, c.auth]), [["POST", "/invites/claim", { code: "7KQ2-M9XA" }, "Bearer tok"]]);
});

test("a refused claim is a ShopError with its status, so the callback can tell a refusal from an outage", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ traceId: "t", success: false, code: "CREATOR_INVITE_NOT_NEW", msg: "Invitations count for new members only.", data: null }), { status: 409 })) as typeof fetch;
  await assert.rejects(shop.claimInvite("tok", "7KQ2M9XA"), (e: unknown) => e instanceof ShopError && e.status === 409 && e.code === "CREATOR_INVITE_NOT_NEW");
});
