import { parseArgs } from "node:util";
import { createApp, Hub } from "./app";
import { assets } from "./generated/assets";
import { SnapshotSource } from "./watch";

const { values: args } = parseArgs({
  options: {
    db: { type: "string", default: "/var/www/html/VisualAX/dbSymLink.axdb" },
    port: { type: "string", default: "8080" },
    host: { type: "string", default: "0.0.0.0" },
  },
});

const hub = new Hub();
const source = new SnapshotSource(args.db, (snap) => hub.publish(snap.version));
source.start();

const server = Bun.serve({
  port: Number(args.port),
  hostname: args.host,
  // SSE clients get a heartbeat every 5s; keep this comfortably above it.
  idleTimeout: 30,
  fetch: createApp(source, hub, assets).fetch,
});
console.log(`livetiming listening on http://${server.hostname}:${server.port} (db: ${args.db})`);
