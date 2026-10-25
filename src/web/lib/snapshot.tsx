import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EventSnapshot, SnapRun } from "@shared/types";
import { getMe, setMe as storeMe } from "./storage";

export type Connection = "connecting" | "live" | "reconnecting";

interface SnapshotState {
  snap: EventSnapshot | null;
  error: string | null; // server error code when no snapshot is available
  connection: Connection;
  freshRunIds: ReadonlySet<number>; // runs added or changed by the latest update
  meId: number | null;
  setMe: (driverId: number | null) => void;
}

const Ctx = createContext<SnapshotState | null>(null);

function changedRuns(prev: EventSnapshot | null, next: EventSnapshot): Set<number> {
  if (!prev || prev.eventKey !== next.eventKey) return new Set();
  const before = new Map<number, SnapRun>(prev.runs.map((r) => [r.id, r]));
  const fresh = new Set<number>();
  for (const r of next.runs) {
    const b = before.get(r.id);
    if (!b || b.status !== r.status || b.cones !== r.cones || b.disposition !== r.disposition) fresh.add(r.id);
  }
  return fresh;
}

export function SnapshotProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<EventSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [freshRunIds, setFresh] = useState<ReadonlySet<number>>(new Set());
  const [meId, setMeId] = useState<number | null>(null);
  const current = useRef<EventSnapshot | null>(null);
  const inflight = useRef(false);

  // The browser revalidates with the ETag, so an unchanged snapshot costs a 304.
  const load = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch("/api/snapshot", { cache: "no-cache" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP_${res.status}`);
        return;
      }
      const next = (await res.json()) as EventSnapshot;
      if (next.version === current.current?.version) return;
      setFresh(changedRuns(current.current, next));
      if (next.eventKey !== current.current?.eventKey) setMeId(getMe(next.eventKey));
      current.current = next;
      setSnap(next);
      setError(null);
    } catch {
      setError("UNREACHABLE");
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    // EventSource reconnects on its own; the server sends the current version
    // on every (re)connect, so a missed update is caught up immediately.
    const es = new EventSource("/api/stream");
    es.onopen = () => setConnection("live");
    es.onerror = () => setConnection("reconnecting");
    es.addEventListener("version", (e) => {
      if ((e as MessageEvent<string>).data !== current.current?.version) load();
    });
    return () => es.close();
  }, [load]);

  const setMe = useCallback((driverId: number | null) => {
    if (!current.current) return;
    storeMe(current.current.eventKey, driverId);
    setMeId(driverId);
  }, []);

  const value = useMemo(() => ({ snap, error, connection, freshRunIds, meId, setMe }), [snap, error, connection, freshRunIds, meId, setMe]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSnapshot(): SnapshotState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSnapshot outside SnapshotProvider");
  return v;
}
