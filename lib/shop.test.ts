import assert from "node:assert/strict";
import { test } from "node:test";
import { shop } from "./shop.ts";

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
