# Deploying livetiming on the event NUC

The event site has no internet. Everything below is done with a single file, `livetiming`, carried over on a USB stick.

livetiming replaces the old PHP web UI and serves phones on port 80, the standard web port, so drivers just open `http://<nuc-address>/`.

## Get the binary (while online)

Download `livetiming` from the latest GitHub release, or build it yourself with `bun install && bun run build` (output: `out/livetiming`). Copy it and `deploy/livetiming.service` to the USB stick.

The binary targets `linux-x64-baseline`, so it runs on older CPUs without AVX2. It needs no Node, Bun, PHP or Apache on the NUC.

## First install

### 1. Stop the old PHP web UI

The old UI runs in Apache, which also listens on port 80, so it has to stop before livetiming can start.

```sh
sudo systemctl disable --now apache2   # stop it now and on every boot
sudo systemctl mask apache2            # keep anything (e.g. a package upgrade) from starting it again
sudo ss -ltnp 'sport = :80'            # no output means port 80 is free
```

**Do not delete `/var/www/html/VisualAX`.** VisualAX writes `dbSymLink.axdb` there every time it loads an event, and livetiming reads the event through that link. The old PHP files in that directory can stay or go, but the directory and the link must stay.

Removing the `apache2` and `php` packages is optional. Masking the service is enough, and `apt remove` leaves `/var/www/html/VisualAX` alone if you do remove them.

### 2. Install livetiming

```sh
sudo useradd --system --no-create-home --shell /usr/sbin/nologin livetiming
sudo install -m 0755 /media/usb/livetiming /usr/local/bin/livetiming
sudo install -m 0644 /media/usb/livetiming.service /etc/systemd/system/livetiming.service
sudo systemctl daemon-reload
sudo systemctl enable --now livetiming
```

Then give the `livetiming` user read access to the event database (see [Permissions](#permissions)).

### 3. Check it from a phone

Open `http://<nuc-address>/` from a phone on the event Wi-Fi.

## Port 80 without root

Ports below 1024 normally need root. livetiming doesn't run as root: the service runs as the unprivileged `livetiming` user, and systemd grants it one capability, `CAP_NET_BIND_SERVICE`, which allows binding port 80 and nothing else (see `AmbientCapabilities` in `livetiming.service`). It can't write anywhere on the system either.

If livetiming won't start, check whether something else holds port 80:

```sh
journalctl -u livetiming -n 20     # look for an "address in use" or permission error
sudo ss -ltnp 'sport = :80'        # shows the process holding the port
```

Usually that process is Apache still running: go back to step 1.

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
sudo systemctl restart livetiming   # picks up the new group membership
```

livetiming only ever opens the database read-only.

Check the result with:

```sh
curl -s localhost/api/health
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

## Going back to the PHP UI

If livetiming can't be used at an event, the old UI can take port 80 back. Its files and the database link were left in place, so this needs no reinstall:

```sh
sudo systemctl disable --now livetiming
sudo systemctl unmask apache2
sudo systemctl enable --now apache2
```

To return to livetiming afterwards, run step 1 of First install again, then `sudo systemctl enable --now livetiming`.

## Logs

```sh
journalctl -u livetiming -f
```

Read failures are logged here with full detail. The `/api/health` endpoint only shows a short error code.
