import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Mail, Pencil, Plus, Trash2, UserPlus, UserRound } from 'lucide-react';
import { Page } from '@/components/Page';
import { Modal, PageHeader, useToast } from '@/components/ui';
import { HOUR_THRESHOLDS, formatDuration } from './engine.ts';
import { EmployeeForm } from './EmployeeForm';
import { FaceCheck } from './FaceCheck';
import { IDENTITY_LABEL, KIND_LABEL, STATUS_LABEL, adminApi, clockOf, type AdminState } from './api.ts';
import type { IdentityCheck, OutboxMessage, PunchEmployee, PunchEvent, PunchKind } from './types.ts';
import './punch.css';

const POLL_MS = 5_000;
const WEEK_MAX_H = 45;
const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const KINDS: PunchKind[] = ['in', 'pause_start', 'pause_end', 'out'];
const MAIL_KIND: Record<OutboxMessage['kind'], string> = {
  hours_10: '10 h',
  hours_20: '20 h',
  hours_30: '30 h · question',
  hours_40: '40 h',
  director_35: 'Directeur 35 h',
  admin_digest: 'Résumé admin',
  admin_faces: 'Visages à configurer',
  admin_new: 'Nouvel inscrit',
};
const MAIL_STATUS: Record<OutboxMessage['status'], [string, string]> = {
  pending: ['En cours', 'pc-tag-muted'],
  sent: ['Envoyé', ''],
  failed: ['Échec', 'pc-tag-red'],
  disabled: ['Non envoyé', 'pc-tag-warn'],
  grouped: ['Inclus dans un courriel groupé', 'pc-tag-muted'],
};

const identityClass = (i: IdentityCheck) => (i === 'mismatch' || i === 'no_camera' || i === 'no_reference' ? 'pc-tag-red' : i === 'off' ? 'pc-tag-muted' : '');

