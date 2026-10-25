// Generate a synthetic .axdb with the real VisualAX schema and fake people.
// Used by tests, the dev server and simulate-writer. Never use real event
// databases for fixtures: they contain names, emails and phone numbers.
//
//   bun scripts/make-fixture.ts out.axdb [--drivers 40] [--seed 1] [--event "Name"]
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

export const CONE_PENALTY = 2;

export interface FixtureOptions {
  orgName?: string;
  eventName?: string;
  eventDate?: string;
  drivers?: number;
  runsPerDriver?: number; // attempts per driver, before reruns
  numRuns?: number; // events.num_runs (runs that count)
  seed?: number;
  pax?: Record<string, number>; // class_name -> pax
  pendingTail?: number; // leave the last N runs at status 2
  webActive?: boolean;
}

const FIRST = ["Avery", "Blake", "Casey", "Devon", "Emerson", "Finley", "Gray", "Harper", "Indy", "Jordan", "Kai", "Logan", "Morgan", "Noel", "Oakley", "Parker", "Quinn", "Riley", "Sage", "Taylor", "Umber", "Vale", "Wren", "Xen", "Yael", "Zion"];
const LAST = ["Apex", "Brakewell", "Camber", "Downforce", "Esses", "Fastline", "Gearhart", "Hairpin", "Ignition", "Junction", "Kerbs", "Lockwood", "Midcorner", "Northlap", "Oversteer", "Pitlane", "Quickshift", "Redline", "Slalom", "Torque", "Understeer", "Vortex", "Wheelbase", "Yawrate", "Zenith"];
const CARS = ["911 Carrera", "Cayman S", "Boxster", "718 GTS", "944 Turbo", "Macan", "GT3", "914", "356C", "Taycan"];
const COLORS = ["Guards Red", "Arctic Silver", "Black", "Racing Yellow", "Miami Blue", "White", "Python Green"];
const CLASSES = ["C1", "C2", "C3", "C4", "C5", "CS", "TO"];

