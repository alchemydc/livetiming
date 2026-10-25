import type { SnapRun } from "@shared/types";
import { formatTime, penaltyTime, rawTime } from "@shared/scoring";

export function NumberPanel({ number, me, className = "" }: { number: string; me?: boolean; className?: string }) {
  return (
    <span className={`num-panel ${className}`} data-me={me || undefined}>
      {number}
    </span>
  );
}

function ConeGlyph() {
  return (
    <svg viewBox="0 0 12 14" width="11" height="13" aria-hidden="true" className="shrink-0">
      <path d="M4.6 0.5h2.8L10.6 12H1.4z" fill="var(--cone)" />
      <path d="M3.5 6h5l.55 2.2H2.95z" fill="#fff" />
      <rect x="0" y="11.6" width="12" height="2.2" rx="0.6" fill="var(--cone)" />
    </svg>
  );
}

// One cone glyph per cone hit, so the count reads at a glance in sunlight.
export function Cones({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="inline-flex items-center gap-px" title={`${n} cone${n === 1 ? "" : "s"}, +${n * 2}s`}>
      <span className="sr-only">{n} cone{n === 1 ? "" : "s"}</span>
      {Array.from({ length: Math.min(n, 3) }, (_, i) => (
        <ConeGlyph key={i} />
      ))}
      {n > 3 && <span className="ml-0.5 text-xs font-bold text-cone-ink tnum">×{n}</span>}
    </span>
  );
}

const DISPOSITION_LABEL: Record<string, string> = { DNF: "DNF", RRN: "Rerun", DSQ: "DSQ" };

export function Disposition({ run }: { run: SnapRun }) {
  const label = DISPOSITION_LABEL[run.disposition] ?? run.disposition;
  if (!label) return null;
  return <span className={`text-xs font-bold ${run.disposition === "RRN" ? "text-ink-2" : "text-ink"}`}>{label}</span>;
}

export function PendingTag() {
  return <span className="text-xs font-semibold text-ink-2">Pending</span>;
}

// DNF, DSQ and rerun times don't count, so no penalty is ever added to them.
const struck = (run: SnapRun) => run.disposition === "DNF" || run.disposition === "DSQ";
const uncounted = (run: SnapRun) => struck(run) || run.disposition === "RRN";

// The headline time includes cone penalties, so it always matches how runs are
// ranked. Uncounted runs show their raw time; DNF and DSQ are struck through.
export function Time({ run, className = "" }: { run: SnapRun; className?: string }) {
  if (struck(run)) return <span className={`tnum line-through decoration-2 text-ink-2 ${className}`}>{formatTime(rawTime(run))}</span>;
  if (uncounted(run)) return <span className={`tnum text-ink-2 ${className}`}>{formatTime(rawTime(run))}</span>;
  return <span className={`tnum ${className}`}>{formatTime(penaltyTime(run))}</span>;
}

// Raw time plus the cones that were added to it; nothing for a clean run.
// An uncounted run only records the cones it hit, with no penalty sum.
export function Breakdown({ run }: { run: SnapRun }) {
  if (run.cones <= 0) return null;
  if (uncounted(run)) return <Cones n={run.cones} />;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-ink-2">
      <span className="tnum">{formatTime(rawTime(run))}</span>
      <span aria-hidden="true">+</span>
      <Cones n={run.cones} />
    </span>
  );
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}
