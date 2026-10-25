// Pure derivations from an EventSnapshot. Semantics follow the PHP UI this
// replaces and VisualAX itself (runresults.h/.cpp, database.cpp).
import type { EventSnapshot, SnapClass, SnapDriver, SnapRun } from "./types";
import { STATUS_PENDING } from "./types";

export const CONE_PENALTY = 2; // seconds per cone, runresults.h coneTimePenalty

export function rawTime(run: SnapRun): number | null {
  if (run.startTick == null || run.finishTick == null) return null;
  return (run.finishTick - run.startTick) / 1000;
}

export function penaltyTime(run: SnapRun): number | null {
  const raw = rawTime(run);
  return raw == null ? null : raw + CONE_PENALTY * run.cones;
}

export function formatTime(t: number | null): string {
  return t == null ? "---.---" : t.toFixed(3);
}

export const isPending = (run: SnapRun) => run.status === STATUS_PENDING;

export interface Lookup {
  driver: Map<number, SnapDriver>;
  cls: Map<number, SnapClass>;
  run: Map<number, SnapRun>;
}

export function lookup(snap: EventSnapshot): Lookup {
  return {
    driver: new Map(snap.drivers.map((d) => [d.id, d])),
    cls: new Map(snap.classes.map((c) => [c.id, c])),
    run: new Map(snap.runs.map((r) => [r.id, r])),
  };
}

// SQLite's `ORDER BY number*1, number`: numeric prefix first ("8X" -> 8, "X" -> 0), then text.
export function compareCarNumbers(a: string, b: string): number {
  const na = parseFloat(a) || 0;
  const nb = parseFloat(b) || 0;
  if (na !== nb) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function driversByNumber(snap: EventSnapshot): SnapDriver[] {
  return [...snap.drivers].sort((a, b) => compareCarNumbers(a.number, b.number));
}

export interface DriverRun {
  run: SnapRun;
  runNo: number | null; // null for RRN: reruns don't use up a run number
  isBest: boolean;
}

export function driverRuns(snap: EventSnapshot, driverId: number): DriverRun[] {
  const best = snap.bestRunByDriver[String(driverId)];
  let n = 0;
  return snap.runs
    .filter((r) => r.driverId === driverId)
    .map((run) => ({
      run,
      runNo: run.disposition === "RRN" ? null : ++n,
      isBest: run.id === best,
    }));
}

export interface StandingRow {
  position: number;
  driver: SnapDriver;
  cls: SnapClass | undefined;
  run: SnapRun;
}

// Standings rank each driver's registrations.bestpendingrun_id run. Do not
// recompute the best run here: VisualAX chooses it by *paxed* penalty time
// within num_runs (runresults.cpp isThisRunBetter), which can differ from the
// fastest raw penalty time when a class pax != 1.0. The list itself is sorted by
// raw penalty time, matching the PHP UI. The disposition filter mirrors
// VisualAX's own position query (database.cpp, `WHERE runs.disposition = ''`).
export function standings(snap: EventSnapshot, include: (d: SnapDriver) => boolean = () => true): StandingRow[] {
  const L = lookup(snap);
  const rows: Omit<StandingRow, "position">[] = [];
  for (const [driverId, runId] of Object.entries(snap.bestRunByDriver)) {
    const driver = L.driver.get(Number(driverId));
    const run = L.run.get(runId);
    if (!driver || !run || run.disposition !== "" || penaltyTime(run) == null || !include(driver)) continue;
    rows.push({ driver, cls: L.cls.get(driver.classId), run });
  }
  rows.sort((a, b) => penaltyTime(a.run)! - penaltyTime(b.run)! || a.run.id - b.run.id);
  return rows.map((r, i) => ({ ...r, position: i + 1 }));
}

export function classStandings(snap: EventSnapshot, classId: number): StandingRow[] {
  return standings(snap, (d) => d.classId === classId);
}

export function friendsStandings(snap: EventSnapshot, meId: number, friendIds: readonly number[]): StandingRow[] {
  const ids = new Set([meId, ...friendIds]);
  return standings(snap, (d) => ids.has(d.id));
}

export function lastRuns(snap: EventSnapshot, n = 12): SnapRun[] {
  return n > 0 ? snap.runs.slice(-n).reverse() : [];
}

export function reruns(snap: EventSnapshot): SnapRun[] {
  return snap.runs.filter((r) => r.disposition === "RRN");
}
