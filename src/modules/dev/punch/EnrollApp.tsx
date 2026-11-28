import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { FaceCheck } from './FaceCheck';
import './punch.css';

type Info = { name: string; firstName: string; hasFace: boolean; photo: string | null };
type Phase = { name: 'loading' } | { name: 'error'; text: string } | { name: 'intro'; info: Info } | { name: 'camera'; info: Info } | { name: 'done'; info: Info };

/**
 * Face setup page reached from the protected link of the administrator's e-mail (/visage?k=…&e=…).
 * Takes the employee's reference face with the device camera; no Imago account needed.
 */
export function EnrollApp() {
  const params = new URLSearchParams(window.location.search);
  const k = params.get('k') ?? '';
  const e = params.get('e') ?? '';
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });

  useEffect(() => {
    fetch(`/punch-api/enroll/info?k=${encodeURIComponent(k)}&e=${encodeURIComponent(e)}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'Lien invalide');
        setPhase({ name: 'intro', info: body as Info });
      })
      .catch((err: Error) => setPhase({ name: 'error', text: err.message }));
  }, [k, e]);

  const save = async (info: Info, descriptor: number[], photo: string) => {
    const r = await fetch('/punch-api/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ k, e, descriptor, photo }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setPhase({ name: 'error', text: body.error ?? 'Enregistrement impossible' });
      return;
    }
    setPhase({ name: 'done', info: { ...info, hasFace: true, photo } });
  };

  let main;
  if (phase.name === 'loading') main = <p className="pc-prompt">Chargement…</p>;
  else if (phase.name === 'error')
    main = (
      <div className="pc-emp">
        <div className="pc-hello pc-hello-sm">{phase.text}</div>
        <button className="pc-btn pc-btn-ghost" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </div>
    );
  else if (phase.name === 'intro')
    main = (
      <div className="pc-emp">
        <div className="pc-hello pc-hello-sm">Visage de référence : {phase.info.name}</div>
        {phase.info.photo && <img className="pc-enroll-photo" src={phase.info.photo} alt="" />}
        <p className="pc-prompt">
          {phase.info.hasFace
            ? 'Un visage est déjà enregistré. Le reprendre remplace l’ancien.'
            : 'Placez la personne bien en face de la caméra, avec un bon éclairage. Le visage est enregistré en quelques secondes.'}
        </p>
        <div className="pc-actions">
          <button className="pc-btn pc-btn-in" onClick={() => setPhase({ name: 'camera', info: phase.info })}>
            {phase.info.hasFace ? 'Reprendre le visage' : 'Ouvrir la caméra'}
          </button>
        </div>
      </div>
    );
  else if (phase.name === 'camera') {
    const info = phase.info;
    main = (
      <FaceCheck
        firstName={info.firstName}
        reference={null}
        onCancel={() => setPhase({ name: 'intro', info })}
        onResult={(r) => {
          if (r.identity === 'enrolled' && r.descriptor && r.photo) save(info, r.descriptor, r.photo);
          else setPhase({ name: 'error', text: 'Caméra indisponible : autorisez la caméra puis réessayez.' });
        }}
      />
    );
  } else
    main = (
      <div className="pc-confirm">
        <CheckCircle2 className="pc-confirm-icon" />
        <h1>Visage enregistré pour {phase.info.name}</h1>
        {phase.info.photo && <img className="pc-enroll-photo" src={phase.info.photo} alt="" />}
        <p>La tablette pourra maintenant confirmer son identité. Vous pouvez fermer cette page.</p>
      </div>
    );

  return (
    <div className="pc-kiosk">
      <div className="pc-kiosk-top">
        <span className="pc-kiosk-brand">Pubco · Configuration du visage</span>
      </div>
      <div className="pc-kiosk-main">{main}</div>
    </div>
  );
}
