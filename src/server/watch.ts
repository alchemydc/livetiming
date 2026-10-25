import { Database } from "bun:sqlite";
import { realpathSync, statSync } from "node:fs";
import type { EventSnapshot } from "../shared/types";
import { readSnapshot } from "./snapshot";

export interface SourceStatus {
  dbName: string | null; // basename only; full paths stay in the server log
  version: string | null;
  lastChange: number | null;
  error: string | null; // short code, e.g. SQLITE_BUSY, ENOENT, NO_ACTIVE_EVENT
}

function errorCode(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  return typeof code === "string" ? code : "READ_FAILED";
}

// Polls the .axdb (normally VisualAX's dbSymLink.axdb symlink) and rebuilds
// the snapshot only when the file changes. stat() takes no SQLite lock, so the
// timing app only ever contends with one short read per change.
export class SnapshotSource {
  current: EventSnapshot | null = null;
  status: SourceStatus = { dbName: null, version: null, lastChange: null, error: null };

  private db: Database | null = null;
  private openKey = ""; // realpath + inode of the open connection
  private lastSig = "";
  private dirty = true;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private path: string,
    private onChange: (snap: EventSnapshot) => void = () => {},
    private log: (msg: string) => void = console.error,
  ) {}

  start(intervalMs = 1000) {
    this.tick();
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.db?.close();
    this.db = null;
  }

  tick() {
    let real: string;
    let key: string;
    let sig: string;
    try {
      // Re-resolve every tick: VisualAX removes and re-creates the symlink on each event load.
      real = realpathSync(this.path);
      const st = statSync(real);
      key = `${real}:${st.ino}`;
      sig = `${key}:${st.mtimeMs}:${st.size}`;
    } catch (e) {
      this.fail(e);
      return;
    }
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      this.dirty = true;
    }
    if (!this.dirty) return;

    try {
      if (key !== this.openKey) {
        this.db?.close();
        this.db = null;
        this.db = new Database(real, { readonly: true });
        this.db.exec("PRAGMA busy_timeout = 200");
        this.openKey = key;
        this.status.dbName = real.split("/").pop() ?? null;
      }
      const snap = readSnapshot(this.db!);
      // Only clear dirty after a successful read: in rollback-journal mode the
      // file changes while the writer still holds its lock, so reads can fail.
      this.dirty = false;
      if (this.status.error) this.log(`recovered from ${this.status.error}`);
      this.status.error = null;
      if (snap.version !== this.current?.version) {
        this.current = snap;
        this.status.version = snap.version;
        this.status.lastChange = Date.now();
        this.onChange(snap);
      }
    } catch (e) {
      this.fail(e);
    }
  }

  // Any failure keeps serving the last good snapshot; the next tick retries.
  private fail(e: unknown) {
    const code = errorCode(e);
    if (code !== this.status.error) this.log(`snapshot read failed (${code}) for ${this.path}: ${(e as Error)?.message ?? e}`);
    this.status.error = code;
    this.dirty = true;
  }
}
