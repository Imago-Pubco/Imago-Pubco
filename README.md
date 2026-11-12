# Imago — Pubco Hub 2.0

In-house portal that gathers all Pubco modules in one place. The name comes from the *imago*, the final stage of a butterfly's metamorphosis (egg → caterpillar → chrysalis → imago). Every workflow in the app (invoices, shipments, …) uses these stages to show how far a record has progressed.

## Getting started (development)

```bash
npm install
npm run dev
```

Open http://localhost:5173.

In development, **all data lives in the browser** (localStorage) and demo data is loaded the first time the app runs. Seeded accounts: `admin`, `prod`, `compta`, `lecture`. The shared dev password is in [`src/data/seed.ts`](src/data/seed.ts). To reload the demo data: *Administration → Système → Réinitialiser*.

## Structure

```
src/
  auth/            Session, granular permissions (union of groups, wildcards `*`, `module.*`)
  components/      Shared UI (Butterfly, Stages, Modal, Kpi, …)
  data/            Data access layer (Collection<T>), seed, password hashing
  layout/          App shell, butterfly transition between modules, Ctrl+K palette, theme
  modules/
    registry.ts    ← list of modules; add new modules here
    admin/         Admin portal: users, access groups, audit log, system
    accounting/    Vendor invoices: mailbox → extraction → 3-way match with Business Central → posting
    shipping/      4×6 shipping labels for production (Code128 barcodes, printing)
    rh/            RH (human resources): hosts sections; first section is Conformité (/rh/conformite)
    production/    Production: tools for Microsoft 365 and Dynamics (placeholder for now)
    compliance/    Conformité section of RH: frameworks (ISO 9001/27001, Loi 25, FSC, SST…), requirements and evidence,
                   audits and non-conformities, policy register — all editable from the UI
    it/            IT support: embeds the AKAB support site (address set by `it.settings`);
                   full-screen layout there (`chrome: 'topnav'`): no top bar, modules in a thin bar on top
    estimating/    Packaging estimates: specs, box photo (future AI analysis), quantity breaks, pricing
    o365/          Gestion O365: Microsoft 365 tenants, users, contacts, distribution groups, licenses
  pages/           Login, Home (customizable dashboard)
```

### Adding a module

1. Create `src/modules/<name>/index.tsx` exporting a `ModuleDef` (name, accent colour, permissions, navigation, routes, widgets).
2. Add it to `src/modules/registry.ts`.

Its permissions then appear automatically in the access-group matrix, and its widgets appear on the dashboard.

## Dashboard

The dashboard (home page) is built from widgets: general widgets (welcome, my modules, my activity, notes) plus the widgets each module declares.

- **Default layout**: every user gets it. An administrator sets it from *Personnaliser → Enregistrer comme défaut pour tous*.
- **Personal layout**: each user can reorder (drag and drop), resize (half or full width), hide or add widgets. *Rétablir la disposition par défaut* switches back to the organisation's layout.
- A widget only appears if the user has the matching permission.

## Navigation

- Sidebar: a module's submenu opens automatically when you enter the module and closes when you leave it; clicking the current module (or its arrow) opens or closes it. Each user can reorder modules by dragging the grip that appears on hover; *Rétablir l’ordre du menu* (user menu) restores the default order. Both are saved per user.
- **Administration** is not in the sidebar. The menu under the user name (top right) has a single *Paramètres d’administration* entry, visible only to users with the `admin.access` permission. It opens the admin portal, which has its own tabs (Users, Groups, Audit, System).

## Permissions

Keys use the form `module.area.action` (for example `accounting.invoices.post`). A group may grant:
- `*`: everything (super administrator)
- `accounting.*`: the whole module
- individual keys

A user gets the union of the permissions from all their groups.

