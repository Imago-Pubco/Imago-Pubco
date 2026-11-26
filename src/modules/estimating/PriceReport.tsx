import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Copy, Printer, ListChecks } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import { SETTING_GROUPS } from './defaults';
import { priceBreaks, type CostKey, type QuantityPrice } from './pricing';
import { provisionalGroups } from './setup/validation';
import type { Estimate, EstimatingSettings, Material, TraceInput, TraceStep } from './types';

const LINE_NAME: Record<CostKey, { fr: string; en: string }> = {
  material: { fr: 'Matériaux', en: 'Material' },
  print: { fr: 'Impression', en: 'Printing' },
  tooling: { fr: 'Outillage', en: 'Tooling' },
  finishing: { fr: 'Finition', en: 'Finishing' },
  labor: { fr: 'Transformation', en: 'Converting' },
  assembly: { fr: 'Assemblage', en: 'Assembly' },
  overhead: { fr: 'Frais généraux', en: 'Overhead' },
  freight: { fr: 'Transport', en: 'Freight' },
};

const SOURCE: Record<TraceInput['source'], { fr: string; en: string }> = {
  spec: { fr: 'Fiche', en: 'Spec' },
  setting: { fr: 'Réglage', en: 'Setting' },
  material: { fr: 'Matériau', en: 'Material' },
  derived: { fr: 'Calculé', en: 'Derived' },
  default: { fr: 'Défaut', en: 'Default' },
};

interface Props {
  estimate: Estimate;
  material?: Material;
  settings: EstimatingSettings;
  canSeeCosts: boolean;
}

