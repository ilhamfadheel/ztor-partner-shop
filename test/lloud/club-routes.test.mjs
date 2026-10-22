import assert from "node:assert/strict";
import { test } from "node:test";
import "./browser.mjs";

const { viewOf, TITLES } = await import("../../public/js/club-routes.js");

test("maps the club's clean URLs (and their old .html names) to a view rendered in place", () => {
  assert.equal(viewOf("/fan-club"), "home");
  assert.equal(viewOf("/loyalty"), "home");
  assert.equal(viewOf("https://shop.example/rewards?reward=2"), "rewards");
  assert.equal(viewOf("/leaderboard.html"), "leaderboard");
  assert.equal(viewOf("/edit-profile"), "profile");
  assert.equal(viewOf("/account?section=orders"), "account");
  for (const v of ["/shop", "/signup", "/auction"]) assert.ok(viewOf(v));
});

test("leaves everything else to a normal page load: other pages, other sites", () => {
  for (const url of ["/", "/product?id=1", "/checkout", "/login?return_to=/shop", "/orders/9", "https://other.example/rewards", "/js/club.js"]) assert.equal(viewOf(url), null, url);
});

test("gives every view its page title", () => {
  for (const view of ["home", "rewards", "leaderboard", "shop", "account", "profile", "signup", "auction"]) assert.match(TITLES[view], /\| LLOUD$/);
});
