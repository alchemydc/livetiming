import { Database } from "bun:sqlite";
import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeFixture } from "../scripts/make-fixture";
import { readSnapshot } from "../src/server/snapshot";
import { SnapshotSource } from "../src/server/watch";

const dir = mkdtempSync(join(tmpdir(), "lt-contention-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// The writer runs in its own process, as VisualAX does, while the poller ticks
// far faster than production (5ms vs 1s) to maximise lock overlap.
test("a VisualAX-like writer never fails, and the poller converges with no lost updates", async () => {
  const path = join(dir, "event.axdb");
  makeFixture(path, { drivers: 20, runsPerDriver: 2 });

  const versions: string[] = [];
  const errors: string[] = [];
  const source = new SnapshotSource(path, (s) => versions.push(s.version), (m) => errors.push(m));
  source.tick();
  const timer = setInterval(() => source.tick(), 5);

  const writer = Bun.spawn(["bun", join(import.meta.dir, "../scripts/simulate-writer.ts"), path, "--runs", "80", "--interval", "1"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await writer.exited;
  const stderr = await new Response(writer.stderr).text();
  clearInterval(timer);

  expect(stderr).toBe("");
  expect(exitCode).toBe(0);

  source.tick();
  const truth = readSnapshot(new Database(path, { readonly: true }));
  expect(source.current!.version).toBe(truth.version);
  expect(source.status.error).toBeNull();
  expect(versions.length).toBeGreaterThan(10); // it really tracked the event live
  console.log(`poller saw ${versions.length} versions; transient read errors logged: ${errors.length}`);
  source.stop();
}, 60000);
