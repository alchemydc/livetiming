import { standings } from "@shared/scoring";
import { PageTitle } from "@/components/shell";
import { StandingsList } from "@/components/standings";
import { useSnapshot } from "@/lib/snapshot";

export function Overall() {
  const snap = useSnapshot().snap!;
  const rows = standings(snap);
  return (
    <>
      <PageTitle
        title="Overall"
        detail={rows.length === snap.drivers.length ? `${rows.length} drivers` : `${rows.length} of ${snap.drivers.length} drivers have a time`}
      />
      <StandingsList rows={rows} />
    </>
  );
}
