import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Info, Plus, Wand2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { logAudit } from '@/data/stores';
import { uid, useCollection } from '@/data/db';
import { useI18n, type L } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { DEFAULT_EST_SETTINGS, estSettings, getEstSettings, materials } from '../stores';
import { SETTING_GROUPS } from '../defaults';
import type { EstimatingSettings, Material, PackagingType } from '../types';
import { getIn, provisionalGroups, setIn, validationSummary } from './validation';

const b = (fr: string, en: string): L => ({ fr, en });
type Path = (string | number)[];

interface Field {
  path: Path;
  label: L;
  unit?: string;
  kind?: 'number' | 'text' | 'select';
  options?: string[];
  /** Empty input clears the value (used for optional overrides). */
  optional?: boolean;
}
interface Question {
  id: string;
  title: L;
  example: L;
  fields: Field[];
}
interface WizStep {
  group: string;
  title: L;
  intro: L;
  questions: Question[];
  /** Shows the inline materials editor under the questions. */
  materials?: boolean;
}

const FINISHES: { key: string; fr: string; en: string }[] = [
  { key: 'aqueous', fr: 'Vernis aqueux', en: 'Aqueous coating' },
  { key: 'uv', fr: 'Vernis UV', en: 'UV coating' },
  { key: 'spotuv', fr: 'UV sélectif', en: 'Spot UV' },
  { key: 'matte', fr: 'Laminage mat', en: 'Matte lamination' },
  { key: 'gloss', fr: 'Laminage lustré', en: 'Gloss lamination' },
  { key: 'foil', fr: 'Dorure à chaud', en: 'Hot foil stamping' },
  { key: 'emboss', fr: 'Gaufrage', en: 'Embossing' },
];

const TYPE_NAMES: { key: PackagingType; fr: string; en: string }[] = [
  { key: 'folding', fr: 'Boîte pliante', en: 'Folding carton' },
  { key: 'corrugated', fr: 'Carton ondulé', en: 'Corrugated box' },
  { key: 'rigid', fr: 'Boîte rigide', en: 'Rigid box' },
  { key: 'display', fr: 'Présentoir', en: 'Display' },
  { key: 'copacking', fr: 'Co-packing', en: 'Co-packing' },
];

const D = DEFAULT_EST_SETTINGS;
const wasteFields: Field[] = (D.wasteCurve ?? []).map((w, i, arr) => ({
  path: ['wasteCurve', i, 'pct'],
  unit: '%',
  label:
    i === arr.length - 1
      ? b(`Au-delà de ${num(arr[i - 1]?.upToQty ?? 0)} unités`, `Above ${num(arr[i - 1]?.upToQty ?? 0)} units`)
      : b(`Jusqu’à ${num(w.upToQty)} unités`, `Up to ${num(w.upToQty)} units`),
}));
const tierFields: Field[] = (D.marginTiers ?? []).map((t, i) => ({
  path: ['marginTiers', i, 'marginPct'],
  unit: '%',
  label: b(`Quantités à partir de ${num(t.minQty)}`, `Quantities from ${num(t.minQty)}`),
}));
function num(n: number) {
  return n.toLocaleString('fr-CA');
}

