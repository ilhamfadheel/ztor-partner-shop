import assert from "node:assert/strict";
import { test } from "node:test";
import { mediaUrl } from "./media.ts";

test("media paths resolve on Shopping's CDN; absolute URLs pass through", () => {
  assert.equal(mediaUrl("image/1245/20260922/1262.png"), "https://d1k50uq0sig7az.cloudfront.net/image/1245/20260922/1262.png");
  assert.equal(mediaUrl("/image/a.png"), "https://d1k50uq0sig7az.cloudfront.net/image/a.png");
  assert.equal(mediaUrl("https://cdn.example.com/a.png"), "https://cdn.example.com/a.png");
});

test("no media, or a non-web scheme, is nothing to show", () => {
  assert.equal(mediaUrl(null), undefined);
  assert.equal(mediaUrl("  "), undefined);
  assert.equal(mediaUrl("javascript:alert(1)"), undefined);
});