/** 'YYYY-MM-DDTHH:MM' in local time, for <input type="datetime-local">. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function WeekMini({ minutes }: { minutes: number }) {
  const pct = (h: number) => `${Math.min(h / WEEK_MAX_H, 1) * 100}%`;
  return (
    <div className="pc-mini" aria-label={`${formatDuration(minutes)} cette semaine`}>
      <div className={`pc-mini-fill ${minutes >= 40 * 60 ? 'over' : ''}`} style={{ width: pct(minutes / 60) }} />
      {HOUR_THRESHOLDS.map((h) => (
        <span key={h} className="pc-mini-dot" style={{ left: pct(h), background: minutes >= h * 60 ? '#22c55e' : '#94a3b8' }} title={`${h} h`} />
      ))}
    </div>
  );
}

function Avatar({ employee, size = 44 }: { employee: PunchEmployee; size?: number }) {
  return employee.photo ? (
    <img className="pc-avatar" src={employee.photo} alt={`Photo d'identité de ${employee.name}`} style={{ width: size, height: size }} />
  ) : (
    <span className="pc-avatar pc-avatar-empty" style={{ width: size, height: size }} title="Photo de référence pas encore prise">
      <UserRound size={size * 0.5} />
    </span>
  );
}

/** Punch card administration (private): employees with ID photo and code, punches, answers, e-mails. */
export function FollowUp() {
  const toast = useToast();
  const [state, setState] = useState<AdminState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PunchEmployee | 'new' | null>(null);
  const [enrolling, setEnrolling] = useState<PunchEmployee | null>(null);

  const load = useCallback(() => {
    adminApi.state(week).then(
      (s) => {
        setState(s);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  }, [week]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  /** Runs an admin action, shows its error, reloads. */
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast((e as Error).message, 'err');
    }
    load();
  };

  const kioskUrl = state?.kioskUrls[0] ?? 'https://localhost:8443/';

  return (
    <Page wide>
      <PageHeader
        eyebrow="Développement"
        title="Punch card"
        subtitle="Administration privée du pointage : employés, pointages, réponses et courriels"
        actions={
          <>
            <button className="btn" onClick={() => setEditing('new')} disabled={!state}>
              <UserPlus size={16} /> Ajouter un employé
            </button>
            <a className="btn btn-primary" href={kioskUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> Ouvrir la borne (iPad)
            </a>
          </>
        }
      />

      {error && (
        <div className="card card-pad pc-offline">
          <strong>Serveur de pointage non disponible.</strong> {error}
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Dans un terminal, à la racine du projet : <code>npm run pointage</code> (construit la borne et démarre le serveur https sur le port 8443).
          </p>
        </div>
      )}

      {state && (
        <>
          <div className="pc-grid pc-grid-top">
            <KioskCard state={state} />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-head pc-week-nav">
              <h3>Semaine du {new Date(state.weekStart + 'T12:00').toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })}</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm" onClick={() => setWeek((w) => w - 1)} aria-label="Semaine précédente">
                  <ChevronLeft size={16} />
                </button>
                <button className="btn btn-sm" onClick={() => setWeek(0)} disabled={week === 0}>
                  Cette semaine
                </button>
                <button className="btn btn-sm" onClick={() => setWeek((w) => w + 1)} disabled={week >= 0} aria-label="Semaine suivante">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr>
                    <th>Photo</th>
                    <th>Employé</th>
                    <th>Code</th>
                    <th>Statut</th>
                    <th>Aujourd'hui</th>
                    <th>Semaine</th>
                    <th style={{ minWidth: 170 }}>10 · 20 · 30 · 40 h</th>
                    <th>Prévu</th>
                    <th>Dernier pointage</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.employees.map((e) => {
                    const s = state.summaries[e.id];
                    const evs = state.events.filter((x) => x.employeeId === e.id);
                    const last = evs[evs.length - 1];
                    return (
                      <tr
                        key={e.id}
                        className={`${selectedId === e.id ? 'pc-row-on' : ''} ${e.active ? '' : 'pc-row-off'}`}
                        onClick={() => setSelectedId(selectedId === e.id ? null : e.id)}
                      >
                        <td>
                          <Avatar employee={e} />
                        </td>
                        <td>
                          <strong>{e.name}</strong>
                          {e.toApprove && (
                            <button
                              className="pc-tag pc-tag-red pc-tag-btn"
                              title="Inscrit seul sur la tablette : vérifiez son identité et son horaire, puis validez"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                act(() => adminApi.approve(e.id), `${e.name} validé`);
                              }}
                            >
                              Inscrit sur la tablette · Valider
                            </button>
                          )}
                          {!e.hasFace && (
                            <button
                              className="pc-tag pc-tag-warn pc-tag-btn"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setEnrolling(e);
                              }}
                            >
                              Prendre la photo de référence
                            </button>
                          )}
                          <div className="muted" style={{ fontSize: 12 }}>
                            {[e.role, e.email].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </td>
                        <td className="mono pc-code">{e.phoneLast4}</td>
                        <td>
                          {e.active ? <span className={`pc-status-pill pc-st-${s.status}`}>{STATUS_LABEL[s.status]}</span> : <span className="muted">Inactif</span>}
                          {s.inPostShift && <div className="pc-tag pc-tag-warn">Après son quart</div>}
                        </td>
                        <td className="mono">{formatDuration(s.todayMinutes)}</td>
                        <td className="mono">
                          <strong>{formatDuration(s.workedMinutes)}</strong>
                        </td>
                        <td>
                          <WeekMini minutes={s.workedMinutes} />
                        </td>
                        <td className="mono">
                          <span className={s.projectedMinutes > 40 * 60 ? 'pc-tag pc-tag-warn' : ''}>{formatDuration(s.projectedMinutes)}</span>
                        </td>
                        <td>
                          {last ? (
                            <>
                              <span className="mono">
                                {DAY_SHORT[new Date(last.at).getDay()]} {clockOf(new Date(last.at))}
                              </span>{' '}
                              {KIND_LABEL[last.kind]}
                              <div>
                                <span className={`pc-tag ${identityClass(last.identity)}`}>{IDENTITY_LABEL[last.identity]}</span>
                              </div>
                            </>
                          ) : (
                            <span className="faint">—</span>
                          )}
                        </td>
                        <td onClick={(ev) => ev.stopPropagation()}>
                          <button className="btn btn-sm btn-ghost" onClick={() => setEditing(e)} aria-label={`Modifier ${e.name}`}>
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {state.employees.length === 0 && (
                    <tr>
                      <td colSpan={10} className="pc-empty">
                        Aucun employé. Ajoutez-vous avec « Ajouter un employé », prenez la photo de référence, puis pointez sur la borne avec vos 4 chiffres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {(() => {
            const sel = state.employees.find((e) => e.id === selectedId);
            return sel ? (
              <PunchEditor
                key={sel.id}
                employee={sel}
                state={state}
                events={state.events.filter((e) => e.employeeId === sel.id)}
                act={act}
                onEdit={() => setEditing(sel)}
                onEnroll={() => setEnrolling(sel)}
              />
            ) : null;
          })()}

          <AnswersCard state={state} />

          <div className="pc-grid">
            <MailsCard state={state} act={act} />
            <SettingsCard state={state} act={act} />
          </div>
        </>
      )}

      {enrolling && (
        <Modal open large title={`Photo de référence · ${enrolling.name}`} onClose={() => setEnrolling(null)}>
          <div className="pc-enroll">
            <FaceCheck
              firstName={enrolling.name.split(' ')[0]}
              reference={null}
              onCancel={() => setEnrolling(null)}
              onResult={(r) => {
                const who = enrolling;
                setEnrolling(null);
                if (r.identity === 'enrolled' && r.descriptor && r.photo) {
                  act(() => adminApi.setFace(who.id, r.descriptor!, r.photo!), `Photo de référence enregistrée pour ${who.name}`);
                } else {
                  toast('Aucun visage pris : vérifiez que la webcam est branchée et autorisée, puis réessayez.', 'err');
                }
              }}
            />
          </div>
        </Modal>
      )}

      {editing && (
        <EmployeeForm
          employee={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            if (editing === 'new') await adminApi.createEmployee(input);
            else await adminApi.updateEmployee(editing.id, input);
            load();
          }}
        />
      )}
    </Page>
  );
}

type Act = (fn: () => Promise<unknown>, ok?: string) => Promise<void>;

function KioskCard({ state }: { state: AdminState }) {
  const lan = state.kioskUrls.slice(1);
  return (
    <div className="card card-pad">
      <h3 style={{ marginTop: 0 }}>Borne iPad</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Sur l'iPad (même Wi-Fi que cet ordinateur), ouvrez dans Safari :
      </p>
      {lan.length ? (
        lan.map((u, i) => (
          <div key={u} className="pc-url mono">
            {u}
            <div className="muted" style={{ fontSize: 11, fontFamily: 'inherit' }}>
              {i === 0 ? 'Nom fixe de cet ordinateur (ne change pas avec le Wi-Fi) : à mettre sur l’iPad' : 'Adresse actuelle, si le nom fixe ne répond pas'}
            </div>
          </div>
        ))
      ) : (
        <p className="muted">Aucune adresse réseau trouvée.</p>
      )}
      <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
        La première fois, Safari avertit que le certificat n'est pas vérifié : touchez « Afficher les détails » puis « visiter ce site web ». Ensuite « Partager → Sur l'écran
        d'accueil » ouvre la borne en plein écran.
      </p>
    </div>
  );
}

function PunchEditor({
  employee,
  state,
  events,
  act,
  onEdit,
  onEnroll,
}: {
  employee: PunchEmployee;
  state: AdminState;
  events: PunchEvent[];
  act: Act;
  onEdit: () => void;
  onEnroll: () => void;
}) {
  const s = state.summaries[employee.id];
  const [adding, setAdding] = useState(false);
  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="pc-section-title">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar employee={employee} size={84} />
          <div>
            <h3>{employee.name}</h3>
            <div className="muted">
              Code <b className="mono">{employee.phoneLast4}</b> · {employee.email || 'aucun courriel'} · {employee.hasFace ? 'visage de référence enregistré' : 'photo de référence à prendre'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={onEdit}>
            <Pencil size={14} /> Modifier
          </button>
          <button className={`btn btn-sm ${employee.hasFace ? '' : 'btn-primary'}`} onClick={onEnroll}>
            {employee.hasFace ? 'Reprendre la photo de référence' : 'Prendre la photo de référence'}
          </button>
          {employee.hasFace && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => window.confirm(`Effacer la photo de référence de ${employee.name} ?`) && act(() => adminApi.resetFace(employee.id), 'Photo effacée')}
            >
              Effacer la photo
            </button>
          )}
          <button
            className="btn btn-sm btn-danger"
            onClick={() =>
              window.confirm(`Supprimer ${employee.name} et tous ses pointages et courriels ? C'est définitif.`) && act(() => adminApi.deleteEmployee(employee.id), 'Employé supprimé')
            }
          >
            <Trash2 size={14} /> Supprimer
          </button>
        </div>
      </div>

      <div className="pc-days">
        {s.days.map((d, i) => (
          <div key={d.date}>
            {DAY_SHORT[i]}
            <b>{d.workedMinutes > 0 ? formatDuration(d.workedMinutes) : '—'}</b>
            <span className="muted">{d.shift ? `${d.shift.start}–${d.shift.end}` : 'congé'}</span>
          </div>
        ))}
      </div>

      <div className="pc-section-title">
        <h4 style={{ margin: 0 }}>Pointages de la semaine</h4>
        <button className="btn btn-sm" onClick={() => setAdding(true)}>
          <Plus size={14} /> Ajouter un pointage
        </button>
      </div>
      <table className="pc-table">
        <thead>
          <tr>
            <th>Date et heure</th>
            <th>Type</th>
            <th>Identité</th>
            <th>Note</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {adding && (
            <EventRow
              employeeId={employee.id}
              initial={{ at: state.now, kind: s.nextAllowed[0] ?? 'in', note: '' }}
              onDone={() => setAdding(false)}
              act={act}
            />
          )}
          {events.map((ev) => (
            <EventRow key={ev.id} event={ev} employeeId={employee.id} initial={{ at: ev.at, kind: ev.kind, note: ev.note ?? '' }} act={act} />
          ))}
          {events.length === 0 && !adding && (
            <tr>
              <td colSpan={5} className="pc-empty">
                Aucun pointage cette semaine.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EventRow({
  event,
  employeeId,
  initial,
  act,
  onDone,
}: {
  event?: PunchEvent;
  employeeId: string;
  initial: { at: string; kind: PunchKind; note: string };
  act: Act;
  onDone?: () => void;
}) {
  const [at, setAt] = useState(toLocalInput(initial.at));
  const [kind, setKind] = useState<PunchKind>(initial.kind);
  const [note, setNote] = useState(initial.note);
  const dirty = !event || at !== toLocalInput(initial.at) || kind !== initial.kind || note !== initial.note;
  const save = () => {
    const iso = new Date(at).toISOString();
    if (event) act(() => adminApi.updateEvent(event.id, { at: iso, kind, note }), 'Pointage corrigé');
    else act(() => adminApi.addEvent({ employeeId, at: iso, kind, note }), 'Pointage ajouté').then(onDone);
  };
  return (
    <tr className={event ? '' : 'pc-row-on'}>
      <td>
        <input className="input input-sm" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
      </td>
      <td>
        <select className="input input-sm" value={kind} onChange={(e) => setKind(e.target.value as PunchKind)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </td>
      <td>
        {event ? (
          <>
            <span className={`pc-tag ${identityClass(event.identity)}`}>{IDENTITY_LABEL[event.identity]}</span>
            {event.faceDistance !== undefined && <span className="muted" style={{ fontSize: 12 }}> écart {event.faceDistance.toFixed(2)}</span>}
            {event.source === 'admin' && <span className="pc-tag pc-tag-muted">Corrigé</span>}
          </>
        ) : (
          <span className="pc-tag pc-tag-muted">Ajout manuel</span>
        )}
      </td>
      <td>
        <input className="input input-sm" value={note} placeholder="Raison de la correction" onChange={(e) => setNote(e.target.value)} />
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button className="btn btn-sm btn-primary" disabled={!dirty} onClick={save}>
          {event ? 'Enregistrer' : 'Ajouter'}
        </button>{' '}
        {event ? (
          <button className="btn btn-sm btn-ghost" aria-label="Supprimer le pointage" onClick={() => window.confirm('Supprimer ce pointage ?') && act(() => adminApi.deleteEvent(event.id), 'Pointage supprimé')}>
            <Trash2 size={14} />
          </button>
        ) : (
          <button className="btn btn-sm btn-ghost" onClick={onDone}>
            Annuler
          </button>
        )}
      </td>
    </tr>
  );
}

function AnswersCard({ state }: { state: AdminState }) {
  const questions = state.mails.filter((m) => m.asksYesNo);
  const name = (id: string) => state.employees.find((e) => e.id === id)?.name ?? '—';
  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="pc-section-title">
        <h3>Réponses : dépasser 40 h ?</h3>
        <span className="muted" style={{ fontSize: 13 }}>
          Question envoyée à 30 h, réponse par le lien du courriel ou sur la borne
        </span>
      </div>
      {questions.length === 0 ? (
        <p className="muted">Aucune question envoyée pour l'instant.</p>
      ) : (
        <table className="pc-table">
          <thead>
            <tr>
              <th>Employé</th>
              <th>Semaine</th>
              <th>Réponse</th>
              <th>Justification</th>
              <th>Répondu le</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((m) => (
              <tr key={m.id}>
                <td>{name(m.employeeId)}</td>
                <td className="mono">{m.weekStart}</td>
                <td>{m.answer === 'yes' ? <span className="pc-tag pc-tag-warn">Oui</span> : m.answer === 'no' ? <span className="pc-tag">Non</span> : <span className="pc-tag pc-tag-muted">En attente</span>}</td>
                <td style={{ whiteSpace: 'normal', maxWidth: 420 }}>{m.justification ?? '—'}</td>
                <td className="mono">{m.answeredAt ? new Date(m.answeredAt).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MailsCard({ state, act }: { state: AdminState; act: Act }) {
  return (
    <div className="card card-pad">
      <div className="pc-section-title">
        <h3>
          <Mail size={18} style={{ verticalAlign: '-3px' }} /> Courriels
        </h3>
        {state.mail.enabled ? <span className="pc-tag">Envoi depuis {state.mail.user}</span> : <span className="pc-tag pc-tag-warn">Gmail non configuré</span>}
      </div>
      {state.mails.length === 0 ? <p className="muted">Aucun courriel pour l'instant.</p> : state.mails.map((m) => <MailItem key={m.id} mail={m} act={act} />)}
    </div>
  );
}

function MailItem({ mail, act }: { mail: OutboxMessage; act: Act }) {
  const [open, setOpen] = useState(false);
  const [label, cls] = MAIL_STATUS[mail.status];
  return (
    <div className="pc-mail">
      <div className="pc-mail-head" onClick={() => setOpen((o) => !o)}>
        <div>
          <strong>{mail.subject}</strong>
          <div className="pc-mail-meta">
            À {mail.to || '(aucune adresse)'} · {new Date(mail.createdAt).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className={`pc-tag ${mail.kind === 'director_35' ? 'pc-tag-red' : 'pc-tag-muted'}`}>{MAIL_KIND[mail.kind]}</span>
          <span className={`pc-tag ${cls}`}>{label}</span>
        </div>
      </div>
      {mail.error && <div className="pc-mail-meta" style={{ color: '#b91c1c' }}>{mail.error}</div>}
      {open && <pre>{mail.body}</pre>}
      {mail.status !== 'sent' && (
        <div className="pc-mail-actions">
          <button className="btn btn-sm" onClick={() => act(() => adminApi.resendMail(mail.id), 'Envoi relancé')}>
            Renvoyer
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsCard({ state, act }: { state: AdminState; act: Act }) {
  const toast = useToast();
  const toastOk = (t: string) => toast(t);
  const [director, setDirector] = useState(state.settings.directorEmail);
  return (
    <div className="card card-pad">
      <div className="pc-section-title">
        <h3>Paramètres</h3>
      </div>
      <div className="pc-settings">
        <label>
          Courriel de l'administrateur / directeur de production
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" type="email" placeholder="directeur@pubco.ca" value={director} onChange={(e) => setDirector(e.target.value)} />
            <button className="btn" disabled={director === state.settings.directorEmail} onClick={() => act(() => adminApi.saveSettings({ directorEmail: director }), 'Enregistré')}>
              Enregistrer
            </button>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            Reçoit : l'avertissement des 35 h (tout de suite), les visages à configurer (un courriel pour tous les nouveaux), et le résumé groupé par tranches
            d'heures avec les réponses Oui / Non et leurs justifications.
          </span>
        </label>
        <label>
          Résumé groupé envoyé à l'administrateur
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="input" style={{ width: 'auto' }} value={state.settings.digestHours} onChange={(e) => act(() => adminApi.saveSettings({ digestHours: Number(e.target.value) }), 'Enregistré')}>
              {[12, 24, 48, 72, 168].map((h) => (
                <option key={h} value={h}>
                  {h === 12 ? 'aux 12 heures' : h === 24 ? 'chaque jour' : h === 168 ? 'chaque semaine' : `aux ${h / 24} jours`}
                </option>
              ))}
            </select>
            <button className="btn" disabled={!state.settings.directorEmail} onClick={() => act(() => adminApi.sendDigest(), 'Résumé envoyé')}>
              Envoyer le résumé maintenant
            </button>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            Dernier envoi : {state.settings.lastDigestAt ? new Date(state.settings.lastDigestAt).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais'}
          </span>
        </label>
        <label>
          Lien protégé du suivi en direct (pour l'administrateur, sans compte Imago)
          <div className="pc-link-box">
            <input className="input" readOnly value={state.followUpLink} onFocus={(e) => e.target.select()} />
            <button className="btn" onClick={() => navigator.clipboard.writeText(state.followUpLink).then(() => toastOk('Lien copié'))}>
              Copier
            </button>
            <button
              className="btn btn-ghost"
              onClick={() =>
                window.confirm('Créer un nouveau lien ? Les anciens liens (suivi et configuration des visages) ne fonctionneront plus.') &&
                act(() => adminApi.renewKey(), 'Nouveau lien créé')
              }
            >
              Nouveau lien
            </button>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            Le même lien est mis dans chaque résumé. Il fonctionne sur le même réseau que cet ordinateur jusqu'à la mise en ligne (étape 4).
          </span>
        </label>
        <label className="pc-check">
          <input type="checkbox" checked={state.settings.photoCheck} onChange={(e) => act(() => adminApi.saveSettings({ photoCheck: e.target.checked }))} />
          Photo de vérification à chaque pointage (comparée puis supprimée)
        </label>
        {!state.mail.enabled && (
          <span className="muted" style={{ fontSize: 12 }}>
            Courriels désactivés. Pour les activer : copiez server/punch/env.example en .env.punch, mettez votre Gmail et un mot de passe d'application, puis relancez npm run pointage.
          </span>
        )}
      </div>
    </div>
  );
}
