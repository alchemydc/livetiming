import { Link } from "react-router";
import type { SnapRun } from "@shared/types";
import { isPending } from "@shared/scoring";
import { useSnapshot } from "@/lib/snapshot";
import { Breakdown, Disposition, NumberPanel, PendingTag, Time } from "./marks";

// A list of individual runs across drivers, newest or in run order, as given.
export function RunList({ runs, empty }: { runs: SnapRun[]; empty: string }) {
  const { snap, meId, freshRunIds } = useSnapshot();
  const drivers = new Map(snap!.drivers.map((d) => [d.id, d]));
  const classes = new Map(snap!.classes.map((c) => [c.id, c.name]));
  if (runs.length === 0) return <p className="px-4 py-10 text-center text-ink-2">{empty}</p>;
  return (
    <ol>
      {runs.map((run) => {
        const d = drivers.get(run.driverId);
        if (!d) return null;
        const me = d.id === meId;
        const pending = isPending(run);
        return (
          <li key={run.id} className="border-b border-rule">
            <Link
              to={me ? "/me" : `/driver/${d.id}`}
              className={`grid grid-cols-[3.5rem_1fr_auto] items-center gap-x-2 px-4 py-1.5 ${me ? "bg-aspen-wash shadow-[inset_4px_0_0_var(--aspen)]" : ""} ${pending ? "pending" : ""} ${freshRunIds.has(run.id) ? "fresh" : ""}`}
            >
              <span className="text-center text-[14px]">
                <NumberPanel number={d.number} me={me} />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="w-condensed block truncate text-[16px] font-semibold">
                  {d.firstName} {d.lastName}
                  {me && <span className="sr-only"> (you)</span>}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2">
                  <span className="shrink-0 rounded border border-rule px-1 font-semibold text-ink">{classes.get(d.classId)}</span>
                  <span className="truncate">{d.carModel}</span>
                </span>
              </span>
              <span className="flex flex-col items-end leading-tight">
                <Time run={run} className="text-[18px] font-bold" />
                {(run.cones > 0 || pending || run.disposition) && (
                  <span className="flex items-center gap-2">
                    <Breakdown run={run} />
                    {pending && <PendingTag />}
                    <Disposition run={run} />
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

// A row of mutually exclusive choices (classes, run counts) rendered as links.
export function Choices({ items, label }: { items: { key: string; label: string; to: string; active: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} data-no-swipe className="flex gap-1.5 overflow-x-auto px-4 pb-3">
      {items.map((it) => (
        <Link
          key={it.key}
          to={it.to}
          replace
          aria-current={it.active ? "page" : undefined}
          className={`shrink-0 rounded-md border-2 px-2.5 py-1 text-[15px] font-bold ${it.active ? "border-ink bg-ink text-paper" : "border-rule text-ink"}`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
