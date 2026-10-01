import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Search, Paperclip, X, ListChecks } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { logAudit, users } from '@/data/stores';
import { useUserName } from '@/data/hooks';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, Empty, Modal, useToast } from '@/components/ui';
import { Stages } from '@/components/Stages';
import { audits, frameworks, policyDocs, requirements } from '../stores';
import { Badge, CATEGORIES, REQ_STAGES, REQ_STATUS, RISK, ScoreRing, isOverdue, isSoon, reqStageIndex, score } from '../ui';
import { FrameworkForm } from './Frameworks';
import type { Framework, Requirement, RequirementStatus, RiskLevel } from '../types';

export function FrameworkDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, fmtDate } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const userName = useUserName();
  const { rows: fws, loading } = useCollection(frameworks);
  const { rows: allReqs } = useCollection(requirements);
  const { rows: aus } = useCollection(audits);
  const { rows: docs } = useCollection(policyDocs);
  const { rows: allUsers } = useCollection(users);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<RequirementStatus | 'all'>('all');
  const [edit, setEdit] = useState<Requirement | null>(null);
  const [fwEdit, setFwEdit] = useState<Framework | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [evidence, setEvidence] = useState('');

  const fw = fws.find((f) => f.id === id);
  const reqs = useMemo(() => allReqs.filter((r) => r.frameworkId === id), [allReqs, id]);
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return reqs
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => !s || `${r.ref} ${r.title}`.toLowerCase().includes(s))
      .sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
  }, [reqs, q, status]);

  if (loading) return null;
  if (!fw)
    return (
      <Page>
        <p>{t('Référentiel introuvable.', 'Framework not found.')}</p>
        <Link to="/compliance/frameworks">{t('Retour', 'Back')}</Link>
      </Page>
    );

  const canEdit = can('compliance.edit');
  const setReqStatus = async (r: Requirement, s: RequirementStatus) => {
    await requirements.update(r.id, { status: s, updatedAt: new Date().toISOString() });
    await logAudit(user!.id, 'compliance.requirement.status', `${fw.code} ${r.ref} → ${s}`);
  };
  const blank = (): Requirement => ({ id: uid('req_'), frameworkId: fw.id, ref: '', title: '', description: '', ownerId: user!.id, status: 'todo', risk: 'medium', evidence: [], notes: '', updatedAt: new Date().toISOString() });

  const saveReq = async () => {
    if (!edit) return;
    const next = { ...edit, updatedAt: new Date().toISOString() };
    if (await requirements.get(edit.id)) await requirements.update(edit.id, next);
    else await requirements.insert(next);
    await logAudit(user!.id, 'compliance.requirement.save', `${fw.code} ${edit.ref}`);
    setEdit(null);
    toast(t('Exigence enregistrée', 'Requirement saved'));
  };
  const removeReq = async (r: Requirement) => {
    await requirements.remove(r.id);
    await logAudit(user!.id, 'compliance.requirement.delete', `${fw.code} ${r.ref}`);
    setEdit(null);
  };
  const saveFw = async () => {
    if (!fwEdit) return;
    await frameworks.update(fwEdit.id, fwEdit);
    setFwEdit(null);
    toast(t('Référentiel enregistré', 'Framework saved'));
  };
  const deleteFw = async () => {
    for (const r of reqs) await requirements.remove(r.id);
    await frameworks.remove(fw.id);
    await logAudit(user!.id, 'compliance.framework.delete', fw.code);
    nav('/compliance/frameworks');
  };

  const fwAudits = aus.filter((a) => a.frameworkId === fw.id).sort((a, b) => b.date.localeCompare(a.date));
  const fwDocs = docs.filter((d) => d.frameworkIds.includes(fw.id));

  return (
    <Page wide>
      <Link to="/compliance/frameworks" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, marginLeft: -10 }}>
        <ArrowLeft size={16} /> {t('Référentiels', 'Frameworks')}
      </Link>

      <div className="card fw-hero" style={{ ['--fw' as string]: fw.color, marginBottom: 16 }}>
        <ScoreRing value={score(reqs)} size={84} color={fw.color} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="fw-code">{fw.code} · {t(CATEGORIES[fw.category])}</div>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>{fw.name}</h1>
          {fw.description && <p className="muted" style={{ margin: '6px 0 0' }}>{fw.description}</p>}
          <div className="row small faint" style={{ marginTop: 8, gap: 16 }}>
            <span>{t('Responsable', 'Owner')} : {userName(fw.ownerId)}</span>
            {fw.targetDate && <span>{t('Date cible', 'Target')} : {fmtDate(fw.targetDate)}</span>}
            {fw.certified && <span style={{ color: 'var(--ok)' }}>{t('Certifié', 'Certified')}</span>}
          </div>
        </div>
        <Can permission="compliance.frameworks">
          <div className="row">
            <button className="btn btn-sm" onClick={() => setFwEdit(structuredClone(fw))}>
              <Pencil size={14} /> {t('Modifier', 'Edit')}
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} />
            </button>
          </div>
        </Can>
      </div>

      <div className="fw-detail-grid">
        <div className="card">
          <div className="card-head">
            <h3>{t('Exigences', 'Requirements')} ({reqs.length})</h3>
            <div className="row">
              <div style={{ position: 'relative', width: 220 }}>
                <Search size={15} style={{ position: 'absolute', left: 9, top: 8, color: 'var(--text-3)' }} />
                <input className="input input-sm" style={{ paddingLeft: 30 }} placeholder={t('Rechercher…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select className="select input-sm" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value as RequirementStatus | 'all')}>
                <option value="all">{t('Tous les statuts', 'All statuses')}</option>
                {(Object.keys(REQ_STATUS) as RequirementStatus[]).map((s) => <option key={s} value={s}>{t(REQ_STATUS[s][0])}</option>)}
              </select>
              {canEdit && (
                <button className="btn btn-sm btn-primary" onClick={() => { setEvidence(''); setEdit(blank()); }}>
                  <Plus size={14} /> {t('Exigence', 'Requirement')}
                </button>
              )}
            </div>
          </div>
          {filtered.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Réf.</th>
                    <th>{t('Exigence', 'Requirement')}</th>
                    <th>{t('Risque', 'Risk')}</th>
                    <th>{t('Statut', 'Status')}</th>
                    <th>{t('Prochaine revue', 'Next review')}</th>
                    <th className="num"><Paperclip size={13} /></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => { setEvidence(''); setEdit(structuredClone(r)); }}>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{r.ref}</td>
                      <td>
                        {r.title}
                        <div className="faint small">{userName(r.ownerId)}</div>
                      </td>
                      <td><Badge map={RISK} k={r.risk} /></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {canEdit ? (
                          <select className={`select input-sm status-select st-${r.status}`} value={r.status} onChange={(e) => setReqStatus(r, e.target.value as RequirementStatus)}>
                            {(Object.keys(REQ_STATUS) as RequirementStatus[]).map((s) => <option key={s} value={s}>{t(REQ_STATUS[s][0])}</option>)}
                          </select>
                        ) : (
                          <Badge map={REQ_STATUS} k={r.status} />
                        )}
                      </td>
                      <td className={`small ${isOverdue(r.reviewDue) ? 'due-over' : isSoon(r.reviewDue) ? 'due-soon' : 'muted'}`}>{fmtDate(r.reviewDue)}</td>
                      <td className="num faint small">{r.evidence.length || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={<ListChecks size={34} />} title={t('Aucune exigence', 'No requirements')}>
              {canEdit && t('Ajoutez les exigences de ce référentiel.', 'Add this framework’s requirements.')}
            </Empty>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head"><h3>{t('Avancement', 'Progress')}</h3></div>
            <div className="card-pad stack" style={{ gap: 10 }}>
              {REQ_STAGES.map((s) => {
                const n = reqs.filter((r) => r.status === s.key).length;
                return (
                  <div key={s.key} className="row small">
                    <span style={{ width: 110 }}>{t(s.label)}</span>
                    <div className="bar"><div style={{ width: `${reqs.length ? (n / reqs.length) * 100 : 0}%`, background: fw.color }} /></div>
                    <span className="faint" style={{ width: 24, textAlign: 'right' }}>{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h3>{t('Audits', 'Audits')}</h3>
              <Link to="/compliance/audits" className="btn btn-ghost btn-sm">{t('Tout voir', 'View all')}</Link>
            </div>
            <ul className="widget-list" style={{ border: 'none' }}>
              {fwAudits.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <span className="widget-list-main">{a.title}</span>
                  <span className="faint small">{fmtDate(a.date)}</span>
                </li>
              ))}
              {!fwAudits.length && <li className="faint small">{t('Aucun audit', 'No audits')}</li>}
            </ul>
          </div>
          <div className="card">
            <div className="card-head">
              <h3>{t('Documents', 'Documents')}</h3>
              <Link to="/compliance/documents" className="btn btn-ghost btn-sm">{t('Tout voir', 'View all')}</Link>
            </div>
            <ul className="widget-list" style={{ border: 'none' }}>
              {fwDocs.map((d) => (
                <li key={d.id}>
                  <span className="widget-list-main">{d.title}</span>
                  <span className="faint small">v{d.version}</span>
                </li>
              ))}
              {!fwDocs.length && <li className="faint small">{t('Aucun document', 'No documents')}</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Requirement editor */}
      <Modal
        open={!!edit}
        large
        onClose={() => setEdit(null)}
        title={edit && reqs.some((r) => r.id === edit.id) ? `${fw.code} ${edit.ref}` : t('Nouvelle exigence', 'New requirement')}
        footer={
          canEdit ? (
            <>
              {edit && reqs.some((r) => r.id === edit.id) && (
                <button className="btn btn-danger" onClick={() => removeReq(edit)}>
                  <Trash2 size={15} /> {t('Supprimer', 'Delete')}
                </button>
              )}
              <span className="spacer" />
              <button className="btn" onClick={() => setEdit(null)}>{t('Annuler', 'Cancel')}</button>
              <button className="btn btn-primary" onClick={saveReq} disabled={!edit?.ref.trim() || !edit?.title.trim()}>{t('Enregistrer', 'Save')}</button>
            </>
          ) : undefined
        }
      >
        {edit && (
          <fieldset disabled={!canEdit} style={{ border: 'none', padding: 0, margin: 0 }} className="stack">
            <Stages stages={REQ_STAGES} current={reqStageIndex(edit.status)} complete={edit.status === 'verified'} />
            <div className="form-grid">
              <label className="field">
                <span>{t('Référence', 'Reference')}</span>
                <input className="input mono" value={edit.ref} onChange={(e) => setEdit({ ...edit, ref: e.target.value })} placeholder="A.5.1 / Art. 3" />
              </label>
              <label className="field">
                <span>{t('Statut', 'Status')}</span>
                <select className="select" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as RequirementStatus })}>
                  {(Object.keys(REQ_STATUS) as RequirementStatus[]).map((s) => <option key={s} value={s}>{t(REQ_STATUS[s][0])}</option>)}
                </select>
              </label>
              <label className="field span-2">
                <span>{t('Exigence', 'Requirement')}</span>
                <input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              </label>
              <label className="field span-2">
                <span>{t('Description / comment nous y répondons', 'Description / how we comply')}</span>
                <textarea className="textarea" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
              </label>
              <label className="field">
                <span>{t('Responsable', 'Owner')}</span>
                <select className="select" value={edit.ownerId} onChange={(e) => setEdit({ ...edit, ownerId: e.target.value })}>
                  {allUsers.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                </select>
              </label>
              <label className="field">
                <span>{t('Risque', 'Risk')}</span>
                <select className="select" value={edit.risk} onChange={(e) => setEdit({ ...edit, risk: e.target.value as RiskLevel })}>
                  {(Object.keys(RISK) as RiskLevel[]).map((k) => <option key={k} value={k}>{t(RISK[k][0])}</option>)}
                </select>
              </label>
              <label className="field">
                <span>{t('Prochaine revue', 'Next review')}</span>
                <input className="input" type="date" value={edit.reviewDue ?? ''} onChange={(e) => setEdit({ ...edit, reviewDue: e.target.value || undefined })} />
              </label>
            </div>

            <div>
              <div className="label" style={{ marginBottom: 8 }}>{t('Preuves', 'Evidence')}</div>
              <ul className="widget-list">
                {edit.evidence.map((ev) => (
                  <li key={ev.id}>
                    <Paperclip size={14} className="faint" />
                    <span className="widget-list-main">{ev.label}</span>
                    <span className="faint small">{userName(ev.by)} · {fmtDate(ev.at)}</span>
                    {canEdit && (
                      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit({ ...edit, evidence: edit.evidence.filter((x) => x.id !== ev.id) })}>
                        <X size={13} />
                      </button>
                    )}
                  </li>
                ))}
                {!edit.evidence.length && <li className="faint small">{t('Aucune preuve pour l’instant.', 'No evidence yet.')}</li>}
              </ul>
              {canEdit && (
                <form
                  className="row"
                  style={{ marginTop: 8 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!evidence.trim()) return;
                    setEdit({ ...edit, evidence: [...edit.evidence, { id: uid('ev_'), label: evidence.trim(), at: new Date().toISOString(), by: user!.id }] });
                    setEvidence('');
                  }}
                >
                  <input className="input input-sm" placeholder={t('Ex. : PV de revue de direction 2026, lien SharePoint…', 'E.g. management review minutes 2026, SharePoint link…')} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
                  <button className="btn btn-sm" type="submit"><Plus size={14} /> {t('Ajouter', 'Add')}</button>
                </form>
              )}
            </div>

            <label className="field">
              <span>{t('Notes', 'Notes')}</span>
              <textarea className="textarea" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </label>
          </fieldset>
        )}
      </Modal>

      <Modal
        open={!!fwEdit}
        onClose={() => setFwEdit(null)}
        title={t('Modifier le référentiel', 'Edit framework')}
        footer={
          <>
            <button className="btn" onClick={() => setFwEdit(null)}>{t('Annuler', 'Cancel')}</button>
            <button className="btn btn-primary" onClick={saveFw}>{t('Enregistrer', 'Save')}</button>
          </>
        }
      >
        {fwEdit && <FrameworkForm value={fwEdit} onChange={setFwEdit} />}
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('Supprimer le référentiel ?', 'Delete framework?')}
        footer={
          <>
            <button className="btn" onClick={() => setConfirmDelete(false)}>{t('Annuler', 'Cancel')}</button>
            <button className="btn btn-primary" onClick={deleteFw}>{t('Supprimer', 'Delete')}</button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {t(
            `« ${fw.code} » et ses ${reqs.length} exigences seront supprimés. Astuce : décochez « Actif » pour simplement l’archiver.`,
            `"${fw.code}" and its ${reqs.length} requirements will be deleted. Tip: untick "Active" to just archive it.`,
          )}
        </p>
      </Modal>
    </Page>
  );
}
