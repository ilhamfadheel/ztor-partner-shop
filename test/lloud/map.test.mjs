import assert from "node:assert/strict";
import { test } from "node:test";
import "./browser.mjs";

const m = await import("../../public/js/ztor/map.js");

const session = { user: { sub: "u-1", name: "Fan From Token" } };
const standing = { boardScope: "shared", points: 7515, tier: "super_fan", tierSince: "2026-11-02T00:00:00.000Z", rank: 4, boardSize: 120, next: { tier: "inner_circle", minPoints: 9000, gap: 1485 } };

test("a guest is LLOUD's guest member", () => {
  const who = m.toMember({});
  assert.equal(who.id, null);
  assert.equal(who.guest, true);
  assert.equal(who.tier, "fan");
  assert.equal(who.lifetime, 0);
});

test("a signed-in fan carries their Ztor profile and their standing on the creator's board, in LLOUD's tier ids", () => {
  const who = m.toMember({ session, account: { name: "Fanny", bio: "hi", avatarUrl: "https://cdn/a.jpg", createdAt: "2026-03-01T00:00:00Z" }, standing, claimed: ["10"], unlocked: ["10", "11"] });
  assert.deepEqual(
    { id: who.id, name: who.name, bio: who.bio, avatar: who.avatar, tier: who.tier, rank: who.rank, population: who.population, lifetime: who.lifetime, recent: who.recent, claimed: who.claimed, unlockedRewards: who.unlockedRewards, joined: who.joined, guest: who.guest },
    { id: "u-1", name: "Fanny", bio: "hi", avatar: "https://cdn/a.jpg", tier: "super", rank: 4, population: 120, lifetime: 7515, recent: 7515, claimed: ["10"], unlockedRewards: ["10", "11"], joined: "2026-03-01", guest: false },
  );
  assert.equal(m.toMember({ session }).name, "Fan From Token");
  assert.equal(m.toMember({ session }).tier, "fan");
});

test("the gap to the next tier comes from the board's cut-offs", () => {
  assert.deepEqual(m.nextTierProgress(m.toMember({ session, standing })), { nextTierId: "inner", nextTierName: "Inner Circle", targetPoints: 9000, remaining: 1485, percent: (7515 / 9000) * 100, rankTarget: null, available: true });
  const top = m.toMember({ session, standing: { ...standing, tier: "inner_circle", next: null } });
  assert.equal(m.nextTierProgress(top).nextTierId, null);
  // No cut-offs yet this week: the next tier, but no points line to show.
  const early = m.toMember({ session, standing: { ...standing, tier: "fan", next: null } });
  assert.deepEqual([m.nextTierProgress(early).nextTierId, m.nextTierProgress(early).available], ["ranked", false]);
});

test("a fan with no public name is worded on the site, as the API leaves it empty", () => {
  assert.equal(m.boardRows([{ rank: 3, name: null, avatarUrl: null, points: 5, tier: "fan", me: false }])[0].name, "Fan");
});

test("the leaderboard rows are LLOUD's, with tier names and the caller marked", () => {
  assert.deepEqual(m.boardRows([{ rank: 1, name: "Rival", avatarUrl: null, points: 9000, tier: "inner_circle", me: false }, { rank: 2, name: "Fanny", avatarUrl: "x", points: 15, tier: "fan", me: true }]), [
    { name: "Rival", rank: 1, points: 9000, tier: "Inner Circle", avatar: null },
    { name: "Fanny", rank: 2, points: 15, tier: "Fan", avatar: "x", you: true },
  ]);
});

const eggs = [
  {
    id: "1",
    title: "Studio Egg",
    description: null,
    coverUrl: "https://cdn/egg.jpg",
    rewards: [
      { id: "10", title: "Studio photo", subtitle: null, mediaKind: "photo", previewUrl: null, allowDownload: false, conditions: [], unlocked: true },
      {
        id: "11",
        title: "Unreleased demo",
        subtitle: "Two minutes",
        mediaKind: "audio",
        previewUrl: "https://cdn/blur.jpg",
        allowDownload: false,
        conditions: [
          { type: "tier", target: "inner_circle", met: false },
          { type: "lifetime", target: "10000", met: false },
          { type: "purchased", target: "p-tee", met: true },
          { type: "supported", target: "7", met: false },
          { type: "follow", target: null, met: true },
        ],
        unlocked: false,
      },
    ],
  },
];