const STEPS: WizStep[] = [
  {
    group: 'company',
    title: b('Entreprise et devise', 'Company and currency'),
    intro: b('Ces informations apparaissent sur les soumissions.', 'These details appear on quotes.'),
    questions: [
      {
        id: 'company-name',
        title: b('Nom de l’entreprise', 'Company name'),
        example: b('Ex. Pubco inc.', 'Ex. Pubco inc.'),
        fields: [{ path: ['companyName'], label: b('Nom', 'Name'), kind: 'text' }],
      },
      {
        id: 'currency',
        title: b('Devise des prix', 'Price currency'),
        example: b('Ex. CAD pour des soumissions en dollars canadiens.', 'Ex. CAD for quotes in Canadian dollars.'),
        fields: [{ path: ['currency'], label: b('Devise', 'Currency'), kind: 'select', options: ['CAD', 'USD', 'EUR'] }],
      },
    ],
  },
  {
    group: 'materials',
    title: b('Cartons, feuilles et gâche', 'Boards, sheets and waste'),
    intro: b('Le format des feuilles détermine combien de pièces tiennent sur une feuille.', 'The sheet size decides how many pieces fit on one sheet.'),
    materials: true,
    questions: [
      {
        id: 'sheet',
        title: b('Format de feuille standard', 'Standard sheet size'),
        example: b('Ex. 720 × 1 020 mm (feuille 25 × 38 po). Remplacé par le format propre à chaque matériau.', 'Ex. 720 × 1,020 mm (25 × 38 in sheet). Replaced by each material’s own size.'),
        fields: [
          { path: ['sheetWidthMm'], label: b('Largeur', 'Width'), unit: 'mm' },
          { path: ['sheetHeightMm'], label: b('Hauteur', 'Height'), unit: 'mm' },
        ],
      },
      {
        id: 'gripper',
        title: b('Marge de prise de la presse', 'Press gripper margin'),
        example: b('Ex. 12 mm : bande du bord de la feuille que la presse ne peut pas imprimer.', 'Ex. 12 mm: strip at the sheet edge the press cannot print.'),
        fields: [{ path: ['gripperMarginMm'], label: b('Marge', 'Margin'), unit: 'mm' }],
      },
      {
        id: 'gutter',
        title: b('Espace entre deux pièces', 'Space between two pieces'),
        example: b('Ex. 5 mm pour la coupe et le repérage.', 'Ex. 5 mm for cutting and registration.'),
        fields: [{ path: ['gutterMm'], label: b('Espace', 'Gap'), unit: 'mm' }],
      },
      {
        id: 'waste',
        title: b('Gâche (feuilles perdues) selon la quantité', 'Waste (lost sheets) by quantity'),
        example: b('Ex. 15 % de feuilles en plus pour une petite série, 4 % pour une très grande.', 'Ex. 15% extra sheets for a small run, 4% for a very large one.'),
        fields: wasteFields,
      },
    ],
  },
  {
    group: 'printing',
    title: b('Impression', 'Printing'),
    intro: b('Taux de chaque presse. Un taux horaire inclut l’amortissement, l’énergie et l’opérateur.', 'Rate of each press. An hourly rate includes depreciation, energy and the operator.'),
    questions: [
      {
        id: 'press-offset',
        title: b('Presse offset', 'Offset press'),
        example: b('Ex. 185 $/h, 6 000 feuilles/h, 4 couleurs par passage, 12 min de mise en train par couleur, 55 $ par plaque.', 'Ex. $185/h, 6,000 sheets/h, 4 colours per pass, 12 min make-ready per colour, $55 per plate.'),
        fields: [
          { path: ['pressRates', 'offset', 'hourlyRate'], label: b('Taux horaire', 'Hourly rate'), unit: '$/h' },
          { path: ['pressRates', 'offset', 'sheetsPerHour'], label: b('Vitesse', 'Speed'), unit: 'feuilles/h' },
          { path: ['pressRates', 'offset', 'units'], label: b('Couleurs par passage', 'Colours per pass') },
          { path: ['pressRates', 'offset', 'makeReadyMinPerColor'], label: b('Mise en train par couleur', 'Make-ready per colour'), unit: 'min' },
          { path: ['pressRates', 'offset', 'platePerColor'], label: b('Prix d’une plaque', 'Price per plate'), unit: '$' },
        ],
      },
      {
        id: 'press-flexo',
        title: b('Presse flexo', 'Flexo press'),
        example: b('Ex. 150 $/h, 5 000 feuilles/h, 6 couleurs par passage.', 'Ex. $150/h, 5,000 sheets/h, 6 colours per pass.'),
        fields: [
          { path: ['pressRates', 'flexo', 'hourlyRate'], label: b('Taux horaire', 'Hourly rate'), unit: '$/h' },
          { path: ['pressRates', 'flexo', 'sheetsPerHour'], label: b('Vitesse', 'Speed'), unit: 'feuilles/h' },
          { path: ['pressRates', 'flexo', 'units'], label: b('Couleurs par passage', 'Colours per pass') },
        ],
      },
      {
        id: 'press-digital',
        title: b('Presse numérique', 'Digital press'),
        example: b('Ex. 240 $/h, 1 500 feuilles/h, 0,06 $ de toner par feuille et par couleur.', 'Ex. $240/h, 1,500 sheets/h, $0.06 toner per sheet and colour.'),
        fields: [
          { path: ['pressRates', 'digital', 'hourlyRate'], label: b('Taux horaire', 'Hourly rate'), unit: '$/h' },
          { path: ['pressRates', 'digital', 'sheetsPerHour'], label: b('Vitesse', 'Speed'), unit: 'feuilles/h' },
          { path: ['pressRates', 'digital', 'inkPerSheetPerColor'], label: b('Toner par feuille et couleur', 'Toner per sheet and colour'), unit: '$' },
        ],
      },
    ],
  },
  {
    group: 'tooling',
    title: b('Découpe et outillage', 'Die-cutting and tooling'),
    intro: b('Une forme neuve est facturée une seule fois, pas à chaque pièce.', 'A new die is charged once, not per piece.'),
    questions: [
      ...(['folding', 'corrugated', 'rigid', 'display'] as PackagingType[]).map((k) => {
        const n = TYPE_NAMES.find((x) => x.key === k)!;
        return {
          id: `die-${k}`,
          title: b(`Forme ou gabarit : ${n.fr.toLowerCase()}`, `Die or jig: ${n.en.toLowerCase()}`),
          example: b(
            k === 'rigid' ? 'Ex. 250 $ pour le gabarit de montage d’une boîte rigide.' : 'Ex. 450 $ pour une forme neuve de ce type.',
            k === 'rigid' ? 'Ex. $250 for the assembly jig of a rigid box.' : 'Ex. $450 for a new die of this type.',
          ),
          fields: [{ path: ['dieCostByType', k], label: b('Coût', 'Cost'), unit: '$' }],
        };
      }),
      {
        id: 'diecut-speed',
        title: b('Découpeuse', 'Die-cutter'),
        example: b('Ex. 4 000 feuilles/h pour le carton plat, 120 $/h.', 'Ex. 4,000 sheets/h for folding cartons, $120/h.'),
        fields: [
          { path: ['dieCutSheetsPerHour', 'folding'], label: b('Cadence, carton plat', 'Speed, folding carton'), unit: 'feuilles/h' },
          { path: ['dieCutHourlyRate'], label: b('Taux horaire', 'Hourly rate'), unit: '$/h' },
        ],
      },
    ],
  },
  {
    group: 'finishing',
    title: b('Finitions', 'Finishing'),
    intro: b('Pour chaque finition : mise en train (par travail) et coût par 1 000 unités.', 'For each finish: set-up (per job) and cost per 1,000 units.'),
    questions: FINISHES.map((f) => ({
      id: `finish-${f.key}`,
      title: b(f.fr, f.en),
      example: b('Ex. 60 $ de mise en train et 15 $ par 1 000 unités.', 'Ex. $60 set-up and $15 per 1,000 units.'),
      fields: [
        { path: ['finishRates', f.key, 'setup'], label: b('Mise en train', 'Set-up'), unit: '$' },
        { path: ['finishRates', f.key, 'perThousand'], label: b('Par 1 000 unités', 'Per 1,000 units'), unit: '$' },
      ],
    })),
  },
  {
    group: 'labour',
    title: b('Collage, assemblage et emballage', 'Gluing, assembly and packing'),
    intro: b('Temps de main-d’œuvre et taux des machines et des opérateurs.', 'Labour time and machine and operator rates.'),
    questions: [
      {
        id: 'operator',
        title: b('Opérateur (assemblage, emballage)', 'Operator (assembly, packing)'),
        example: b('Ex. 42 $/h, taux chargé de l’employé.', 'Ex. $42/h, the fully loaded employee rate.'),
        fields: [{ path: ['assemblyRatePerHour'], label: b('Taux horaire', 'Hourly rate'), unit: '$/h' }],
      },
      {
        id: 'gluer',
        title: b('Colleuse', 'Gluer'),
        example: b('Ex. 3 000 unités/h et 95 $/h pour la machine.', 'Ex. 3,000 units/h and $95/h for the machine.'),
        fields: [
          { path: ['gluerUnitsPerHour'], label: b('Cadence', 'Output'), unit: 'unités/h' },
          { path: ['machineHourlyRate'], label: b('Taux machine', 'Machine rate'), unit: '$/h' },
        ],
      },
      {
        id: 'packing',
        title: b('Emballage et comptage', 'Packing and counting'),
        example: b('Ex. 3 secondes par unité pour compter et mettre en sac.', 'Ex. 3 seconds per unit to count and bag.'),
        fields: [{ path: ['packingSecondsPerUnit'], label: b('Temps par unité', 'Time per unit'), unit: 's' }],
      },
      {
        id: 'extra-part',
        title: b('Assemblage d’un présentoir ou d’un kit', 'Assembling a display or kit'),
        example: b('Ex. 25 secondes par pièce supplémentaire.', 'Ex. 25 seconds per extra part.'),
        fields: [{ path: ['secondsPerExtraPart'], label: b('Temps par pièce en plus', 'Time per extra part'), unit: 's' }],
      },
    ],
  },
  {
    group: 'overhead',
    title: b('Frais généraux et transport', 'Overhead and freight'),
    intro: b('Pourcentages appliqués au coût direct.', 'Percentages applied to direct cost.'),
    questions: [
      {
        id: 'overhead',
        title: b('Frais généraux', 'Overhead'),
        example: b('Ex. 18 % : loyer, administration, entretien.', 'Ex. 18%: rent, admin, maintenance.'),
        fields: [{ path: ['overheadPct'], label: b('Pourcentage', 'Percentage'), unit: '%' }],
      },
      {
        id: 'freight',
        title: b('Transport', 'Freight'),
        example: b('Ex. 3 % du coût pour la livraison au client.', 'Ex. 3% of cost for delivery to the customer.'),
        fields: [{ path: ['freightPct'], label: b('Pourcentage', 'Percentage'), unit: '%' }],
      },
    ],
  },
  {
    group: 'margin',
    title: b('Politique de marge', 'Margin policy'),
    intro: b('La marge de chaque estimation reste modifiable ; ces valeurs servent de suggestion.', 'Each estimate keeps an editable margin; these values are suggestions.'),
    questions: [
      {
        id: 'margin-default',
        title: b('Marge par défaut', 'Default margin'),
        example: b('Ex. 30 % : marge proposée sur une nouvelle estimation.', 'Ex. 30%: margin proposed on a new estimate.'),
        fields: [{ path: ['defaultMarginPct'], label: b('Marge', 'Margin'), unit: '%' }],
      },
      {
        id: 'margin-tiers',
        title: b('Marge selon la quantité', 'Margin by quantity'),
        example: b('Ex. petites séries 30 %, grandes séries 25 %.', 'Ex. small runs 30%, large runs 25%.'),
        fields: tierFields,
      },
      {
        id: 'margin-type',
        title: b('Marge par type de produit (facultatif)', 'Margin by product type (optional)'),
        example: b('Ex. 35 % pour les présentoirs. Laisser vide pour suivre les paliers.', 'Ex. 35% for displays. Leave empty to follow the quantity tiers.'),
        fields: TYPE_NAMES.map((tn) => ({
          path: ['marginByType', tn.key],
          label: b(tn.fr, tn.en),
          unit: '%',
          optional: true,
        })),
      },
    ],
  },
];

