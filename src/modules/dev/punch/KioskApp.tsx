import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Delete, ShieldAlert } from 'lucide-react';
import { HOUR_THRESHOLDS, formatDuration } from './engine.ts';
import { FaceCheck, type FaceCheckResult } from './FaceCheck';
import { KIND_LABEL, STATUS_LABEL, clockOf, clockSecondsOf, kioskApi, type KioskView } from './api.ts';
import type { PunchKind } from './types.ts';
import './punch.css';

const IDLE_MS = 30_000;
const CONFIRM_MS = 3_500;
const WEEK_MAX_H = 45;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

type Step =
  | { name: 'code' }
  | { name: 'photo'; view: KioskView; reference: number[] | null }
  | { name: 'question'; view: KioskView; face: FaceCheckResult | null }
  | { name: 'punch'; view: KioskView; face: FaceCheckResult | null }
  | { name: 'done'; text: string; sub?: string }
  | { name: 'signup'; form: SignupData; error?: string }
  | { name: 'signupPhoto'; form: SignupData };

interface SignupData {
  name: string;
  code: string;
  email: string;
}

/** New employee: name, last 4 phone digits, e-mail (optional). The identity photo comes next. */
function Signup({ initial, error, onNext, onCancel }: { initial: SignupData; error?: string; onNext: (f: SignupData) => void; onCancel: () => void }) {
  const [f, setF] = useState(initial);
  const [local, setLocal] = useState<string | null>(null);
  const next = () => {
    const name = f.name.trim().replace(/\s+/g, ' ');
    if (name.split(' ').length < 2) return setLocal('Écrivez votre prénom et votre nom.');
    if (!/^\d{4}$/.test(f.code)) return setLocal('Le code doit avoir 4 chiffres : les 4 derniers chiffres de votre téléphone.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setLocal(f.email.trim() ? 'Le courriel n’est pas valide.' : 'Écrivez votre courriel : il sert à recevoir le suivi de vos heures.');
    onNext({ name, code: f.code, email: f.email.trim() });
  };
  return (
    <div className="pc-emp pc-signup">
      <div className="pc-hello pc-hello-sm">Nouvel employé</div>
      <label>
        Prénom et nom
        <input className="pc-input" autoFocus autoComplete="off" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </label>
      <label>
        4 derniers chiffres de votre téléphone (votre code de pointage)
        <input
          className="pc-input"
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 4) })}
        />
      </label>
      <label>
        Courriel (pour recevoir le suivi de vos heures)
        <input className="pc-input" type="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </label>
      {(local || error) && <div className="pc-note pc-note-red">{local ?? error}</div>}
      <div className="pc-actions">
        <button className="pc-btn pc-btn-ghost" onClick={onCancel}>
          Annuler
        </button>
        <button className="pc-btn pc-btn-in" onClick={next}>
          Continuer : photo
        </button>
      </div>
    </div>
  );
}

/** Week hours bar with points at 10, 20, 30 and 40 h. */
function WeekBar({ minutes }: { minutes: number }) {
  const pct = (h: number) => `${Math.min(h / WEEK_MAX_H, 1) * 100}%`;
  return (
    <div className="pc-week">
      <div className="pc-track">
        <div className={`pc-fill ${minutes >= 40 * 60 ? 'pc-fill-over' : ''}`} style={{ width: pct(minutes / 60) }} />
        {HOUR_THRESHOLDS.map((h) => (
          <span key={h} className={`pc-point ${minutes >= h * 60 ? 'pc-point-done' : 'pc-point-todo'}`} style={{ left: pct(h) }} />
        ))}
      </div>
      <div className="pc-track-labels">
        {HOUR_THRESHOLDS.map((h) => (
          <span key={h} className="pc-tlabel" style={{ left: pct(h) }}>
            {h} h
          </span>
        ))}
      </div>
    </div>
  );
}

