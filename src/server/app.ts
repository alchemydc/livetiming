import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { SnapshotSource } from "./watch";

export const HEARTBEAT_MS = 5000;

// Fan-out of snapshot versions to connected SSE clients.
export class Hub {
  private listeners = new Set<(version: string) => void>();
  subscribe(fn: (version: string) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  publish(version: string) {
    for (const fn of this.listeners) fn(version);
  }
  get size() {
    return this.listeners.size;
  }
}

export function createApp(source: SnapshotSource, hub: Hub, assets: Record<string, string>, heartbeatMs = HEARTBEAT_MS) {
  const app = new Hono();

  // Serialize once per version, not once per client.
  let cached: { version: string; body: string } | null = null;

  app.get("/api/snapshot", (c) => {
    const snap = source.current;
    if (!snap) return c.json({ error: source.status.error ?? "NOT_READY" }, 503);
    const etag = `"${snap.version}"`;
    if (c.req.header("If-None-Match") === etag) return c.body(null, 304, { ETag: etag });
    if (cached?.version !== snap.version) cached = { version: snap.version, body: JSON.stringify(snap) };
    return c.body(cached.body, 200, { "Content-Type": "application/json", ETag: etag, "Cache-Control": "no-cache" });
  });

  app.get("/api/stream", (c) =>
    streamSSE(c, async (stream) => {
      const send = (version: string) => stream.writeSSE({ event: "version", data: version }).catch(() => {});
      if (source.current) await send(source.current.version);
      const unsubscribe = hub.subscribe(send);
      const heartbeat = setInterval(() => stream.writeSSE({ event: "ping", data: "" }).catch(() => {}), heartbeatMs);
      await new Promise<void>((resolve) => stream.onAbort(resolve));
      clearInterval(heartbeat);
      unsubscribe();
    }),
  );

  app.get("/api/health", (c) => c.json(source.status, source.current ? 200 : 503));
  app.all("/api/*", (c) => c.notFound());

  // Hashed build output is immutable; everything else (index.html, SPA routes) revalidates.
  app.get("*", (c) => {
    const path = c.req.path;
    const file = assets[path] ?? assets["/index.html"];
    if (!file) return c.notFound();
    const immutable = path.startsWith("/assets/") && assets[path];
    return new Response(Bun.file(file), {
      headers: { "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache" },
    });
  });

  return app;
}