/* ---------------------------------------------------------------- state helpers */

const ALL_QUESTIONS = STEPS.flatMap((s) => s.questions.map((q) => ({ ...q, group: s.group })));

/** A group is confirmed when none of its questions is marked "I don't know yet". */
function groupStatus(group: string, unknown: Record<string, boolean>): 'confirmed' | 'estimate' {
  return ALL_QUESTIONS.filter((q) => q.group === group).every((q) => !unknown[q.id]) ? 'confirmed' : 'estimate';
}

/* ---------------------------------------------------------------- materials editor */

function MaterialRow({ m }: { m: Material }) {
  const [d, setD] = useState<Material>(m);
  const save = async () => {
    if (JSON.stringify(d) !== JSON.stringify(m)) await materials.update(m.id, d);
  };
  return (
    <div className="wiz-mat-row">
      <input className="input mono" aria-label="Code" value={d.code} onChange={(e) => setD({ ...d, code: e.target.value.toUpperCase() })} onBlur={save} />
      <input className="input" aria-label="Description" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} onBlur={save} />
      <label className="wiz-inline">
        <input className="input num" type="number" step="0.01" aria-label="Prix au m²" value={d.costPerM2} onChange={(e) => setD({ ...d, costPerM2: +e.target.value })} onBlur={save} />
        <span className="faint small">$/m²</span>
      </label>
      <label className="wiz-inline">
        <input className="input num" type="number" aria-label="Largeur feuille" placeholder="L" value={d.sheetWidthMm ?? ''} onChange={(e) => setD({ ...d, sheetWidthMm: e.target.value === '' ? undefined : +e.target.value })} onBlur={save} />
        <span className="faint small">×</span>
        <input className="input num" type="number" aria-label="Hauteur feuille" placeholder="H" value={d.sheetHeightMm ?? ''} onChange={(e) => setD({ ...d, sheetHeightMm: e.target.value === '' ? undefined : +e.target.value })} onBlur={save} />
        <span className="faint small">mm</span>
      </label>
    </div>
  );
}

