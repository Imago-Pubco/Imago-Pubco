import { Home, Lock } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { ModuleDef } from '@/modules/types';
import { modules as allModules } from '@/modules/registry';
import type { MenuLayout } from '@/layout/menuSchema';
import { effectiveName } from './menuEdit';

interface Props {
  layout: MenuLayout;
  modulesById: Map<string, ModuleDef>;
}

/** Module that is always fixed at the bottom of the sidebar and cannot be placed in a section. */
const BOTTOM_ID = 'it';

/** Live preview of the sidebar as it will look for everyone (empty sections are hidden there, shown here dimmed). */
export function MenuPreview({ layout, modulesById }: Props) {
  const { t } = useI18n();
  const bottom = allModules.find((m) => m.id === BOTTOM_ID);
  const BottomIcon = bottom?.icon;

  return (
    <div className="card menu-ed-preview">
      <div className="card-head">
        <h3>{t('Aperçu de la barre latérale', 'Sidebar preview')}</h3>
      </div>
      <div className="card-pad">
        <div className="menu-ed-preview-box">
          <div className="menu-ed-preview-item menu-ed-fixed" title={t('Toujours en haut', 'Always at the top')}>
            <span className="menu-ed-preview-icon">
              <Home size={16} />
            </span>
            <span>{t('Tableau de bord', 'Dashboard')}</span>
            <Lock size={12} className="menu-ed-lock" aria-hidden="true" />
          </div>

          {layout.sections.map((s, i) => {
            const mods = s.moduleIds.map((id) => modulesById.get(id)).filter((m): m is ModuleDef => !!m);
            return (
              <div key={`${i}-${s.id}`} className="menu-ed-preview-group">
                {s.label ? <div className="menu-ed-preview-head">{t(s.label)}</div> : <div className="menu-ed-preview-gap" />}
                {mods.length === 0 ? (
                  <div className="menu-ed-preview-empty">{t('(vide — masquée)', '(empty — hidden)')}</div>
                ) : (
                  mods.map((m) => {
                    const Icon = m.icon;
                    return (
                      <div key={m.id} className="menu-ed-preview-item">
                        <span className="menu-ed-preview-icon" style={{ color: m.accent }}>
                          <Icon size={16} />
                        </span>
                        <span>{t(effectiveName(m, layout.names))}</span>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}

          {bottom && BottomIcon && (
            <div className="menu-ed-preview-group menu-ed-preview-bottom">
              <div className="menu-ed-preview-gap" />
              <div className="menu-ed-preview-item menu-ed-fixed" title={t('Toujours en bas', 'Always at the bottom')}>
                <span className="menu-ed-preview-icon" style={{ color: bottom.accent }}>
                  <BottomIcon size={16} />
                </span>
                <span>{t(effectiveName(bottom, layout.names))}</span>
                <Lock size={12} className="menu-ed-lock" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
        <p className="faint small" style={{ margin: '10px 2px 0' }}>
          {t('Le tableau de bord (en haut) et le Support TI (en bas) restent toujours à leur place.', 'The dashboard (top) and IT support (bottom) always stay in place.')}
        </p>
      </div>
    </div>
  );
}
