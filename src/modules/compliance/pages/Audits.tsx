import { useState } from 'react';
import { Plus, ClipboardCheck, CheckCircle2, Circle, Trash2, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { logAudit, users } from '@/data/stores';
import { useUserName } from '@/data/hooks';
import { useI18n, type L } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, Modal, PageHeader, useToast } from '@/components/ui';
import { audits, frameworks, requirements } from '../stores';
import { Badge, SEVERITY, isOverdue } from '../ui';
import type { Audit, Finding, FindingSeverity } from '../types';

const KIND: Record<Audit['kind'], L> = {
  internal: { fr: 'Interne', en: 'Internal' },
  external: { fr: 'Externe', en: 'External' },
  certification: { fr: 'Certification', en: 'Certification' },
};

export function Audits() {
  const { t, fmtDate } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const userName = useUserName();
  const { rows } = useCollection(audits);
  const { rows: fws } = useCollection(frameworks);
  const { rows: reqs } = useCollection(requirements);
  const { rows: allUsers } = useCollection(users);
  const [edit, setEdit] = useState<Audit | null>(null);
  const manage = can('compliance.audits');

  const fw = (id: string) => fws.find((f) => f.id === id);
  const sorted = [...rows].sort((a, b) => (a.status === b.status ? b.date.localeCompare(a.date) : a.status === 'planned' ? -1 : 1));
  const open = rows.flatMap((a) => a.findings.filter((f) => !f.closed).map((f) => ({ f, a })));

  const toggleFinding = async (a: Audit, fid: string) => {
    await audits.update(a.id, { findings: a.findings.map((x) => (x.id === fid ? { ...x, closed: !x.closed } : x)) });
    await logAudit(user!.id, 'compliance.finding.toggle', `${a.title}: ${fid}`);
  };
  const save = async () => {
    if (!edit) return;
    if (await audits.get(edit.id)) await audits.update(edit.id, edit);
    else await audits.insert(edit);
    await logAudit(user!.id, 'compliance.audit.save', edit.title);
    setEdit(null);
    toast(t('Audit enregistré', 'Audit saved'));
  };
  const setFinding = (fid: string, patch: Partial<Finding>) => edit && setEdit({ ...edit, findings: edit.findings.map((f) => (f.id === fid ? { ...f, ...patch } : f)) });

  return (
    <Page>
      <PageHeader
        eyebrow={t('Conformité', 'Compliance')}
        title={t('Audits et non-conformités', 'Audits & non-conformities')}
        actions={
          manage && (
            <button
              className="btn btn-primary"
              onClick={() => setEdit({ id: uid('au_'), frameworkId: fws[0]?.id ?? '', kind: 'internal', title: '', date: new Date().toISOString().slice(0, 10), auditor: '', status: 'planned', findings: [], notes: '' })}
            >
              <Plus size={16} /> {t('Audit', 'Audit')}
            </button>
          )
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>{t('Non-conformités ouvertes', 'Open non-conformities')} ({open.length})</h3>
        </div>
        {open.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>{t('Constat', 'Finding')}</th>
                  <th>{t('Type', 'Type')}</th>
                  <th>{t('Référentiel', 'Framework')}</th>
                  <th>{t('Responsable', 'Owner')}</th>
                  <th>{t('Échéance', 'Due')}</th>
                </tr>
              </thead>
              <tbody>
                {open.map(({ f, a }) => (
                  <tr key={f.id}>
                    <td>
                      {manage && (
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => toggleFinding(a, f.id)} title={t('Fermer', 'Close')}>
                          <Circle size={16} />
                        </button>
                      )}
                    </td>
                    <td>
                      {f.title}
                      <div className="faint small">{a.title}</div>
                    </td>
                    <td><Badge map={SEVERITY} k={f.severity} /></td>
                    <td className="muted">{fw(a.frameworkId)?.code}</td>
                    <td className="muted small">{userName(f.ownerId)}</td>
                    <td className={`small ${isOverdue(f.dueDate) ? 'due-over' : 'muted'}`}>{fmtDate(f.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card-pad faint small">{t('Aucune non-conformité ouverte.', 'No open non-conformities.')}</div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>{t('Audits', 'Audits')}</h3>
        </div>
        {sorted.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Date', 'Date')}</th>
                  <th>{t('Audit', 'Audit')}</th>
                  <th>{t('Référentiel', 'Framework')}</th>
                  <th>{t('Type', 'Type')}</th>
                  <th>{t('Auditeur', 'Auditor')}</th>
                  <th className="num">{t('Constats', 'Findings')}</th>
                  <th>{t('Statut', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <tr key={a.id} className="clickable" onClick={() => setEdit(structuredClone(a))}>
                    <td className="muted">{fmtDate(a.date)}</td>
                    <td>{a.title}</td>
                    <td>
                      <span className="fw-dot" style={{ background: fw(a.frameworkId)?.color }} /> {fw(a.frameworkId)?.code}
                    </td>
                    <td className="muted">{t(KIND[a.kind])}</td>
                    <td className="muted small">{a.auditor}</td>
                    <td className="num">
                      {a.findings.filter((f) => !f.closed).length}/{a.findings.length}
                    </td>
                    <td>{a.status === 'planned' ? <span className="badge badge-info">{t('Planifié', 'Planned')}</span> : <span className="badge badge-ok">{t('Réalisé', 'Done')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<ClipboardCheck size={36} />} title={t('Aucun audit', 'No audits')} />
        )}
      </div>

      <Modal
        open={!!edit}
        large
        onClose={() => setEdit(null)}
        title={edit?.title || t('Nouvel audit', 'New audit')}
        footer={
          manage ? (
            <>
              {edit && rows.some((a) => a.id === edit.id) && (
                <button className="btn btn-danger" onClick={async () => { await audits.remove(edit.id); setEdit(null); }}>
                  <Trash2 size={15} />
                </button>
              )}
              <span className="spacer" />
              <button className="btn" onClick={() => setEdit(null)}>{t('Annuler', 'Cancel')}</button>
              <button className="btn btn-primary" onClick={save} disabled={!edit?.title.trim() || !edit?.frameworkId}>{t('Enregistrer', 'Save')}</button>
            </>
          ) : undefined
        }
      >
        {edit && (
          <fieldset disabled={!manage} style={{ border: 'none', padding: 0, margin: 0 }} className="stack">
            <div className="form-grid">
              <label className="field span-2">
                <span>{t('Titre', 'Title')}</span>
                <input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} autoFocus />
              </label>
              <label className="field">
                <span>{t('Référentiel', 'Framework')}</span>
                <select className="select" value={edit.frameworkId} onChange={(e) => setEdit({ ...edit, frameworkId: e.target.value })}>
                  {fws.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>{t('Type', 'Type')}</span>
                <select className="select" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Audit['kind'] })}>
                  {(Object.keys(KIND) as Audit['kind'][]).map((k) => <option key={k} value={k}>{t(KIND[k])}</option>)}
                </select>
              </label>
              <label className="field">
                <span>{t('Date', 'Date')}</span>
                <input className="input" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
              </label>
              <label className="field">
                <span>{t('Statut', 'Status')}</span>
                <select className="select" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Audit['status'] })}>
                  <option value="planned">{t('Planifié', 'Planned')}</option>
                  <option value="done">{t('Réalisé', 'Done')}</option>
                </select>
              </label>
              <label className="field span-2">
                <span>{t('Auditeur', 'Auditor')}</span>
                <input className="input" value={edit.auditor} onChange={(e) => setEdit({ ...edit, auditor: e.target.value })} />
              </label>
            </div>

            <div>
              <div className="row" style={{ marginBottom: 8 }}>
                <span className="label">{t('Constats', 'Findings')}</span>
                <span className="spacer" />
                {manage && (
                  <button type="button" className="btn btn-sm" onClick={() => setEdit({ ...edit, findings: [...edit.findings, { id: uid('f_'), title: '', severity: 'minor', ownerId: user!.id, closed: false }] })}>
                    <Plus size={14} /> {t('Constat', 'Finding')}
                  </button>
                )}
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {edit.findings.map((f) => (
                  <div key={f.id} className={`finding-row ${f.closed ? 'closed' : ''}`}>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setFinding(f.id, { closed: !f.closed })} title={f.closed ? t('Rouvrir', 'Reopen') : t('Fermer', 'Close')}>
                      {f.closed ? <CheckCircle2 size={17} color="var(--ok)" /> : <Circle size={17} />}
                    </button>
                    <input className="input input-sm" value={f.title} placeholder={t('Description du constat', 'Finding description')} onChange={(e) => setFinding(f.id, { title: e.target.value })} />
                    <select className="select input-sm" value={f.severity} onChange={(e) => setFinding(f.id, { severity: e.target.value as FindingSeverity })}>
                      {(Object.keys(SEVERITY) as FindingSeverity[]).map((s) => <option key={s} value={s}>{t(SEVERITY[s][0])}</option>)}
                    </select>
                    <select className="select input-sm" value={f.requirementId ?? ''} onChange={(e) => setFinding(f.id, { requirementId: e.target.value || undefined })}>
                      <option value="">{t('— Exigence liée —', '— Linked requirement —')}</option>
                      {reqs.filter((r) => r.frameworkId === edit.frameworkId).map((r) => <option key={r.id} value={r.id}>{r.ref} {r.title}</option>)}
                    </select>
                    <select className="select input-sm" value={f.ownerId} onChange={(e) => setFinding(f.id, { ownerId: e.target.value })}>
                      {allUsers.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                    </select>
                    <input className="input input-sm" type="date" value={f.dueDate ?? ''} onChange={(e) => setFinding(f.id, { dueDate: e.target.value || undefined })} />
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit({ ...edit, findings: edit.findings.filter((x) => x.id !== f.id) })}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {!edit.findings.length && <div className="faint small">{t('Aucun constat.', 'No findings.')}</div>}
              </div>
            </div>

            <label className="field">
              <span>{t('Notes', 'Notes')}</span>
              <textarea className="textarea" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </label>
          </fieldset>
        )}
      </Modal>
    </Page>
  );
}
