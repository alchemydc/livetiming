import { ChevronLeft } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router";
import { useSnapshot } from "@/lib/snapshot";
import { DriverRuns } from "./me";

export function Driver() {
  const { meId } = useSnapshot();
  const navigate = useNavigate();
  const id = Number(useParams().id);
  if (id === meId) return <Navigate to="/me" replace />;
  return (
    <>
      <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-0.5 px-3 pt-3 text-[15px] font-semibold text-sky">
        <ChevronLeft size={20} aria-hidden="true" />
        Back
      </button>
      <DriverRuns driverId={id} />
    </>
  );
}
