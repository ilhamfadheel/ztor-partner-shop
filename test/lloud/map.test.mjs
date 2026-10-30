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

// ── missions (CONTRACT §4, §7.2) ───────────────────────────────────────────────
const me = (state, extra = {}) => ({ state, progress: { current: state === "done" ? 1 : 0, target: 1 }, proofUrl: null, note: null, reason: null, attempts: 0, submittedAt: null, completedAt: null, pointsEarned: 0, ...extra });
const mission = (over = {}) => ({
  id: "41", kind: "proof", action: null, target: null, targetCount: 1, points: 450, pointsPer: "mission",
  title: "Share your outfit", description: "Post your LLOUD look.", category: "Community", coverUrl: "https://cdn/c.webp", mediaUrl: null,
  instructions: ["Post your outfit", "Submit the public post link"], rules: "One post can earn only once.", prizes: [], prizeNote: null,
  benefit: null, availabilityNote: null, actionUrl: "https://www.instagram.com/", actionLabel: "Open Instagram",
  proof: { link: "required", note: "off", notePrompt: null, allowedHosts: ["instagram.com"] },
  startsAt: null, endsAt: null, availability: "open", me: null, ...over,
});

test("a mission's kind follows how it completes: a link, a note, an invitation, a purchase, or anything else Ztor tracks", () => {
  const kinds = m.toMissions([
    mission(),
    mission({ id: "2", proof: { link: "off", note: "required", notePrompt: "Why?", allowedHosts: [] } }),
    mission({ id: "3", kind: "invite", proof: null, pointsPer: "friend", targetCount: 10 }),
    mission({ id: "4", kind: "auto", action: "purchased", proof: null }),
    mission({ id: "6", kind: "auto", action: "follow", proof: null }),
    mission({ id: "7", kind: "auto", action: "tier", target: "super_fan", proof: null }),
  ]).map((x) => [x.id, x.kind]);
  assert.deepEqual(kinds, [["41", "social"], ["2", "response"], ["3", "referral"], ["4", "purchase"], ["6", "auto"], ["7", "auto"]]);
});

test("a mission carries LLOUD's fields: cover, rule, checklist, prompt, and the platform's action", () => {
  const [x] = m.toMissions([mission({ proof: { link: "optional", note: "optional", notePrompt: "Tell us more", allowedHosts: [] }, prizes: ["Signed print"], prizeNote: "For three winners", mediaUrl: "https://cdn/f.mp4" })]);
  assert.deepEqual(
    { id: x.id, title: x.title, description: x.description, points: x.points, pointsPer: x.pointsPer, category: x.category, cover: x.cover, media: x.media, rule: x.rule, prizes: x.prizes, prizeEligibility: x.prizeEligibility, prompt: x.prompt, checklist: x.checklist, actionUrl: x.actionUrl, actionLabel: x.actionLabel, me: x.me },
    { id: "41", title: "Share your outfit", description: "Post your LLOUD look.", points: 450, pointsPer: "mission", category: "Community", cover: "https://cdn/c.webp", media: "https://cdn/f.mp4", rule: "One post can earn only once.", prizes: ["Signed print"], prizeEligibility: "For three winners", prompt: "Tell us more", checklist: ["Post your outfit", "Submit the public post link"], actionUrl: "https://www.instagram.com/", actionLabel: "Open Instagram", me: null },
  );
});

test("the card's +N is the mission's points; per friend for an invitation, else the benefit", () => {
  const [proof, invite, milestone] = m.toMissions([
    mission(),
    mission({ id: "42", kind: "invite", points: 400, pointsPer: "friend", proof: null, targetCount: 10 }),
    mission({ id: "51", kind: "auto", action: "purchased", points: 0, proof: null, benefit: "First purchase milestone" }),
  ]);
  assert.deepEqual([proof.amount, invite.amount, milestone.amount], [450, 400, 0]);
  assert.deepEqual([m.missionBenefit(proof), m.missionBenefit(invite), m.missionBenefit(milestone)], ["+450 points", "+400 points per friend", "First purchase milestone"]);
});

test("the seal follows the fan's state; a visitor's mission is still to discover", () => {
  const seals = m.toMissions(["todo", "pending", "rejected", "done", "revoked"].map((s, i) => mission({ id: String(i), me: me(s) })).concat(mission({ id: "v" }))).map((x) => [x.state, x.seal]);
  assert.deepEqual(seals, [["todo", "To discover"], ["pending", "In review"], ["rejected", "Needs an update"], ["done", "Complete"], ["revoked", "Not credited"], ["todo", "To discover"]]);
});

test("a mission without a category gets one from what it is", () => {
  const cats = m.toMissions([mission({ category: null }), mission({ id: "3", kind: "invite", proof: null, category: null })]).map((x) => x.category);
  assert.deepEqual(cats, ["Mission", "Community"]);
});

test("a mission's availability text: the platform's note first, else when it opens or closes", () => {
  const [note, upcoming, closed, open] = m.toMissions([
    mission({ availabilityNote: "Invitations open soon." }),
    mission({ id: "2", availability: "upcoming", startsAt: "2099-01-02T00:00:00.000Z" }),
    mission({ id: "3", availability: "closed", endsAt: "2020-01-02T00:00:00.000Z" }),
    mission({ id: "4" }),
  ]);
  assert.equal(note.availability, "Invitations open soon.");
  assert.match(upcoming.availability, /^Opens /);
  assert.equal(closed.availability, "This mission has ended.");
  assert.equal(open.availability, null);
  assert.deepEqual([note.window, upcoming.window, closed.window], ["open", "upcoming", "closed"]);
});

test("unknown reward conditions are kept as a requirement, never dropped; a mission is named, an invitation counts friends", () => {
  const [reward] = m.toRewards([{ id: "1", title: "Egg", coverUrl: null, rewards: [{ id: "9", title: "Encore", subtitle: null, mediaKind: "video", previewUrl: null, conditions: [
    { type: "mission", target: "41", met: true, title: "Share your outfit" },
    { type: "mission", target: "99", met: false, title: null },
    { type: "invite", target: "5", met: false, current: 2 },
    { type: "streak", target: "3", met: false },
  ], unlocked: false }] }]);
  assert.deepEqual(reward.conditions, [
    { type: "achievement", value: "41", label: "Share your outfit" },
    { type: "achievement", value: "99", label: null },
    { type: "invite", value: 5, current: 2 },
    { type: "other", value: "3" },
  ]);
  assert.deepEqual(reward.met, [true, false, false, false]);
  const status = m.rewardStatus(reward, m.toMember({ session, standing }));
  assert.deepEqual(status.conditions.map((c) => [c.label, c.met, c.current, c.target, Math.round(c.progress * 100)]), [
    ["Complete: Share your outfit", true, 1, 1, 100],
    ["Complete a mission", false, 0, 1, 0],
    ["Invite 5 friends who join", false, 2, 5, 40],
    ["Complete a requirement", false, 0, 1, 0],
  ]);
});

test("a reward gated on one friend asks for a friend, not '1 friends'", () => {
  const [reward] = m.toRewards([{ id: "1", title: "Egg", coverUrl: null, rewards: [{ id: "9", title: "Encore", subtitle: null, mediaKind: "video", previewUrl: null, conditions: [
    { type: "invite", target: "1", met: false, current: 0 },
  ], unlocked: false }] }]);
  const [c] = m.rewardStatus(reward, m.toMember({ session, standing })).conditions;
  assert.equal(c.label, "Invite a friend who joins");
});
