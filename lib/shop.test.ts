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
