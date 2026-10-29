import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { reset, routes, signIn } from "./browser.mjs";

// The rendered /rewards page ("Your missions.") and the mission dialog, from the Creator API's
// answers (CONTRACT §7.5-§7.7, §9.6.7-8). Strings, not a DOM: the page's markup is checked as text.
const state = await import("../../public/js/ztor/state.js");
const ui = await import("../../public/js/missions-ui.js");
const store = await import("../../public/js/earning-store.js");
const ok = (data) => () => Response.json({ traceId: "t", success: true, code: "0", msg: "", data });
const API = "https://api.example/api/creator/v1";

const me = (state, extra = {}) => ({ state, progress: { current: state === "done" ? 1 : 0, target: 1 }, proofUrl: null, note: null, reason: null, attempts: 0, submittedAt: null, completedAt: null, pointsEarned: 0, ...extra });
const mission = (over = {}) => ({
  id: "41", kind: "proof", action: null, target: null, targetCount: 1, points: 450, pointsPer: "mission",
  title: "Share your outfit", description: "Post your LLOUD look and submit the public link.", category: "Community", coverUrl: null, mediaUrl: null,
  instructions: ["Post your outfit on Instagram", "Submit the public post link"], rules: "One post can earn only once. We review the outfit.", prizes: [], prizeNote: null,
  benefit: null, availabilityNote: null, actionUrl: "https://www.instagram.com/", actionLabel: "Open Instagram",
  proof: { link: "required", note: "off", notePrompt: null, allowedHosts: ["instagram.com"] }, campaign: null,
  startsAt: null, endsAt: null, availability: "open", me: null, ...over,
});
const MISSIONS = [
  mission(),
  mission({ id: "42", kind: "invite", points: 400, pointsPer: "friend", targetCount: 10, title: "Bring a friend", proof: null, actionUrl: null, actionLabel: null }),
  mission({ id: "50", kind: "auto", action: "redeemed", target: "7", points: 0, title: "Buy from a participating café", category: "Scan & earn", proof: null, campaign: { id: "7", name: "Cafés", brand: null, pointsPerCode: 80 } }),
];
const EGGS = [{ id: "1", title: "Vault", coverUrl: null, rewards: [
  { id: "10", title: "A closer look", subtitle: "A private film.", mediaKind: "video", previewUrl: null, conditions: [{ type: "mission", target: "41", met: false, title: "Share your outfit" }, { type: "invite", target: "5", met: false, current: 2 }], unlocked: false },
  { id: "11", title: "Before the release", subtitle: null, mediaKind: "audio", previewUrl: null, conditions: [], unlocked: true },
] }];

async function page({ fan = false, missions = MISSIONS, eggs = EGGS } = {}) {
  if (fan) {
    signIn();
    routes.push(["GET", "https://api.example/api/api/v1/account", () => Response.json({ code: 200, msg: "ok", data: { name: "Fanny" } })]);
    routes.push(["GET", `${API}/loyalty/me`, ok({ boardScope: "shared", points: 40, tier: "fan", rank: 3, boardSize: 9, next: null })]);
    routes.push(["GET", `${API}/invites/me`, ok({ code: "7KQ2M9XA", counted: 2 })]);
  }
  routes.push(["GET", `${API}/missions`, ok({ missions })]);
  routes.push(["GET", `${API}/vault/eggs`, ok({ eggs })]);
  await state.hydrate(["member", "missions", "invite", "vault"]);
}
const order = (html) => [...html.matchAll(/data-(earning|reward)-id="([^"]+)"/g)].map((m) => m[1] + ":" + m[2]);

beforeEach(() => {
  reset();
  state.forget();
});

