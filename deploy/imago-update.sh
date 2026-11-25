#!/usr/bin/env bash
# =====================================================================================================
#  Imago updater — runs ON THE SERVER (root, through systemd), never inside the app container.
#
#  The app (Administration › Système › Mise à jour) can only drop a request file in .update/; systemd
#  sees it and runs this script, which does one fixed job:
#     check  : fetch GitHub, list the new commits on the branch
#     apply  : fetch · back up the database · fast-forward · build · restart · health check
#              any failure before the restart leaves the running version untouched;
#              a failed health check after the restart rolls back to the previous version.
#  The app never runs commands on the server: a compromised app could at most deploy the reviewed code
#  already on GitHub.
#
#  Install once:  sudo bash deploy/install-updater.sh      (see deploy/UPDATES.md)
# =====================================================================================================
set -uo pipefail

REPO="${IMAGO_DIR:-/opt/imago-pubco}"
BRANCH="${IMAGO_BRANCH:-main}"
DIR="$REPO/.update"
REQ="$DIR/request.json"
STATUS="$DIR/status.json"
LOG="$DIR/update.log"
BACKUPS="$REPO/backups"

cd "$REPO" || exit 1
mkdir -p "$DIR"
exec 9>"$DIR/.lock"
flock -n 9 || exit 0 # another run is in progress
[ -f "$REQ" ] || exit 0

# The request is read narrowly: a kind from a fixed list, and a name for the log (letters only).
KIND=$(grep -o '"kind" *: *"[a-z]*"' "$REQ" | sed 's/.*"\([a-z]*\)"$/\1/')
BY=$(grep -o '"by" *: *"[^"]*"' "$REQ" | sed 's/.*: *"\(.*\)"$/\1/' | tr -cd 'A-Za-z0-9 ._@-' | cut -c1-80)
rm -f "$REQ"
case "$KIND" in check | apply) ;; *) exit 0 ;; esac

STARTED=$(date -Iseconds)
STATE=working
STEP=""
MESSAGE=""
PREV=""

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >>"$LOG"; }

# ---- status.json (pure bash + git: nothing else needed on the server) ----
# JSON string: escape backslashes and quotes, drop control characters.
js() { printf '"%s"' "$(printf '%s' "$1" | tr -d '\000-\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"; }

# One commit as a JSON object ({} fields from git log, separated by the unit separator).
commit_json() { # $1 ref
  local line
  line=$(git log -1 --format='%h%x1f%H%x1f%s%x1f%an%x1f%cI' "$1" 2>/dev/null) || { printf 'null'; return; }
  [ -n "$line" ] || { printf 'null'; return; }
  local h full subj an d
  IFS=$'\x1f' read -r h full subj an d <<<"$line"
  printf '{"sha":%s,"full":%s,"subject":%s,"author":%s,"date":%s}' "$(js "$h")" "$(js "$full")" "$(js "$subj")" "$(js "$an")" "$(js "$d")"
}

write_status() {
  local now commits="" n=0 h subj an d finished local_changes=false
  now=$(date -Iseconds)
  while IFS=$'\x1f' read -r h subj an d; do
    [ -n "$h" ] || continue
    [ $n -gt 0 ] && commits+=","
    commits+=$(printf '{"sha":%s,"subject":%s,"author":%s,"date":%s}' "$(js "$h")" "$(js "$subj")" "$(js "$an")" "$(js "$d")")
    n=$((n + 1))
  done < <(git log --format='%h%x1f%s%x1f%an%x1f%cI' -n 60 "HEAD..origin/$BRANCH" 2>/dev/null)
  [ "$STATE" = working ] && finished=null || finished=$(js "$now")
  [ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ] && local_changes=true
  {
    printf '{"state":%s,"step":%s,"message":%s,"kind":%s,"requestedBy":%s,' "$(js "$STATE")" "$(js "$STEP")" "$(js "$MESSAGE")" "$(js "$KIND")" "$(js "$BY")"
    printf '"startedAt":%s,"finishedAt":%s,"checkedAt":%s,"branch":%s,' "$(js "$STARTED")" "$finished" "$(js "$now")" "$(js "$BRANCH")"
    printf '"current":%s,"latest":%s,"behind":%d,"commits":[%s],"localChanges":%s}
' "$(commit_json HEAD)" "$(commit_json "origin/$BRANCH")" "$n" "$commits" "$local_changes"
  } >"$STATUS.tmp"
  mv -f "$STATUS.tmp" "$STATUS"
  chown --reference="$DIR" "$STATUS" 2>/dev/null || true
}

