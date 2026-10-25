import { Database } from "bun:sqlite";
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeFixture } from "../scripts/make-fixture";
import { createApp, Hub } from "../src/server/app";
import { SnapshotSource } from "../src/server/watch";

const dir = mkdtempSync(join(tmpdir(), "lt-server-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const indexHtml = join(dir, "index.html");
writeFileSync(indexHtml, "<!doctype html><title>t</title>");
const assets = { "/index.html": indexHtml };

function setup(name: string) {
  const path = join(dir, name);
  makeFixture(path);
  const hub = new Hub();
  const source = new SnapshotSource(path, (s) => hub.publish(s.version), () => {});
  source.tick();
  return { path, hub, source, app: createApp(source, hub, assets) };
}

describe("HTTP API", () => {
  test("snapshot has an ETag and answers 304 when unchanged, including after a restart", async () => {
    const { path, app, source } = setup("etag.axdb");
    const res = await app.request("/api/snapshot");
    expect(res.status).toBe(200);
    const etag = res.headers.get("ETag")!;
    expect(etag).toBe(`"${source.current!.version}"`);

    expect((await app.request("/api/snapshot", { headers: { "If-None-Match": etag } })).status).toBe(304);

    // A fresh process over the same unchanged file produces the same ETag.
    const restarted = new SnapshotSource(path, () => {}, () => {});
    restarted.tick();
    const app2 = createApp(restarted, new Hub(), assets);
    expect((await app2.request("/api/snapshot", { headers: { "If-None-Match": etag } })).status).toBe(304);
  });

  test("snapshot JSON carries no PII", async () => {
    const { app } = setup("pii.axdb");
    const body = await (await app.request("/api/snapshot")).text();
    for (const leaked of ["example.invalid", "555-0100", "Sponsor Co", "member_num", "email", "cellphone"]) expect(body).not.toContain(leaked);
  });

  test("503 with an error code before any snapshot exists", async () => {
    const source = new SnapshotSource(join(dir, "nope.axdb"), () => {}, () => {});
    source.tick();
    const app = createApp(source, new Hub(), assets);
    const res = await app.request("/api/snapshot");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "ENOENT" });
  });

  test("health reports basename only, never the full path", async () => {
    const { app } = setup("health.axdb");
    const body = await (await app.request("/api/health")).text();
    expect(JSON.parse(body).dbName).toBe("health.axdb");
    expect(body).not.toContain(dir);
  });

  test("unknown /api routes 404; other paths fall back to the SPA", async () => {
    const { app } = setup("spa.axdb");
    expect((await app.request("/api/whatever")).status).toBe(404);
    const res = await app.request("/overall");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<!doctype html>");
  });
});

// Reads SSE events from a live server until `count` events named `name` arrive.
async function readEvents(url: string, name: string, count: number, signal: AbortSignal): Promise<string[]> {
  const res = await fetch(url, { signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const out: string[] = [];
  let buf = "";
  while (out.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1] ?? "";
      if (ev === name) out.push(data);
    }
  }
  return out;
}

describe("SSE", () => {
  test("pushes the current version on connect and new versions on change", async () => {
    const { path, hub, source } = setup("sse.axdb");
    const server = Bun.serve({ port: 0, fetch: createApp(source, hub, assets).fetch });
    const ctl = new AbortController();
    const got = readEvents(`http://127.0.0.1:${server.port}/api/stream`, "version", 2, ctl.signal);
    await Bun.sleep(50);
    const first = source.current!.version;

    const w = new Database(path);
    w.run("UPDATE runs SET cones = 4 WHERE id = 3");
    w.close();
    source.tick();

    const versions = await got;
    expect(versions[0]).toBe(first);
    expect(versions[1]).toBe(source.current!.version);
    expect(versions[1]).not.toBe(first);
    ctl.abort();
    server.stop(true);
  });

  test("100 clients stay connected past idleTimeout and all receive the next version", async () => {
    const { path, hub, source } = setup("fanout.axdb");
    // Heartbeat 500ms vs idleTimeout 2s: without heartbeats Bun would drop these sockets.
    const server = Bun.serve({ port: 0, idleTimeout: 2, fetch: createApp(source, hub, assets, 500).fetch });
    const ctl = new AbortController();
    const clients = Array.from({ length: 100 }, () => readEvents(`http://127.0.0.1:${server.port}/api/stream`, "version", 2, ctl.signal));
    await Bun.sleep(3000);
    expect(hub.size).toBe(100);

    const w = new Database(path);
    w.run("UPDATE runs SET cones = 1 WHERE id = 4");
    w.close();
    source.tick();

    const results = await Promise.all(clients);
    for (const r of results) expect(r[1]).toBe(source.current!.version);
    ctl.abort();
    server.stop(true);
  }, 15000);
});
