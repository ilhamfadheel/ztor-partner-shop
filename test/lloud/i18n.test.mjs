import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const i18n = await import("../../public/js/i18n.js");
const ROOT = new URL("../../public/", import.meta.url).pathname;
const JS = readdirSync(join(ROOT, "js"), { recursive: true })
  .filter((f) => f.endsWith(".js") && !f.startsWith("locales") && !f.startsWith("vendor") && f !== "i18n.js")
  .map((f) => join(ROOT, "js", f));
const HTML = readdirSync(ROOT).filter((f) => f.endsWith(".html")).map((f) => join(ROOT, f));

/** Every literal key passed to t() in the LLOUD modules, with where it is. */
function keys() {
  const found = [];
  const call = /(?<![\w$.])t\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (const file of JS) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(call)) {
      if (m[1] === "`" && m[2].includes("${")) { found.push({ file, key: null, raw: m[2] }); continue; }
      found.push({ file, key: Function(`return ${m[1]}${m[2]}${m[1]}`)() });
    }
  }
  for (const file of HTML) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/<(\w+)[^>]*\sdata-i18n(?:\s|>|=)[^>]*>([^<]*)</g)) found.push({ file, key: m[2].trim() });
    for (const m of src.matchAll(/\sdata-i18n-([\w-]+)[^>]*?\s\1="([^"]*)"|\s([\w-]+)="([^"]*)"[^>]*?\sdata-i18n-\3(?=[\s>])/g)) found.push({ file, key: m[2] ?? m[4] });
  }
  return found;
}

test("every t() key is a plain string, not a template with ${…} (use {name} and t()'s second argument)", () => {
  const bad = keys().filter((k) => k.key === null).map((k) => `${k.file.replace(ROOT, "")}: \`${k.raw.slice(0, 60)}\``);
  assert.deepEqual(bad, []);
});

for (const lang of ["zh-hk", "zh-cn"]) {
  test(`every string on the LLOUD pages has its ${lang} translation`, () => {
    const missing = [...new Set(keys().filter((k) => k.key && !(k.key in i18n.MESSAGES[lang])).map((k) => `${k.file.replace(ROOT, "")}: ${k.key}`))];
    assert.deepEqual(missing, []);
  });
  test(`${lang} translations keep the English text's {placeholders}`, () => {
    const off = Object.entries(i18n.MESSAGES[lang]).filter(([en, zh]) => {
      const names = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
      return names(en) !== names(zh);
    }).map(([en]) => en);
    assert.deepEqual(off, []);
  });
}

test("t() falls back to English, fills {names}; the language comes from the cookie, else the browser", () => {
  i18n.resetLang();
  globalThis.document = { cookie: "ztor_lang=zh-hk" };
  i18n.MESSAGES["zh-hk"]["Hello {name}"] = "你好 {name}";
  assert.equal(i18n.t("Hello {name}", { name: "Fanny" }), "你好 Fanny");
  assert.equal(i18n.t("Not translated"), "Not translated");
  delete i18n.MESSAGES["zh-hk"]["Hello {name}"];
  assert.deepEqual([i18n.langFromBrowser(["zh-TW"]), i18n.langFromBrowser(["zh-CN"]), i18n.langFromBrowser(["fr", "en-GB"]), i18n.langFromBrowser(["fr"])], ["zh-hk", "zh-cn", "en-us", null]);
  delete globalThis.document;
  i18n.resetLang();
});
