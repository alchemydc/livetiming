import { useSearchParams } from "react-router";
import { lastRuns, reruns } from "@shared/scoring";
import { Choices, RunList } from "@/components/runs";
import { PageTitle } from "@/components/shell";
import { useSnapshot } from "@/lib/snapshot";

const COUNTS = [12, 25, 50];

export function LastRuns() {
  const s = useSnapshot().snap!;
  const [params] = useSearchParams();
  const asked = Number(params.get("n"));
  const n = COUNTS.includes(asked) ? asked : 12;
  return (
    <>
      <PageTitle title="Last runs" detail="Newest first" />
      <Choices label="How many runs" items={COUNTS.map((c) => ({ key: String(c), label: String(c), to: `/last?n=${c}`, active: c === n }))} />
      <RunList runs={lastRuns(s, n)} empty="No runs have finished yet." />
    </>
  );
}

export function Reruns() {
  const s = useSnapshot().snap!;
  const runs = reruns(s);
  return (
    <>
      <PageTitle title="Reruns" detail={runs.length ? `${runs.length} so far` : undefined} />
      <p className="px-4 pb-3 text-[14px] text-ink-2">Runs the timing table marked for a rerun, usually for a timing fault or a course problem. They don't count toward results.</p>
      <RunList runs={runs} empty="No reruns so far today." />
    </>
  );
}
