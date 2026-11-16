import { useState } from 'react';
import { DatabaseZap } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { API_MODE, useCollection } from '@/data/db';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { priorities as kpiPriorities } from '@/modules/tools/stores';
import { errorText } from '../components/RockShared';
import { importAlignFromKpi, type AlignImportResult } from '../importKpi';
import { alignHuddles, alignPriorities, notes, rocks } from '../stores';

/** "Importer depuis l'outil KPI": fills Align from the KPI tool's data (replaces the Align data). Unchanged behaviour. */
export function ImportCard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const counts = {
    rocks: useCollection(rocks).rows.length,
    priorities: useCollection(alignPriorities).rows.length,
    notes: useCollection(notes).rows.length,
    huddles: useCollection(alignHuddles).rows.length,
  };
  const kpiRows = useCollection(kpiPriorities).rows;
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AlignImportResult | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const r = await importAlignFromKpi();
      setResult(r);
      if (r.invalid) {
        toast(t(`Import refusé : ${r.invalid} enregistrement(s) invalide(s). Rien n’a été modifié.`, `Import refused: ${r.invalid} invalid record(s). Nothing was changed.`), 'err');
        return;
      }
      // In API mode the server already audits the import (api.ts); only the local backend needs the client entry.
      if (!API_MODE) await logAudit(user!.id, 'align.import.kpi', JSON.stringify(r.written));
      toast(t('Données Align importées depuis l’outil KPI', 'Align data imported from the KPI tool'));
      setConfirm(false);
      setTyped('');
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad stack">
      <div className="row">
        <DatabaseZap size={20} color="var(--accent)" />
        <h3 style={{ margin: 0 }}>{t('Importer depuis l’outil KPI', 'Import from the KPI tool')}</h3>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {t(
          'Les priorités d’entreprise deviennent des Rocks, leurs sous-priorités deviennent leurs priorités, les autres priorités sont importées sans Rock (à rattacher), les tâches et notes hebdomadaires deviennent des suivis et des notes, et les huddles sont copiés. Le plan stratégique et la liste de vérification ne sont pas touchés.',
          'Company priorities become Rocks, their sub-priorities become their priorities, other priorities are imported without a Rock (to be linked), tasks and weekly notes become follow-ups and notes, and huddles are copied. The strategic plan and the checklist are not touched.',
        )}
      </p>
      <div className="row row-wrap small">
        <span className="badge">{t(`Outil KPI : ${kpiRows.length} priorités`, `KPI tool: ${kpiRows.length} priorities`)}</span>
        <span className="badge">{t(`Align : ${counts.rocks} Rocks, ${counts.priorities} priorités, ${counts.notes} notes, ${counts.huddles} huddles`, `Align: ${counts.rocks} Rocks, ${counts.priorities} priorities, ${counts.notes} notes, ${counts.huddles} huddles`)}</span>
      </div>
      <div>
        <button className="btn btn-primary" onClick={() => setConfirm(true)}>
          {t('Importer…', 'Import…')}
        </button>
      </div>
      {result && (
        <div className="faint small">
          {t('Résultat', 'Result')} : {Object.entries(result.written).map(([k, n]) => `${k.replace('align.', '')} ${n}`).join(' · ')}
          {result.invalid ? ` · ${t('invalides', 'invalid')} ${result.invalid}` : ''}
          {result.skipped ? ` · ${t('ignorés', 'skipped')} ${result.skipped}` : ''}
        </div>
      )}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('Remplacer les données Align ?', 'Replace the Align data?')}
        footer={
          <>
            <button className="btn" onClick={() => setConfirm(false)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-danger" onClick={run} disabled={busy || !['REMPLACER', 'REPLACE'].includes(typed.trim().toUpperCase())}>
              {t('Remplacer', 'Replace')}
            </button>
          </>
        }
      >
        <div className="stack">
          <p style={{ margin: 0 }}>
            {t(
              'Les Rocks, priorités, notes et huddles actuels d’Align seront REMPLACÉS par ceux construits depuis l’outil KPI. Tapez REMPLACER pour confirmer.',
              'Align’s current Rocks, priorities, notes and huddles will be REPLACED by those built from the KPI tool. Type REPLACE to confirm.',
            )}
          </p>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </div>
      </Modal>
    </div>
  );
}
