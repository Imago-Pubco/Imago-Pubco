import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { ModuleDef } from '@/modules/types';
import type { MenuLayout, MenuName } from '@/layout/menuSchema';
import { NEW_SECTION_LABEL, sectionTitle, type MenuOp, type MenuSection } from './menuEdit';

interface Props {
  index: number;
  sections: MenuSection[];
  section: MenuSection;
  modulesById: Map<string, ModuleDef>;
  names: MenuLayout['names'];
  dispatch: (op: MenuOp) => void;
}

/** One section of the draft: heading names, its modules (order, display names, move to another section). */
export function SectionCard({ index, sections, section, modulesById, names, dispatch }: Props) {
  const { t } = useI18n();
  const hasModules = section.moduleIds.length > 0;
  const targets = sections.map((s, i) => ({ i, title: sectionTitle(s.label, i) })).filter((x) => x.i !== index);
  const untitled = section.label === null;

  const setName = (lang: keyof MenuName, value: string) => {
    if (section.label) dispatch({ type: 'section-label', index, label: { ...section.label, [lang]: value } });
  };

  return (
    <section className="card menu-ed-section">
      <div className="card-head">
        <h3 className="menu-ed-title">
          <span className="menu-ed-num">{index + 1}</span>
          <span>{sectionTitle(section.label, index)}</span>
        </h3>
        <div className="row">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            disabled={index === 0}
            onClick={() => dispatch({ type: 'section-move', index, dir: -1 })}
            aria-label={t('Monter la section', 'Move section up')}
            title={t('Monter la section', 'Move section up')}
          >
            <ChevronUp size={16} />
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            disabled={index === sections.length - 1}
            onClick={() => dispatch({ type: 'section-move', index, dir: 1 })}
            aria-label={t('Descendre la section', 'Move section down')}
            title={t('Descendre la section', 'Move section down')}
          >
            <ChevronDown size={16} />
          </button>
          <button
            className="btn btn-danger btn-sm"
            disabled={hasModules}
            onClick={() => dispatch({ type: 'section-delete', index })}
            title={hasModules ? t('Déplacez d’abord ses modules vers une autre section', 'Move its modules to another section first') : t('Supprimer la section', 'Delete section')}
          >
            <Trash2 size={14} /> {t('Supprimer', 'Delete')}
          </button>
        </div>
      </div>

      <div className="card-pad stack">
        <div className="stack" style={{ gap: 10 }}>
          <label className="check">
            <input
              type="checkbox"
              checked={untitled}
              onChange={(e) => dispatch({ type: 'section-label', index, label: e.target.checked ? null : { ...NEW_SECTION_LABEL } })}
            />
            {t('Sans titre (pas d’en-tête)', 'Untitled (no heading)')}
          </label>
          {!untitled && section.label && (
            <div className="menu-ed-names">
              <label className="field">
                <span>{t('Nom FR', 'Name FR')}</span>
                <input className="input" value={section.label.fr} onChange={(e) => setName('fr', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('Nom EN', 'Name EN')}</span>
                <input className="input" value={section.label.en} onChange={(e) => setName('en', e.target.value)} />
              </label>
            </div>
          )}
        </div>

        <div className="menu-ed-mod-head faint small" aria-hidden="true">
          <span>{t('Module', 'Module')}</span>
          <span>{t('Nom affiché FR', 'Displayed name FR')}</span>
          <span>{t('Nom affiché EN', 'Displayed name EN')}</span>
          <span />
        </div>

        {hasModules ? (
          section.moduleIds.map((id, mi) => {
            const m = modulesById.get(id);
            if (!m) return null;
            const Icon = m.icon;
            const override = names[id];
            return (
              <div key={id} className="menu-ed-mod">
                <div className="menu-ed-mod-id">
                  <span className="menu-ed-mod-icon" style={{ ['--m' as string]: m.accent }}>
                    <Icon size={16} />
                  </span>
                  <div className="menu-ed-mod-label">
                    <strong>{t(m.name)}</strong>
                    <span className="faint small">{t('Nom par défaut', 'Default name')}</span>
                  </div>
                </div>
                <input
                  className="input"
                  aria-label={t('Nom affiché FR', 'Displayed name FR')}
                  placeholder={m.name.fr}
                  value={override?.fr ?? ''}
                  onChange={(e) => dispatch({ type: 'module-name', id, lang: 'fr', value: e.target.value })}
                />
                <input
                  className="input"
                  aria-label={t('Nom affiché EN', 'Displayed name EN')}
                  placeholder={m.name.en}
                  value={override?.en ?? ''}
                  onChange={(e) => dispatch({ type: 'module-name', id, lang: 'en', value: e.target.value })}
                />
                <div className="menu-ed-mod-actions">
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    disabled={mi === 0}
                    onClick={() => dispatch({ type: 'module-move', section: index, index: mi, dir: -1 })}
                    aria-label={t('Monter', 'Move up')}
                    title={t('Monter', 'Move up')}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    disabled={mi === section.moduleIds.length - 1}
                    onClick={() => dispatch({ type: 'module-move', section: index, index: mi, dir: 1 })}
                    aria-label={t('Descendre', 'Move down')}
                    title={t('Descendre', 'Move down')}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <select
                    className="select menu-ed-move"
                    value=""
                    disabled={targets.length === 0}
                    aria-label={t('Déplacer vers', 'Move to')}
                    onChange={(e) => {
                      if (e.target.value !== '') dispatch({ type: 'module-to', from: index, index: mi, to: Number(e.target.value) });
                    }}
                  >
                    <option value="">{t('Déplacer vers…', 'Move to…')}</option>
                    {targets.map((x) => (
                      <option key={x.i} value={x.i}>
                        {x.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })
        ) : (
          <div className="faint small">{t('Aucun module. Déplacez-en un ici depuis une autre section.', 'No modules. Move one here from another section.')}</div>
        )}
      </div>
    </section>
  );
}
