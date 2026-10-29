import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { reset, store } from "./browser.mjs";

// The LLOUD pages' copy of lib/referral.ts: the same cases as lib/referral.test.ts.
const r = await import("../../public/js/ztor/referral.js");

beforeEach(reset);

test("keeps a well-formed ?ref= with when it arrived, and nothing else", () => {
  assert.equal(r.captureRef("?ref=7KQ2-M9XA&return=/rewards", 1_000), "7KQ2-M9XA");
  assert.deepEqual(JSON.parse(store.get("ztor_ref")), { code: "7KQ2-M9XA", at: 1_000 });
  store.clear();
  for (const bad of ["?ref=abc", "?ref=" + "A".repeat(33), "?ref=7KQ2M9XA%3Cscript", "?other=1", ""]) assert.equal(r.captureRef(bad, 1_000), null, bad);
  assert.equal(store.size, 0);
});

test("a code is pending for 7 days, then forgotten; clear forgets it", () => {
  r.captureRef("?ref=7KQ2M9XA", 1_000);
  assert.equal(r.pendingRef(1_000 + r.REF_TTL_MS - 1), "7KQ2M9XA");
  assert.equal(r.pendingRef(1_000 + r.REF_TTL_MS + 1), null);
  r.captureRef("?ref=7KQ2M9XA", 1_000);
  r.clearRef();
  assert.equal(r.pendingRef(1_000), null);
  store.set("ztor_ref", "{not json");
  assert.equal(r.pendingRef(1_000), null);
});

test("the LLOUD pages keep an invitation link's code as they load (session.js, on every page)", async () => {
  location.search = "?ref=7KQ2M9XA";
  try {
    await import("../../public/js/ztor/session.js?ref-capture");
    assert.equal(r.pendingRef(), "7KQ2M9XA");
  } finally {
    location.search = "";
  }
});
