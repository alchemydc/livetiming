import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/shell";
import { useSnapshot } from "@/lib/snapshot";

function Item({ to, title, detail }: { to: string; title: string; detail: string }) {
  return (
    <li className="border-b border-rule">
      <Link to={to} className="flex items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[17px] font-semibold">{title}</span>
          <span className="block text-[14px] text-ink-2">{detail}</span>
        </span>
        <ChevronRight size={20} aria-hidden="true" className="text-ink-2" />
      </Link>
    </li>
  );
}

export function More() {
  const { snap, meId } = useSnapshot();
  const me = snap!.drivers.find((d) => d.id === meId);
  return (
    <>
      <PageTitle title="More" />
      <ul className="border-t border-rule">
        <Item to="/last" title="Last runs" detail="The newest finishes, across every car" />
        <Item to="/reruns" title="Reruns" detail="Runs marked to be run again" />
        <Item to="/" title={me ? "Pick a different car" : "Pick your car"} detail={me ? `You're car ${me.number}, ${me.firstName} ${me.lastName}` : "See your own runs and places"} />
        <Item to="/status" title="Connection status" detail="Check that results are coming through" />
      </ul>
    </>
  );
}

interface Health {
  dbName: string | null;
  version: string | null;
  lastChange: number | null;
  error: string | null;
}

const ERRORS: Record<string, string> = {
  ENOENT: "The timing database isn't there. Check that VisualAX has today's event open.",
  EACCES: "The server isn't allowed to read the timing database. See the permissions section of DEPLOY.md.",
  NO_ACTIVE_EVENT: "No event is marked for the web in VisualAX.",
  SQLITE_BUSY: "The timing table was writing at that moment. The server retries every second.",
};

function ago(ms: number) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}

export function Status() {
  const { snap, connection } = useSnapshot();
  const [health, setHealth] = useState<Health | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/health", { cache: "no-store" })
        .then((r) => r.json() as Promise<Health>)
        .then((h) => alive && setHealth(h))
        .catch(() => alive && setHealth(null));
    load();
    const t = setInterval(() => {
      load();
      tick((n) => n + 1);
    }, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const rows: [string, string][] = [
    ["Live updates", connection === "live" ? "Connected" : connection === "connecting" ? "Connecting" : "Reconnecting"],
    ["Timing database", health?.dbName ?? "Not found"],
    ["Last result change", health?.lastChange ? ago(health.lastChange) : "None yet"],
    ["Cars entered", String(snap!.drivers.length)],
    ["Runs recorded", String(snap!.runs.length)],
    ["Results version", health?.version ?? "–"],
    ["App version", __APP_VERSION__],
  ];

  return (
    <>
      <PageTitle title="Connection status" />
      {health?.error && (
        <p role="alert" className="mx-4 mb-3 border-l-4 border-cone pl-3 text-[15px]">
          {ERRORS[health.error] ?? `The server can't read the timing database right now (${health.error}). It retries every second.`} Results shown are from the last successful read.
        </p>
      )}
      <dl className="border-t border-rule">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-rule px-4 py-2.5 text-[15px]">
            <dt className="text-ink-2">{k}</dt>
            <dd className="text-right font-semibold tnum">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
