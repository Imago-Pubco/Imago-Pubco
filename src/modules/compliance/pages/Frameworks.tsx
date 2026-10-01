import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Award, Library } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { logAudit, users } from '@/data/stores';
import { useUserName } from '@/data/hooks';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, Empty, Modal, PageHeader, useToast } from '@/components/ui';
import { frameworks, requirements } from '../stores';
import { CATEGORIES, ScoreRing, score } from '../ui';
import type { Framework, FrameworkCategory } from '../types';

const COLORS = ['#1e6fd9', '#7b4fd6', '#d6336c', '#2e9e5b', '#e07a10', '#0ea5c6', '#da291c', '#5b6b82'];

export function FrameworkForm({ value, onChange }: { value: Framework; onChange: (f: Framework) => void }) {
  const { t } = useI18n();
  const { rows: allUsers } = useCollection(users);
  return (
    <div className="form-grid">
      <label className="field">
        <span>{t('Code', 'Code')}</span>
        <input className="input" value={value.code} onChange={(e) => onChange({ ...value, code: e.target.value })} placeholder="ISO 14001" autoFocus />
      </label>
      <label className="field">
        <span>{t('Catégorie', 'Category')}</span>
        <select className="select" value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value as FrameworkCategory })}>
          {(Object.keys(CATEGORIES) as FrameworkCategory[]).map((c) => (
            <option key={c} value={c}>{t(CATEGORIES[c])}</option>
          ))}
        </select>
      </label>
      <label className="field span-2">
        <span>{t('Nom', 'Name')}</span>
        <input className="input" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </label>
      <label className="field span-2">
        <span>Description</span>
        <textarea className="textarea" value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </label>
      <label className="field">
        <span>{t('Responsable', 'Owner')}</span>
        <select className="select" value={value.ownerId} onChange={(e) => onChange({ ...value, ownerId: e.target.value })}>
          {allUsers.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
        </select>
      </label>
      <label className="field">
        <span>{t('Date cible / renouvellement', 'Target / renewal date')}</span>
        <input className="input" type="date" value={value.targetDate ?? ''} onChange={(e) => onChange({ ...value, targetDate: e.target.value || undefined })} />
      </label>
      <div className="field">
        <span>{t('Couleur', 'Colour')}</span>
        <div className="row" style={{ gap: 6, height: 38 }}>
          {COLORS.map((c) => (
            <button key={c} type="button" className={`color-dot ${value.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange({ ...value, color: c })} aria-label={c} />
          ))}
        </div>
      </div>
      <div className="field">
        <span>&nbsp;</span>
        <div className="row" style={{ gap: 16, height: 38 }}>
          <label className="check">
            <input type="checkbox" checked={!!value.certified} onChange={(e) => onChange({ ...value, certified: e.target.checked })} />
            {t('Certifié', 'Certified')}
          </label>
          <label className="check">
            <input type="checkbox" checked={value.active} onChange={(e) => onChange({ ...value, active: e.target.checked })} />
            {t('Actif', 'Active')}
          </label>
        </div>
      </div>
    </div>
  );
}

export function Frameworks() {
  const { t, fmtDate } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const userName = useUserName();
  const [params, setParams] = useSearchParams();
  const { rows } = useCollection(frameworks);
  const { rows: reqs } = useCollection(requirements);
  const [edit, setEdit] = useState<Framework | null>(null);

  const blank = (): Framework => ({ id: uid('fw_'), code: '', name: '', category: 'other', description: '', ownerId: user!.id, color: COLORS[rows.length % COLORS.length], active: true });

  useEffect(() => {
    if (params.get('new')) {
      setEdit(blank());
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const save = async () => {
    if (!edit) return;
    if (await frameworks.get(edit.id)) await frameworks.update(edit.id, edit);
    else await frameworks.insert(edit);
    await logAudit(user!.id, 'compliance.framework.save', edit.code);
    setEdit(null);
    toast(t('Référentiel enregistré', 'Framework saved'));
    nav(`/compliance/frameworks/${edit.id}`);
  };

  const sorted = [...rows].sort((a, b) => Number(b.active) - Number(a.active) || a.code.localeCompare(b.code));

  return (
    <Page>
      <PageHeader
        eyebrow={t('Conformité', 'Compliance')}
        title={t('Référentiels', 'Frameworks')}
        subtitle={t('Normes, lois et exigences clients suivies par Pubco.', 'Standards, laws and customer requirements tracked by Pubco.')}
        actions={
          <Can permission="compliance.frameworks">
            <button className="btn btn-primary" onClick={() => setEdit(blank())}>
              <Plus size={16} /> {t('Référentiel', 'Framework')}
            </button>
          </Can>
        }
      />
      <div className="card">
        {sorted.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Score', 'Score')}</th>
                  <th>{t('Référentiel', 'Framework')}</th>
                  <th>{t('Catégorie', 'Category')}</th>
                  <th className="num">{t('Exigences', 'Requirements')}</th>
                  <th>{t('Responsable', 'Owner')}</th>
                  <th>{t('Date cible', 'Target date')}</th>
                  <th>{t('Statut', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((f) => {
                  const r = reqs.filter((x) => x.frameworkId === f.id);
                  return (
                    <tr key={f.id} className="clickable" onClick={() => nav(`/compliance/frameworks/${f.id}`)} style={{ opacity: f.active ? 1 : 0.55 }}>
                      <td style={{ width: 70 }}>
                        <ScoreRing value={score(r)} size={44} color={f.color} />
                      </td>
                      <td>
                        <strong>{f.code}</strong>
                        <div className="faint small">{f.name}</div>
                      </td>
                      <td className="muted">{t(CATEGORIES[f.category])}</td>
                      <td className="num">{r.length}</td>
                      <td className="muted small">{userName(f.ownerId)}</td>
                      <td className="muted">{fmtDate(f.targetDate)}</td>
                      <td>
                        {!f.active ? (
                          <span className="badge">{t('Inactif', 'Inactive')}</span>
                        ) : f.certified ? (
                          <span className="badge badge-ok"><Award size={12} /> {t('Certifié', 'Certified')}</span>
                        ) : (
                          <span className="badge badge-info">{t('En démarche', 'In progress')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<Library size={36} />} title={t('Aucun référentiel', 'No frameworks')} />
        )}
      </div>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={t('Référentiel', 'Framework')}
        footer={
          <>
            <button className="btn" onClick={() => setEdit(null)}>{t('Annuler', 'Cancel')}</button>
            <button className="btn btn-primary" onClick={save} disabled={!edit?.code.trim() || !edit?.name.trim()}>{t('Enregistrer', 'Save')}</button>
          </>
        }
      >
        {edit && <FrameworkForm value={edit} onChange={setEdit} />}
      </Modal>
    </Page>
  );
}
