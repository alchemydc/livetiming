import { Database } from "bun:sqlite";
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeFixture } from "../scripts/make-fixture";
import { NoActiveEventError, readSnapshot } from "../src/server/snapshot";

const dir = mkdtempSync(join(tmpdir(), "lt-snap-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function fixture(name: string, opts = {}) {
  const path = join(dir, name);
  makeFixture(path, opts);
  return path;
}

describe("readSnapshot", () => {
  test("never exposes driver PII", () => {
    const db = new Database(fixture("pii.axdb"), { readonly: true });
    const snap = readSnapshot(db);
    const json = JSON.stringify(snap);
    for (const leaked of ["example.invalid", "555-0100", "Sponsor Co", "Tire Co", "M1000"]) expect(json).not.toContain(leaked);
    expect(Object.keys(snap.drivers[0]!).sort()).toEqual(["carColor", "carModel", "classId", "firstName", "id", "lastName", "number"]);
  });

  test("includes only finished (2) and committed (3) runs", () => {
    const path = fixture("status.axdb", { pendingTail: 3 });
    const w = new Database(path);
    w.run("INSERT INTO runs (event_id, driver_id, start_tick, cones, disposition, status) VALUES (1, 1, 5, 0, '', 0)");
    w.run("INSERT INTO runs (event_id, driver_id, start_tick, cones, disposition, status) VALUES (1, 2, 6, 0, '', 1)");
    w.close();
    const snap = readSnapshot(new Database(path, { readonly: true }));
    expect(new Set(snap.runs.map((r) => r.status))).toEqual(new Set([2, 3]));
    expect(snap.runs.filter((r) => r.status === 2)).toHaveLength(3);
  });

  test("best runs are always clean (VisualAX invariant)", () => {
    const snap = readSnapshot(new Database(fixture("best.axdb", { drivers: 60, seed: 7 }), { readonly: true }));
    const byId = new Map(snap.runs.map((r) => [r.id, r]));
    const bests = Object.values(snap.bestRunByDriver);
    expect(bests.length).toBeGreaterThan(0);
    for (const runId of bests) expect(byId.get(runId)?.disposition).toBe("");
  });

  test("eventKey and version are stable across reopen; version tracks content", () => {
    const path = fixture("stable.axdb");
    const a = readSnapshot(new Database(path, { readonly: true }));
    const b = readSnapshot(new Database(path, { readonly: true }));
    expect(b.eventKey).toBe(a.eventKey);
    expect(b.version).toBe(a.version);

    const w = new Database(path);
    w.run("UPDATE runs SET cones = cones + 1 WHERE id = 1");
    w.close();
    const c = readSnapshot(new Database(path, { readonly: true }));
    expect(c.eventKey).toBe(a.eventKey);
    expect(c.version).not.toBe(a.version);
  });

  test("eventKey differs between events even though both are events.id 1", () => {
    const a = readSnapshot(new Database(fixture("e1.axdb", { eventName: "Event One" }), { readonly: true }));
    const b = readSnapshot(new Database(fixture("e2.axdb", { eventName: "Event Two" }), { readonly: true }));
    expect(a.eventKey).not.toBe(b.eventKey);
  });

  test("throws NoActiveEventError when no event is web_active", () => {
    const db = new Database(fixture("inactive.axdb", { webActive: false }), { readonly: true });
    expect(() => readSnapshot(db)).toThrow(NoActiveEventError);
  });
});
