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
    it/            IT support: embeds the AKAB support site (address set by `it.settings`);
                   full-screen layout there (`chrome: 'topnav'`): no top bar, modules in a thin bar on top
    estimating/    Packaging estimates: specs, box photo (future AI analysis), quantity breaks, pricing
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

## Accounting: invoice flow

| Stage | Meaning |
|---|---|
| 🥚 Received | E-mail with a PDF in the invoice mailbox |
| 🐛 Extracted | Invoice fields read (vendor, no., PO, lines) |
| ⏳ BC validated | 3-way match: invoice ↔ PO ↔ receipt (quantities received and not yet invoiced, price within tolerance, vendor, currency) |
| 🦋 Posted | Purchase invoice created in Business Central |

Tolerances are configurable (*Comptabilité → Paramètres*). Posting despite exceptions requires the `accounting.invoices.override` permission and a written justification.

## Estimating (layout — rules to come)

Estimates for custom packaging (folding carton, corrugated, rigid, display, co-packing). Stages: 🥚 Request → 🐛 Costing → ⏳ Sent → 🦋 Won (or Lost).

- Spec sheet: ECMA/FEFCO style, dimensions (mm and inches), material, print process and colours, finishes, converting options, cutting die.
- **Box photo**: upload area ready. Automatic analysis (type, dimensions, material, finishes) will be plugged in later.
- Quantity breaks (up to 5) with cost breakdown, margin, selling price and unit price. Costs and margins are visible only with `estimating.pricing.view`.
- ⚠ The cost model ([`src/modules/estimating/pricing.ts`](src/modules/estimating/pricing.ts)) is **provisional**. It will be replaced by the estimating team's rules.

## Production (planned)

Ubuntu server + PostgreSQL. The screens depend only on the `Collection<T>` interface ([`src/data/db.ts`](src/data/db.ts)) and on the connectors in [`src/modules/accounting/integrations.ts`](src/modules/accounting/integrations.ts). Going to production means:

1. **Imago API** (Node + PostgreSQL) exposing the same collections over REST, with server-side authentication (argon2/bcrypt, sessions).
2. **Mailbox**: Microsoft Graph (`/users/{mailbox}/messages` + attachments).
3. **Extraction**: PDF text, then AI extraction on the server.
4. **Business Central**: API v2.0 (`purchaseOrders`, `purchaseReceipts`, `purchaseInvoices`).
5. Replace the browser implementations with HTTP clients. The screens don't change.
