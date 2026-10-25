import { Link, Navigate } from "react-router";
import { classStandings, driverRuns, isPending, standings } from "@shared/scoring";
import { Breakdown, Disposition, NumberPanel, ordinal, PendingTag, Time } from "@/components/marks";
import { useSnapshot } from "@/lib/snapshot";

export function Me() {
  const { snap, meId } = useSnapshot();
  const me = snap!.drivers.find((d) => d.id === meId);
  if (!me) return <Navigate to="/" replace />;
  return <DriverRuns driverId={me.id} isMe />;
}

export function DriverRuns({ driverId, isMe = false }: { driverId: number; isMe?: boolean }) {
  const { snap, freshRunIds } = useSnapshot();
  const s = snap!;
  const driver = s.drivers.find((d) => d.id === driverId);
  if (!driver) return <p className="px-4 py-10 text-center text-ink-2">This driver isn't entered in today's event.</p>;
  const cls = s.classes.find((c) => c.id === driver.classId);
  const runs = driverRuns(s, driverId);
  const best = runs.find((r) => r.isBest)?.run;
  const inClass = classStandings(s, driver.classId);
  const overall = standings(s);
  const classPos = inClass.find((r) => r.driver.id === driverId)?.position;
  const overallPos = overall.find((r) => r.driver.id === driverId)?.position;
  const counted = runs.filter((r) => r.runNo != null).length;

  return (
    <>
      <section className="border-b border-rule px-4 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <NumberPanel number={driver.number} me={isMe} className="text-[30px]" />
          <div className="min-w-0 pt-0.5 leading-tight">
            <h1 className="w-expanded truncate text-[22px] font-extrabold tracking-tight">
              {driver.firstName} {driver.lastName}
            </h1>
            <p className="truncate text-[14px] text-ink-2">
              {[driver.carColor, driver.carModel].filter(Boolean).join(" ")}
              {cls && (
                <Link to={`/class?c=${encodeURIComponent(cls.name)}`} className="ml-2 rounded border border-rule px-1 font-semibold text-ink">
                  {cls.name}
                </Link>
              )}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto] items-end gap-4">
          <div>
            <div className="text-[13px] text-ink-2">Best time</div>
            {best ? (
              <div className="grid justify-items-start gap-1">
                <Time run={best} className="w-expanded text-[52px] leading-none font-extrabold tracking-tight" />
                <Breakdown run={best} />
              </div>
            ) : (
              <div className="pt-2 text-[17px] text-ink-2">No clean run yet</div>
            )}
          </div>
          <div className="grid gap-1 text-right text-[14px]">
            <Placing label={cls ? `in ${cls.name}` : "in class"} pos={classPos} of={inClass.length} to="/class" />
            <Placing label="overall" pos={overallPos} of={overall.length} to="/overall" />
          </div>
        </div>
      </section>

      <div className="flex items-baseline justify-between px-4 pt-4 pb-1">
        <h2 className="text-[17px] font-bold">Runs</h2>
        <span className="text-[13px] text-ink-2">
          {counted} of {s.event.numRuns}
        </span>
      </div>
      {runs.length === 0 ? (
        <p className="px-4 py-8 text-center text-ink-2">No runs yet. Your times appear here as soon as you cross the finish.</p>
      ) : (
        <ol>
          {runs.map(({ run, runNo, isBest }) => (
            <li
              key={run.id}
              className={`grid grid-cols-[2.25rem_1fr_auto] items-center gap-x-2 border-b border-rule px-4 py-2.5 ${isPending(run) ? "pending" : ""} ${freshRunIds.has(run.id) ? "fresh" : ""}`}
            >
              <span className="w-expanded text-[15px] font-bold text-ink-2 tnum">{runNo ?? "–"}</span>
              <span className="flex flex-wrap items-center gap-x-3">
                <Time run={run} className={`text-[21px] ${isBest ? "font-extrabold" : "font-semibold"}`} />
                <Breakdown run={run} />
              </span>
              <span className="flex items-center gap-2">
                {isPending(run) && <PendingTag />}
                <Disposition run={run} />
                {isBest && <span className="rounded bg-sky px-1.5 py-0.5 text-[12px] font-bold text-paper">Best</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {isMe && (
        <div className="px-4 py-6 text-center">
          <Link to="/" className="text-[15px] font-semibold text-sky underline underline-offset-4">
            Not you? Pick a different car
          </Link>
        </div>
      )}
    </>
  );
}

function Placing({ label, pos, of, to }: { label: string; pos?: number; of: number; to: string }) {
  return (
    <Link to={to} className="flex items-baseline justify-end gap-1.5">
      <span className="w-expanded text-[22px] font-extrabold tnum">{pos ? ordinal(pos) : "–"}</span>
      <span className="text-ink-2">
        of <span className="tnum">{of}</span> {label}
      </span>
    </Link>
  );
}