/** The complete "how we got this price" report: summary, step-by-step walkthrough, cost-vs-margin chart, assumptions. */
export function PriceReport({ estimate, material, settings, canSeeCosts }: Props) {
  const { t, lang, fmtNum } = useI18n();
  const toast = useToast();
  const en = lang === 'en';
  const locale = en ? 'en-CA' : 'fr-CA';
  const currency = settings.currency || 'CAD';
  const [sel, setSel] = useState(0);

  const prices = useMemo(
    () => priceBreaks(estimate.spec, estimate.quantities, estimate.marginPct, material, settings),
    [estimate, material, settings],
  );

  if (!prices.length) {
    return (
      <div className="card card-pad muted">
        {t('Ajoutez au moins une quantité pour voir le prix.', 'Add at least one quantity to see the price.')}
      </div>
    );
  }

  const current: QuantityPrice = prices[Math.min(sel, prices.length - 1)];
  const money = (n: number, digits = 2) =>
    n.toLocaleString(locale, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
  const num = (n: number) => (Number.isInteger(n) ? fmtNum(n, 0) : n.toLocaleString(locale, { maximumFractionDigits: 4 }));
  const pick = (fr: string, enText?: string) => (en && enText ? enText : fr);
  const stepTitle = (s: TraceStep) => pick(s.title, s.en?.title);
  const stepFormula = (s: TraceStep) => pick(s.formula, s.en?.formula);
  const stepNote = (s: TraceStep) => (s.note ? pick(s.note, s.en?.note) : undefined);
  const inputValue = (i: TraceInput) => (typeof i.value === 'number' ? num(i.value) : i.value);
  const unitLabel = (u?: string) => (u === '$' || u === '$/h' || u === '$/m²' || u === '$/unité' ? u : u ?? '');
  const groups = provisionalGroups(settings);
  const groupName = (id: string) => {
    const g = SETTING_GROUPS.find((x) => x.id === id);
    return g ? pick(g.fr, g.en) : id;
  };
  const provisionalSteps = canSeeCosts ? current.trace.filter((s) => s.provisional) : [];
  const uniqueProvisional = provisionalSteps.filter((s, i, a) => a.findIndex((x) => x.title === s.title) === i);

  /* Waterfall: cost lines accumulate to the total cost, then the margin lifts it to the price. */
  const waterfall = (() => {
    type Bar = { label: string; start: number; end: number; kind: 'cost' | 'total' | 'margin' | 'price' };
    const bars: Bar[] = [];
    let cum = 0;
    for (const l of current.lines) {
      if (l.amount <= 0) continue;
      const lbl = LINE_NAME[l.key];
      bars.push({ label: pick(lbl.fr, lbl.en), start: cum, end: cum + l.amount, kind: 'cost' });
      cum += l.amount;
    }
    bars.push({ label: pick('Coût', 'Cost'), start: 0, end: current.cost, kind: 'total' });
    bars.push({ label: pick('Marge', 'Margin'), start: current.cost, end: current.price, kind: 'margin' });
    bars.push({ label: pick('Prix', 'Price'), start: 0, end: current.price, kind: 'price' });
    return bars;
  })();

  const W = 640;
  const H = 260;
  const PAD = 24;
  const BASE = 200;
  const bw = (W - PAD * 2) / waterfall.length;
  const scale = current.price > 0 ? (BASE - 24) / current.price : 0;
  const colorOf = (k: string) =>
    k === 'cost' ? 'var(--info)' : k === 'total' ? 'var(--text-2)' : k === 'margin' ? 'var(--ok)' : 'var(--accent)';

  const toText = () => {
    const out: string[] = [];
    out.push(`${estimate.no} — ${estimate.customer} — ${estimate.project}`);
    out.push('');
    out.push(en ? 'Price summary' : 'Sommaire des prix');
    for (const p of prices) {
      let line = `${num(p.quantity)} : ${money(p.unitPrice, 4)} / ${en ? 'unit' : 'unité'} — ${en ? 'total' : 'total'} ${money(p.price)}`;
      if (canSeeCosts) line += ` — ${en ? 'cost' : 'coût'} ${money(p.cost)} — ${en ? 'margin' : 'marge'} ${money(p.margin)} (${p.marginPct} %)`;
      out.push(line);
    }
    if (canSeeCosts) {
      out.push('');
      out.push(`${en ? 'Walkthrough for' : 'Détail pour'} ${num(current.quantity)} ${en ? 'units' : 'unités'}`);
      current.trace.forEach((s, i) => {
        out.push(`${i + 1}. ${stepTitle(s)}${s.provisional ? (en ? ' [to validate]' : ' [à valider]') : ''}`);
        out.push(`   ${stepFormula(s)}`);
        for (const inp of s.inputs) {
          const label = pick(inp.label, inp.labelEn);
          out.push(`   - ${label}: ${inputValue(inp)}${inp.unit ? ' ' + inp.unit : ''} (${pick(SOURCE[inp.source].fr, SOURCE[inp.source].en)})`);
        }
        out.push(`   = ${num(s.result)}${s.unit ? ' ' + unitLabel(s.unit) : ''}`);
        const note = stepNote(s);
        if (note) out.push(`   ${note}`);
      });
      if (groups.length) {
        out.push('');
        out.push(en ? 'Assumptions to validate:' : 'Hypothèses à valider :');
        for (const g of groups) out.push(`- ${groupName(g)}`);
      }
    }
    return out.join('\n');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toText());
      toast(t('Rapport copié', 'Report copied'));
    } catch {
      toast(t('Copie impossible dans ce navigateur', 'Copy is not available in this browser'), 'err');
    }
  };

  return (
    <div className="price-report">
      <div className="row row-wrap price-report-head" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>{t('Comment ce prix a été obtenu', 'How this price was reached')}</h2>
          <div className="muted small">{estimate.no} · {estimate.customer}</div>
        </div>
        <div className="row no-print" style={{ gap: 8 }}>
          <button className="btn" onClick={() => window.print()}>
            <Printer size={16} /> {t('Imprimer / PDF', 'Print / PDF')}
          </button>
          <button className="btn" onClick={copy}>
            <Copy size={16} /> {t('Copier en texte', 'Copy as text')}
          </button>
        </div>
      </div>

      {/* 1. Summary */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>{t('Sommaire par quantité', 'Summary by quantity')}</h3>
        <div className="table-wrap">
          <table className="table price-table">
            <thead>
              <tr>
                <th className="num">{t('Quantité', 'Quantity')}</th>
                <th className="num">{t('Prix unitaire', 'Unit price')}</th>
                <th className="num">{t('Total', 'Total')}</th>
                {canSeeCosts && <th className="num">{t('Coût', 'Cost')}</th>}
                {canSeeCosts && <th className="num">{t('Marge', 'Margin')}</th>}
              </tr>
            </thead>
            <tbody>
              {prices.map((p, i) => (
                <tr key={p.quantity} onClick={() => setSel(i)} className={`clickable ${i === sel ? 'on' : ''}`}>
                  <td className="num">{num(p.quantity)}</td>
                  <td className="num"><strong>{money(p.unitPrice, 4)}</strong></td>
                  <td className="num">{money(p.price)}</td>
                  {canSeeCosts && <td className="num">{money(p.cost)}</td>}
                  {canSeeCosts && <td className="num">{money(p.margin)} <span className="faint small">({p.marginPct} %)</span></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row row-wrap no-print" style={{ gap: 6, marginTop: 10 }}>
          <span className="small muted">{t('Quantité détaillée :', 'Detailed quantity:')}</span>
          {prices.map((p, i) => (
            <button key={p.quantity} className={`qty-chip ${i === sel ? 'on' : ''}`} onClick={() => setSel(i)}>
              <span>{num(p.quantity)}</span>
            </button>
          ))}
        </div>
      </div>

      {!canSeeCosts && (
        <div className="card card-pad muted small">
          {t(
            `Dimensions : ${num(estimate.spec.lengthMm)} × ${num(estimate.spec.widthMm)} × ${num(estimate.spec.heightMm)} mm. Les prix sont indiqués hors taxes.`,
            `Dimensions: ${num(estimate.spec.lengthMm)} × ${num(estimate.spec.widthMm)} × ${num(estimate.spec.heightMm)} mm. Prices exclude taxes.`,
          )}
        </div>
      )}

      {canSeeCosts && (
        <>
          {/* 2. Waterfall */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>
              {t(`Du coût au prix — ${num(current.quantity)} unités`, `From cost to price — ${num(current.quantity)} units`)}
            </h3>
            <svg viewBox={`0 0 ${W} ${H}`} className="waterfall" role="img" aria-label={t('Cascade des coûts et de la marge', 'Cost and margin waterfall')}>
              {waterfall.map((b, i) => {
                const x = PAD + i * bw + bw * 0.15;
                const w = bw * 0.7;
                const top = BASE - b.end * scale;
                const h = Math.max(1, (b.end - b.start) * scale);
                return (
                  <g key={`${b.label}-${i}`}>
                    <rect x={x} y={top} width={w} height={h} rx={2} style={{ fill: colorOf(b.kind) }} />
                    <text x={x + w / 2} y={top - 4} textAnchor="middle" className="wf-value">{money(b.end - b.start, 2)}</text>
                    <text x={x + w / 2} y={BASE + 16} textAnchor="middle" className="wf-label">{b.label}</text>
                  </g>
                );
              })}
              <line x1={PAD} x2={W - PAD} y1={BASE} y2={BASE} className="wf-axis" />
            </svg>
          </div>

          {/* 3. Walkthrough */}
          <h3 style={{ margin: '8px 0 10px' }}>
            {t('Pas à pas', 'Step by step')} <span className="faint small">({num(current.quantity)} {t('unités', 'units')})</span>
          </h3>
          <div className="trace-list">
            {current.trace.map((s, i) => (
              <article key={`${s.key}-${i}`} className={`trace-step ${s.provisional ? 'is-provisional' : ''}`}>
                <header className="trace-head">
                  <span className="trace-num">{i + 1}</span>
                  <h4>{stepTitle(s)}</h4>
                  {s.provisional && (
                    <span className="prov-flag" title={t('Valeur non validée', 'Value not validated')}>
                      <AlertTriangle size={14} /> {t('À valider', 'To validate')}
                    </span>
                  )}
                </header>
                <p className="trace-formula">{stepFormula(s)}</p>
                {s.inputs.length > 0 && (
                  <table className="trace-inputs">
                    <tbody>
                      {s.inputs.map((inp, j) => (
                        <tr key={j}>
                          <td>{pick(inp.label, inp.labelEn)}</td>
                          <td className="num">
                            {inputValue(inp)}
                            {inp.unit ? <span className="faint"> {inp.unit}</span> : null}
                          </td>
                          <td>
                            <span className={`src-tag src-${inp.source}`}>{pick(SOURCE[inp.source].fr, SOURCE[inp.source].en)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="trace-result">
                  = <strong>{s.unit === '$' || s.unit === '$/unité' ? money(s.result, Math.abs(s.result) < 1 ? 4 : 2) : num(s.result)}</strong>
                  {s.unit && s.unit !== '$' && s.unit !== '$/unité' ? <span className="faint"> {s.unit}</span> : null}
                  {s.unit === '$/unité' ? <span className="faint"> / {en ? 'unit' : 'unité'}</span> : null}
                </div>
                {stepNote(s) && <p className="trace-note">{stepNote(s)}</p>}
              </article>
            ))}
          </div>

          {/* 4. Assumptions */}
          <div className="card card-pad" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>
              <ListChecks size={18} style={{ verticalAlign: '-3px' }} /> {t('Hypothèses et valeurs à valider', 'Assumptions and values to validate')}
            </h3>
            {groups.length === 0 && uniqueProvisional.length === 0 ? (
              <p className="muted small">{t('Toutes les valeurs de chiffrage ont été confirmées.', 'All costing values have been confirmed.')}</p>
            ) : (
              <>
                {groups.length > 0 && (
                  <>
                    <p className="small muted" style={{ margin: '0 0 6px' }}>{t('Groupes encore provisoires :', 'Groups still provisional:')}</p>
                    <ul className="assumption-list">
                      {groups.map((g) => (
                        <li key={g}>
                          {groupName(g)} <Link to="/estimating/settings">{t('Ouvrir les paramètres', 'Open settings')}</Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {uniqueProvisional.length > 0 && (
                  <>
                    <p className="small muted" style={{ margin: '12px 0 6px' }}>{t('Étapes de ce calcul qui en dépendent :', 'Steps of this calculation that depend on them:')}</p>
                    <ul className="assumption-list">
                      {uniqueProvisional.map((s) => (
                        <li key={s.key}>
                          {stepTitle(s)} <Link to="/estimating/settings">{t('Paramètres', 'Settings')}</Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
