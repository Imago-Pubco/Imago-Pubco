import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FlaskConical, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { API_MODE, useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader, useToast } from '@/components/ui';
import { SANDBOX_MODULES, sandboxModule, type SandboxRequest } from './sandboxModules';
import { STATUS_LABEL, sandboxApi, type SandboxStatusInfo } from './api';

const err = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Sandbox home: start a request, follow mine (approvers: the requests to review). */
export function SandboxHome({ review = false }: { review?: boolean }) {
  const { t, fmtDate } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { rows: allUsers } = useCollection(users);
  const [status, setStatus] = useState<SandboxStatusInfo | null>(null);
  const [list, setList] = useState<SandboxRequest[]>([]);
  const [title, setTitle] = useState('');
  const allowedModules = useMemo(() => SANDBOX_MODULES.filter((m) => can(m.permission)), [can]);
  const [moduleId, setModuleId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!API_MODE) return;
    try {
      const [s, l] = await Promise.all([sandboxApi.status(), sandboxApi.list()]);
      setStatus(s);
      setList(l);
    } catch (e) {
      toast(err(e), 'err');
    }
  }, [toast]);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (!moduleId && allowedModules[0]) setModuleId(allowedModules[0].id);
  }, [allowedModules, moduleId]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !moduleId) return;
    setBusy(true);
    try {
      const r = await sandboxApi.create(title.trim(), moduleId);
      navigate(`/sandbox/${r.id}`);
    } catch (e2) {
      toast(err(e2), 'err');
    } finally {
      setBusy(false);
    }
  }

  const nameOf = (id: string) => allUsers.find((u) => u.id === id)?.displayName ?? id;
  const shown = review ? list.filter((r) => r.status === 'submitted' || r.ownerId !== user!.id) : list.filter((r) => r.ownerId === user!.id);
  const ready = status?.configured && status.runner;

  return (
    <Page>
      <PageHeader
        eyebrow={t('Sandbox', 'Sandbox')}
        title={review ? t('Demandes à réviser', 'Requests to review') : t('Mes demandes', 'My requests')}
        subtitle={t(
          'Décrivez un changement : Claude le fait dans une copie privée de l’application, sur des données de démonstration. Vous voyez le résultat, puis vous le soumettez pour approbation. Rien n’arrive dans la vraie application sans révision.',
          'Describe a change: Claude makes it in a private copy of the app, on demo data. You see the result, then submit it for approval. Nothing reaches the real app without a review.',
        )}
      />

      {!API_MODE && <div className="alert alert-warn">{t('Le Sandbox fonctionne avec le serveur Imago (pas dans la démo du navigateur).', 'The Sandbox works with the Imago server (not in the browser demo).')}</div>}
      {API_MODE && status && !status.configured && (
        <div className="alert alert-warn">{t('Le Sandbox n’est pas encore configuré sur le serveur (voir SANDBOX.md).', 'The Sandbox is not configured on the server yet (see SANDBOX.md).')}</div>
      )}
      {API_MODE && status?.configured && !status.runner && (
        <div className="alert alert-err">{t('Le service Sandbox ne répond pas.', 'The Sandbox service does not answer.')}</div>
      )}
      {status?.runner?.fake && <div className="alert alert-info">{t('Mode test : aucun appel au modèle d’IA, aucun coût.', 'Test mode: no calls to the AI model, no cost.')}</div>}

      {!review && (
        <form className="card card-pad sbx-new" onSubmit={create}>
          <h3>
            <Plus size={16} /> {t('Nouvelle demande', 'New request')}
          </h3>
          {allowedModules.length === 0 ? (
            <div className="small muted">{t('Aucun module disponible pour vous dans le Sandbox.', 'No module available to you in the Sandbox.')}</div>
          ) : (
            <div className="sbx-new-row">
              <select className="select" value={moduleId} onChange={(e) => setModuleId(e.target.value)} aria-label={t('Module', 'Module')}>
                {allowedModules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {t(m.name)}
                  </option>
                ))}
              </select>
              <input
                className="input"
                maxLength={200}
                placeholder={t('Ex. : Ajouter une colonne « Client » aux tâches hebdo', 'E.g.: Add a "Client" column to weekly tasks')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label={t('Titre de la demande', 'Request title')}
              />
              <button className="btn btn-primary" disabled={busy || !ready || !title.trim()}>
                <FlaskConical size={15} /> {t('Commencer', 'Start')}
              </button>
            </div>
          )}
          {status && (
            <div className="small muted">
              {t('Budget du mois', 'This month’s budget')} : {status.budget.used.toFixed(2)} $ / {status.budget.cap} $ US
            </div>
          )}
        </form>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        {shown.length === 0 ? (
          <div className="card-pad">
            <Empty icon={review ? <ShieldCheck size={30} /> : <FlaskConical size={30} />} title={review ? t('Rien à réviser', 'Nothing to review') : t('Aucune demande pour l’instant', 'No request yet')} />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Demande', 'Request')}</th>
                  <th>{t('Module', 'Module')}</th>
                  {review && <th>{t('Par', 'By')}</th>}
                  <th>{t('Statut', 'Status')}</th>
                  <th>{t('Coût', 'Cost')}</th>
                  <th>{t('Mise à jour', 'Updated')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const st = STATUS_LABEL[r.status] ?? { fr: r.status, en: r.status, tone: '' };
                  return (
                    <tr key={r.id} className="clickable" onClick={() => navigate(`/sandbox/${r.id}`)}>
                      <td>
                        <Link to={`/sandbox/${r.id}`} onClick={(e) => e.stopPropagation()}>
                          {r.title}
                        </Link>
                      </td>
                      <td className="small">{sandboxModule(r.moduleId) ? t(sandboxModule(r.moduleId)!.name) : r.moduleId}</td>
                      {review && <td className="small">{nameOf(r.ownerId)}</td>}
                      <td>
                        <span className={`badge ${st.tone ? `badge-${st.tone}` : ''}`}>{t(st.fr, st.en)}</span>
                      </td>
                      <td className="small mono">{r.costUsd.toFixed(2)} $</td>
                      <td className="small muted">{fmtDate(r.updatedAt, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Page>
  );
}
