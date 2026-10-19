import assert from "node:assert/strict";
import { test } from "node:test";
import { asLang, dict, htmlLang, langFromAcceptLanguage, SITE_LANGS } from "./i18n.ts";

test("asLang accepts exactly the site's languages, any case, and nothing else", () => {
  assert.equal(asLang("en-us"), "en-us");
  assert.equal(asLang("ZH-HK"), "zh-hk");
  assert.equal(asLang(" zh-cn "), "zh-cn");
  for (const bad of ["zh-tw", "en", "zh", "", null, undefined, "english"]) assert.equal(asLang(bad), null);
});

test("Accept-Language maps to the closest site language, honouring q-order", () => {
  assert.equal(langFromAcceptLanguage("en-US,en;q=0.9"), "en-us");
  assert.equal(langFromAcceptLanguage("zh-HK,zh;q=0.9,en;q=0.8"), "zh-hk");
  assert.equal(langFromAcceptLanguage("zh-TW"), "zh-hk"); // traditional script reads our HK Chinese
  assert.equal(langFromAcceptLanguage("zh-Hant"), "zh-hk");
  assert.equal(langFromAcceptLanguage("zh-CN,zh;q=0.9"), "zh-cn");
  assert.equal(langFromAcceptLanguage("zh"), "zh-cn");
  assert.equal(langFromAcceptLanguage("fr;q=0.9,zh-CN;q=0.8"), "zh-cn"); // first OUR match, not the header's first
  assert.equal(langFromAcceptLanguage("en;q=0.5,zh-HK;q=0.9"), "zh-hk"); // q beats position
  assert.equal(langFromAcceptLanguage("fr-FR,de;q=0.9"), null);
  assert.equal(langFromAcceptLanguage(null), null);
  assert.equal(langFromAcceptLanguage(""), null);
});

test("html lang is the BCP 47 form", () => {
  assert.deepEqual(SITE_LANGS.map(htmlLang), ["en", "zh-HK", "zh-CN"]);
});

/** Every language answers the same keys with the same kinds of value, so no page can fall through to English mid-sentence. */
test("the dictionaries have identical shape in every language", () => {
  const shape = (value: unknown, path: string): string[] => {
    if (typeof value === "function") return [`${path}:fn${(value as (...args: unknown[]) => unknown).length}`];
    if (typeof value === "string") {
      assert.ok(value.length > 0, `${path} is empty`);
      return [`${path}:str`];
    }
    assert.ok(value && typeof value === "object", `${path} is ${typeof value}`);
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => shape(v, `${path}.${k}`)).sort();
  };
  const reference = shape(dict("en-us"), "");
  for (const lang of SITE_LANGS) assert.deepEqual(shape(dict(lang), ""), reference, `${lang} diverges from en-us`);
});

test("parametrised messages interpolate in every language", () => {
  for (const lang of SITE_LANGS) {
    const t = dict(lang);
    assert.ok(t.home.matches(3, "tee").includes("3"));
    assert.ok(t.home.matches(3, "tee").includes("tee"));
    assert.ok(t.notifications.unreadCount(7).includes("7"));
    assert.ok(t.account.bioHelp(10, 150).includes("10 / 150"));
    assert.ok(t.done.payAgainWith("PayPal").includes("PayPal"));
  }
});
