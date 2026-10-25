import { describe, expect, test } from "bun:test";
import {
  classStandings,
  compareCarNumbers,
  driverRuns,
  driversByNumber,
  formatTime,
  friendsStandings,
  lastRuns,
  penaltyTime,
  rawTime,
  reruns,
  standings,
} from "../src/shared/scoring";
import type { EventSnapshot, SnapDriver, SnapRun } from "../src/shared/types";

let nextRun = 1;
function run(driverId: number, seconds: number, extra: Partial<SnapRun> = {}): SnapRun {
  const startTick = 1000;
  return { id: nextRun++, driverId, startTick, finishTick: startTick + Math.round(seconds * 1000), cones: 0, disposition: "", status: 3, ...extra };
}

function driver(id: number, number: string, classId = 1): SnapDriver {
  return { id, firstName: `F${id}`, lastName: `L${id}`, number, classId, carModel: "", carColor: "" };
}

function snap(drivers: SnapDriver[], runs: SnapRun[], best: Record<number, number>): EventSnapshot {
  return {
    eventKey: "k",
    version: "v",
    event: { orgName: "o", eventName: "e", eventDate: "2026-01-01", numRuns: 6 },
    classes: [
      { id: 1, name: "C1", pax: 1 },
      { id: 2, name: "C2", pax: 0.9 },
    ],
    drivers,
    runs: [...runs].sort((a, b) => a.id - b.id),
    bestRunByDriver: Object.fromEntries(Object.entries(best).map(([d, r]) => [d, r])),
  };
}

describe("times", () => {
  test("raw and penalty times use ticks/1000 and 2s per cone", () => {
    const r = run(1, 50.123, { cones: 2 });
    expect(rawTime(r)).toBeCloseTo(50.123, 6);
    expect(penaltyTime(r)).toBeCloseTo(54.123, 6);
  });

  test("missing ticks give no time", () => {
    const r = run(1, 50, { finishTick: null });
    expect(rawTime(r)).toBeNull();
    expect(formatTime(rawTime(r))).toBe("---.---");
    expect(formatTime(49.5)).toBe("49.500");
  });
});

describe("car number order (SQLite number*1, number)", () => {
  test.each([
    [["10", "2", "8X", "8", "0"], ["0", "2", "8", "8X", "10"]],
    [["X1", "1", "A"], ["A", "X1", "1"]],
  ])("%p sorts to %p", (input, expected) => {
    expect([...input].sort(compareCarNumbers)).toEqual(expected);
  });

  test("driversByNumber", () => {
    const s = snap([driver(1, "15"), driver(2, "8X"), driver(3, "8")], [], {});
    expect(driversByNumber(s).map((d) => d.number)).toEqual(["8", "8X", "15"]);
  });
});

describe("driverRuns", () => {
  test("RRN runs don't consume a run number; best follows bestpendingrun_id", () => {
    const r1 = run(1, 52);
    const r2 = run(1, 51, { disposition: "RRN" });
    const r3 = run(1, 50, { cones: 1 });
    const r4 = run(1, 49, { status: 2 });
    const r5 = run(2, 40);
    const s = snap([driver(1, "1"), driver(2, "2")], [r1, r2, r3, r4, r5], { 1: r4.id });
    const rows = driverRuns(s, 1);
    expect(rows.map((r) => r.runNo)).toEqual([1, null, 2, 3]);
    expect(rows.map((r) => r.isBest)).toEqual([false, false, false, true]);
  });
});

describe("standings", () => {
  test("rank best runs by raw penalty time; drivers without a best run are omitted", () => {
    const a = run(1, 50, { cones: 1 }); // 52
    const b = run(2, 51); // 51
    const c = run(3, 60);
    const s = snap([driver(1, "1"), driver(2, "2"), driver(3, "3"), driver(4, "4")], [a, b, c], { 1: a.id, 2: b.id, 3: c.id });
    const rows = standings(s);
    expect(rows.map((r) => [r.position, r.driver.id])).toEqual([[1, 2], [2, 1], [3, 3]]);
  });

  test("uses VisualAX's chosen best run even when another run is faster raw (pax != 1)", () => {
    // VisualAX picks by paxed time; within num_runs only. Trust its choice.
    const chosen = run(1, 50);
    const fasterButNotChosen = run(1, 48);
    const s = snap([driver(1, "1", 2)], [chosen, fasterButNotChosen], { 1: chosen.id });
    expect(standings(s)[0]!.run.id).toBe(chosen.id);
  });

  test("a best run with a disposition is excluded (belt and braces)", () => {
    const dnf = run(1, 40, { disposition: "DNF" });
    const ok = run(2, 50);
    const s = snap([driver(1, "1"), driver(2, "2")], [dnf, ok], { 1: dnf.id, 2: ok.id });
    expect(standings(s).map((r) => r.driver.id)).toEqual([2]);
  });

  test("pending best runs stay in the standings", () => {
    const p = run(1, 45, { status: 2 });
    const s = snap([driver(1, "1")], [p], { 1: p.id });
    expect(standings(s)[0]!.run.status).toBe(2);
  });

  test("ties keep the earlier run first", () => {
    const a = run(1, 50);
    const b = run(2, 50);
    const s = snap([driver(2, "2"), driver(1, "1")], [a, b], { 2: b.id, 1: a.id });
    expect(standings(s).map((r) => r.driver.id)).toEqual([1, 2]);
  });

  test("class and friends filters", () => {
    const a = run(1, 50);
    const b = run(2, 49);
    const c = run(3, 48);
    const s = snap([driver(1, "1", 1), driver(2, "2", 2), driver(3, "3", 1)], [a, b, c], { 1: a.id, 2: b.id, 3: c.id });
    expect(classStandings(s, 1).map((r) => [r.position, r.driver.id])).toEqual([[1, 3], [2, 1]]);
    expect(friendsStandings(s, 1, [2]).map((r) => r.driver.id)).toEqual([2, 1]);
  });
});

describe("lastRuns and reruns", () => {
  test("lastRuns returns the newest N runs, newest first", () => {
    const runs = [run(1, 50), run(2, 51), run(1, 52), run(2, 53)];
    const s = snap([driver(1, "1"), driver(2, "2")], runs, {});
    expect(lastRuns(s, 2).map((r) => r.id)).toEqual([runs[3]!.id, runs[2]!.id]);
    expect(lastRuns(s, 0)).toEqual([]);
    expect(lastRuns(s, 99)).toHaveLength(4);
  });

  test("reruns are RRN runs in run order", () => {
    const runs = [run(1, 50, { disposition: "RRN" }), run(2, 51), run(2, 52, { disposition: "RRN" })];
    const s = snap([driver(1, "1"), driver(2, "2")], runs, {});
    expect(reruns(s).map((r) => r.id)).toEqual([runs[0]!.id, runs[2]!.id]);
  });
});
