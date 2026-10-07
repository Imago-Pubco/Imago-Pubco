import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, KeyRound, Moon, Sun } from 'lucide-react';
import { ApiError, api } from '@/data/db';
import { useI18n } from '@/i18n';
import { Butterfly } from '@/components/Butterfly';
import { useTheme } from '@/layout/theme';
import './login.css';

/**
 * Page opened from the link in the welcome / password-reset e-mail (/reset-password?token=…):
 * the person chooses a password. The link works once and expires.
 */
export function ResetPassword() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ name: string; username: string }>(`/auth/reset/check?token=${encodeURIComponent(token)}`).then(
      (r) => {
        setName(r.name);
        setUsername(r.username);
        setState('ready');
      },
      () => setState('invalid'),
    );
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError(t('Mot de passe : 8 caractères minimum.', 'Password: at least 8 characters.'));
    if (password !== confirm) return setError(t('Les deux mots de passe ne sont pas identiques.', 'The two passwords do not match.'));
    setBusy(true);
    try {
      await api('/auth/reset', { method: 'POST', body: { token, password } });
      setState('done');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.message === 'invalid_or_expired') setState('invalid');
      else setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const goLogin = () => {
    window.location.href = '/';
  };

  return (
    <div className="login">
      <section className="login-brand">
        <div className="login-brand-top">
          <Butterfly size={48} />
          <div>
            <div className="login-word">PUBCO</div>
            <div className="login-sub">Imago · Hub 2.0</div>
          </div>
        </div>
        <div className="meta">
          <div className="meta-stage">
            <Butterfly size={140} flutter />
          </div>
        </div>
        <p className="login-tag">{t('Chaque processus, jusqu’à sa forme accomplie.', 'Every process, all the way to its finished form.')}</p>
      </section>

      <section className="login-form-wrap">
        <div className="login-tools">
          <button className="btn btn-ghost btn-sm" onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}>
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={toggle} aria-label="Theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        <motion.div className="login-form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          {state === 'checking' && <p className="muted">{t('Vérification du lien…', 'Checking the link…')}</p>}

          {state === 'invalid' && (
            <>
              <h1>{t('Lien invalide ou expiré', 'Invalid or expired link')}</h1>
              <p className="muted" style={{ margin: '6px 0 24px' }}>
                {t('Ce lien a déjà servi ou n’est plus valide. Demandez un nouveau lien avec « Mot de passe oublié » sur la page de connexion, ou contactez un administrateur.', 'This link was already used or is no longer valid. Request a new one with “Forgot password” on the sign-in page, or contact an administrator.')}
              </p>
              <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={goLogin}>
                {t('Aller à la connexion', 'Go to sign-in')}
              </button>
            </>
          )}

          {state === 'ready' && (
            <form onSubmit={submit}>
              <h1>{t('Choisir votre mot de passe', 'Choose your password')}</h1>
              <p className="muted" style={{ margin: '6px 0 24px' }}>
                {name && <>{name} · </>}
                <span className="mono">{username}</span>
              </p>
              {error && (
                <div className="alert alert-err" style={{ marginBottom: 16 }}>
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              <label className="field" style={{ marginBottom: 14 }}>
                <span>{t('Nouveau mot de passe', 'New password')}</span>
                <input className="input input-lg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus required />
              </label>
              <label className="field" style={{ marginBottom: 8 }}>
                <span>{t('Confirmer le mot de passe', 'Confirm password')}</span>
                <input className="input input-lg" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
              </label>
              <p className="faint small" style={{ margin: '0 0 22px' }}>{t('8 caractères minimum.', 'At least 8 characters.')}</p>
              <button className="btn btn-primary btn-lg" type="submit" disabled={busy} style={{ width: '100%' }}>
                {busy ? <Butterfly size={20} color="currentColor" flutter /> : <KeyRound size={18} />}
                {t('Enregistrer le mot de passe', 'Save password')}
              </button>
            </form>
          )}

          {state === 'done' && (
            <>
              <h1 className="row" style={{ gap: 10 }}>
                <CheckCircle2 color="var(--ok)" /> {t('Mot de passe enregistré', 'Password saved')}
              </h1>
              <p className="muted" style={{ margin: '6px 0 24px' }}>
                {t('Vous pouvez maintenant vous connecter avec votre identifiant', 'You can now sign in with your username')} <span className="mono">{username}</span>.
              </p>
              <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={goLogin}>
                {t('Aller à la connexion', 'Go to sign-in')}
              </button>
            </>
          )}
        </motion.div>
      </section>
    </div>
  );
}
