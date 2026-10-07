import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { audit, users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';

export interface AuditFilters {
  text?: string;
  userId?: string;
  /** yyyy-mm-dd, inclusive */
  from?: string;
  to?: string;
}

const MAX_ROWS = 500;

export function AuditTable({ limit, filter = '', filters }: { limit?: number; filter?: string; filters?: AuditFilters }) {
  const { t, fmtDate } = useI18n();
  const userName = useUserName();
  const { rows } = useCollection(audit);
  const { list, total } = useMemo(() => {
    const s = (filters?.text ?? filter).toLowerCase();
    const from = filters?.from ? new Date(filters.from + 'T00:00:00').getTime() : 0;
    const to = filters?.to ? new Date(filters.to + 'T23:59:59.999').getTime() : Infinity;
    const sorted = rows
      .filter((r) => !filters?.userId || r.userId === filters.userId)
      .filter((r) => {
        const at = Date.parse(r.at);
        return at >= from && at <= to;
      })
      .filter((r) => !s || [r.action, r.detail, r.ip ?? '', userName(r.userId)].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => b.at.localeCompare(a.at));
    const cap = limit ?? MAX_ROWS;
    return { list: sorted.slice(0, cap), total: sorted.length };
  }, [rows, filter, filters, limit, userName]);

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('Date', 'Date')}</th>
              <th>{t('Utilisateur', 'User')}</th>
              <th>Action</th>
              <th>{t('Détail', 'Detail')}</th>
              {!limit && <th>IP</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                  {fmtDate(r.at, true)}
                </td>
                <td>{userName(r.userId)}</td>
                <td>
                  <span className="badge mono">{r.action}</span>
                {r.via === 'ui' && (
                  <span className="faint small" style={{ marginLeft: 6 }} title={t('Déclaré par le navigateur (non prouvé par le serveur)', 'Declared by the browser (not proven by the server)')}>
                    ·ui
                  </span>
                )}
                </td>
                <td className="muted small" style={{ maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.detail}>
                  {r.detail}
                </td>
                {!limit && <td className="mono small faint">{r.ip}</td>}
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={limit ? 4 : 5} className="faint" style={{ textAlign: 'center', padding: 24 }}>
                  {t('Aucune entrée', 'No entries')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!limit && total > list.length && (
        <p className="faint small" style={{ padding: '8px 16px', margin: 0 }}>
          {t(`${list.length} entrées affichées sur ${total}. Affinez les filtres pour voir les autres.`, `Showing ${list.length} of ${total} entries. Narrow the filters to see the rest.`)}
        </p>
      )}
    </>
  );
}

export function Audit() {
  const { t } = useI18n();
  const userName = useUserName();
  const { rows: allUsers } = useCollection(users);
  const [q, setQ] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filters = useMemo(() => ({ text: q, userId, from, to }), [q, userId, from, to]);
  const sortedUsers = useMemo(() => [...allUsers].sort((a, b) => a.displayName.localeCompare(b.displayName)), [allUsers]);

  return (
    <Page>
      <PageHeader
        eyebrow={t('Administration', 'Administration')}
        title={t('Journal d’audit', 'Audit log')}
        subtitle={t('Toutes les actions des utilisateurs : connexions, créations, modifications et suppressions.', 'Every user action: sign-ins, creations, changes and deletions.')}
      />
      <div className="row row-wrap" style={{ marginBottom: 16, gap: 12 }}>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 34 }} placeholder={t('Filtrer…', 'Filter…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" style={{ width: 'auto' }} value={userId} onChange={(e) => setUserId(e.target.value)} aria-label={t('Utilisateur', 'User')}>
          <option value="">{t('Tous les utilisateurs', 'All users')}</option>
          {sortedUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {userName(u.id)}
            </option>
          ))}
        </select>
        <label className="row small muted" style={{ gap: 6 }}>
          {t('Du', 'From')}
          <input className="input" type="date" style={{ width: 'auto' }} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="row small muted" style={{ gap: 6 }}>
          {t('Au', 'To')}
          <input className="input" type="date" style={{ width: 'auto' }} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {(q || userId || from || to) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setQ('');
              setUserId('');
              setFrom('');
              setTo('');
            }}
          >
            {t('Réinitialiser', 'Reset')}
          </button>
        )}
      </div>
      <div className="card">
        <AuditTable filters={filters} />
      </div>
    </Page>
  );
}
