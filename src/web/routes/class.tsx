import { useSearchParams } from "react-router";
import { classStandings } from "@shared/scoring";
import { parseClassesMd } from "@shared/classes-md";
import classesMd from "../../../branding/classes.md?raw";
import { Choices } from "@/components/runs";
import { PageTitle } from "@/components/shell";
import { StandingsList } from "@/components/standings";
import { useSnapshot } from "@/lib/snapshot";

const descriptions = parseClassesMd(classesMd);

export function ClassPage() {
  const { snap, meId } = useSnapshot();
  const s = snap!;
  const [params] = useSearchParams();
  const myClassId = s.drivers.find((d) => d.id === meId)?.classId;
  // Only offer classes that have entries today.
  const entered = s.classes.filter((c) => s.drivers.some((d) => d.classId === c.id));
  const cls = entered.find((c) => c.name === params.get("c")) ?? entered.find((c) => c.id === myClassId) ?? entered[0];
  if (!cls) return <p className="px-4 py-10 text-center text-ink-2">No drivers are entered yet.</p>;

  const rows = classStandings(s, cls.id);
  const entries = s.drivers.filter((d) => d.classId === cls.id).length;
  const info = descriptions.get(cls.name);

  return (
    <>
      <PageTitle title={`Class ${cls.name}`} detail={rows.length === entries ? `${entries} drivers` : `${rows.length} of ${entries} drivers have a time`} />
      <Choices
        label="Class"
        items={entered.map((c) => ({ key: String(c.id), label: c.name, to: `/class?c=${encodeURIComponent(c.name)}`, active: c.id === cls.id }))}
      />
      {info && info.lines.length > 0 && (
        <details className="mx-4 mb-3 rounded-md border border-rule px-3 py-2 text-[14px]">
          <summary className="cursor-pointer font-semibold">Which cars run in {cls.name}</summary>
          <ul className="mt-2 grid gap-1 text-ink-2">
            {info.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      )}
      <StandingsList rows={rows} showClass={false} />
    </>
  );
}
