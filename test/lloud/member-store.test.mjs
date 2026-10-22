import assert from "node:assert/strict";
import { test } from "node:test";
import "./browser.mjs";

const { safeReturn } = await import("../../public/js/member-store.js");

test("sign-in brings the fan back to the page they were on, LLOUD's or the shop's own (orders, notifications)", () => {
  for (const path of ["/rewards", "/product?id=12", "/account?section=orders", "/orders", "/orders/1269866", "/notifications", "/checkout/done", "/"]) assert.equal(safeReturn(path), path, path);
});

test("refuses anything off this site or unknown, falling back to the fan club", () => {
  for (const bad of ["https://evil.example/orders", "//evil.example", "/login?return_to=/x", "/js/club.js", "javascript:alert(1)"]) assert.equal(safeReturn(bad), "/fan-club", bad);
});
