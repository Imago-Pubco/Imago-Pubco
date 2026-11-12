import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader, useToast } from '@/components/ui';
import type { Client } from '../schemas';
import { clients, projects } from '../stores';
import { OPEN_STATUSES } from '../Projects.shared';
import { ClientForm } from '../Clients.form';

export function Clients() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const manage = can('tools.pm.manage');

  const { rows: clientRows, loading } = useCollection(clients);
  const { rows: projectRows } = useCollection(projects);

  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  /** null = closed, 'new' = create, or the client being edited. */
  const [editing, setEditing] = useState<Client | 'new' | null>(null);

  /** Number of projects per client, and how many of them are still open. */
  const counts = useMemo(() => {
    const m = new Map<string, { total: number; open: number }>();
    for (const p of projectRows) {
      if (!p.clientId) continue;
      const c = m.get(p.clientId) ?? { total: 0, open: 0 };
      c.total += 1;
      if (OPEN_STATUSES.includes(p.status)) c.open += 1;
      m.set(p.clientId, c);
    }
    return m;
  }, [projectRows]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return clientRows
      .filter((c) => showArchived || !c.archived)
      .filter((c) => !s || [c.name, c.contact, c.email, c.phone].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clientRows, q, showArchived]);

  async function setArchived(c: Client) {
    const archive = !c.archived;
    try {
      await clients.update(c.id, { archived: archive });
      toast(archive ? t('Client archivé', 'Client archived') : t('Client désarchivé', 'Client unarchived'));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('Action impossible', 'Action failed'), 'err');
    }
  }

  async function remove(c: Client) {
    const ok = window.confirm(
      t(`Supprimer le client « ${c.name} » ? Cette action est irréversible.`, `Delete client "${c.name}"? This cannot be undone.`),
    );
    if (!ok) return;
    try {
      await clients.remove(c.id);
      toast(t('Client supprimé', 'Client deleted'));
    } catch (e) {
      // The server refuses when the client has projects: the message says to archive it instead.
      const msg = e instanceof Error ? e.message : '';
      toast(`${t('Suppression refusée', 'Delete refused')} — ${msg || t('Archivez-le plutôt.', 'Archive it instead.')}`, 'err');
    }
  }

  return (
    <Page wide>
      <PageHeader
        eyebrow={t('Outils · Gestion de projet', 'Tools · Project management')}
        title={t('Clients', 'Clients')}
        subtitle={t(
          'Les clients (ou services internes) auxquels sont rattachés les projets.',
          'The clients (or internal departments) that projects belong to.',
        )}
        actions={
          manage ? (
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              <Plus size={16} /> {t('Nouveau client', 'New client')}
            </button>
          ) : undefined
        }
      />

      <div className="card">
        <div className="card-pad row row-wrap" style={{ gap: 10 }}>
          <label className="row" style={{ position: 'relative', flex: '1 1 240px', minWidth: 0 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--text-3)' }} aria-hidden="true" />
            <input
              className="input"
              style={{ paddingLeft: 32, height: 34 }}
              placeholder={t('Rechercher un nom, une personne, un courriel…', 'Search a name, contact or email…')}
              aria-label={t('Rechercher', 'Search')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            <span>{t('Afficher les archivés', 'Show archived')}</span>
          </label>
        </div>

        {loading && clientRows.length === 0 ? (
          <div className="card-pad muted">{t('Chargement…', 'Loading…')}</div>
        ) : clientRows.length === 0 ? (
          <Empty icon={<Building2 size={40} />} title={t('Aucun client pour le moment', 'No clients yet')}>
            {manage
              ? t('Ajoutez un premier client avec le bouton « Nouveau client ».', 'Add a first client with “New client”.')
              : t('Les clients apparaîtront ici lorsqu’ils seront ajoutés.', 'Clients will appear here once added.')}
          </Empty>
        ) : list.length === 0 ? (
          <Empty icon={<Search size={40} />} title={t('Aucun client ne correspond à la recherche', 'No client matches the search')}>
            {!showArchived && clientRows.some((c) => c.archived) && t('Des clients archivés sont masqués.', 'Some archived clients are hidden.')}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Client', 'Client')}</th>
                  <th>{t('Personne-ressource', 'Contact person')}</th>
                  <th>{t('Courriel', 'Email')}</th>
                  <th>{t('Téléphone', 'Phone')}</th>
                  <th className="num">{t('Projets', 'Projects')}</th>
                  <th className="num">{t('Projets ouverts', 'Open projects')}</th>
                  {manage && <th aria-label={t('Actions', 'Actions')} />}
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const n = counts.get(c.id) ?? { total: 0, open: 0 };
                  return (
                    <tr key={c.id} style={c.archived ? { opacity: 0.6 } : undefined}>
                      <td>
                        <strong style={{ fontWeight: 500 }}>{c.name}</strong>
                        {c.archived && (
                          <span className="badge" style={{ marginLeft: 8 }}>
                            {t('Archivé', 'Archived')}
                          </span>
                        )}
                      </td>
                      <td className="small">{c.contact || <span className="faint">—</span>}</td>
                      <td className="small">{c.email || <span className="faint">—</span>}</td>
                      <td className="small">{c.phone || <span className="faint">—</span>}</td>
                      <td className="num">{n.total}</td>
                      <td className="num">{n.open}</td>
                      {manage && (
                        <td>
                          <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            <button className="btn btn-ghost btn-icon btn-sm" title={t('Modifier', 'Edit')} aria-label={t('Modifier', 'Edit')} onClick={() => setEditing(c)}>
                              <Pencil size={15} />
                            </button>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              title={c.archived ? t('Désarchiver', 'Unarchive') : t('Archiver', 'Archive')}
                              aria-label={c.archived ? t('Désarchiver', 'Unarchive') : t('Archiver', 'Archive')}
                              onClick={() => setArchived(c)}
                            >
                              {c.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                            </button>
                            <button
                              className="btn btn-ghost btn-icon btn-sm btn-danger"
                              title={t('Supprimer', 'Delete')}
                              aria-label={t('Supprimer', 'Delete')}
                              onClick={() => remove(c)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== null && <ClientForm client={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}
