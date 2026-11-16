import { useState } from 'react';
import { AlertTriangle, Archive, Database, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { ALIGN_COUNT_ITEMS, type AlignArchiveInfo, type AlignCounts, type ArchiveParts } from './types';

/** Compact grid of labelled numbers (same look as the KPI screen). */
export function CountGrid({ items }: { items: { label: string; value: number }[] }) {
  const { fmtNum } = useI18n();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
      {items.map((i) => (
        <div key={i.label} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 10px', background: 'var(--bg-sunken)' }}>
          <div className="faint small">{i.label}</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{fmtNum(i.value)}</div>
        </div>
      ))}
    </div>
  );
}

/** The six collections as they are in the app right now. */
export function CurrentCard({ counts }: { counts: AlignCounts }) {
  const { t } = useI18n();
  return (
    <div className="card card-pad stack">
      <div className="row">
        <Database size={20} color="var(--accent)" />
        <h3>{t('Données actuelles', 'Current data')}</h3>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {t('Le contenu actuel de la section Align de l’application.', 'What the Align section of the app holds today.')}
      </p>
      <CountGrid items={ALIGN_COUNT_ITEMS.map((i) => ({ label: t(i.label), value: counts[i.key] ?? 0 }))} />
    </div>
  );
}

interface ArchiveCardProps {
  archive: AlignArchiveInfo;
  canReplace: boolean;
  busy: boolean;
  onAsk: (parts: ArchiveParts) => void;
}

const NONE: ArchiveParts = { strategy: false, checklist: false, rocks: false };

/** The capture from aligntoday.com: the user picks which parts to reload. */
export function ArchiveCard({ archive, canReplace, busy, onAsk }: ArchiveCardProps) {
  const { t } = useI18n();
  const [parts, setParts] = useState<ArchiveParts>(NONE);
  const chosen = Object.values(parts).some(Boolean);
  const box = (key: keyof ArchiveParts, label: string) => (
    <label className="row" style={{ gap: 8 }}>
      <input type="checkbox" checked={!!parts[key]} disabled={!canReplace || busy} onChange={(e) => setParts({ ...parts, [key]: e.target.checked })} />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="card card-pad stack">
      <div className="row">
        <Archive size={20} color="var(--accent)" />
        <h3>{t('Archive Align (aligntoday.com)', 'Align archive (aligntoday.com)')}</h3>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {t(`Capturée le ${archive.date}. Elle contient :`, `Captured on ${archive.date}. It contains:`)}
      </p>
      <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
        <li>{t('le plan stratégique complet', 'the full strategic plan')}</li>
        <li>{t(`la liste de vérification, ${archive.checklist} points`, `the checklist, ${archive.checklist} points`)}</li>
        <li>{t(`${archive.rocks} Rocks du trimestre`, `${archive.rocks} Rocks of the quarter`)}</li>
      </ul>

      <div className="stack" style={{ gap: 6 }}>
        {box('strategy', t('Plan stratégique (remplace le plan actuel)', 'Strategic plan (replaces the current plan)'))}
        {box('checklist', t('Liste de vérification (remplace la liste actuelle)', 'Checklist (replaces the current list)'))}
        {box('rocks', t('Rocks du trimestre (ajoute seulement ceux qui manquent)', 'Rocks of the quarter (adds only the missing ones)'))}
      </div>

      {!canReplace && (
        <p className="faint small" style={{ margin: 0 }}>
          {t('Réservé aux personnes qui gèrent les Rocks, les priorités, les huddles et le plan.', 'Reserved to people who manage Rocks, priorities, huddles and the plan.')}
        </p>
      )}
      <div>
        <button className="btn" onClick={() => onAsk(parts)} disabled={!canReplace || busy || !chosen}>
          <RefreshCw size={16} /> {t('Recharger…', 'Reload…')}
        </button>
      </div>
    </div>
  );
}

interface DangerCardProps {
  disabled: boolean;
  canReplace: boolean;
  onOpen: () => void;
}

export function DangerCard({ disabled, canReplace, onOpen }: DangerCardProps) {
  const { t } = useI18n();
  return (
    <div className="card card-pad stack" style={{ border: '1px solid var(--err)' }}>
      <div className="row">
        <AlertTriangle size={20} color="var(--err)" />
        <h3 style={{ color: 'var(--err)' }}>{t('Zone dangereuse', 'Danger zone')}</h3>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {t(
          'Efface toutes les données Align de l’application (Rocks, priorités, notes et suivis, huddles, plan stratégique, liste de vérification). Les instantanés et la sauvegarde sont conservés.',
          'Erases all Align data in the app (Rocks, priorities, notes and follow-ups, huddles, strategic plan, checklist). Snapshots and the backup are kept.',
        )}
      </p>
      {!canReplace && (
        <p className="faint small" style={{ margin: 0 }}>
          {t('Réservé aux personnes qui gèrent les Rocks, les priorités, les huddles et le plan.', 'Reserved to people who manage Rocks, priorities, huddles and the plan.')}
        </p>
      )}
      <div>
        <button className="btn btn-danger" onClick={onOpen} disabled={disabled}>
          {t('Effacer toutes les données Align', 'Erase all Align data')}
        </button>
      </div>
    </div>
  );
}
