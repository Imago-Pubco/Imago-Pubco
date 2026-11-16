import { useMemo, useState } from 'react';
import { Plus, RotateCcw, Save, Undo2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Modal, PageHeader, useToast } from '@/components/ui';
import { menuModules, normalizeMenu, resetMenuLayout, saveMenuLayout, useMenuLayout } from '@/layout/menuLayout';
import type { MenuLayout } from '@/layout/menuSchema';
import type { ModuleDef } from '@/modules/types';
import { MenuPreview } from '../menu/MenuPreview';
import { SectionCard } from '../menu/SectionCard';
import { applyOp, canon, MAX_SECTIONS, prepareMenu, summarizeMenu, type MenuOp } from '../menu/menuEdit';

/** Always fixed at the bottom of the sidebar: not offered in the editor. */
const FIXED_BOTTOM_ID = 'it';

/** Administration → Menu: shapes the sidebar for everyone. Edits a local draft; saved only on "Enregistrer". */
export function MenuEditor() {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const toast = useToast();
  const modulesById = useMemo(
    () => new Map<string, ModuleDef>(menuModules().filter((m) => m.id !== FIXED_BOTTOM_ID).map((m) => [m.id, m] as const)),
    [],
  );
  const { layout } = useMenuLayout();

  // The draft starts from the saved layout. When the saved layout changes (saved here or elsewhere), the draft follows
  // it only if it had no unsaved edits of its own.
  const baseKey = canon(layout);
  const [draft, setDraft] = useState<MenuLayout>(layout);
  const [baseSeen, setBaseSeen] = useState(baseKey);
  if (baseSeen !== baseKey) {
    setBaseSeen(baseKey);
    if (canon(draft) === baseSeen) setDraft(layout);
  }
  const dirty = canon(draft) !== baseKey;

  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const dispatch = (op: MenuOp) => setDraft((d) => applyOp(d, op));

  const save = async () => {
    const res = prepareMenu(draft, menuModules());
    if ('error' in res) {
      toast(t(res.error), 'err');
      return;
    }
    setSaving(true);
    try {
      await saveMenuLayout(res.menu);
      setDraft(res.menu);
      await logAudit(me!.id, 'admin.menu.save', summarizeMenu(res.menu));
      toast(t('Menu enregistré', 'Menu saved'));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('Enregistrement impossible', 'Could not save'), 'err');
    } finally {
      setSaving(false);
    }
  };

  const resetDefault = async () => {
    setSaving(true);
    try {
      await resetMenuLayout();
      setDraft(normalizeMenu(null));
      setResetOpen(false);
      await logAudit(me!.id, 'admin.menu.reset', '');
      toast(t('Menu par défaut rétabli', 'Default menu restored'));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('Réinitialisation impossible', 'Could not reset'), 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page wide>
      <PageHeader
        eyebrow={t('Administration', 'Administration')}
        title={t('Menu', 'Menu')}
        subtitle={t(
          'Ce menu change la barre latérale de tout le monde : l’ordre et les noms des sections et des modules. Les sections vides sont masquées.',
          'This menu changes the sidebar for everyone: the order and names of sections and modules. Empty sections are hidden.',
        )}
        actions={
          <>
            {dirty && <span className="badge badge-warn">{t('Modifications non enregistrées', 'Unsaved changes')}</span>}
            <button className="btn btn-ghost" disabled={!dirty || saving} onClick={() => setDraft(layout)}>
              <Undo2 size={16} /> {t('Annuler les modifications', 'Discard changes')}
            </button>
            <button className="btn btn-ghost" disabled={saving} onClick={() => setResetOpen(true)}>
              <RotateCcw size={16} /> {t('Rétablir le menu par défaut', 'Restore default menu')}
            </button>
            <button className="btn btn-primary" disabled={!dirty || saving} onClick={save}>
              <Save size={16} /> {t('Enregistrer', 'Save')}
            </button>
          </>
        }
      />

      <div className="menu-ed-layout">
        <div className="menu-ed-main">
          {draft.sections.map((s, i) => (
            <SectionCard
              key={`${i}-${s.id}`}
              index={i}
              sections={draft.sections}
              section={s}
              modulesById={modulesById}
              names={draft.names}
              dispatch={dispatch}
            />
          ))}
          <button className="btn btn-ghost menu-ed-add" disabled={draft.sections.length >= MAX_SECTIONS || saving} onClick={() => dispatch({ type: 'section-add' })}>
            <Plus size={16} /> {t('Ajouter une section', 'Add a section')}
          </button>
        </div>
        <div className="menu-ed-side">
          <MenuPreview layout={draft} modulesById={modulesById} />
        </div>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={t('Rétablir le menu par défaut ?', 'Restore the default menu?')}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setResetOpen(false)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-danger" disabled={saving} onClick={resetDefault}>
              {t('Rétablir', 'Restore')}
            </button>
          </>
        }
      >
        <p className="muted" style={{ margin: 0 }}>
          {t(
            'Le menu de tout le monde reviendra à la disposition d’origine, et les noms affichés personnalisés seront retirés.',
            'Everyone’s menu goes back to the original order, and custom displayed names are removed.',
          )}
        </p>
      </Modal>
    </Page>
  );
}
