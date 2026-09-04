#!/usr/bin/env node
/**
 * Find interactive controls that are not wired to anything.
 *
 * Every fault of this kind found in the People Builders apps looked the same
 * from the code: a control that renders perfectly and does nothing. A button
 * with no onClick. An input with no value or onChange, so typing in it goes
 * nowhere. A link to "#". A switch with no handler, which flips under the
 * cursor and saves nothing.
 *
 * You cannot see the difference in a screenshot, which is exactly why these
 * survive review. You can see it immediately in the source.
 *
 * Usage: node audit-dead-controls.mjs <src-dir> [more dirs...]
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const roots = process.argv.slice(2);
if (!roots.length) {
  console.error("usage: node audit-dead-controls.mjs <src-dir> [...]");
  process.exit(1);
}

/* What counts as wired, per control. */
const RULES = {
  Button: {
    wired: [/\bonClick=/, /\btype=["']submit["']/, /\basChild\b/],
    why: "no onClick, not a submit button, not wrapping a link",
  },
  Input: {
    wired: [/\bonChange=/, /\bvalue=/, /\bdefaultValue=/, /\breadOnly\b/, /\bdisabled\b/, /\b\{\.\.\./],
    why: "no value and no onChange, so what is typed is discarded",
  },
  Textarea: {
    wired: [/\bonChange=/, /\bvalue=/, /\bdefaultValue=/, /\breadOnly\b/, /\b\{\.\.\./],
    why: "no value and no onChange, so what is typed is discarded",
  },
  Switch: {
    wired: [/\bonCheckedChange=/, /\bdisabled\b/, /\b\{\.\.\./],
    why: "no onCheckedChange, so it flips and saves nothing",
  },
  Checkbox: {
    wired: [/\bonCheckedChange=/, /\bdisabled\b/, /\b\{\.\.\./],
    why: "no onCheckedChange, so it ticks and saves nothing",
  },
};

/* Read a JSX opening tag from `<Name` to its closing `>`, skipping over
   strings and balanced braces so an arrow function in a prop does not end
   the tag early. */
function readTag(src, start) {
  let i = start;
  let depth = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === quote && src[i - 1] !== "\\") quote = null;
    } else if (c === '"' || c === "'" || c === "`") {
      quote = c;
    } else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return src.slice(start, i + 1);
    i++;
  }
  return null;
}

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx|jsx)$/.test(full)) files.push(full);
  }
};
roots.forEach(walk);

const findings = [];

for (const file of files) {
  // The shadcn/ui primitives themselves define these components; they are not
  // pages and have no handlers by design.
  if (/[/\\]components[/\\]ui[/\\]/.test(file)) continue;

  const src = readFileSync(file, "utf8");
  const lineAt = (idx) => src.slice(0, idx).split("\n").length;

  for (const [name, rule] of Object.entries(RULES)) {
    const re = new RegExp(`<${name}(?=[\\s/>])`, "g");
    let m;
    while ((m = re.exec(src))) {
      const tag = readTag(src, m.index);
      if (!tag) continue;
      // A disabled control is not a placeholder. It is deliberately telling
      // somebody they cannot do this yet, which is the opposite failing.
      if (/\bdisabled(\b|=)/.test(tag)) continue;
      if (rule.wired.some((r) => r.test(tag))) continue;
      // A control handed to a Radix trigger, or wrapped in a router Link,
      // gets its behaviour from the parent. Not dead, just delegating.
      const before = src.slice(Math.max(0, m.index - 200), m.index);
      if (/asChild\s*>\s*$/.test(before)) continue;
      if (/<Link\b[^>]*\bto=[^>]*>\s*$/.test(before)) continue;
      findings.push({
        file,
        line: lineAt(m.index),
        control: name,
        why: rule.why,
        snippet: tag.replace(/\s+/g, " ").slice(0, 90),
      });
    }
  }

  // Links and anchors that go nowhere.
  for (const m of src.matchAll(/<(Link|a)\b[^>]*?\b(to|href)=["']#["']/g)) {
    findings.push({
      file,
      line: lineAt(m.index),
      control: m[1] === "a" ? "anchor" : "Link",
      why: 'points at "#", so it looks clickable and goes nowhere',
      snippet: m[0].replace(/\s+/g, " ").slice(0, 90),
    });
  }

  // Forms that cannot submit.
  for (const m of src.matchAll(/<form(?=[\s>])/g)) {
    const tag = readTag(src, m.index);
    if (tag && !/\bonSubmit=/.test(tag) && !/\baction=/.test(tag)) {
      findings.push({
        file,
        line: lineAt(m.index),
        control: "form",
        why: "no onSubmit, so pressing Enter reloads the page and loses the data",
        snippet: tag.replace(/\s+/g, " ").slice(0, 90),
      });
    }
  }
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

const cwd = process.cwd();
let lastFile = null;
for (const f of findings) {
  const rel = relative(cwd, f.file);
  if (rel !== lastFile) {
    console.log(`\n${rel}`);
    lastFile = rel;
  }
  console.log(`  ${String(f.line).padStart(4)}  ${f.control.padEnd(8)} ${f.why}`);
  console.log(`        ${f.snippet}`);
}

console.log(
  `\n${findings.length} unwired control${findings.length === 1 ? "" : "s"} ` +
    `across ${new Set(findings.map((f) => f.file)).size} file(s), ` +
    `${files.length} file(s) scanned.`,
);
process.exit(findings.length ? 1 : 0);
