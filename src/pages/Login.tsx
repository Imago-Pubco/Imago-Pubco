import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Egg, Bug, Hourglass, LogIn, AlertCircle, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Butterfly } from '@/components/Butterfly';
import { useTheme } from '@/layout/theme';
import './login.css';

const STAGES = [
  { icon: Egg, fr: 'Œuf', en: 'Egg' },
  { icon: Bug, fr: 'Chenille', en: 'Caterpillar' },
  { icon: Hourglass, fr: 'Chrysalide', en: 'Chrysalis' },
  { icon: null, fr: 'Imago', en: 'Imago' },
];

/** Cycles through the four life stages on the brand panel. */
function Metamorphosis() {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  useEffect(() => {
    const tm = setInterval(() => setI((x) => (x + 1) % STAGES.length), 1800);
    return () => clearInterval(tm);
  }, []);
  const S = STAGES[i];
  return (
    <div className="meta">
      <div className="meta-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.6, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.3, filter: 'blur(8px)' }}
            transition={{ duration: 0.5 }}
          >
            {S.icon ? <S.icon size={72} strokeWidth={1.2} /> : <Butterfly size={140} flutter />}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="meta-steps">
        {STAGES.map((s, k) => (
          <span key={k} className={k === i ? 'on' : k < i ? 'past' : ''}>
            {t(s.fr, s.en)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Login() {
  const { t, lang, setLang } = useI18n();
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const r = await login(username, password);
    setBusy(false);
    if (r === 'invalid') setError(t('Identifiant ou mot de passe invalide.', 'Invalid username or password.'));
    if (r === 'disabled') setError(t('Ce compte est désactivé.', 'This account is disabled.'));
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
        <Metamorphosis />
        <p className="login-tag">
          {t('Chaque processus, jusqu’à sa forme accomplie.', 'Every process, all the way to its finished form.')}
        </p>
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
        <motion.form className="login-form" onSubmit={submit} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <h1>{t('Connexion', 'Sign in')}</h1>
          <p className="muted" style={{ margin: '6px 0 28px' }}>
            {t('Portail interne Pubco. Accès réservé au personnel.', 'Pubco internal portal. Staff only.')}
          </p>
          <AnimatePresence>
            {error && (
              <motion.div className="alert alert-err" style={{ marginBottom: 16 }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <AlertCircle size={16} /> {error}
              </motion.div>
            )}
          </AnimatePresence>
          <label className="field" style={{ marginBottom: 14 }}>
            <span>{t('Identifiant', 'Username')}</span>
            <input className="input input-lg" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </label>
          <label className="field" style={{ marginBottom: 24 }}>
            <span>{t('Mot de passe', 'Password')}</span>
            <input className="input input-lg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? <Butterfly size={20} color="currentColor" flutter /> : <LogIn size={18} />}
            {t('Se connecter', 'Sign in')}
          </button>
          {import.meta.env.DEV && (
            <p className="faint small" style={{ marginTop: 24, textAlign: 'center' }}>
              {t('Mode développement — comptes de démonstration : admin, prod, compta, lecture.', 'Development mode — demo accounts: admin, prod, compta, lecture.')}
            </p>
          )}
        </motion.form>
      </section>
    </div>
  );
}