finish() { # $1 state, $2 message
  STATE="$1"
  MESSAGE="$2"
  STEP=""
  log "$KIND terminé : $STATE — $MESSAGE"
  write_status
  exit 0
}

step() {
  STEP="$1"
  log "→ $1"
  write_status
}

# docker compose with the sandbox profile when its runner is running (so it is rebuilt too).
compose() {
  if docker compose --profile sandbox ps --status running --services 2>/dev/null | grep -qx 'sandbox-runner'; then
    docker compose --profile sandbox "$@"
  else
    docker compose "$@"
  fi
}

PORT=$(grep -E '^IMAGO_PORT=' .env 2>/dev/null | cut -d= -f2 | tr -cd '0-9')
PORT="${PORT:-8080}"

healthy() {
  for _ in $(seq 1 60); do
    curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && return 0
    sleep 3
  done
  return 1
}

log "=== $KIND demandé par ${BY:-?} ==="
step "Vérification de GitHub"
if ! git fetch --quiet origin "$BRANCH" >>"$LOG" 2>&1; then
  finish failed "Impossible de joindre GitHub (git fetch). Vérifiez l’accès réseau ou les identifiants du dépôt."
fi

if [ "$KIND" = check ]; then
  finish done "Vérification terminée."
fi

# ----- apply -----
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  finish failed "Des fichiers ont été modifiés directement sur le serveur : mise à jour annulée pour ne rien écraser. Voir « git status » dans $REPO."
fi
PREV=$(git rev-parse HEAD)
if [ "$PREV" = "$(git rev-parse "origin/$BRANCH")" ]; then
  finish done "Déjà à jour."
fi
if ! git merge-base --is-ancestor HEAD "origin/$BRANCH"; then
  finish failed "La version du serveur a divergé de GitHub : mise à jour automatique impossible, à faire à la main."
fi

step "Sauvegarde de la base de données"
mkdir -p "$BACKUPS"
chmod 700 "$BACKUPS"
DUMP="$BACKUPS/imago-$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD).sql.gz"
if ! compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' 2>>"$LOG" | gzip >"$DUMP" || [ ! -s "$DUMP" ]; then
  rm -f "$DUMP"
  finish failed "La sauvegarde de la base de données a échoué : mise à jour annulée (rien n’a changé)."
fi
log "Sauvegarde : $DUMP"
ls -1t "$BACKUPS"/imago-*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f # keep the 10 latest

step "Récupération de la nouvelle version"
git merge --ff-only --quiet "origin/$BRANCH" >>"$LOG" 2>&1 || finish failed "git merge a échoué."

step "Compilation (typage et build)"
if ! compose build >>"$LOG" 2>&1; then
  git reset --hard --quiet "$PREV"
  finish failed "La compilation de la nouvelle version a échoué : rien n’a changé, l’ancienne version tourne toujours. Détails dans le journal."
fi

step "Redémarrage de l’application"
compose up -d --remove-orphans >>"$LOG" 2>&1

step "Vérification du démarrage"
if healthy; then
  docker image prune -f >/dev/null 2>&1 || true
  finish done "Mise à jour réussie : $(git log -1 --format='%h %s')."
fi

log "L’application ne répond pas : retour à la version précédente ($PREV)."
step "Retour à la version précédente"
git reset --hard --quiet "$PREV"
compose build >>"$LOG" 2>&1
compose up -d --remove-orphans >>"$LOG" 2>&1
if healthy; then
  finish rolled_back "La nouvelle version ne démarrait pas : retour automatique à la version précédente. La base de données a été sauvegardée dans $DUMP."
fi
finish failed "La nouvelle version ne démarrait pas et le retour arrière n’a pas réussi : intervention nécessaire sur le serveur (sauvegarde : $DUMP)."
