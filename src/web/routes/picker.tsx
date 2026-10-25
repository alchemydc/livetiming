import { useState } from "react";
import { useNavigate } from "react-router";
import { driversByNumber } from "@shared/scoring";
import { NumberPanel } from "@/components/marks";
import { PageTitle } from "@/components/shell";
import { useSnapshot } from "@/lib/snapshot";

export function Picker() {
  const { snap, meId, setMe } = useSnapshot();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const s = snap!;
  const classes = new Map(s.classes.map((c) => [c.id, c.name]));
  const needle = q.trim().toLowerCase();
  const drivers = driversByNumber(s).filter(
    (d) => !needle || d.number.toLowerCase().startsWith(needle) || `${d.firstName} ${d.lastName}`.toLowerCase().includes(needle),
  );

  return (
    <>
      <PageTitle title="Which car is yours?" />
      <div className="sticky top-14 z-10 bg-paper px-4 pb-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Car number or name"
          aria-label="Find your car by number or name"
          className="w-full rounded-lg border-2 border-rule bg-paper px-3 py-2.5 text-[17px] placeholder:text-ink-2 focus:border-sky focus:outline-none"
        />
      </div>
      <ul>
        {drivers.map((d) => (
          <li key={d.id} className="border-b border-rule">
            <button
              type="button"
              onClick={() => {
                setMe(d.id);
                navigate("/me");
              }}
              className={`grid w-full grid-cols-[3.75rem_1fr_auto] items-center gap-x-3 px-4 py-2.5 text-left ${d.id === meId ? "bg-aspen-wash shadow-[inset_4px_0_0_var(--aspen)]" : ""}`}
            >
              <span className="text-center text-[17px]">
                <NumberPanel number={d.number} me={d.id === meId} />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="w-condensed block truncate text-[17px] font-semibold">
                  {d.firstName} {d.lastName}
                </span>
                <span className="block truncate text-[13px] text-ink-2">{d.carModel}</span>
              </span>
              <span className="rounded border border-rule px-1 text-[13px] font-semibold">{classes.get(d.classId)}</span>
            </button>
          </li>
        ))}
        {drivers.length === 0 && <li className="px-4 py-8 text-center text-ink-2">No car matches “{q}”.</li>}
      </ul>
    </>
  );
}
