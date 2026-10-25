// Drive a fixture .axdb the way VisualAX does during an event, for live-update
// and lock-contention testing. Mirrors database.cpp: runQueue, runStart,
// runFinish and runCommit each run `BEGIN; UPDATE runs; UPDATE registrations;
// COMMIT;`, and finish/commit then bump run_timestamp on events, registrations
// and classes as separate autocommit statements (updateRunTimestamps).
//
//   bun scripts/simulate-writer.ts event.axdb [--runs 50] [--interval 1500]
import { Database } from "bun:sqlite";
import { parseArgs } from "node:util";
import { CONE_PENALTY } from "./make-fixture";

export interface SimOptions {
  runs?: number; // runs to complete
  intervalMs?: number; // pause between lifecycle steps
  seed?: number;
}

export async function simulate(path: string, opts: SimOptions = {}): Promise<void> {
  const { runs = 50, intervalMs = 1500 } = opts;
  let a = (opts.seed ?? 42) >>> 0;
  const rand = () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296);

  const db = new Database(path);
  db.exec("PRAGMA journal_mode = DELETE");
  db.exec("PRAGMA busy_timeout = 5000"); // QSQLITE's default busy timeout

  const ev = db.query<{ id: number; num_runs: number }, []>("SELECT id, num_runs FROM events WHERE web_active = 1").get()!;
  const drivers = db
    .query<{ id: number; class_id: number; pax: number }, [number]>(
      `SELECT drivers.id, drivers.class_id, classes.pax FROM drivers
       JOIN registrations ON registrations.driver_id = drivers.id JOIN classes ON classes.id = drivers.paxmult_id
       WHERE registrations.event_id = ? ORDER BY drivers.id`,
    )
    .all(ev.id);
  let tick = db.query<{ t: number | null }, []>("SELECT MAX(finish_tick) AS t FROM runs").get()?.t ?? 0;

  const txn = (runSql: string, runArgs: (number | string | null)[], regSql: string, regArgs: (number | null)[]) => {
    db.exec("BEGIN TRANSACTION");
    const r = db.run(runSql, runArgs);
    db.run(regSql, regArgs);
    db.exec("COMMIT");
    return r;
  };
  const stamp = (driverId: number, classId: number) => {
    const now = Date.now();
    db.run("UPDATE events SET run_timestamp = ? WHERE id = ?", [now, ev.id]);
    db.run("UPDATE registrations SET run_timestamp = ? WHERE event_id = ? AND driver_id = ?", [now, ev.id, driverId]);
    db.run("UPDATE classes SET run_timestamp = ? WHERE id = ?", [now, classId]);
  };
  const committedScore = (driverId: number, pax: number) => {
    const best = db
      .query<{ t: number; cones: number }, [number, number]>(
        `SELECT finish_tick - start_tick AS t, cones FROM registrations JOIN runs ON runs.id = registrations.bestcommittedrun_id
         WHERE registrations.event_id = ? AND registrations.driver_id = ?`,
      )
      .get(ev.id, driverId);
    return best ? (best.t / 1000) * pax + CONE_PENALTY * best.cones : Infinity;
  };
  const runNumber = (driverId: number) =>
    db.query<{ n: number }, [number, number]>("SELECT COUNT(*) AS n FROM runs WHERE event_id = ? AND driver_id = ? AND status >= 2 AND disposition <> 'RRN'").get(ev.id, driverId)!.n;

  for (let i = 0; i < runs; i++) {
    const d = drivers[i % drivers.length]!;
    const where = "WHERE event_id = ? AND driver_id = ?";

    const q = txn("INSERT INTO runs (event_id, driver_id, status) VALUES (?, ?, 0)", [ev.id, d.id], `UPDATE registrations SET bestpendingrun_id = bestcommittedrun_id ${where}`, [ev.id, d.id]);
    const runId = Number(q.lastInsertRowid);
    await Bun.sleep(intervalMs);

    tick += 20000;
    const start = tick;
    txn("UPDATE runs SET status = 1, start_at = ?, start_tick = ? WHERE id = ?", [Math.floor(Date.now() / 1000), start, runId], `UPDATE registrations SET bestpendingrun_id = bestcommittedrun_id ${where}`, [ev.id, d.id]);
    await Bun.sleep(intervalMs);

    const ticks = Math.round(45000 + rand() * 15000);
    tick = start + ticks;
    const cones = rand() < 0.25 ? 1 : 0;
    const roll = rand();
    const disposition = roll < 0.05 ? "DNF" : roll < 0.08 ? "RRN" : "";
    const no = runNumber(d.id) + (disposition === "RRN" ? 0 : 1);
    const isBest = disposition === "" && no <= ev.num_runs && (ticks / 1000) * d.pax + CONE_PENALTY * cones < committedScore(d.id, d.pax);
    txn(
      "UPDATE runs SET status = 2, finish_at = ?, finish_tick = ?, cones = ?, disposition = ? WHERE id = ?",
      [Math.floor(Date.now() / 1000), tick, cones, disposition, runId],
      `UPDATE registrations SET ${isBest ? "bestpendingrun_id = ?" : "bestpendingrun_id = bestcommittedrun_id"} ${where}`,
      isBest ? [runId, ev.id, d.id] : [ev.id, d.id],
    );
    stamp(d.id, d.class_id);
    await Bun.sleep(intervalMs);

    txn(
      "UPDATE runs SET status = 3, cones = ?, disposition = ? WHERE id = ?",
      [cones, disposition, runId],
      `UPDATE registrations SET ${isBest ? "bestcommittedrun_id = ?, bestpendingrun_id = ?, bestcommittedrun_no = ?" : "bestpendingrun_id = bestcommittedrun_id"} ${where}`,
      isBest ? [runId, runId, no, ev.id, d.id] : [ev.id, d.id],
    );
    stamp(d.id, d.class_id);
    await Bun.sleep(intervalMs);
  }
  db.close();
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { runs: { type: "string" }, interval: { type: "string" }, seed: { type: "string" } },
  });
  const path = positionals[0];
  if (!path) throw new Error("usage: bun scripts/simulate-writer.ts <event.axdb> [--runs N] [--interval MS] [--seed N]");
  await simulate(path, {
    runs: values.runs ? Number(values.runs) : undefined,
    intervalMs: values.interval ? Number(values.interval) : undefined,
    seed: values.seed ? Number(values.seed) : undefined,
  });
}
