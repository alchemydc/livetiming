import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseClassesMd } from "../src/shared/classes-md";

test("parses headings, bullets and free text", () => {
  const md = "# Class Descriptions\n\n## TO — Time Only\nSelect TO if you like.\n\n## C1 — Class 1\n- 356 (all)\n- 914 (all)\n";
  const classes = parseClassesMd(md);
  expect([...classes.keys()]).toEqual(["TO", "C1"]);
  expect(classes.get("TO")).toEqual({ title: "Time Only", lines: ["Select TO if you like."] });
  expect(classes.get("C1")).toEqual({ title: "Class 1", lines: ["356 (all)", "914 (all)"] });
});

test("the baked branding file has every PCA class", () => {
  const classes = parseClassesMd(readFileSync(join(import.meta.dir, "../branding/classes.md"), "utf8"));
  expect([...classes.keys()].sort()).toEqual(["C1", "C2", "C3", "C4", "C5", "CS", "TO"]);
  expect(classes.get("C5")!.lines).toContain("918");
});
