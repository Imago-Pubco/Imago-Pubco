import { useState } from 'react';
import { Plus, FileText, ExternalLink, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { logAudit, users } from '@/data/stores';
import { useUserName } from '@/data/hooks';
import { useI18n, type L } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, Modal, PageHeader, useToast } from '@/components/ui';
import { frameworks, policyDocs } from '../stores';
import { isOverdue, isSoon } from '../ui';
import type { PolicyDoc } from '../types';

const STATUS: Record<PolicyDoc['status'], [L, string]> = {
  draft: [{ fr: 'Brouillon', en: 'Draft' }, 'badge-warn'],
  approved: [{ fr: 'Approuvé', en: 'Approved' }, 'badge-ok'],
  obsolete: [{ fr: 'Obsolète', en: 'Obsolete' }, ''],
};

/** Register of policies, procedures and records, linked to frameworks. */
export function Documents() {
  const { t, fmtDate } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const userName = useUserName();
  const { rows } = useCollection(policyDocs);
  const { rows: fws } = useCollection(frameworks);
  const { rows: allUsers } = useCollection(users);
  const [edit, setEdit] = useState<PolicyDoc | null>(null);
  const manage = can('compliance.documents');

  const save = async () => {
    if (!edit) return;
    if (await policyDocs.get(edit.id)) await policyDocs.update(edit.id, edit);
    else await policyDocs.insert(edit);
    await logAudit(user!.id, 'compliance.document.save', `${edit.title} v${edit.version}`);
    setEdit(null);
    toast(t('Document enregistré', 'Document saved'));
  };
  const sorted = [...rows].sort((a, b) => (a.reviewDue ?? '9').localeCompare(b.reviewDue ?? '9'));

  return (
    <Page>
      <PageHeader
        eyebrow={t('Conformité', 'Compliance')}
        title={t('Politiques et procédures', 'Policies & procedures')}
        subtitle={t('Registre des documents maîtrisés et de leurs révisions.', 'Register of controlled documents and their reviews.')}
        actions={
          manage && (
            <button className="btn btn-primary" onClick={() => setEdit({ id: uid('doc_'), title: '', version: '1.0', frameworkIds: [], ownerId: user!.id, status: 'draft' })}>
              <Plus size={16} /> {t('Document', 'Document')}
            </button>
          )
        }
      />
      <div className="card">
        {sorted.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Document', 'Document')}</th>
                  <th>Version</th>
                  <th>{t('Référentiels', 'Frameworks')}</th>
                  <th>{t('Responsable', 'Owner')}</th>
                  <th>{t('Approuvé le', 'Approved')}</th>
                  <th>{t('Prochaine révision', 'Next review')}</th>
                  <th>{t('Statut', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr key={d.id} className="clickable" onClick={() => setEdit(structuredClone(d))}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <FileText size={16} className="faint" />
                        {d.title}
                        {d.link && (
                          <a href={d.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="faint">
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="mono">{d.version}</td>
                    <td>
                      <div className="row row-wrap" style={{ gap: 4 }}>
                        {d.frameworkIds.map((id) => {
                          const f = fws.find((x) => x.id === id);
                          return f ? <span key={id} className="badge" style={{ background: `color-mix(in srgb, ${f.color} 15%, transparent)`, color: f.color }}>{f.code}</span> : null;
                        })}
                      </div>
                    </td>
                    <td className="muted small">{userName(d.ownerId)}</td>
                    <td className="muted">{fmtDate(d.approvedAt)}</td>
                    <td className={`small ${isOverdue(d.reviewDue) ? 'due-over' : isSoon(d.reviewDue) ? 'due-soon' : 'muted'}`}>{fmtDate(d.reviewDue)}</td>
                    <td><span className={`badge ${STATUS[d.status][1]}`}>{t(STATUS[d.status][0])}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<FileText size={36} />} title={t('Aucun document', 'No documents')} />
        )}
      </div>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.title || t('Nouveau document', 'New document')}
        footer={
          manage ? (
            <>
              {edit && rows.some((d) => d.id === edit.id) && (
                <button className="btn btn-danger" onClick={async () => { await policyDocs.remove(edit.id); setEdit(null); }}>
                  <Trash2 size={15} />
                </button>
              )}
              <span className="spacer" />
              <button className="btn" onClick={() => setEdit(null)}>{t('Annuler', 'Cancel')}</button>
              <button className="btn btn-primary" onClick={save} disabled={!edit?.title.trim()}>{t('Enregistrer', 'Save')}</button>
            </>
          ) : undefined
        }
      >
        {edit && (
          <fieldset disabled={!manage} style={{ border: 'none', padding: 0, margin: 0 }} className="form-grid">
            <label className="field span-2">
              <span>{t('Titre', 'Title')}</span>
              <input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} autoFocus />
            </label>
            <label className="field">
              <span>Version</span>
              <input className="input mono" value={edit.version} onChange={(e) => setEdit({ ...edit, version: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('Statut', 'Status')}</span>
              <select className="select" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as PolicyDoc['status'] })}>
                {(Object.keys(STATUS) as PolicyDoc['status'][]).map((s) => <option key={s} value={s}>{t(STATUS[s][0])}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{t('Responsable', 'Owner')}</span>
              <select className="select" value={edit.ownerId} onChange={(e) => setEdit({ ...edit, ownerId: e.target.value })}>
                {allUsers.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{t('Approuvé le', 'Approved on')}</span>
              <input className="input" type="date" value={edit.approvedAt ?? ''} onChange={(e) => setEdit({ ...edit, approvedAt: e.target.value || undefined })} />
            </label>
            <label className="field">
              <span>{t('Prochaine révision', 'Next review')}</span>
              <input className="input" type="date" value={edit.reviewDue ?? ''} onChange={(e) => setEdit({ ...edit, reviewDue: e.target.value || undefined })} />
            </label>
            <label className="field">
              <span>{t('Lien (SharePoint, Drive…)', 'Link (SharePoint, Drive…)')}</span>
              <input className="input" value={edit.link ?? ''} onChange={(e) => setEdit({ ...edit, link: e.target.value || undefined })} placeholder="https://" />
            </label>
            <div className="field span-2">
              <span>{t('Référentiels liés', 'Linked frameworks')}</span>
              <div className="chips">
                {fws.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`chip ${edit.frameworkIds.includes(f.id) ? 'on' : ''}`}
                    onClick={() => setEdit({ ...edit, frameworkIds: edit.frameworkIds.includes(f.id) ? edit.frameworkIds.filter((x) => x !== f.id) : [...edit.frameworkIds, f.id] })}
                  >
                    {f.code}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>
        )}
      </Modal>
    </Page>
  );
}