/** The 30 h question, asked on the tablet when the e-mail is still unanswered. */
function Question({
  worked,
  onAnswer,
  onCancel,
  error,
}: {
  worked: number;
  onAnswer: (a: 'yes' | 'no', why: string) => void;
  /** Only when changing an answer already given: the first answer is required before any punch. */
  onCancel: (() => void) | null;
  error: string | null;
}) {
  const [yes, setYes] = useState(false);
  const [why, setWhy] = useState('');
  return (
    <div className="pc-emp">
      <div className="pc-note">
        <ShieldAlert size={18} />{' '}
        {worked < 30 * 60
          ? `Vous avez ${formatDuration(worked)} cette semaine et vous allez franchir 30 h aujourd'hui en finissant votre quart. Au-delà de 40 h, ce sont des heures supplémentaires.`
          : worked < 40 * 60
            ? `Vous avez fait ${formatDuration(worked)} cette semaine : attention, vous approchez des 40 h. Au-delà, ce sont des heures supplémentaires.`
            : `Vous avez fait ${formatDuration(worked)} cette semaine : vous êtes en heures supplémentaires.`}
      </div>
      <div className="pc-hello pc-hello-sm">Voulez-vous faire du temps supplémentaire (plus de 40 h) cette semaine ?</div>
      {!yes ? (
        <div className="pc-actions">
          <button className="pc-btn pc-btn-in" onClick={() => onAnswer('no', '')}>
            Non
          </button>
          <button className="pc-btn pc-btn-pause_start" onClick={() => setYes(true)}>
            Oui
          </button>
        </div>
      ) : (
        <>
          <textarea
            className="pc-why"
            autoFocus
            maxLength={1000}
            placeholder="Pourquoi voulez-vous faire plus de 40 h ?"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
          />
          <div className="pc-actions">
            <button className="pc-btn pc-btn-ghost" onClick={() => setYes(false)}>
              Retour
            </button>
            <button className="pc-btn pc-btn-in" disabled={why.trim().length < 3} onClick={() => onAnswer('yes', why)}>
              Envoyer
            </button>
          </div>
        </>
      )}
      {error && <div className="pc-note pc-note-red">{error}</div>}
      {onCancel ? (
        <button className="pc-link" onClick={onCancel}>
          Garder ma réponse
        </button>
      ) : (
        <p className="pc-prompt" style={{ fontSize: 'clamp(13px, 2vh, 16px)', opacity: 0.7 }}>
          Une réponse est obligatoire avant de pointer.
        </p>
      )}
    </div>
  );
}

/**
 * Tablet time clock, served on its own by the punch server (https://…:8443/). No way out of the page:
 * on the iPad, Guided Access (Accès guidé) keeps it locked on this site, with a code only the admin knows.
 */