// Small deterministic PRNG (mulberry32) so fixtures are reproducible.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeFixture(path: string, opts: FixtureOptions = {}): void {
  const o = {
    orgName: "Example Region",
    eventName: "Fixture Autocross",
    eventDate: "2026-05-16",
    drivers: 40,
    runsPerDriver: 6,
    numRuns: 6,
    seed: 1,
    pax: {} as Record<string, number>,
    pendingTail: 0,
    webActive: true,
    ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)),
  };
  const rand = rng(o.seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;

  mkdirSync(dirname(path), { recursive: true });
  for (const f of [path, `${path}-journal`]) if (existsSync(f)) rmSync(f);
  const db = new Database(path, { create: true });
  db.exec(readFileSync(join(import.meta.dir, "../test/fixtures/schema.sql"), "utf8"));

  db.run(
    "INSERT INTO events (event_name, event_date, num_runs, mirrored, unique_numbers, org_name, timing_mode, typical_time, web_active, run_timestamp) VALUES (?, ?, ?, 0, 0, ?, 0, 60.0, ?, 0)",
    [o.eventName, o.eventDate, o.numRuns, o.orgName, o.webActive ? 1 : 0],
  );
  const eventId = 1;

  const classIds = new Map<string, number>();
  for (const name of CLASSES) {
    const r = db.run("INSERT INTO classes (class_name, paxed_class, pax, run_timestamp) VALUES (?, 0, ?, 0)", [name, o.pax[name] ?? 1.0]);
    classIds.set(name, Number(r.lastInsertRowid));
  }
  const paxById = new Map([...classIds].map(([name, id]) => [id, o.pax[name] ?? 1.0]));

  // Drivers, each with fake PII so tests can prove it never leaves the server.
  const drivers: { id: number; classId: number; base: number }[] = [];
  const usedNumbers = new Set<string>();
  for (let i = 0; i < o.drivers; i++) {
    let number: string;
    do number = String(1 + Math.floor(rand() * 99)) + (rand() < 0.08 ? "X" : "");
    while (usedNumbers.has(number));
    usedNumbers.add(number);
    const classId = classIds.get(pick(CLASSES))!;
    const first = pick(FIRST);
    const last = pick(LAST);
    const r = db.run(
      "INSERT INTO drivers (last_name, first_name, number, class_id, paxmult_id, car_model, car_color, member_num, sponsor, tire, email, cellphone, member, registered, icon_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'red')",
      [last, first, number, classId, classId, pick(CARS), pick(COLORS), `M${1000 + i}`, "Sponsor Co", "Tire Co", `${first}.${last}@example.invalid`.toLowerCase(), "555-0100"],
    );
    drivers.push({ id: Number(r.lastInsertRowid), classId, base: 45000 + rand() * 15000 });
  }

  // Runs in heat order: everyone's run 1, then run 2, ... An RRN earns an extra attempt.
  type Run = { id: number; driverId: number; ticks: number; cones: number; disposition: string; status: number };
  const runs: Run[] = [];
  const attempts = new Map(drivers.map((d) => [d.id, o.runsPerDriver]));
  let tick = 100000;
  for (let round = 0; [...attempts.values()].some((n) => n > 0); round++) {
    for (const d of drivers) {
      if (attempts.get(d.id)! <= 0) continue;
      attempts.set(d.id, attempts.get(d.id)! - 1);
      const roll = rand();
      const disposition = roll < 0.05 ? "DNF" : roll < 0.09 ? "RRN" : "";
      if (disposition === "RRN") attempts.set(d.id, attempts.get(d.id)! + 1);
      const ticks = Math.round(d.base * (1.08 - round * 0.012) + rand() * 2500);
      const cones = rand() < 0.25 ? 1 + Math.floor(rand() * 2) : 0;
      const r = db.run(
        "INSERT INTO runs (event_id, driver_id, start_at, finish_at, start_tick, finish_tick, cones, disposition, status) VALUES (?, ?, 0, 0, ?, ?, ?, ?, 3)",
        [eventId, d.id, tick, tick + ticks, cones, disposition],
      );
      runs.push({ id: Number(r.lastInsertRowid), driverId: d.id, ticks, cones, disposition, status: 3 });
      tick += ticks + 15000;
    }
  }
  for (const r of runs.slice(runs.length - o.pendingTail)) {
    r.status = 2;
    db.run("UPDATE runs SET status = 2 WHERE id = ?", [r.id]);
  }

  // Best runs, the way VisualAX picks them (runresults.cpp isThisRunBetter):
  // clean disposition, within num_runs (RRNs don't count), lowest paxed penalty time.
  for (const d of drivers) {
    const pax = paxById.get(d.classId)!;
    let runNo = 0;
    let committed: Run | undefined;
    let pending: Run | undefined;
    const score = (r: Run) => (r.ticks / 1000) * pax + CONE_PENALTY * r.cones;
    for (const r of runs.filter((x) => x.driverId === d.id)) {
      if (r.disposition !== "RRN") runNo++;
      if (r.disposition !== "" || runNo > o.numRuns) continue;
      if (r.status === 3 && (!committed || score(r) < score(committed))) committed = r;
      if (!pending || score(r) < score(pending)) pending = r;
    }
    db.run(
      "INSERT INTO registrations (driver_id, event_id, bestcommittedrun_id, bestcommittedrun_no, bestpendingrun_id, run_timestamp) VALUES (?, ?, ?, NULL, ?, 0)",
      [d.id, eventId, committed?.id ?? null, pending?.id ?? null],
    );
  }
  db.close();
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      drivers: { type: "string" },
      seed: { type: "string" },
      event: { type: "string" },
      date: { type: "string" },
      pending: { type: "string" },
    },
  });
  const out = positionals[0];
  if (!out) throw new Error("usage: bun scripts/make-fixture.ts <out.axdb> [--drivers N] [--seed N] [--event NAME] [--date YYYY-MM-DD] [--pending N]");
  makeFixture(out, {
    drivers: values.drivers ? Number(values.drivers) : undefined,
    seed: values.seed ? Number(values.seed) : undefined,
    eventName: values.event,
    eventDate: values.date,
    pendingTail: values.pending ? Number(values.pending) : undefined,
  });
  console.log(`wrote ${out}`);
}