function MaterialsEditor() {
  const { t } = useI18n();
  const { rows } = useCollection(materials);
  const add = async () => {
    await materials.insert({ id: uid('mat_'), code: 'NOUVEAU', name: '', category: 'carton', caliper: '', costPerM2: 0 });
  };
  return (
    <div className="wiz-materials">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <strong>{t('Matériaux : prix et format de feuille', 'Materials: price and sheet size')}</strong>
        <button className="btn btn-sm" onClick={add}>
          <Plus size={14} /> {t('Ajouter', 'Add')}
        </button>
      </div>
      <p className="small muted" style={{ margin: '0 0 8px' }}>
        {t(
          'Prix d’achat au m² de chaque matériau. Les valeurs de départ sont indicatives : remplacez-les par vos prix fournisseurs. Enregistrement à la sortie de chaque champ.',
          'Purchase price per m² of each material. Starting values are indicative: replace them with your supplier prices. Saved when you leave each field.',
        )}
      </p>
      {rows.map((m) => (
        <MaterialRow key={m.id} m={m} />
      ))}
      {!rows.length && <p className="muted small">{t('Aucun matériau.', 'No materials.')}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- wizard */

export function SetupWizard({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<EstimatingSettings | null>(null);
  const [unk, setUnk] = useState<Record<string, boolean>>({});
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const total = STEPS.length + 1; // + summary
  const isSummary = idx === STEPS.length;
  const step = STEPS[idx];

  useEffect(() => {
    getEstSettings().then((s) => {
      setDraft(s);
      const v = s.validated ?? {};
      // Groups not yet confirmed start as "I don't know yet", so the owner answers each one on purpose.
      setUnk(Object.fromEntries(ALL_QUESTIONS.map((q) => [q.id, v[q.group] !== 'confirmed'])));
    });
  }, []);

  if (!draft) {
    return (
      <Modal open onClose={onClose} title={t('Assistant de configuration', 'Setup assistant')}>
        <p className="muted">{t('Chargement…', 'Loading…')}</p>
      </Modal>
    );
  }

  /** Autosave: stores the settings and the state of every group. */
  const persist = async (s: EstimatingSettings, finish = false) => {
    const validated = Object.fromEntries(SETTING_GROUPS.map((g) => [g.id, groupStatus(g.id, unk)]));
    const next: EstimatingSettings = { ...s, validated, ...(finish ? { wizardCompletedAt: new Date().toISOString() } : {}) };
    if (await estSettings.get('settings')) await estSettings.update('settings', next);
    else await estSettings.insert(next);
    await logAudit(user!.id, 'estimating.settings.wizard', JSON.stringify(validated));
    return next;
  };

  const goto = async (n: number) => {
    setSaving(true);
    try {
      await persist(draft);
    } finally {
      setSaving(false);
    }
    setIdx(Math.max(0, Math.min(STEPS.length, n)));
  };

  const finish = async () => {
    setSaving(true);
    try {
      const next = await persist(draft, true);
      setDraft(next);
      toast(t('Configuration enregistrée', 'Setup saved'));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const setValue = (f: Field, q: Question, raw: string) => {
    if (f.kind === 'text' || f.kind === 'select') {
      setDraft((d) => setIn(d, f.path, raw) as EstimatingSettings);
    } else if (raw === '') {
      if (f.optional) setDraft((d) => setIn(d, f.path, undefined) as EstimatingSettings);
    } else {
      setDraft((d) => setIn(d, f.path, +raw) as EstimatingSettings);
    }
    setUnk((u) => ({ ...u, [q.id]: false }));
  };

  const setUnknown = (q: Question, on: boolean) => {
    setUnk((u) => ({ ...u, [q.id]: on }));
    if (on) {
      // Keep the provisional default: the value goes back to the estimate.
      setDraft((d) => q.fields.reduce((acc, f) => setIn(acc, f.path, getIn(D, f.path)), d as unknown) as EstimatingSettings);
    }
  };

  const pct = Math.round(((idx + 1) / total) * 100);

  return (
    <Modal open onClose={onClose} title={t('Assistant de configuration', 'Setup assistant')} large>
      <div className="wiz-progress-label small muted">
        {t(`Étape ${idx + 1} sur ${total}`, `Step ${idx + 1} of ${total}`)}
      </div>
      <div className="wiz-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${pct}%` }} />
      </div>

      {!isSummary && (
        <div className="wiz-step">
          <h3 style={{ margin: '12px 0 4px' }}>{t(step.title.fr, step.title.en)}</h3>
          <p className="muted small" style={{ margin: '0 0 12px' }}>{t(step.intro.fr, step.intro.en)}</p>

          {step.questions.map((q) => {
            const isUnknown = !!unk[q.id];
            return (
              <div key={q.id} className={`wiz-q ${isUnknown ? 'is-unknown' : ''}`}>
                <div className="wiz-q-title">{t(q.title.fr, q.title.en)}</div>
                <div className="wiz-example">
                  <Info size={13} /> {t('Exemple : ', 'Example: ')}
                  {t(q.example.fr.replace(/^Ex\. /, ''), q.example.en.replace(/^Ex\. /, ''))}
                </div>
                <div className="form-grid">
                  {q.fields.map((f) => {
                    const v = getIn(draft, f.path);
                    const label = t(f.label.fr, f.label.en) + (f.unit ? ` (${f.unit})` : '');
                    if (f.kind === 'select') {
                      return (
                        <label className="field" key={f.path.join('.')}>
                          <span>{label}</span>
                          <select className="select" disabled={isUnknown} value={String(v ?? '')} onChange={(e) => setValue(f, q, e.target.value)}>
                            {(f.options ?? []).map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        </label>
                      );
                    }
                    return (
                      <label className="field" key={f.path.join('.')}>
                        <span>{label}</span>
                        <input
                          className={`input ${f.kind === 'text' ? '' : 'num'}`}
                          type={f.kind === 'text' ? 'text' : 'number'}
                          step="any"
                          disabled={isUnknown}
                          value={v === undefined || v === null ? '' : String(v)}
                          onChange={(e) => setValue(f, q, e.target.value)}
                        />
                      </label>
                    );
                  })}
                </div>
                <label className="wiz-unknown">
                  <input type="checkbox" checked={isUnknown} onChange={(e) => setUnknown(q, e.target.checked)} />
                  <span>
                    {t(
                      'Je ne sais pas encore — utiliser l’estimation et me le rappeler',
                      'I don’t know yet — use the estimate and remind me',
                    )}
                  </span>
                </label>
              </div>
            );
          })}

          {step.materials && <MaterialsEditor />}
        </div>
      )}

      {isSummary && (
        <div className="wiz-step">
          <h3 style={{ margin: '12px 0 4px' }}>{t('Récapitulatif', 'Summary')}</h3>
          <p className="muted small" style={{ margin: '0 0 12px' }}>
            {t(
              'Les groupes « à valider » restent des estimations : les prix sont calculés, mais signalés comme provisoires dans chaque rapport.',
              'Groups “to validate” stay estimates: prices are calculated but flagged as provisional in every report.',
            )}
          </p>
          <ul className="wiz-summary">
            {SETTING_GROUPS.map((g, i) => {
              const ok = groupStatus(g.id, unk) === 'confirmed';
              return (
                <li key={g.id}>
                  {ok ? <CheckCircle2 size={16} color="var(--ok)" /> : <AlertTriangle size={16} color="var(--warn)" />}
                  <button className="link-btn" onClick={() => setIdx(i)}>{t(g.fr, g.en)}</button>
                  <span className={`badge ${ok ? 'badge-ok' : 'badge-warn'}`}>{ok ? t('Confirmé', 'Confirmed') : t('À valider', 'To validate')}</span>
                </li>
              );
            })}
          </ul>
          <p className="small">
            {t(
              `${validationSummary(draft).confirmed.length} groupe(s) confirmé(s), ${provisionalGroups(draft).length} à valider.`,
              `${validationSummary(draft).confirmed.length} group(s) confirmed, ${provisionalGroups(draft).length} to validate.`,
            )}
          </p>
        </div>
      )}

      <div className="modal-foot">
        <button className="btn" onClick={() => goto(idx - 1)} disabled={idx === 0 || saving}>
          <ArrowLeft size={16} /> {t('Précédent', 'Back')}
        </button>
        {isSummary ? (
          <button className="btn btn-primary" onClick={finish} disabled={saving}>
            <Wand2 size={16} /> {t('Terminer', 'Finish')}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => goto(idx + 1)} disabled={saving}>
            {t('Suivant', 'Next')} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- banner */

/** Banner for the settings page and the estimate editor: how many cost groups still need validation. */
export function ValidationBanner() {
  const { t } = useI18n();
  const { can } = useAuth();
  const [settings, setSettings] = useState<EstimatingSettings>(DEFAULT_EST_SETTINGS);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const load = () => getEstSettings().then(setSettings);
    load();
    return estSettings.subscribe(load);
  }, []);
  const pending = provisionalGroups(settings).length;
  const canOpen = can('estimating.settings');

  if (!pending) {
    return (
      <div className="alert alert-info validation-banner" style={{ marginBottom: 16 }}>
        <CheckCircle2 size={16} />
        {t('Tous les groupes de coûts sont confirmés.', 'All cost groups are confirmed.')}
      </div>
    );
  }

  return (
    <>
      <div className="alert alert-warn validation-banner" style={{ marginBottom: 16 }}>
        <AlertTriangle size={16} />
        <span>
          {t(
            `${pending} groupe${pending > 1 ? 's' : ''} de coûts à valider`,
            `${pending} cost group${pending > 1 ? 's' : ''} to validate`,
          )}
        </span>
        {canOpen && (
          <button className="btn btn-sm" onClick={() => setOpen(true)}>
            <Wand2 size={14} /> {t('Ouvrir l’assistant', 'Open the assistant')}
          </button>
        )}
      </div>
      {open && <SetupWizard onClose={() => setOpen(false)} />}
    </>
  );
}
