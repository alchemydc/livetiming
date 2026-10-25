import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { StandingRow } from "@shared/scoring";
import { isPending } from "@shared/scoring";
import { useSnapshot } from "@/lib/snapshot";
import { Breakdown, NumberPanel, ordinal, PendingTag, Time } from "./marks";

const COLS = "grid-cols-[2rem_3.5rem_1fr_auto]";

export function StandingsList({ rows, showClass = true }: { rows: StandingRow[]; showClass?: boolean }) {
  const { meId, freshRunIds } = useSnapshot();
  const meRow = useRef<HTMLLIElement>(null);
  const mine = rows.find((r) => r.driver.id === meId);
  if (rows.length === 0) return <p className="px-4 py-10 text-center text-ink-2">No clean runs yet. Standings fill in as cars finish.</p>;
  return (
    <>
      <ol>
        <li aria-hidden="true" className={`sticky top-14 z-10 grid ${COLS} gap-x-2 border-b border-rule bg-paper px-4 py-1 text-[12px] text-ink-2`}>
          <span className="text-right">Pos</span>
          <span className="text-center">Car</span>
          <span>Driver</span>
          <span className="text-right">Time</span>
        </li>
        {rows.map((r) => {
          const me = r.driver.id === meId;
          const pending = isPending(r.run);
          return (
            <li
              key={r.driver.id}
              ref={me ? meRow : undefined}
              className="scroll-my-32 border-b border-rule"
            >
              <Link
                to={me ? "/me" : `/driver/${r.driver.id}`}
                className={`grid ${COLS} items-center gap-x-2 px-4 py-1.5 ${me ? "bg-aspen-wash shadow-[inset_4px_0_0_var(--aspen)]" : ""} ${pending ? "pending" : ""} ${freshRunIds.has(r.run.id) ? "fresh" : ""}`}
              >
                <span className="w-expanded text-right text-[17px] font-extrabold tnum">{r.position}</span>
                <span className="text-center text-[14px]">
                  <NumberPanel number={r.driver.number} me={me} />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="w-condensed block truncate text-[16px] font-semibold">
                    {r.driver.firstName} {r.driver.lastName}
                    {me && <span className="sr-only"> (you)</span>}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2">
                    {showClass && r.cls && <span className="shrink-0 rounded border border-rule px-1 font-semibold text-ink">{r.cls.name}</span>}
                    <span className="truncate">{r.driver.carModel}</span>
                  </span>
                </span>
                <span className="flex flex-col items-end leading-tight">
                  <Time run={r.run} className="text-[18px] font-bold" />
                  {(r.run.cones > 0 || pending) && (
                    <span className="flex items-center gap-2">
                      <Breakdown run={r.run} />
                      {pending && <PendingTag />}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {mine && <JumpToMe target={meRow} position={mine.position} number={mine.driver.number} />}
    </>
  );
}

// Your row is always one tap away, however long the list.
function JumpToMe({ target, position, number }: { target: React.RefObject<HTMLLIElement | null>; position: number; number: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { rootMargin: "-56px 0px -72px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  if (visible) return null;
  return (
    <button
      type="button"
      onClick={() => target.current?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      className="fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-2 rounded-full border-2 border-ink bg-paper py-1 pr-3.5 pl-1 text-[15px] font-bold shadow-lg"
    >
      <span className="text-[13px]">
        <NumberPanel number={number} me />
      </span>
      Show me ({ordinal(position)})
    </button>
  );
}
