// Per-phone state. Keys include the event key because events.id restarts at 1
// in every .axdb, so a saved driver id is only meaningful for its own event.
// Storage can be unavailable (private mode, blocked site data); every access
// is guarded and the app works without it.

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* not persisted; the session still works */
  }
}

export function getMe(eventKey: string): number | null {
  const v = Number(read(`lt:${eventKey}:me`));
  return Number.isInteger(v) && v > 0 ? v : null;
}

export function setMe(eventKey: string, driverId: number | null) {
  write(`lt:${eventKey}:me`, driverId == null ? null : String(driverId));
}

export function getFriends(eventKey: string): number[] {
  try {
    const v = JSON.parse(read(`lt:${eventKey}:friends`) ?? "[]");
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

export function setFriends(eventKey: string, ids: number[]) {
  write(`lt:${eventKey}:friends`, JSON.stringify(ids));
}

export type Theme = "light" | "dark";

export function getTheme(): Theme {
  const saved = read("lt:theme");
  if (saved === "light" || saved === "dark") return saved;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  write("lt:theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}
