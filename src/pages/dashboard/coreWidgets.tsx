/** General (non-module) widgets available on everyone's dashboard. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, History } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { audit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Butterfly } from '@/components/Butterfly';
import { modules, orderModules } from '@/modules/registry';
import type { WidgetDef } from '@/modules/types';

function Welcome() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tm = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tm);
  }, []);
  const h = now.getHours();
  const greet = h < 12 ? t('Bonjour', 'Good morning') : h < 18 ? t('Bon après-midi', 'Good afternoon') : t('Bonsoir', 'Good evening');
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  return (
    <div className="hero">
      <div className="hero-wings" aria-hidden="true">
        <Butterfly size={380} flutter />
      </div>
      <div className="hero-text">
        <div className="eyebrow" style={{ color: 'var(--red-glow)' }}>
          {now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <h1>
          {greet}, {user?.displayName.split(' ')[0]}.
        </h1>
        <p>{t('Tous vos modules, réunis en un seul portail.', 'All your modules, gathered in one portal.')}</p>
      </div>
      <div className="hero-clock">{now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  );
}

function ModuleShortcuts() {
  const { t } = useI18n();
  const { can, user } = useAuth();
  const mine = orderModules(modules.filter((m) => m.placement !== 'userMenu' && can(m.entryPermission)), user?.prefs?.menuOrder);
  if (!mine.length)
    return <div className="muted small">{t('Aucun module ne vous est attribué.', 'No modules assigned to you.')}</div>;
  return (
    <div className="launcher">
      {mine.map((m) => {
        const Icon = m.icon;
        return (
          <Link key={m.id} to={m.path} className="launch-card" style={{ ['--accent' as string]: m.accent }}>
            <span className="launch-icon">
              <Icon size={22} />
            </span>
            <div>
              <strong>{t(m.name)}</strong>
              <span>{t(m.tagline)}</span>
            </div>
            <ArrowUpRight size={18} className="launch-arrow" />
          </Link>
        );
      })}
    </div>
  );
}

function MyActivity() {
  const { t, fmtDate } = useI18n();
  const { user } = useAuth();
  const { rows } = useCollection(audit);
  const mine = rows
    .filter((r) => r.userId === user?.id && !r.action.startsWith('auth.'))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);
  if (!mine.length)
    return (
      <div className="widget-empty">
        <History size={22} />
        {t('Aucune activité récente.', 'No recent activity.')}
      </div>
    );
  return (
    <ul className="widget-list">
      {mine.map((r) => (
        <li key={r.id}>
          <span className="badge mono">{r.action}</span>
          <span className="widget-list-main">{r.detail}</span>
          <span className="faint small">{fmtDate(r.at, true)}</span>
        </li>
      ))}
    </ul>
  );
}

function Notes() {
  const { t } = useI18n();
  const { user, updatePrefs } = useAuth();
  const [text, setText] = useState(user?.prefs?.notes ?? '');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onChange = (v: string) => {
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => updatePrefs({ notes: v }), 600);
  };
  return (
    <textarea
      className="textarea notes"
      value={text}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('Vos notes personnelles… (enregistrées automatiquement)', 'Your personal notes… (saved automatically)')}
    />
  );
}

export const coreWidgets: WidgetDef[] = [
  { id: 'core.welcome', title: { fr: 'Bienvenue', en: 'Welcome' }, permission: '', size: 2, component: Welcome },
  { id: 'core.modules', title: { fr: 'Mes modules', en: 'My modules' }, permission: '', size: 2, component: ModuleShortcuts },
  { id: 'core.activity', title: { fr: 'Mon activité', en: 'My activity' }, permission: '', size: 1, component: MyActivity },
  { id: 'core.notes', title: { fr: 'Notes', en: 'Notes' }, permission: '', size: 1, component: Notes },
];
