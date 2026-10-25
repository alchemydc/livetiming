# Deploying livetiming on the event NUC

The event site has no internet. Everything below is done with a single file, `livetiming`, carried over on a USB stick.

## Get the binary (while online)

Download `livetiming` from the latest GitHub release, or build it yourself with `bun install && bun run build` (output: `out/livetiming`). Copy it to the USB stick.

The binary targets `linux-x64-baseline`, so it runs on older CPUs without AVX2. It needs no Node, Bun, PHP or Apache on the NUC.

## First install

```sh
sudo useradd --system --no-create-home --shell /usr/sbin/nologin livetiming
sudo install -m 0755 /media/usb/livetiming /usr/local/bin/livetiming
sudo install -m 0644 /media/usb/livetiming.service /etc/systemd/system/livetiming.service
sudo systemctl daemon-reload
sudo systemctl enable --now livetiming
```

Then open `http://<nuc-address>:8080/` from a phone on the event Wi-Fi.

## Permissions

VisualAX points `/var/www/html/VisualAX/dbSymLink.axdb` at the current event's `.axdb` every time an event is loaded. That only happens when the VisualAX license has the web server enabled and VisualAX runs on Linux. The `livetiming` user needs:

- read and execute (`r-x`) on `/var/www/html/VisualAX` and on every directory leading to the real `.axdb` file;
- read on the `.axdb` file itself;
- read on the `<name>.axdb-journal` file SQLite creates next to it during writes (it gets the same mode as the database file).

The usual way is a shared group, for example:

```sh
sudo usermod -aG <visualax-user-group> livetiming
chmod g+rx <event-db-directory>
chmod g+r <event-db-directory>/*.axdb
```

livetiming only ever opens the database read-only.

Check the result with:

```sh
curl -s localhost:8080/api/health
```

- `"error": null` means it is reading the event.
- `EACCES` is a permissions problem.
- `ENOENT` means the symlink or file is missing.
- `NO_ACTIVE_EVENT` means no event is marked for the web in VisualAX.

## Upgrading at the site

```sh
sudo cp /usr/local/bin/livetiming /usr/local/bin/livetiming.prev
sudo install -m 0755 /media/usb/livetiming /usr/local/bin/livetiming
sudo systemctl restart livetiming
```

Rollback:

```sh
sudo install -m 0755 /usr/local/bin/livetiming.prev /usr/local/bin/livetiming
sudo systemctl restart livetiming
```

Phones keep working through a restart: they reconnect on their own and only refetch if the results changed.

## Cutover from the PHP UI

1. **Side by side.** Leave Apache serving the old UI on port 80 and run livetiming on 8080 for an event or two.
2. **Swap.** Run `sudo systemctl disable --now apache2`. In `/etc/systemd/system/livetiming.service`, change `--port 8080` to `--port 80` and uncomment the two `CAP_NET_BIND_SERVICE` lines. Then run `sudo systemctl daemon-reload && sudo systemctl restart livetiming`.

## Logs

```sh
journalctl -u livetiming -f
```

Read failures are logged here with full detail. The `/api/health` endpoint only shows a short error code.
