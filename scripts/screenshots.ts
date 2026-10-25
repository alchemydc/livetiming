// Screenshot every route at phone and desktop widths, in light and dark, and
// run an axe accessibility scan on each. Needs a built dist/ (bun scripts/build.ts --no-compile)
// and a fixture (bun run fixture). Output: out/screens/*.png
//
//   bun scripts/screenshots.ts [route ...]
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { EventSnapshot } from "../src/shared/types";

const root = join(import.meta.dir, "..");
const outDir = join(root, "out/screens");
mkdirSync(outDir, { recursive: true });

const port = 18090;
const server = Bun.spawn(["bun", "src/server/index.ts", "--db", "dev/event.axdb", "--port", String(port), "--host", "127.0.0.1"], {
  cwd: root,
  stdout: "ignore",
  stderr: "inherit",
});
const base = `http://127.0.0.1:${port}`;

try {
  let snap: EventSnapshot | undefined;
  for (let i = 0; i < 50 && !snap; i++) {
    snap = await fetch(`${base}/api/snapshot`)
      .then((r) => (r.ok ? (r.json() as Promise<EventSnapshot>) : undefined))
      .catch(() => undefined);
    if (!snap) await Bun.sleep(100);
  }
  if (!snap) throw new Error("server did not come up");

  // "Me" is the driver of the newest pending run, so pending/cones/you all show.
  const pending = [...snap.runs].reverse().find((r) => r.status === 2);
  const meId = pending?.driverId ?? snap.drivers[0]!.id;

  const routes = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/me", "/overall"];
  const viewports = [
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ];
  const browser = await chromium.launch();
  let violations = 0;
  for (const theme of ["light", "dark"] as const) {
    for (const vp of viewports) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
      const friends = snap.drivers.filter((d) => d.id !== meId).slice(0, 3).map((d) => d.id);
      await ctx.addInitScript(
        ([key, me, t, f]) => {
          localStorage.setItem(`lt:${key}:me`, String(me));
          localStorage.setItem(`lt:${key}:friends`, f);
          localStorage.setItem("lt:theme", t);
        },
        [snap.eventKey, meId, theme, JSON.stringify(friends)] as const,
      );
      const page = await ctx.newPage();
      for (const route of routes) {
        await page.goto(base + route, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        const file = `${route === "/" ? "picker" : route.slice(1).replaceAll("/", "-")}-${vp.name}-${theme}.png`;
        await page.screenshot({ path: join(outDir, file) });
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        for (const v of axe.violations) {
          violations++;
          console.log(`axe ${file}: ${v.id} (${v.impact}) ${v.nodes.length}x ${v.nodes[0]?.target.join(" ")}`);
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`screenshots in ${outDir}; axe violations: ${violations}`);
} finally {
  server.kill();
}