test("/rewards is LLOUD's live page: Your missions., its category and status tabs, missions first, then rewards", async () => {
  await page();
  const html = ui.rewardsPage({ category: "all", filter: "all" });
  assert.match(html, /<h1>Your missions\.<\/h1>/);
  assert.match(html, /Earned\. Not ordinary\./);
  assert.match(html, /Take part in missions, earn points from qualifying activities and unlock exclusive content from Lisa\./);
  const categories = [...html.matchAll(/data-mission-category="(\w+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(categories, [["all", "All"], ["earn", "Missions"], ["everyday", "Scan &amp; earn"], ["films", "Films"], ["audio", "Voice &amp; music"]]);
  const statuses = [...html.matchAll(/data-reward-filter="(\w+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(statuses, [["all", "All statuses"], ["unlocked", "Unlocked"], ["locked", "To discover"]]);
  assert.deepEqual(order(html), ["earning:41", "earning:42", "earning:50", "reward:10", "reward:11"]);
  assert.match(html, /id="vault-missions"/);
});

test("the category tabs: Missions without Scan & earn, Scan & earn with its redeem box, Films and Voice & music by reward type", async () => {
  await page({ fan: true });
  assert.deepEqual(order(ui.rewardsPage({ category: "earn", filter: "all" })), ["earning:41", "earning:42"]);
  const scan = ui.rewardsPage({ category: "everyday", filter: "all" });
  assert.deepEqual(order(scan), ["earning:50"]);
  assert.match(scan, /data-redeem-form/);
  assert.doesNotMatch(ui.rewardsPage({ category: "all", filter: "all" }), /data-redeem-form/);
  assert.deepEqual(order(ui.rewardsPage({ category: "films", filter: "all" })), ["reward:10"]);
  assert.deepEqual(order(ui.rewardsPage({ category: "audio", filter: "all" })), ["reward:11"]);
});

test("the status tabs: Unlocked = missions done and rewards unlocked; To discover = the rest", async () => {
  await page({ fan: true, missions: [mission({ me: me("done") }), MISSIONS[1], MISSIONS[2]] });
  assert.deepEqual(order(ui.rewardsPage({ category: "all", filter: "unlocked" })), ["earning:41", "reward:11"]);
  assert.deepEqual(order(ui.rewardsPage({ category: "all", filter: "locked" })), ["earning:42", "earning:50", "reward:10"]);
});

test("nothing in a view says so, in the live page's words", async () => {
  await page({ missions: [], eggs: [] });
  const html = ui.rewardsPage({ category: "films", filter: "unlocked" });
  assert.match(html, /Nothing here yet\./);
  assert.match(html, /Try another category or show all statuses\./);
  assert.match(html, /data-reward-filter="all"[^>]*>Show all statuses/);
});

test("a mission card shows its label, seal, what it earns and its tasks; per friend for an invitation, the code's points for Scan & earn", async () => {
  await page({ fan: true, missions: [mission({ me: me("pending") }), { ...MISSIONS[1], me: me("todo", { progress: { current: 2, target: 10 } }) }, MISSIONS[2]] });
  const [proof, invite, scan] = MISSIONS.map((m) => ui.missionCard(state.missionCatalog().find((x) => x.id === m.id)));
  assert.match(proof, /<span>Community<\/span><span class="reward-seal">In review<\/span>/);
  assert.match(proof, /What you earn<\/h4><span>\+450 points<\/span>/);
  assert.match(proof, /Post your outfit on Instagram/);
  assert.match(proof, /data-fan-mission="41"[^>]*>View mission/);
  assert.match(invite, /\+400 points per friend/);
  assert.match(invite, /2 of 10 friends/);
  assert.match(scan, /\+80 points/);
});

test("a completed mission's card says it's yours to keep and offers the completion", async () => {
  await page({ fan: true, missions: [mission({ me: me("done", { pointsEarned: 450 }) })] });
  const card = ui.missionCard(state.missionCatalog()[0]);
  assert.match(card, /is-unlocked/);
  assert.match(card, /Yours to keep/);
  assert.match(card, /View completion/);
});

test("a reward gated on a mission and on friends shows both steps, with the invite count", async () => {
  await page({ fan: true });
  const html = ui.rewardsPage({ category: "films", filter: "all" });
  assert.match(html, /Complete: Share your outfit/);
  assert.match(html, /Invite 5 friends who join/);
});

test("a reward gated on one friend reads 'Invite a friend who joins' on its card", async () => {
  const eggs = [{ id: "1", title: "Vault", coverUrl: null, rewards: [{ id: "12", title: "One friend", subtitle: null, mediaKind: "video", previewUrl: null, conditions: [{ type: "invite", target: "1", met: false, current: 0 }], unlocked: false }] }];
  await page({ fan: true, eggs });
  const html = ui.rewardsPage({ category: "films", filter: "all" });
  assert.match(html, /Invite a friend who joins/);
  assert.doesNotMatch(html, /Invite 1 friends/);
});

test("the mission dialog: the form for a mission to do, with the link field and its hosts, and the platform's action", async () => {
  await page({ fan: true });
  const body = ui.missionBody(state.missionCatalog()[0]);
  assert.match(body, /data-mission-form="41"/);
  assert.match(body, /name="proof_url"[^>]*required/);
  assert.doesNotMatch(body, /name="note"/);
  assert.match(body, /instagram\.com/);
  assert.match(body, /href="https:\/\/www\.instagram\.com\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(body, /Mission reward/);
  assert.match(body, /<summary>Details<\/summary>/);
});

test("the mission dialog follows the review: in review, needs an update (with the reason and the form again), complete, not credited", async () => {
  await page({ fan: true, missions: [
    mission({ id: "1", me: me("pending", { proofUrl: "https://instagram.com/p/a" }) }),
    mission({ id: "2", me: me("rejected", { reason: "The post is private.", proofUrl: "https://instagram.com/p/b" }) }),
    mission({ id: "3", me: me("done") }),
    mission({ id: "4", me: me("revoked", { reason: "Not your post." }) }),
    mission({ id: "5", proof: { link: "off", note: "required", notePrompt: "What stood out, and why?", allowedHosts: [] } }),
  ] });
  const [pending, rejected, done, revoked, note] = state.missionCatalog().map((m) => ui.missionBody(m));
  assert.match(pending, /In review\. We’ll confirm once your submission is approved\./);
  assert.doesNotMatch(pending, /data-mission-form/);
  assert.match(rejected, /Your submission needs an update\./);
  assert.match(rejected, /The post is private\./);
  assert.match(rejected, /data-mission-form="2"/);
  assert.match(rejected, /value="https:\/\/instagram\.com\/p\/b"/);
  assert.match(done, /Mission complete\./);
  assert.match(done, /Your points have been credited once\./);
  assert.match(revoked, /This mission was not credited\./);
  assert.match(revoked, /Not your post\./);
  assert.doesNotMatch(revoked, /data-mission-form/);
  assert.match(note, /What stood out, and why\?/);
  assert.match(note, /<textarea name="note"[^>]*maxlength="1000"[^>]*required/);
  assert.doesNotMatch(note, /name="proof_url"/);
});

test("an invitation mission shows the friends counted and the copy-link button; an auto mission its progress and where to go; a closed one only when", async () => {
  await page({ fan: true, missions: [
    mission({ id: "42", kind: "invite", points: 400, pointsPer: "friend", targetCount: 10, proof: null, actionUrl: null, actionLabel: null, me: me("todo", { progress: { current: 2, target: 10 } }) }),
    mission({ id: "60", kind: "auto", action: "purchased", target: "1273347568188919808", points: 0, benefit: "First purchase milestone", proof: null, actionUrl: null, actionLabel: null, me: me("todo") }),
    mission({ id: "61", kind: "auto", action: "lifetime", target: "3000", points: 100, proof: null, actionUrl: null, actionLabel: null, me: me("todo", { progress: { current: 40, target: 3000 } }) }),
    mission({ id: "70", availability: "closed", endsAt: "2020-01-01T00:00:00.000Z", me: me("todo") }),
  ] });
  const [invite, purchase, lifetime, closed] = state.missionCatalog().map((m) => ui.missionBody(m));
  assert.match(invite, /2 of 10 friends/);
  assert.match(invite, /data-invite-link[^>]*>Copy invitation link/);
  assert.match(purchase, /href="\/product\?id=1273347568188919808"/);
  assert.match(purchase, /First purchase milestone/);
  assert.doesNotMatch(purchase, /data-mission-form|Claim/);
  assert.match(lifetime, /40 of 3,000 points/);
  assert.match(closed, /This mission has ended\./);
  assert.doesNotMatch(closed, /data-mission-form/);
});

test("a Scan & earn mission's dialog carries the redeem box", async () => {
  await page({ fan: true });
  assert.match(ui.missionBody(state.missionCatalog().find((m) => m.scan)), /data-redeem-form/);
});

test("a refusal reads as the fan's next step", () => {
  const e = (code, message = "msg") => Object.assign(new Error(message), { code });
  assert.equal(ui.refusalText(e("CREATOR_PROOF_REUSED")), "This link was already used for a mission.");
  assert.equal(ui.refusalText(e("CREATOR_MISSION_CLOSED")), "This mission isn’t open right now.");
  assert.equal(ui.refusalText(e("CREATOR_INVALID_ARGUMENT", "proofUrl must be an https link")), "proofUrl must be an https link");
  assert.equal(ui.refusalText(e("CREATOR_CODE_USED")), "This code has already been used.");
  assert.equal(ui.refusalText(e("CREATOR_CAMPAIGN_NOT_LIVE")), "This code’s campaign isn’t running right now.");
  assert.equal(ui.refusalText(e("CREATOR_CAMPAIGN_FULL")), "This campaign has reached its limit.");
  assert.equal(ui.refusalText(e("CREATOR_NOT_FOUND")), "We don’t recognise this code.");
});

test("earning-store's catalog is the API's missions; review and reset are gone (the platform reviews in the console)", async () => {
  await page();
  assert.deepEqual(store.earningCatalog().map((m) => m.id), ["41", "42", "50"]);
  for (const gone of ["reviewMissionProof", "resetMissionProof", "saveEarningCatalog", "validateEarningCatalog"]) assert.equal(store[gone], undefined, gone);
  assert.equal(typeof store.submitMissionProof, "function");
});