**View as another user** (permission `admin.impersonate`, eye button in *Administration → Utilisateurs*): an administrator sees the portal exactly as that person does — same modules, menus and data. It is strictly **read-only** (every change is refused), lasts 30 minutes, shows a bar with an *Exit* button, and the start and end are written to the audit log in the administrator's name. You can only view as someone who does not hold more rights than you.

**Individual rights** (*Administration → Groupes d'accès → Droits individuels*): permissions given to one person directly, on top of their groups, for the exception that does not deserve a group. Needs `admin.groups.manage`; you can only give rights you hold yourself, and the change is written to the audit log. The person's groups' rights are shown locked in the editor.

## Accounting

E-mails with PDFs arrive in the invoice mailbox (Microsoft Graph). Each PDF is **classified** (invoice, purchase order or other) by the AI when enabled, otherwise by keyword rules; people can correct it in *Boîte de réception → Documents*.

| Area | What it does |
|---|---|
| **Boîte de réception** | *Courriels*, and *Documents* with sub-sections *Factures* and *Bons de commande* (classified PDFs) |
| **Entrant (clients)** | Customer POs matched with Business Central **sales orders**, then the **sales invoice** is created in BC; *Factures clients* (BC sales invoices, synced); *À recevoir* (open customer invoices by due date) |
| **Sortant (fournisseurs)** | BC purchase orders and vendor PO confirmations; *Factures fournisseurs* (vendor invoices: 3-way match with the PO and receipt, then the purchase invoice is created in BC; BC purchase invoices, synced); *À payer* (open vendor invoices by due date) |

Invoice stages: 🥚 Received → 🐛 Extracted → ⏳ BC validated → 🦋 Posted. Purchase-order stages: Received → Matched (or Needs attention) → Invoiced (customer PO) / Confirmed (vendor PO).

**Approval mode** (*Comptabilité → Paramètres*): *Manual* (people do every step), *Assisted* (default: new documents are read and matched automatically, a person approves before anything is created in BC) or *Automatic* (perfect matches within an amount cap are also approved; any variance waits for a person). Automatic actions are logged as "Automatisation".

**Business Central sync** (*Synchroniser BC*, or `BC_SYNC_MINUTES` in `.env`) keeps a local copy of sales orders and of sales/purchase invoices; *À payer* and *À recevoir* read that copy, so a payment recorded in BC disappears at the next sync.

Tolerances are configurable. Posting despite exceptions requires `accounting.invoices.override` and a written justification. Other permissions: `accounting.po.process`, `accounting.po.approve`, `accounting.payables.view`.

## Tools → KPI

Sidebar module **Outils / Tools**, first tool **KPI** (working name): indicators, priorities and weekly huddles per team. Permissions: `tools.access` (the module) and `tools.kpi.access` (the tool); fine-grained rights inside the tool can be added later.

- **Dashboard**: critical numbers with status colour, trend and sparkline; missing entries; my priorities and actions; next huddles.
- **Indicators**: weekly / monthly scorecard (last periods, coloured against the target); click a cell to enter a value and a note; definition, unit, direction (higher or lower is better), target, owner, team.
- **Priorities**: per quarter, company or team, sub-priorities, tasks, weekly progress grid and a "weekly update" form.
- **Huddles**: recurring team meetings (day, time, members, ordered sections). The meeting page runs one week at a time: agenda, critical numbers, team scorecard (enter this week's numbers), priorities, Who-What-When (open tasks carry over), parking lot, issues, then a round table where each member fills their own card (what's up, feedback, priority progress, need help, stuck points).
- **Teams**: the groups of people the KPIs, priorities and huddles belong to.

Every write is validated by a strict schema on the server (`src/modules/tools/schemas.ts`) and stamped with who and when by the server. A check-in can only be written by its author or the huddle owner; only the owner (or a super administrator) can hand a huddle over or delete it. Everything is audited.

### KPI data management (Administration → Modules → Outils, permission `tools.kpi.data`)

Administration has a **Modules** tab with one card per module; a card opens that module's settings (a module registers its screen with `settings` in its `ModuleDef`; modules without settings are listed as "No settings yet"). KPI data management is the Tools module's settings, not a page of the KPI section.

- **Old data (archive).** The data exported from Align (metrics, priorities with tasks and weekly updates, huddles with their history) is kept in a hidden store on the server (`meta` table, key `kpi.archive`): never served by the app, never included in the admin export, never erased by anything on the Settings page. It is not in the repository. An administrator loads it once:
  `docker compose cp align-archive.json app:/tmp/archive.json` then `docker compose exec app node server/scripts/load-kpi-archive.ts /tmp/archive.json` (several part files can be given; dev: `node --env-file=.env server/scripts/load-kpi-archive.ts a.json b.json`).
- **Import old data** fills the KPI section from the archive.
- **People matching.** The archive refers to people by name. The settings screen lists them with what each owns, and an administrator associates each one with an Imago account (automatic suggestion by name or e-mail, an explicit choice, or "no account"), saves, then presses **Sync associated people**. The sync applies only the links that changed since the last import/sync and never re-imports: it fills owner and member links, adds the newly linked people's huddle check-ins, and leaves untouched anything edited in the app (a changed field, a member removed, a deleted item).
- **Snapshots.** Up to three snapshots of the KPI data, named with their date and time. When all three are used, the oldest is overwritten after a warning that names it. Snapshots are kept apart from the app and are never erased by "Erase all".
- **Restore** asks first where to restore from: the archive of the old data or one of the snapshots.
- **Erase all KPI data** wipes the nine KPI collections in production (typed confirmation). The archive and the snapshots are never touched.
- Every operation runs in a single database transaction and is written to the audit log.

## Tools → Gestion de projet (project management)

Inspired by FunctionFox: client → project → task, time booked on tasks, budgets against actuals, availability, reports.
Screens (`/tools/pm`): dashboard, projects (+ detail with budget, tasks, time, expenses, team), tasks (list and Kanban),
timesheet (weekly grid, timer, copy last week, submit), approvals, schedule (Gantt-style), availability (capacity vs planned,
time off), clients, reports (6 reports, CSV), team and rates.

- Permissions: `tools.pm.access` (use), `tools.pm.manage` (clients, projects, expenses, billing rates, team),
  `tools.pm.approve` (approve timesheets), `tools.pm.reports` (reports, profitability, cost rates).
- Rules enforced by the server (`server/pmGuard.ts`): billable and rate of a time entry are computed from the task and frozen on the
  entry (a later rate change never reprices old time); approved time is locked; nobody approves their own time; time only on
  open projects where one is a member; projects, tasks and clients with history are archived, not deleted; cost rates
  (`pm.rates`) are readable only with `tools.pm.reports` or `tools.pm.manage`.
- Later phases: invoices and estimates, retainers, recurring entries, notifications, integrations.

## Gestion O365

Manage several Microsoft 365 tenants from one place: tenant overview (domains, user count, license usage), users (create, edit, block/allow sign-in, reset password, delete, assign licenses), mail contacts (add/delete), distribution groups (members add/remove) and licenses (click a license to see who holds it). Choose the tenant in the top bar.

- Users, licenses and the overview use **Microsoft Graph**; contacts and distribution groups use the **Exchange Online admin API**, because Graph cannot create mail contacts or change distribution-list members.
- One multi-tenant app registration signs in to every tenant (`O365_CLIENT_ID` / `O365_CLIENT_SECRET`); setup steps are in [`.env.example`](.env.example).
- Permissions: `o365.access` (read), `o365.tenants.manage`, `o365.users.manage`, `o365.contacts.manage`, `o365.groups.manage`. Every change is written to the audit log.
- In dev (`npm run dev`) two demo tenants are loaded in the browser.

## Estimating (layout — rules to come)

Estimates for custom packaging (folding carton, corrugated, rigid, display, co-packing). Stages: 🥚 Request → 🐛 Costing → ⏳ Sent → 🦋 Won (or Lost).

- Spec sheet: ECMA/FEFCO style, dimensions (mm and inches), material, print process and colours, finishes, converting options, cutting die.
- **Box photo**: upload area ready. Automatic analysis (type, dimensions, material, finishes) will be plugged in later.
- Quantity breaks (up to 5) with cost breakdown, margin, selling price and unit price. Costs and margins are visible only with `estimating.pricing.view`.
- ⚠ The cost model ([`src/modules/estimating/pricing.ts`](src/modules/estimating/pricing.ts)) is **provisional**. It will be replaced by the estimating team's rules.

## Security notes

- **Sign-in:** scrypt password hashes, server-side sessions in an HttpOnly cookie, throttling per account and per IP, passwords of 12+ characters, one-time hashed links for first password and reset.
- **Permissions are enforced on the server.** Nobody can give (or take over) more than they hold: a user manager cannot add themselves to the administrators, edit a group that holds more than they do, or reset the password of a more privileged account.
- **Workflow fields** (approval, match result, BC numbers) are written by the server; the match is recomputed on the server before anything is created in Business Central. Automatic mode only acts on a perfect match whose sender address belongs to the customer / vendor in BC.
- **Network:** put an HTTPS reverse proxy in front, keep `COOKIE_SECURE=true`, set `APP_URL`, and publish port 8080 to the proxy only (for example `127.0.0.1:8080`). Only the proxy should be able to reach the app, because the client address is read from `X-Forwarded-For`.
- The audit log marks entries written by the browser (`·ui`); entries written by the server (`api.*`, `auth.*`, automation) are the ones that prove what happened.

## Production

Docker Compose runs two containers: **app** (Node 24, serves the built front end and the API on port 8080) and **db** (PostgreSQL 17, data in the `db_data` volume). All settings and keys are in `.env` — see [`.env.example`](.env.example). Put your HTTPS reverse proxy in front of port 8080.

```bash
cp .env.example .env      # fill in POSTGRES_PASSWORD, ADMIN_PASSWORD, Microsoft and BC values
docker compose up -d --build
docker compose logs -f app
```

On first start the server creates the access groups and the first administrator from `ADMIN_*`, and loads reference data (compliance frameworks with every requirement set to "to do", estimating materials, default settings). There are **no demo accounts or demo data** in production.

| Piece | Where |
|---|---|
| API server, routes and per-collection permission checks | [`server/api.ts`](server/api.ts) |
| Sessions (HttpOnly cookie), scrypt password hashes, login throttling | [`server/auth.ts`](server/auth.ts) |
| Business Central API v2.0 (vendors, purchase orders, purchase invoices) | [`server/bc.ts`](server/bc.ts) |
| Invoice mailbox (Microsoft Graph), PDFs stored in the database | [`server/mailbox.ts`](server/mailbox.ts) |
| PDF reading with Claude (optional, `ANTHROPIC_API_KEY`) | [`server/extract.ts`](server/extract.ts) |
| Configuration (every `.env` variable) | [`server/config.ts`](server/config.ts) |

The front end picks its backend at build time (`API_MODE` in [`src/data/db.ts`](src/data/db.ts)): `npm run dev` uses the browser backend with demo data, `npm run build` uses the API. `VITE_BACKEND=api|browser` overrides it. *Administration → Système* shows which integrations are configured and has **Test connection** buttons for Business Central and the mailbox.

**Backups**

```bash
docker compose exec db pg_dump -U imago imago > imago-$(date +%F).sql
```

**Not yet validated against a real tenant:** the Business Central and Graph connectors follow the documented APIs but were tested only without credentials. Try them on a BC **Sandbox** environment first. With `BC_POST_MODE=draft` (default) Imago creates the purchase invoice in BC without posting it. That invoice is not linked to the PO receipt lines, so check with your BC partner how drafts should be completed (for example *Get Receipt Lines*) before switching to `post`.
