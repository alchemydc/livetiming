import type { Database } from "bun:sqlite";
import type { EventSnapshot, SnapClass, SnapDriver, SnapEvent, SnapRun } from "../shared/types";

export class NoActiveEventError extends Error {
  code = "NO_ACTIVE_EVENT";
}

function hash(s: string): string {
  return new Bun.CryptoHasher("sha256").update(s).digest("hex").slice(0, 16);
}

// Reads the web-active event in one read transaction so every table is from
// the same committed state. Every query is static: no request input reaches SQL.
export function readSnapshot(db: Database): EventSnapshot {
  const read = db.transaction(() => {
    const ev = db
      .query<{ id: number; org_name: string; event_name: string; event_date: string; num_runs: number }, []>(
        "SELECT id, org_name, event_name, event_date, num_runs FROM events WHERE web_active = 1 LIMIT 1",
      )
      .get();
    if (!ev) throw new NoActiveEventError("no event has web_active = 1");

    const classes = db
      .query<SnapClass, []>("SELECT id, class_name AS name, pax FROM classes ORDER BY class_name")
      .all();

    // Explicit column list: email, cellphone, member_num, sponsor and tire stay on the NUC.
    const drivers = db
      .query<SnapDriver, [number]>(
        `SELECT drivers.id AS id, first_name AS firstName, last_name AS lastName, number,
                class_id AS classId, COALESCE(car_model, '') AS carModel, COALESCE(car_color, '') AS carColor
         FROM drivers JOIN registrations ON registrations.driver_id = drivers.id
         WHERE registrations.event_id = ?
         ORDER BY drivers.id`,
      )
      .all(ev.id);

    const runs = db
      .query<SnapRun, [number]>(
        `SELECT id, driver_id AS driverId, start_tick AS startTick, finish_tick AS finishTick,
                COALESCE(cones, 0) AS cones, COALESCE(disposition, '') AS disposition, status
         FROM runs WHERE event_id = ? AND status IN (2, 3)
         ORDER BY id`,
      )
      .all(ev.id);

    const best = db
      .query<{ driverId: number; runId: number }, [number]>(
        `SELECT driver_id AS driverId, bestpendingrun_id AS runId FROM registrations
         WHERE event_id = ? AND bestpendingrun_id IS NOT NULL ORDER BY driver_id`,
      )
      .all(ev.id);

    return { ev, classes, drivers, runs, best };
  });

  const { ev, classes, drivers, runs, best } = read();
  const event: SnapEvent = { orgName: ev.org_name, eventName: ev.event_name, eventDate: ev.event_date, numRuns: ev.num_runs };
  const body = {
    eventKey: hash(`${ev.org_name}|${ev.event_name}|${ev.event_date}`),
    event,
    classes,
    drivers,
    runs,
    bestRunByDriver: Object.fromEntries(best.map((b) => [String(b.driverId), b.runId])),
  };
  return { ...body, version: hash(JSON.stringify(body)) };
}
