// The one check that fails if the sign-in plumbing breaks: PKCE S256 + JWT payload decoding + return-path guard.
import assert from "node:assert/strict";
import { test } from "node:test";
import { b64url, claims, pkce, safePath } from "./oidc.ts";

test("pkce challenge is the base64url SHA-256 of the verifier", async () => {
  const { verifier, challenge } = await pkce();
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  assert.equal(challenge, b64url(new Uint8Array(digest)));
});

test("claims decodes a base64url JWT payload", () => {
  const payload = Buffer.from(JSON.stringify({ sub: "u1", name: "Ilham ✓" })).toString("base64url");
  assert.deepEqual(claims(`h.${payload}.s`), { sub: "u1", name: "Ilham ✓" });
});

test("safePath keeps same-origin paths only", () => {
  assert.equal(safePath("/cart?x=1"), "/cart?x=1");
  assert.equal(safePath("//evil.com"), "/");
  assert.equal(safePath("https://evil.com"), "/");
  assert.equal(safePath(null), "/");
});