export function KioskApp() {
  const [now, setNow] = useState(() => new Date());
  const [code, setCode] = useState('');
  /** The typed code is the employee's password: kept only until the screen goes back to the keypad. */
  const [activeCode, setActiveCode] = useState('');
  const [step, setStep] = useState<Step>({ name: 'code' });
  const [error, setError] = useState<{ text: string; id: number } | null>(null);
  const [offline, setOffline] = useState(false);

  const skew = useRef(0); // server time − device time (the iPad clock can be off)
  const lastTouch = useRef(Date.now());
  const busy = useRef(false);

  const touch = useCallback(() => {
    lastTouch.current = Date.now();
  }, []);
  const showError = (text: string) => setError({ text, id: Date.now() });

  const reset = useCallback(() => {
    setStep({ name: 'code' });
    setCode('');
    setActiveCode('');
    setError(null);
  }, []);

  // Server clock every 20 s; device clock every second; back to the keypad after 30 s untouched.
  useEffect(() => {
    const sync = () =>
      kioskApi.now().then(
        (r) => {
          skew.current = Date.parse(r.now) - Date.now();
          setOffline(false);
        },
        () => setOffline(true),
      );
    sync();
    const s = window.setInterval(sync, 20_000);
    const t = window.setInterval(() => {
      setNow(new Date(Date.now() + skew.current));
      if (Date.now() - lastTouch.current > IDLE_MS) {
        lastTouch.current = Date.now();
        setStep((st) => (st.name === 'photo' || st.name === 'signupPhoto' ? st : { name: 'code' }));
        setCode('');
      }
    }, 1000);
    return () => {
      window.clearInterval(s);
      window.clearInterval(t);
    };
  }, []);

  const press = useCallback(
    (d: string) => {
      touch();
      if (step.name !== 'code') return;
      setError(null);
      setCode((c) => (c.length < 4 ? c + d : c));
    },
    [touch, step.name],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      touch();
      if (step.name !== 'code') return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setCode((c) => c.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, touch, step.name]);

  // 4 digits typed: ask the server who it is.
  useEffect(() => {
    if (code.length !== 4 || step.name !== 'code') return;
    let cancelled = false;
    kioskApi.identify(code).then(
      (r) => {
        if (cancelled) return;
        setActiveCode(code);
        setCode('');
        touch();
        const { reference, photoCheck, ...view } = r;
        if (photoCheck) setStep({ name: 'photo', view, reference });
        else setStep(view.question && !view.question.answer ? { name: 'question', view, face: null } : { name: 'punch', view, face: null });
      },
      (e: Error) => {
        if (cancelled) return;
        setCode('');
        showError(e.message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [code, step.name, touch]);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 3000);
    return () => window.clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (step.name !== 'done') return;
    const t = window.setTimeout(reset, CONFIRM_MS);
    return () => window.clearTimeout(t);
  }, [step.name, reset]);

  const afterPhoto = (view: KioskView, face: FaceCheckResult) => {
    touch();
    setStep(view.question && !view.question.answer ? { name: 'question', view, face } : { name: 'punch', view, face });
  };

  const register = async (form: SignupData, face: FaceCheckResult) => {
    touch();
    try {
      const r = await kioskApi.register({
        name: form.name,
        phoneLast4: form.code,
        email: form.email,
        ...(face.descriptor ? { descriptor: face.descriptor } : {}),
        ...(face.photo ? { photo: face.photo } : {}),
      });
      const { reference: _r, photoCheck: _p, ...view } = r;
      setActiveCode(form.code);
      // The face just taken is the reference: this first punch is confirmed with it.
      setStep({ name: 'punch', view, face: face.descriptor ? { identity: 'verified', descriptor: face.descriptor } : face });
    } catch (e) {
      setStep({ name: 'signup', form, error: (e as Error).message });
    }
  };

  const answer = async (view: KioskView, face: FaceCheckResult | null, a: 'yes' | 'no', why: string) => {
    touch();
    try {
      const next = await kioskApi.answer({ code: activeCode, mailId: view.question!.mailId, answer: a, justification: why });
      setStep({ name: 'punch', view: next, face });
    } catch (e) {
      showError((e as Error).message);
    }
  };

  const punch = async (kind: PunchKind, face: FaceCheckResult | null) => {
    if (busy.current) return;
    busy.current = true;
    touch();
    try {
      const r = await kioskApi.punch({
        code: activeCode,
        kind,
        ...(face?.descriptor ? { descriptor: face.descriptor } : {}),
        ...(face?.photo ? { photo: face.photo } : {}),
        ...(face ? { faceStatus: face.identity } : {}),
      });
      const at = new Date(r.event.at);
      setStep({
        name: 'done',
        text: `${KIND_LABEL[kind]} enregistrée à ${clockOf(at)}`,
        sub: `${formatDuration(r.summary.workedMinutes)} cette semaine`,
      });
    } catch (e) {
      showError((e as Error).message);
    } finally {
      busy.current = false;
    }
  };

  let main: ReactNode;
  if (step.name === 'done') {
    main = (
      <div className="pc-confirm">
        <CheckCircle2 className="pc-confirm-icon" />
        <h1>{step.text}</h1>
        {step.sub && <p>{step.sub}</p>}
      </div>
    );
  } else if (step.name === 'signup') {
    main = (
      <Signup
        initial={step.form}
        error={step.error}
        onCancel={reset}
        onNext={(form) => {
          touch();
          setStep({ name: 'signupPhoto', form });
        }}
      />
    );
  } else if (step.name === 'signupPhoto') {
    const { form } = step;
    main = (
      <FaceCheck
        firstName={form.name.split(' ')[0]}
        reference={null}
        onResult={(r) => register(form, r)}
        onCancel={() => setStep({ name: 'signup', form })}
      />
    );
  } else if (step.name === 'photo') {
    const { view } = step;
    main = (
      <FaceCheck
        firstName={view.employee.firstName}
        reference={step.reference}
        onResult={(r) => afterPhoto(view, r)}
        onCancel={reset}
      />
    );
  } else if (step.name === 'question') {
    const { view, face } = step;
    main = (
      <Question
        worked={view.summary.workedMinutes}
        error={error?.text ?? null}
        onAnswer={(a, why) => answer(view, face, a, why)}
        onCancel={view.question?.answer ? () => setStep({ name: 'punch', view, face }) : null}
      />
    );
  } else if (step.name === 'punch') {
    const { view, face } = step;
    const s = view.summary;
    const flagged = face && (face.identity === 'mismatch' || face.identity === 'no_camera');
    const noReference = !face && view.needsReference;
    main = (
      <div className="pc-emp">
        <div className="pc-hello">Bonjour {view.employee.firstName}</div>
        <div className={`pc-status pc-st-${s.status}`}>{STATUS_LABEL[s.status]}</div>
        <div className="pc-hours">
          <div>
            <span>Aujourd'hui</span>
            <b>{formatDuration(s.todayMinutes)}</b>
          </div>
          <div>
            <span>Cette semaine</span>
            <b>{formatDuration(s.workedMinutes)}</b>
          </div>
        </div>
        <WeekBar minutes={s.workedMinutes} />
        {s.workedMinutes >= 30 * 60 && (
          <div className="pc-note">
            <ShieldAlert size={18} />
            <span>
              {s.workedMinutes >= 40 * 60
                ? 'Plus de 40 h cette semaine : ce sont des heures supplémentaires.'
                : s.workedMinutes >= 35 * 60
                  ? 'Plus de 35 h cette semaine : le directeur de production est avisé. Attention aux 40 h.'
                  : 'Plus de 30 h cette semaine : attention, vous approchez des 40 h.'}{' '}
              {view.question?.answer === 'yes'
                ? `Temps supplémentaire : Oui (« ${view.question.justification ?? ''} »).`
                : view.question?.answer === 'no'
                  ? 'Temps supplémentaire : Non.'
                  : ''}
            </span>
            {view.question && (
              <button className="pc-note-btn" onClick={() => setStep({ name: 'question', view, face })}>
                {view.question.answer ? 'Modifier ma réponse' : 'Répondre'}
              </button>
            )}
          </div>
        )}
        {noReference && (
          <div className="pc-note">
            <ShieldAlert size={18} /> Pas encore de photo de référence : demandez à l'administrateur de la prendre.
          </div>
        )}
        {flagged && (
          <div className="pc-note">
            <ShieldAlert size={18} /> Identité non confirmée par photo : le pointage sera vérifié.
          </div>
        )}
        {error && (
          <div key={error.id} className="pc-note pc-note-red pc-shake" role="alert">
            {error.text}
          </div>
        )}
        <div className="pc-actions">
          {s.nextAllowed.map((k) => (
            <button key={k} className={`pc-btn pc-btn-${k}`} onClick={() => punch(k, face)}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <button className="pc-link" onClick={reset}>
          Ce n'est pas moi
        </button>
      </div>
    );
  } else {
    main = (
      <div className="pc-keypad-screen">
        <div className="pc-bigclock">{clockSecondsOf(now)}</div>
        <p className="pc-prompt">Entrez les 4 derniers chiffres de votre téléphone</p>
        <div key={error?.id ?? 'dots'} className={`pc-dots ${error ? 'pc-shake' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pc-dot ${i < code.length ? 'on' : ''}`} />
          ))}
        </div>
        <div className="pc-error" role="alert">
          {error?.text ?? (offline ? 'Serveur de pointage injoignable' : ' ')}
        </div>
        <div className="pc-keypad">
          {KEYS.map((k) =>
            k === 'clear' ? (
              <button key={k} className="pc-key pc-key-fn" onClick={() => (touch(), setCode(''))}>
                Effacer
              </button>
            ) : k === 'back' ? (
              <button key={k} className="pc-key pc-key-fn" aria-label="Retour arrière" onClick={() => (touch(), setCode((c) => c.slice(0, -1)))}>
                <Delete />
              </button>
            ) : (
              <button key={k} className="pc-key" onClick={() => press(k)}>
                {k}
              </button>
            ),
          )}
        </div>
        <button className="pc-link" onClick={() => (touch(), setStep({ name: 'signup', form: { name: '', code: '', email: '' } }))}>
          Nouvel employé ? Inscrivez-vous ici
        </button>
      </div>
    );
  }

  return (
    <div className="pc-kiosk" onPointerDown={touch}>
      <div className="pc-kiosk-top">
        <span className="pc-kiosk-brand">Pubco · Pointage</span>
        <div className="pc-kiosk-corner">{clockOf(now)}</div>
      </div>
      <div className="pc-kiosk-main">{main}</div>
    </div>
  );
}
