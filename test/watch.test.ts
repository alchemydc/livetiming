import { Database } from "bun:sqlite";
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeFixture } from "../scripts/make-fixture";
import { SnapshotSource } from "../src/server/watch";

const dir = mkdtempSync(join(tmpdir(), "lt-watch-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function source(path: string) {
  const changes: string[] = [];
  const src = new SnapshotSource(path, (s) => changes.push(s.version), () => {});
  return { src, changes };
}

describe("SnapshotSource", () => {
  test("emits once per content change, not per tick", () => {
    const path = join(dir, "emit.axdb");
    makeFixture(path);
    const { src, changes } = source(path);
    src.tick();
    src.tick();
    expect(changes).toHaveLength(1);

    const w = new Database(path);
    w.run("UPDATE runs SET cones = 3 WHERE id = 2");
    w.close();
    src.tick();
    expect(changes).toHaveLength(2);
    src.stop();
  });

  test("a read that fails while the writer holds a lock is retried, not lost", () => {
    const path = join(dir, "busy.axdb");
    makeFixture(path);
    const { src } = source(path);
    src.tick();
    const before = src.current!.version;

    const w = new Database(path);
    w.run("UPDATE runs SET cones = 5 WHERE id = 1"); // change A, committed: file stat changes
    w.exec("BEGIN EXCLUSIVE"); // writer now holds the lock
    src.tick(); // sees the stat change, read fails
    expect(src.status.error).toBe("SQLITE_BUSY");
    expect(src.current!.version).toBe(before); // still serving the last good snapshot

    w.exec("ROLLBACK"); // lock released, file unchanged since the failed tick
    src.tick();
    expect(src.status.error).toBeNull();
    expect(src.current!.version).not.toBe(before); // change A was picked up
    expect(src.current!.runs.find((r) => r.id === 1)?.cones).toBe(5);
    w.close();
    src.stop();
  });

  test("survives VisualAX's symlink remove + relink, and detects the new event", () => {
    const a = join(dir, "event-a.axdb");
    const b = join(dir, "event-b.axdb");
    makeFixture(a, { eventName: "Event A" });
    makeFixture(b, { eventName: "Event B", seed: 2 });
    const link = join(dir, "dbSymLink.axdb");
    symlinkSync(a, link);

    const { src } = source(link);
    src.tick();
    const keyA = src.current!.eventKey;
    expect(src.status.dbName).toBe("event-a.axdb");

    unlinkSync(link); // QFile::remove
    src.tick();
    expect(src.status.error).toBe("ENOENT");
    expect(src.current!.eventKey).toBe(keyA);

    symlinkSync(b, link); // QFile::link
    src.tick();
    expect(src.status.error).toBeNull();
    expect(src.current!.eventKey).not.toBe(keyA);
    expect(src.status.dbName).toBe("event-b.axdb");
    src.stop();
  });

  test("keeps the last snapshot when no event is web_active", () => {
    const path = join(dir, "inactive.axdb");
    makeFixture(path);
    const { src } = source(path);
    src.tick();
    const before = src.current!.version;

    const w = new Database(path);
    w.run("UPDATE events SET web_active = 0");
    w.close();
    src.tick();
    expect(src.status.error).toBe("NO_ACTIVE_EVENT");
    expect(src.current!.version).toBe(before);
    src.stop();
  });

  test("starting with a missing file reports ENOENT and has no snapshot", () => {
    const { src } = source(join(dir, "missing.axdb"));
    src.tick();
    expect(src.current).toBeNull();
    expect(src.status.error).toBe("ENOENT");
  });
});
