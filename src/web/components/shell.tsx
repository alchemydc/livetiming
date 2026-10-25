import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { CircleUserRound, ListOrdered, Menu, Moon, Sun, Trophy, UsersRound } from "lucide-react";
import logo from "../../../branding/logo.png";
import { useSnapshot } from "@/lib/snapshot";
import { getTheme, setTheme, type Theme } from "@/lib/storage";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function ThemeToggle() {
  const [theme, set] = useState<Theme>(getTheme);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        set(next);
      }}
      className="grid size-10 place-items-center rounded-full text-ink-2 hover:text-ink"
      aria-label={`Switch to ${next} mode`}
    >
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

function Header() {
  const { snap, connection } = useSnapshot();
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-paper">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-3">
        <img src={logo} alt="PCA Rocky Mountain Region" className="size-9 shrink-0" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="w-condensed truncate text-[17px] font-bold">{snap?.event.eventName ?? "Live timing"}</div>
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            {snap && <span>{formatDate(snap.event.eventDate)}</span>}
            <span className="inline-flex items-center gap-1" role="status">
              <span className={`size-2 rounded-full ${connection === "live" ? "bg-sky" : "bg-cone"}`} aria-hidden="true" />
              {connection === "live" ? "Live" : connection === "connecting" ? "Connecting" : "Reconnecting"}
            </span>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

function Tab({ to, icon: Icon, label, also = [] }: { to: string; icon: typeof Trophy; label: string; also?: string[] }) {
  const { pathname } = useLocation();
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 border-t-[3px] pt-1.5 pb-1 text-[12px] font-semibold ${isActive || also.includes(pathname) ? "border-ink text-ink" : "border-transparent text-ink-2"}`
      }
    >
      <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
      {label}
    </NavLink>
  );
}

// Bottom tabs: the results that matter are one thumb-tap away.
function TabBar() {
  const { snap, meId } = useSnapshot();
  const me = snap?.drivers.find((d) => d.id === meId);
  const cls = me && snap?.classes.find((c) => c.id === me.classId);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)]" aria-label="Main">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        <Tab to={me ? "/me" : "/"} icon={CircleUserRound} label={me ? "My runs" : "Pick car"} />
        <Tab to="/class" icon={Trophy} label={cls ? cls.name : "Class"} />
        <Tab to="/overall" icon={ListOrdered} label="Overall" />
        <Tab to="/friends" icon={UsersRound} label="Friends" />
        <Tab to="/more" icon={Menu} label="More" also={me ? ["/last", "/reruns", "/status", "/"] : ["/last", "/reruns", "/status"]} />
      </div>
    </nav>
  );
}

// Swiping sideways moves between the main pages, in the PHP UI's order.
function useSwipeNav(hasMe: boolean) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const order = ["/me", "/class", "/overall", "/friends", "/last", "/reruns"].filter((p) => hasMe || p !== "/me");
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let skip = true;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      // Ignore multi-touch, the screen edges (the OS back gesture), and controls that scroll sideways.
      skip = !t || e.touches.length > 1 || t.clientX < 24 || t.clientX > innerWidth - 24 || !!(e.target as Element).closest?.("[data-no-swipe], input");
      if (t) [x0, y0, t0] = [t.clientX, t.clientY, Date.now()];
    };
    const end = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (skip || !t) return;
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (Date.now() - t0 > 600 || Math.abs(dx) < 70 || Math.abs(dx) < 2 * Math.abs(dy)) return;
      const next = order[order.indexOf(pathname) + (dx < 0 ? 1 : -1)];
      if (order.includes(pathname) && next) navigate(next);
    };
    addEventListener("touchstart", start, { passive: true });
    addEventListener("touchend", end, { passive: true });
    return () => {
      removeEventListener("touchstart", start);
      removeEventListener("touchend", end);
    };
  }, [hasMe, pathname, navigate]);
}

export function Shell() {
  const { snap, error, meId } = useSnapshot();
  useSwipeNav(!!snap?.drivers.some((d) => d.id === meId));
  return (
    <div className="min-h-dvh pb-20">
      <Header />
      <main className="mx-auto max-w-2xl">{snap ? <Outlet /> : <Waiting error={error} />}</main>
      <TabBar />
    </div>
  );
}

const WAITING: Record<string, string> = {
  NO_ACTIVE_EVENT: "No event is open for live results yet. Results appear here once the timing table marks today's event for the web.",
  ENOENT: "The timing database isn't available yet. Results appear here once the timing table opens today's event.",
  UNREACHABLE: "Can't reach the timing server. Check that you're on the event Wi-Fi.",
};

function Waiting({ error }: { error: string | null }) {
  return (
    <div className="px-4 py-16 text-center">
      <p className="mx-auto max-w-sm text-[17px] text-ink-2">
        {error ? (WAITING[error] ?? `The timing server can't read results right now (${error}). It will retry on its own.`) : "Loading results…"}
      </p>
    </div>
  );
}

export function PageTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2">
      <h1 className="w-expanded text-[22px] font-extrabold tracking-tight">{title}</h1>
      {detail && <span className="text-[13px] text-ink-2">{detail}</span>}
    </div>
  );
}
