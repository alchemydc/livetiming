# livetiming

Live autocross results on drivers' phones, read straight from the `.axdb` database that the VisualAX timing and scoring software writes during an event.

It is a single executable that serves a mobile web app over the event Wi-Fi. It needs no internet connection, no PHP, and no web server to configure. Results update on screen as soon as VisualAX records a finish, with no refresh button.

It replaces VisualAX's PHP web UI, with the same pages: My Runs, Class Standings, Overall Standings, Friends' Runs, Last Runs, and Reruns.

## How it works

- The server checks the `.axdb` file once a second (a `stat`, which takes no database lock). When the file changes, it reads the active event (`events.web_active = 1`) in one short read-only transaction and keeps it in memory as a snapshot.
- Phones download the whole snapshot (tens of KB) and work out every page locally. Server-sent events tell them when a newer snapshot exists.
- The database is opened read-only, and the snapshot never includes emails, phone numbers, or member numbers.
- A driver's choice of car and their friends list live in the phone's browser storage, so nothing about visitors is stored on the server.

Scoring follows VisualAX: raw time is `(finish_tick - start_tick) / 1000`, and each cone adds 2 seconds. Standings rank each driver's best run as chosen by VisualAX (`registrations.bestpendingrun_id`), so runs still waiting for penalties are included and shown as pending. VisualAX picks that best run by PAX-adjusted time; the standings list itself is sorted by raw time plus cones, as the PHP UI did. The two orderings only differ for classes whose PAX is not 1.0.

## Deploying

See [deploy/DEPLOY.md](deploy/DEPLOY.md). In short: stop the old PHP UI, copy `livetiming` and `livetiming.service` to the NUC, install them, and point phones at `http://<nuc-address>/`.

## Developing

Requires [Bun](https://bun.sh) 1.4+.

```sh
bun install
bun run fixture        # writes dev/event.axdb: a synthetic event with fake drivers
bun run dev:server     # API on :8080 against dev/event.axdb
bun run dev:web        # Vite dev server on :5173, proxying /api to :8080
bun run simulate       # optional: plays runs into dev/event.axdb the way VisualAX writes them
```

```sh
bun run test           # builds the web app, then runs unit, server, startup, SSE fan-out and writer-contention tests
bun run typecheck
bun run build          # out/livetiming, a single linux-x64 binary with the web app embedded
bun run screenshots    # every page at phone and desktop width, light and dark, plus an axe scan (out/screens)
```

Never commit a real event database. Real `.axdb` files contain drivers' names, emails, and phone numbers. Tests and development use synthetic fixtures from `scripts/make-fixture.ts`.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
