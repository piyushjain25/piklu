"use strict";
/* _ref/snippets.md is a copy-paste reference — a second copy of real markup, which goes stale
   silently unless something checks it. This does: every block that names a source range must
   still match that range byte for byte, section 9 must list exactly the globals site.js
   defines (both directions, so a new helper can't be missed), and every class in section 10
   must exist in site.css. On any failure the REAL file is right and the snippet is stale. */
const { read, tally } = require("../lib/harness.js");
const { ok, report } = tally();

const md = read("_ref/snippets.md");
const STALE = " — _ref/snippets.md is stale: run `node _ref/build-snippets.js` (the real file is correct;"
  + " for sections 9/10, or an anchor that moved, edit _ref/build-snippets.js first)";

/* ---- 1. every sourced block matches its range, byte for byte ---- */
const blocks = [...md.matchAll(/^Source: `([^`]+)` lines (\d+)-(\d+)\n```[a-z]*\n([\s\S]*?)\n```$/gm)];
const declared = (md.match(/^Source: /gm) || []).length;
ok(blocks.length >= 15, "expected the sourced snippet blocks, found " + blocks.length);
ok(blocks.length === declared, declared + " 'Source:' lines but only " + blocks.length + " parse as a range + code block" + STALE);
for (const [, file, a, b, body] of blocks) {
  let real;
  try { real = read(file).split("\n"); } catch (e) { ok(false, file + " no longer exists" + STALE); continue; }
  const want = real.slice(+a - 1, +b).join("\n");
  if (want === body) { ok(true, ""); continue; }
  const got = body.split("\n"), exp = want.split("\n");
  const i = got.findIndex((l, k) => l !== exp[k]);
  ok(false, file + " lines " + a + "-" + b + " changed (first difference at line " + (+a + Math.max(0, i)) + ": "
    + JSON.stringify((exp[i] || "").slice(0, 70)) + ")" + STALE);
}

/* ---- 2. section 9 lists exactly the globals site.js defines ---- */
function section(n) {
  const at = md.indexOf("\n## " + n + ". ");
  const next = md.indexOf("\n## ", at + 4);
  const body = md.slice(at, next < 0 ? md.length : next);
  const m = body.match(/```text\n([\s\S]*?)\n```/);
  return m ? m[1] : "";
}
const listed = section(9).split("\n").map(l => l.trim().split(/[\s(]/)[0]).filter(Boolean);
const siteJS = read("assets/site.js");
const defined = new Set();
for (const m of siteJS.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) defined.add(m[1]);
for (const m of siteJS.matchAll(/^(?:const|let|var)\s+([^;]*)/gm))       /* `let a = 1, b = 2` names both */
  for (const d of m[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*=/g)) defined.add(d[1]);
ok(listed.length > 20, "section 9 should list the site.js globals, found " + listed.length);
for (const n of listed) ok(defined.has(n), "section 9 lists " + n + ", which assets/site.js no longer defines" + STALE);
for (const n of defined) ok(listed.includes(n), "assets/site.js defines " + n + ", missing from section 9" + STALE);

/* ---- 3. every class in section 10 is defined in site.css ---- */
const css = read("assets/site.css").replace(/\/\*[\s\S]*?\*\//g, "");
const cssClasses = new Set();
for (const m of css.matchAll(/([^{}]+)\{/g))
  if (!m[1].trim().startsWith("@")) for (const c of m[1].matchAll(/\.([A-Za-z][\w-]*)/g)) cssClasses.add(c[1]);
const classes = section(10).split("\n").flatMap(l => l.slice(l.indexOf(":") + 1).trim().split(/\s+/)).filter(Boolean);
ok(classes.length > 50, "section 10 should list the shared classes, found " + classes.length);
for (const c of classes) ok(cssClasses.has(c), "section 10 lists ." + c + ", which assets/site.css does not define" + STALE);

report("_ref/snippets.md matches the real files");
