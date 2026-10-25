import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const entry = join(root, "src/server/index.ts");
// index.ts imports the asset map that `bun scripts/build.ts --no-compile` generates.
const built = existsSync(join(root, "src/server/generated/assets.ts"));

async function start(...args: string[]) {
  const p = Bun.spawn(["bun", entry, "--db", "/nonexistent.axdb", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  const code = await p.exited;
  return { code, stderr: (await new Response(p.stderr).text()).trim() };
}

// Fail loudly rather than skip, so a fresh checkout can't silently miss these tests.
test("asset map is generated (use `bun run test`, or run `bun scripts/build.ts --no-compile` first)", () => {
  expect(built).toBe(true);
});

describe.skipIf(!built)("startup failures print one plain line and exit 1", () => {
  test("port already in use", async () => {
    const holder = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response("") });
    const port = holder.port;
    const r = await start("--host", "127.0.0.1", "--port", String(port));
    holder.stop(true);
    expect(r.code).toBe(1);
    expect(r.stderr).toBe(`livetiming: port ${port} is already in use (often by Apache). See what holds it with: sudo ss -ltnp 'sport = :${port}'`);
  });

  test("unknown flag", async () => {
    const r = await start("--prot", "80");
    expect(r.code).toBe(1);
    expect(r.stderr).not.toContain("\n");
    expect(r.stderr).toStartWith("livetiming: ");
    expect(r.stderr).toContain("--prot");
    expect(r.stderr).toEndWith("(usage: livetiming [--db PATH] [--port N] [--host ADDR])");
  });

  test("port that isn't a number", async () => {
    const r = await start("--port", "eighty");
    expect(r.code).toBe(1);
    expect(r.stderr).toBe('livetiming: --port must be a number from 1 to 65535, got "eighty" (usage: livetiming [--db PATH] [--port N] [--host ADDR])');
  });
});
