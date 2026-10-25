import { expect, test } from "bun:test";
import { coalesce } from "../src/web/lib/coalesce";

function gate() {
  let open!: () => void;
  const p = new Promise<void>((r) => (open = r));
  return { p, open };
}

test("a call during a run is not dropped: it triggers one more run", async () => {
  const gates = [gate(), gate()];
  let runs = 0;
  const load = coalesce(async () => {
    await gates[runs++]!.p;
  });
  const first = load();
  load(); // arrives mid-fetch, e.g. an SSE version notice
  load();
  load();
  gates[0]!.open();
  await Bun.sleep(0);
  gates[1]!.open();
  await first;
  expect(runs).toBe(2); // the three mid-run calls collapse into one extra run
});

test("calls after a run finishes start a fresh run", async () => {
  let runs = 0;
  const load = coalesce(async () => {
    runs++;
  });
  await load();
  await load();
  expect(runs).toBe(2);
});

test("a failing run still releases the lock", async () => {
  let runs = 0;
  const load = coalesce(async () => {
    runs++;
    if (runs === 1) throw new Error("network");
  });
  await load().catch(() => {});
  await load();
  expect(runs).toBe(2);
});