test("the vault's rewards are LLOUD rewards: media kind, cover, and conditions in LLOUD's vocabulary", () => {
  const [photo, demo] = m.toRewards(eggs);
  assert.deepEqual(
    { id: photo.id, type: photo.type, title: photo.title, subtitle: photo.subtitle, coverUrl: photo.coverUrl, published: photo.published, vault: photo.vault, conditions: photo.conditions },
    { id: "10", type: "photo", title: "Studio photo", subtitle: "Studio Egg", coverUrl: "https://cdn/egg.jpg", published: true, vault: true, conditions: [] },
  );
  assert.equal(demo.type, "music");
  assert.equal(demo.coverUrl, "https://cdn/blur.jpg");
  assert.deepEqual(demo.conditions, [
    { type: "tier", value: "inner" },
    { type: "lifetime", value: 10000 },
    { type: "product", value: "p-tee" },
    { type: "supported", value: "7" },
    { type: "follow", value: null },
  ]);
});

test("a reward's status follows the API's unlock, with progress per condition for the fan", () => {
  const [, demo] = m.toRewards(eggs);
  const who = m.toMember({ session, standing });
  const status = m.rewardStatus(demo, who);
  assert.equal(status.unlocked, false);
  assert.deepEqual(status.conditions.map((c) => [c.met, c.current, c.target, Math.round(c.progress * 100)]), [
    [false, "super", "inner", 67],
    [false, 7515, 10000, 75],
    [true, 1, 1, 100],
    [false, 0, 1, 0],
    [true, 1, 1, 100],
  ]);
  assert.equal(Math.round(status.progress * 100), Math.round(((2 / 3 + 0.7515 + 1 + 0 + 1) / 5) * 100));
  const [photo] = m.toRewards(eggs);
  assert.deepEqual(m.rewardStatus(photo, who), { unlocked: true, progress: 1, conditions: [] });
  assert.equal(m.rewardStatus(photo, m.toMember({})).unlocked, false);
});

test("a product card is LLOUD's product: id as slug, price, image on the media CDN, a flag", () => {
  const p = m.toProduct({ productId: "1262", title: "Tour Tee", coverUrl: "image/tee.png", currency: "HKD", minPrice: 280, maxPrice: 300, availabilityStatus: "AVAILABLE", sellable: true, requiresSelection: true, limited: true, mainCategoryName: "Apparel" });
  assert.deepEqual(p, { slug: "1262", name: "Tour Tee", price: 280, maxPrice: 300, currency: "HKD", symbol: "HK$", category: "Apparel", collection: null, flag: "Limited", image: "https://cdn.example/image/tee.png", sellable: true, soldOut: false });
  assert.equal(m.toProduct({ productId: "2", title: "x", coverUrl: null, currency: "TWD", minPrice: 1, maxPrice: 1, availabilityStatus: "SOLD_OUT", sellable: false }).soldOut, true);
});

test("a product wears its LLOUD collection from its Creator Studio tag, any case; untagged has none", () => {
  assert.equal(m.collectionOf(["Tees", "Beach Club"]), "beach");
  assert.equal(m.collectionOf(["ROCKSTAR"]), "rockstar");
  assert.equal(m.collectionOf([" paddock "]), "paddock");
  assert.equal(m.collectionOf(["Rockstart", "Tour 2025"]), null);
  assert.equal(m.collectionOf(undefined), null);
  assert.equal(m.toProduct({ productId: "3", title: "Grid Tee", coverUrl: null, currency: "HKD", minPrice: 460, maxPrice: 460, sellable: true, tags: ["Paddock", "Tees"] }).collection, "paddock");
});

test("money speaks LLOUD's format in the item's currency", () => {
  assert.equal(m.money(2880, "HKD"), "HK$ 2,880");
  assert.equal(m.money(1500, "TWD"), "NT$ 1,500");
  assert.equal(m.money(12.5, "XYZ"), "XYZ 12.5");
});

test("the bag's lines are LLOUD's lines, keyed by the shop's cart item", () => {
  const lines = m.toCartLines({ shopGroups: [{ shopId: "s", currency: "HKD", items: [{ cartItemId: "c1", productId: "1262", quantity: 2, itemStatus: "AVAILABLE", title: "Tour Tee", coverUrl: "image/tee.png", unitPrice: 280, lineSubtotal: 560, maxQuantity: 5, skuSelections: [{ skuId: "k1", skuLabel: "M / Black" }] }] }] });
  assert.deepEqual(lines, [{ id: "c1", slug: "1262", skuId: "k1", size: "M / Black", colour: "", title: "Tour Tee", price: 280, currency: "HKD", image: "https://cdn.example/image/tee.png", qty: 2, max: 5, status: "AVAILABLE" }]);
});
