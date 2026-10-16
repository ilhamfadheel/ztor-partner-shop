import assert from "node:assert/strict";
import { test } from "node:test";
import { account } from "./account.ts";

const ok = (data: unknown) => new Response(JSON.stringify({ code: 200, msg: "", data }));

test("profile edit: PATCH /api/v1/account with only the fields that changed", async () => {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
    return ok({ userId: "u-1", bio: "Front row", language: "en-us" });
  }) as typeof fetch;
  await account.update("tok", { bio: "Front row", language: "en-us" });
  assert.equal(calls[0].method, "PATCH");
  assert.match(calls[0].url, /\/api\/v1\/account$/);
  assert.deepEqual(calls[0].body, { bio: "Front row", language: "en-us" });
});

test("a new avatar: upload URL for its type, the file PUT there with that type, then its publicUrl saved", async () => {
  const calls: Array<{ url: string; method: string; type: string | null; body: unknown }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    calls.push({ url, method: init.method ?? "GET", type: headers.get("content-type"), body: typeof init.body === "string" ? JSON.parse(init.body) : init.body });
    if (url.endsWith("/avatar/upload-url")) return ok({ uploadUrl: "https://oss.example/avatars/u-1/a.png?sig=1", publicUrl: "https://cdn.example/avatars/u-1/a.png", expiresIn: 600, method: "PUT", headers: { "Content-Type": "image/png" } });
    if (url.startsWith("https://oss.example/")) return new Response(null, { status: 200 });
    return ok({ userId: "u-1", avatarUrl: "https://cdn.example/avatars/u-1/a.png" });
  }) as typeof fetch;
  const file = new File([new Uint8Array([137, 80, 78, 71])], "me.png", { type: "image/png" });
  const view = await account.uploadAvatar("tok", file);
  assert.deepEqual(calls.map((c) => c.method), ["POST", "PUT", "PATCH"]);
  assert.deepEqual(calls[0].body, { contentType: "image/png" });
  assert.equal(calls[1].url, "https://oss.example/avatars/u-1/a.png?sig=1");
  assert.equal(calls[1].type, "image/png");
  assert.deepEqual(calls[2].body, { avatarUrl: "https://cdn.example/avatars/u-1/a.png" });
  assert.equal(view.avatarUrl, "https://cdn.example/avatars/u-1/a.png");
});

test("an avatar of another type, or over 5 MB, is refused before anything is sent", async () => {
  let sent = 0;
  globalThis.fetch = (async () => { sent += 1; return ok({}); }) as typeof fetch;
  await assert.rejects(account.uploadAvatar("tok", new File(["x"], "a.webp", { type: "image/webp" })), /JPG, PNG or GIF/);
  await assert.rejects(account.uploadAvatar("tok", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "a.png", { type: "image/png" })), /up to 5 MB/);
  assert.equal(sent, 0);
});
