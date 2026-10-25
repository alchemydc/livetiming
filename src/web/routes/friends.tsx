import { useState } from "react";
import { X } from "lucide-react";
import { driversByNumber, friendsStandings } from "@shared/scoring";
import { NumberPanel } from "@/components/marks";
import { PageTitle } from "@/components/shell";
import { StandingsList } from "@/components/standings";
import { useSnapshot } from "@/lib/snapshot";
import { getFriends, setFriends } from "@/lib/storage";

export function Friends() {
  const { snap, meId } = useSnapshot();
  const s = snap!;
  const [friendIds, setIds] = useState(() => getFriends(s.eventKey));
  const [q, setQ] = useState("");
  const save = (ids: number[]) => {
    setFriends(s.eventKey, ids);
    setIds(ids);
  };

  const byId = new Map(s.drivers.map((d) => [d.id, d]));
  const friends = friendIds.map((id) => byId.get(id)).filter((d) => d !== undefined);
  const rows = friendsStandings(s, meId ?? -1, friendIds);
  const needle = q.trim().toLowerCase();
  const candidates = needle
    ? driversByNumber(s).filter(
        (d) =>
          d.id !== meId &&
          !friendIds.includes(d.id) &&
          (d.number.toLowerCase().startsWith(needle) || `${d.firstName} ${d.lastName}`.toLowerCase().includes(needle)),
      )
    : [];

  return (
    <>
      <PageTitle title="Friends" detail={friends.length ? `${friends.length} added` : undefined} />
      {friends.length === 0 ? (
        <p className="px-4 pb-4 text-[15px] text-ink-2">Add the drivers you want to keep an eye on, and you'll see their best times ranked alongside yours.</p>
      ) : (
        <StandingsList rows={rows} />
      )}

      <section className="px-4 pt-6" aria-labelledby="add-friends">
        <h2 id="add-friends" className="mb-2 text-[17px] font-bold">
          Add a friend
        </h2>
        <input
          id="friend-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Car number or name"
          aria-label="Find a driver by number or name"
          className="w-full rounded-lg border-2 border-rule bg-paper px-3 py-2.5 text-[17px] placeholder:text-ink-2 focus:border-sky focus:outline-none"
        />
        {needle && candidates.length === 0 && <p className="py-3 text-ink-2">No driver matches “{q}”.</p>}
        <ul className="mt-1">
          {candidates.slice(0, 8).map((d) => (
            <li key={d.id} className="border-b border-rule">
              <button
                type="button"
                onClick={() => {
                  save([...friendIds, d.id]);
                  setQ("");
                }}
                className="grid w-full grid-cols-[3.5rem_1fr_auto] items-center gap-x-2 py-2 text-left"
              >
                <span className="text-center text-[14px]">
                  <NumberPanel number={d.number} />
                </span>
                <span className="w-condensed truncate text-[16px] font-semibold">
                  {d.firstName} {d.lastName}
                </span>
                <span className="text-[15px] font-bold text-sky">Add</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {friends.length > 0 && (
        <section className="px-4 pt-6" aria-labelledby="your-friends">
          <h2 id="your-friends" className="mb-2 text-[17px] font-bold">
            Your friends
          </h2>
          <ul className="flex flex-wrap gap-2">
            {friends.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => save(friendIds.filter((id) => id !== d.id))}
                  aria-label={`Remove ${d.firstName} ${d.lastName}`}
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-rule py-0.5 pr-2 pl-0.5 text-[15px] font-semibold"
                >
                  <span className="text-[12px]">
                    <NumberPanel number={d.number} />
                  </span>
                  {d.firstName}
                  <X size={16} aria-hidden="true" className="text-ink-2" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-ink-2">Friends without a clean run yet appear in the list once they post a time.</p>
        </section>
      )}
    </>
  );
}
