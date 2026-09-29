import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { audit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';

export function AuditTable({ limit, filter = '' }: { limit?: number; filter?: string }) {
  const { t, fmtDate } = useI18n();
  const userName = useUserName();
  const { rows } = useCollection(audit);
  const list = useMemo(() => {
    const s = filter.toLowerCase();
    const sorted = rows
      .filter((r) => !s || [r.action, r.detail, userName(r.userId)].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => b.at.localeCompare(a.at));
    return limit ? sorted.slice(0, limit) : sorted;
  }, [rows, filter, limit, userName]);

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{t('Date', 'Date')}</th>
            <th>{t('Utilisateur', 'User')}</th>
            <th>Action</th>
            <th>{t('Détail', 'Detail')}</th>
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
              </td>
              <td className="muted small" style={{ maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.detail}
              </td>
            </tr>
          ))}
          {!list.length && (
            <tr>
              <td colSpan={4} className="faint" style={{ textAlign: 'center', padding: 24 }}>
                {t('Aucune entrée', 'No entries')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Audit() {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  return (
    <Page>
      <PageHeader eyebrow={t('Administration', 'Administration')} title={t('Journal d’audit', 'Audit log')} />
      <div style={{ position: 'relative', width: 320, marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
        <input className="input" style={{ paddingLeft: 34 }} placeholder={t('Filtrer…', 'Filter…')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card">
        <AuditTable filter={q} />
      </div>
    </Page>
  );
}
