// Parses the club's class descriptions (branding/classes.md), using the same
// format the PHP UI read:
//
//   ## C2 — Class 2
//   - Boxster & Cayman - 987.1 & 987.2 (non-S, 2005–2011)
//   Free text lines are kept too.

export interface ClassInfo {
  title: string; // "Class 2"
  lines: string[]; // one entry per bullet or text line
}

export function parseClassesMd(md: string): Map<string, ClassInfo> {
  const out = new Map<string, ClassInfo>();
  let current: ClassInfo | null = null;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const heading = /^##\s+([A-Z0-9]+)\s+—\s+(.*)$/.exec(line);
    if (heading) {
      current = { title: heading[2]!.trim(), lines: [] };
      out.set(heading[1]!, current);
    } else if (current && line) {
      current.lines.push(line.replace(/^- /, ""));
    }
  }
  return out;
}
