import { parseArgs } from "node:util";
import { createApp, Hub } from "./app";
import { assets } from "./generated/assets";
import { SnapshotSource } from "./watch";

const USAGE = "usage: livetiming [--db PATH] [--port N] [--host ADDR]";

// Startup failures are printed as one plain line for the journal, instead of
// an uncaught exception dumping minified source from the compiled binary.
function fail(message: string): never {
  console.error(`livetiming: ${message}`);
  process.exit(1);
}

let args: { db: string; port: string; host: string };
try {
  args = parseArgs({
    options: {
      db: { type: "string", default: "/var/www/html/VisualAX/dbSymLink.axdb" },
      port: { type: "string", default: "8080" },
      host: { type: "string", default: "0.0.0.0" },
    },
  }).values as typeof args;
} catch (e) {
  fail(`${(e as Error).message}\n${USAGE}`);
}

const port = Number(args.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`--port must be a number from 1 to 65535, got "${args.port}"\n${USAGE}`);

const hub = new Hub();
const source = new SnapshotSource(args.db, (snap) => hub.publish(snap.version));

let server: ReturnType<typeof Bun.serve>;
try {
  server = Bun.serve({
    port,
    hostname: args.host,
    // SSE clients get a heartbeat every 5s; keep this comfortably above it.
    idleTimeout: 30,
    fetch: createApp(source, hub, assets).fetch,
  });
} catch (e) {
  const code = (e as { code?: string }).code;
  if (code === "EADDRINUSE") fail(`port ${port} is already in use (often by Apache). See what holds it with: sudo ss -ltnp 'sport = :${port}'`);
  if (code === "EACCES") fail(`not allowed to listen on port ${port}. Ports below 1024 need root or the CAP_NET_BIND_SERVICE capability (AmbientCapabilities in livetiming.service).`);
  fail(`can't listen on ${args.host}:${port} (${code ?? (e as Error).message})`);
}

source.start();
console.log(`livetiming listening on http://${server.hostname}:${server.port} (db: ${args.db})`);
