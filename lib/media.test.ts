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

test("a video cover never reaches an <img>; a gallery keeps its order with the video in it", async () => {
  const { coverImage, galleryItems, isVideoUrl } = await import("./media.ts");
  const video = "https://s3.example/video/1/20260930/v.mp4?X-Amz-Signature=abc";
  assert.equal(isVideoUrl(video), true);
  assert.equal(isVideoUrl("image/1/a.png"), false);
  assert.equal(coverImage(video), undefined);
  assert.equal(coverImage("image/1/a.png"), "https://d1k50uq0sig7az.cloudfront.net/image/1/a.png");
  assert.deepEqual(galleryItems([{ type: "IMAGE", url: "image/b.png", sortOrder: 2 }, { type: "VIDEO", url: video, sortOrder: 1 }]), [
    { type: "VIDEO", url: video },
    { type: "IMAGE", url: "https://d1k50uq0sig7az.cloudfront.net/image/b.png" },
  ]);
});
