import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, LayoutGrid, Check, EyeOff, Plus, RotateCcw, Save, Columns2, Square, Info } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { modules } from '@/modules/registry';
import { useToast } from '@/components/ui';
import type { DashboardItem } from '@/data/types';
import type { ModuleDef, WidgetDef } from '@/modules/types';
import { coreWidgets } from './dashboard/coreWidgets';
import { saveDefaultLayout, useDefaultLayout } from './dashboard/layout';
import './home.css';

type Widget = WidgetDef & { accent: string };

export function Home() {
  const { t } = useI18n();
  const { user, can, updatePrefs } = useAuth();
  const toast = useToast();
  const defaultLayout = useDefaultLayout();
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const isAdmin = can('admin.access');

  /** Every widget this user is allowed to see. */
  const catalog = useMemo(() => {
    const map = new Map<string, Widget>();
    coreWidgets.forEach((w) => map.set(w.id, { ...w, accent: 'var(--red)' }));
    modules
      .filter((m: ModuleDef) => can(m.entryPermission))
      .forEach((m) => (m.widgets ?? []).filter((w) => can(w.permission)).forEach((w) => map.set(w.id, { ...w, accent: m.accent })));
    return map;
  }, [can]);

  const personal = user?.prefs?.dashboard;
  const layout: DashboardItem[] = (personal ?? defaultLayout).filter((i) => catalog.has(i.id));
  const hidden = [...catalog.values()].filter((w) => !layout.some((i) => i.id === w.id));

  const save = (next: DashboardItem[]) => updatePrefs({ dashboard: next });
  const setSize = (id: string, size: 1 | 2) => save(layout.map((i) => (i.id === id ? { ...i, size } : i)));
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const moving = layout.find((i) => i.id === dragId)!;
    const rest = layout.filter((i) => i.id !== dragId);
    rest.splice(rest.findIndex((i) => i.id === targetId), 0, moving);
    save(rest);
    setDragId(null);
  };

  const resetToDefault = async () => {
    await updatePrefs({ dashboard: undefined });
    toast(t('Disposition par défaut rétablie', 'Default layout restored'));
  };
  const publishDefault = async () => {
    // Keep widgets from the previous default that this admin can't see? Admins see all, so the layout is complete.
    await saveDefaultLayout(layout);
    await logAudit(user!.id, 'dashboard.default.save', layout.map((i) => i.id).join(', '));
    toast(t('Disposition par défaut enregistrée pour tous', 'Default layout saved for everyone'));
  };

  return (
    <div className="page home">
      <div className="row row-wrap" style={{ marginBottom: 16 }}>
        <div>
          <div className="eyebrow">Imago</div>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>{t('Tableau de bord', 'Dashboard')}</h1>
        </div>
        <span className="spacer" />
        {!editing && personal && (
          <span className="badge" title={t('Vous utilisez une disposition personnalisée', 'You are using a personal layout')}>
            {t('Disposition personnalisée', 'Personal layout')}
          </span>
        )}
        <button className={`btn btn-sm ${editing ? 'btn-primary' : ''}`} onClick={() => setEditing(!editing)}>
          {editing ? <Check size={14} /> : <LayoutGrid size={14} />}
          {editing ? t('Terminé', 'Done') : t('Personnaliser', 'Customize')}
        </button>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div className="customize-bar card" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="customize-inner">
              <div className="row small muted" style={{ gap: 6 }}>
                <Info size={15} />
                {t(
                  'Glissez les widgets pour les réordonner, changez leur largeur ou masquez-les. Vos changements ne s’appliquent qu’à vous.',
                  'Drag widgets to reorder, change their width or hide them. Your changes only apply to you.',
                )}
              </div>
              <div className="row row-wrap">
                {hidden.length > 0 && <span className="faint small">{t('Ajouter :', 'Add:')}</span>}
                {hidden.map((w) => (
                  <button key={w.id} className="btn btn-sm" onClick={() => save([...layout, { id: w.id, size: w.size ?? 1 }])}>
                    <Plus size={14} /> {t(w.title)}
                  </button>
                ))}
                <span className="spacer" />
                {personal && (
                  <button className="btn btn-sm" onClick={resetToDefault}>
                    <RotateCcw size={14} /> {t('Rétablir la disposition par défaut', 'Restore default layout')}
                  </button>
                )}
                {isAdmin && (
                  <button className="btn btn-sm btn-primary" onClick={publishDefault}>
                    <Save size={14} /> {t('Enregistrer comme défaut pour tous', 'Save as default for everyone')}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`widgets ${editing ? 'editing' : ''}`}>
        {layout.map((item, i) => {
          const w = catalog.get(item.id)!;
          const C = w.component;
          const bare = item.id === 'core.welcome' && !editing;
          return (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3), layout: { duration: 0.3 } }}
              className={`widget ${item.size === 2 ? 'w2' : ''} ${dragId === item.id ? 'dragging' : ''} ${bare ? 'bare' : ''}`}
              style={{ ['--accent' as string]: w.accent, ['--accent-soft' as string]: `color-mix(in srgb, ${w.accent} 14%, transparent)` }}
              draggable={editing}
              onDragStart={() => setDragId(item.id)}
              onDragOver={(e) => editing && e.preventDefault()}
              onDrop={() => onDrop(item.id)}
              onDragEnd={() => setDragId(null)}
            >
              {!bare && (
                <div className="widget-head">
                  {editing && <GripVertical size={16} className="faint" style={{ cursor: 'grab' }} />}
                  <span className="widget-dot" />
                  <span>{t(w.title)}</span>
                  <span className="spacer" />
                  {editing && (
                    <>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => setSize(item.id, item.size === 2 ? 1 : 2)}
                        title={item.size === 2 ? t('Demi-largeur', 'Half width') : t('Pleine largeur', 'Full width')}
                      >
                        {item.size === 2 ? <Square size={14} /> : <Columns2 size={14} />}
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => save(layout.filter((x) => x.id !== item.id))} title={t('Masquer', 'Hide')}>
                        <EyeOff size={14} />
                      </button>
                    </>
                  )}
                </div>
              )}
              <div style={{ pointerEvents: editing ? 'none' : undefined }}>
                <C />
              </div>
            </motion.div>
          );
        })}
      </div>
      {!layout.length && (
        <div className="card empty">
          {t('Votre tableau de bord est vide. Cliquez sur « Personnaliser » pour ajouter des widgets.', 'Your dashboard is empty. Click "Customize" to add widgets.')}
        </div>
      )}
    </div>
  );
}
