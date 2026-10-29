import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
});
const { captureRef, pendingRef, clearRef, claimPendingRef, REF_KEY, REF_TTL_MS } = await import("./referral.ts");

beforeEach(() => store.clear());

// test/lloud/referral.test.mjs holds the LLOUD pages' copy (public/js/ztor/referral.js) to the same cases.
{
  const r = { captureRef, pendingRef, clearRef };
  test(`keeps a well-formed ?ref= with when it arrived, and nothing else`, () => {
    assert.equal(r.captureRef("?ref=7KQ2-M9XA&return=/rewards", 1_000), "7KQ2-M9XA");
    assert.deepEqual(JSON.parse(store.get(REF_KEY)!), { code: "7KQ2-M9XA", at: 1_000 });
    store.clear();
    for (const bad of ["?ref=abc", "?ref=" + "A".repeat(33), "?ref=7KQ2M9XA%3Cscript", "?other=1", ""]) assert.equal(r.captureRef(bad, 1_000), null, bad);
    assert.equal(store.size, 0);
  });

  test(`a code is pending for 7 days, then forgotten; clear forgets it`, () => {
    r.captureRef("?ref=7KQ2M9XA", 1_000);
    assert.equal(r.pendingRef(1_000 + REF_TTL_MS - 1), "7KQ2M9XA");
    assert.equal(r.pendingRef(1_000 + REF_TTL_MS + 1), null);
    r.captureRef("?ref=7KQ2M9XA", 1_000);
    r.clearRef();
    assert.equal(r.pendingRef(1_000), null);
    store.set(REF_KEY, "{not json");
    assert.equal(r.pendingRef(1_000), null);
  });
}

const refused = (status: number) => Object.assign(new Error("no"), { status });

test("claims a pending code once, then forgets it", async () => {
  captureRef("?ref=7KQ2M9XA");
  const sent: string[] = [];
  assert.equal(await claimPendingRef(async (code) => void sent.push(code)), "counted");
  assert.deepEqual(sent, ["7KQ2M9XA"]);
  assert.equal(pendingRef(), null);
  assert.equal(await claimPendingRef(async (code) => void sent.push(code)), "none");
  assert.equal(sent.length, 1);
});

test("forgets the code when the server refuses it (any 4xx), keeps it when the server or the network fails", async () => {
  captureRef("?ref=7KQ2M9XA");
  assert.equal(await claimPendingRef(async () => { throw refused(409); }), "refused");
  assert.equal(pendingRef(), null);
  captureRef("?ref=7KQ2M9XA");
  assert.equal(await claimPendingRef(async () => { throw refused(503); }), "kept");
  assert.equal(pendingRef(), "7KQ2M9XA");
  assert.equal(await claimPendingRef(async () => { throw new TypeError("Failed to fetch"); }), "kept");
  assert.equal(pendingRef(), "7KQ2M9XA");
});

test("never holds the sign-in up: a claim that doesn't answer in time is kept for the next sign-in", async () => {
  captureRef("?ref=7KQ2M9XA");
  const started = Date.now();
  assert.equal(await claimPendingRef(() => new Promise(() => {}), { timeoutMs: 20 }), "kept");
  assert.ok(Date.now() - started < 1_000);
  assert.equal(pendingRef(), "7KQ2M9XA");
});
