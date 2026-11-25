# One-click updates (Administration › Système › Mise à jour)

The **Mise à jour de l'application** card shows the version running, what is new on GitHub (`main`), and installs it
with one button — no more `ssh` + `git pull` + `docker compose`.

## How it works (and why it is safe)

The app never updates itself and cannot run commands on the server. It only writes a small request file in a folder
shared with the server (`.update/`). A systemd watcher on the server sees it and runs `deploy/imago-update.sh`, which
does one fixed job:

1. **Fetch** `main` from GitHub (only a fast-forward: if the server's copy was edited by hand, it stops).
2. **Back up** the database (`backups/imago-<date>-<version>.sql.gz`, the 10 latest kept).
3. **Build** the new version (typecheck + production build). If the build fails, nothing changes and the old version
   keeps running.
4. **Restart** the app (1–3 minutes of downtime), then check that it answers.
5. If the new version does not start, **roll back** automatically to the previous one.

The card follows each step, reconnects by itself during the restart, and reloads on the new version. Only people with
the **Paramètres système** right (`admin.system`) see the card, the update needs the typed confirmation
`METTRE À JOUR`, and every request is in the audit log.

## Install once, on the server

```bash
cd /opt/imago-pubco && sudo git pull
sudo bash deploy/install-updater.sh
sudo docker compose up -d --build
```

`install-updater.sh` creates `.update/` (writable by the app container), installs `imago-update.path` and
`imago-update.service`, and runs a first check. From then on, use the button.

Requirements: git access to GitHub from the server as root (the same as for `sudo git pull` today), `flock`
(util-linux, present on Ubuntu) and `curl`.

## If something goes wrong

- **Journal:** the card's « Voir le journal », or `/opt/imago-pubco/.update/update.log` on the server.
- **"Des fichiers ont été modifiés directement sur le serveur":** someone edited files on the server. Look with
  `git status` in `/opt/imago-pubco`, keep or discard the changes, then try again.
- **Restore a backup:**
  `gunzip -c backups/<file>.sql.gz | sudo docker compose exec -T db psql -U imago -d imago` (into an empty database).
- **Uninstall:** `sudo systemctl disable --now imago-update.path && sudo rm /etc/systemd/system/imago-update.*`.
