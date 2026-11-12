import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Lock, Settings2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader, RequirePermission } from '@/components/ui';
import { modules } from '@/modules/registry';

/** Administration → Modules: one card per module; a card opens that module's settings (when it has some). */
export function Modules() {
  const { t } = useI18n();
  const { can } = useAuth();
  // The admin portal itself is not a module to configure here.
  const list = modules.filter((m) => m.id !== 'admin');

  return (
    <Page wide>
      <PageHeader
        eyebrow={t('Administration', 'Administration')}
        title={t('Modules', 'Modules')}
        subtitle={t('Les paramètres de chaque module au même endroit. Cliquez sur une carte pour l’ouvrir.', 'Every module’s settings in one place. Click a card to open it.')}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
        {list.map((m) => {
          const Icon = m.icon;
          const allowed = !!m.settings && can(m.settings.permission);
          const body = (
            <div className="card card-pad stack" style={{ gap: 10, height: '100%', opacity: m.settings ? 1 : 0.7, borderTop: `3px solid ${m.accent}` }}>
              <div className="row" style={{ gap: 12 }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10, background: `color-mix(in srgb, ${m.accent} 18%, transparent)`, color: m.accent }}>
                  <Icon size={19} />
                </span>
                <strong style={{ fontSize: 16 }}>{t(m.name)}</strong>
                <span className="spacer" />
                {allowed ? <ChevronRight size={16} className="faint" /> : m.settings ? <Lock size={14} className="faint" /> : null}
              </div>
              <div className="muted small">{t(m.tagline)}</div>
              <div className="small" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                {m.settings ? (
                  <>
                    <Settings2 size={14} style={{ color: m.accent }} />
                    <span>{m.settings.summary ? t(m.settings.summary) : t('Paramètres du module', 'Module settings')}</span>
                  </>
                ) : (
                  <span className="faint">{t('Aucun paramètre pour le moment', 'No settings yet')}</span>
                )}
              </div>
              {m.settings && !allowed && <div className="faint small">{t('Réservé aux personnes qui gèrent ce module.', 'Reserved for the people who manage this module.')}</div>}
            </div>
          );
          return allowed ? (
            <Link key={m.id} to={`/admin/modules/${m.id}`} style={{ color: 'inherit', textDecoration: 'none' }} aria-label={t(m.name)}>
              {body}
            </Link>
          ) : (
            <div key={m.id}>{body}</div>
          );
        })}
      </div>
    </Page>
  );
}

/** Administration → Modules → one module: renders the settings screen the module registered. */
export function ModuleSettings() {
  const { t } = useI18n();
  const { id } = useParams();
  const m = modules.find((x) => x.id === id && x.id !== 'admin');

  if (!m?.settings) {
    return (
      <Page>
        <Link to="/admin/modules" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, marginLeft: -10 }}>
          <ArrowLeft size={16} /> {t('Modules', 'Modules')}
        </Link>
        <div className="card">
          <Empty icon={<Settings2 size={36} />} title={t('Ce module n’a pas de paramètres', 'This module has no settings')} />
        </div>
      </Page>
    );
  }
  const Screen = m.settings.component;
  return (
    <RequirePermission permission={m.settings.permission}>
      <div style={{ padding: '0 0 0 0' }}>
        <div className="page" style={{ paddingBottom: 0 }}>
          <Link to="/admin/modules" className="btn btn-ghost btn-sm" style={{ marginLeft: -10 }}>
            <ArrowLeft size={16} /> {t('Modules', 'Modules')} · {t(m.name)}
          </Link>
        </div>
        <Screen />
      </div>
    </RequirePermission>
  );
}
