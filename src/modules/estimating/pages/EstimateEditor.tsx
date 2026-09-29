import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Send, Trophy, XCircle, Copy, FileDown, Camera, Sparkles, UploadCloud, X, Plus,
  User as UserIcon, Package, Layers, Calculator, StickyNote, RotateCcw, Info,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { logAudit, users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, useToast } from '@/components/ui';
import { Stages } from '@/components/Stages';
import { estimates, getEstSettings, materials, nextEstimateNo } from '../stores';
import { FINISHES, OPTIONS, PACKAGING_TYPES, PRINT_PROCESSES, STYLES } from '../catalog';
import { BoxPreview, EST_STAGES, EstStatusBadge, estStageIndex, usePricing } from '../ui';
import type { Estimate, EstimateStatus, Material, PackagingSpec, PackagingType } from '../types';

const MATERIAL_FOR: Record<PackagingType, Material['category'][]> = {
  folding: ['carton'],
  corrugated: ['corrugated'],
  rigid: ['rigid'],
  display: ['corrugated', 'carton'],
  copacking: ['carton', 'corrugated', 'plastic'],
};

const SECTIONS = [
  { id: 'client', icon: UserIcon, label: ['Client et projet', 'Customer & project'] },
  { id: 'photo', icon: Camera, label: ['Photo (IA)', 'Photo (AI)'] },
  { id: 'spec', icon: Package, label: ['Emballage', 'Packaging'] },
  { id: 'finish', icon: Layers, label: ['Impression et finition', 'Print & finish'] },
  { id: 'pricing', icon: Calculator, label: ['Quantités et prix', 'Quantities & price'] },
  { id: 'notes', icon: StickyNote, label: ['Notes', 'Notes'] },
] as const;

const COST_LABEL: Record<string, [string, string]> = {
  material: ['Matériaux', 'Material'],
  print: ['Impression', 'Printing'],
  tooling: ['Outillage (forme de découpe)', 'Tooling (cutting die)'],
  finishing: ['Finition', 'Finishing'],
  labor: ['Main-d’œuvre / transformation', 'Labour / converting'],
  freight: ['Transport', 'Freight'],
};

async function blank(userId: string): Promise<Estimate> {
  const s = await getEstSettings();
  const now = new Date().toISOString();
  return {
    id: uid('est_'),
    no: '',
    status: 'draft',
    customer: '',
    contact: '',
    email: '',
    project: '',
    dueDate: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10),
    ownerId: userId,
    spec: {
      type: 'folding', style: STYLES.folding[0].code, lengthMm: 80, widthMm: 50, heightMm: 150, materialId: 'mat1',
      printProcess: 'offset', colorsOutside: 4, colorsInside: 0, finishes: [], options: [], newDie: true, notes: '',
    },
    quantities: [1000, 5000, 10000],
    marginPct: s.defaultMarginPct,
    internalNotes: '',
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    history: [],
  };
}

/** Remount per estimate so state never leaks between records. */
export function EstimateEditorRoute() {
  const { id } = useParams();
  const { key } = useLocation();
  return <EstimateEditor key={id === 'new' ? key : id} />;
}

function EstimateEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const location = useLocation();
  const nav = useNavigate();
  const { t, fmtMoney, fmtNum, fmtDate } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const { rows: mats } = useCollection(materials);
  const { rows: allUsers } = useCollection(users);
  const [est, setEst] = useState<Estimate | null>(null);
  const [dirty, setDirty] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [newQty, setNewQty] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pricing = usePricing(est);

  useEffect(() => {
    const copy = (location.state as { copy?: Estimate } | null)?.copy;
    if (isNew) {
      if (copy) {
        setEst(copy);
        setDirty(true);
      } else if (user) blank(user.id).then(setEst);
    } else if (id) estimates.get(id).then((e) => setEst(e ?? null));
  }, [id, isNew, user, location.state]);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  if (!est) return null;

  const editable = (est.status === 'draft' || est.status === 'costing') && can('estimating.edit');
  const seeCosts = can('estimating.pricing.view');
  const set = (patch: Partial<Estimate>) => {
    setEst({ ...est, ...patch });
    setDirty(true);
  };
  const setSpec = (patch: Partial<PackagingSpec>) => set({ spec: { ...est.spec, ...patch } });
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);
  const inches = (mm: number) => (mm / 25.4).toFixed(2);

  const persist = async (patch: Partial<Estimate> = {}, action?: string, note?: string) => {
    const next: Estimate = {
      ...est,
      ...patch,
      updatedAt: new Date().toISOString(),
      history: action ? [...est.history, { at: new Date().toISOString(), userId: user!.id, action, note }] : est.history,
    };
    if (!(await estimates.get(next.id))) {
      next.no = await nextEstimateNo();
      next.history = [{ at: next.createdAt, userId: user!.id, action: 'created' }, ...next.history];
      await estimates.insert(next);
      await logAudit(user!.id, 'estimating.create', `${next.no} ${next.customer}`);
    } else {
      await estimates.update(next.id, next);
    }
    setEst(next);
    setDirty(false);
    if (isNew) nav(`/estimating/${next.id}`, { replace: true });
    return next;
  };

  const move = async (status: EstimateStatus, msg: string) => {
    if (!est.customer.trim() || !est.project.trim()) return toast(t('Client et projet requis.', 'Customer and project are required.'), 'err');
    await persist({ status }, status);
    await logAudit(user!.id, `estimating.${status}`, est.no || est.customer);
    toast(msg);
  };

  const duplicate = () => {
    const now = new Date().toISOString();
    const copy: Estimate = { ...structuredClone(est), id: uid('est_'), no: '', status: 'draft', createdAt: now, updatedAt: now, createdBy: user!.id, history: [] };
    nav('/estimating/new', { state: { copy } });
  };

  const onPhoto = (f: File | undefined) => {
    if (!f || !f.type.startsWith('image/')) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(f));
    set({ photo: { fileName: f.name, status: 'pending' } });
  };

  const typeMats = mats.filter((m) => MATERIAL_FOR[est.spec.type].includes(m.category));
  const material = mats.find((m) => m.id === est.spec.materialId);
  const styleLabel = STYLES[est.spec.type].find((s) => s.code === est.spec.style)?.label;

  return (
    <Page wide>
      <Link to="/estimating/list" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, marginLeft: -10 }}>
        <ArrowLeft size={16} /> {t('Estimations', 'Estimates')}
      </Link>

      <div className="page-head">
        <div>
          <div className="eyebrow">{est.customer || t('Nouvelle estimation', 'New estimate')}</div>
          <h1>
            {est.project || t('Sans titre', 'Untitled')} {est.no && <span className="mono faint" style={{ fontSize: 18 }}>{est.no}</span>}
          </h1>
          <div className="row" style={{ marginTop: 8 }}>
            <EstStatusBadge status={est.status} />
            {dirty && <span className="badge badge-warn">{t('Non enregistrée', 'Unsaved')}</span>}
          </div>
        </div>
        <div className="row row-wrap">
          {est.no && (
            <Can permission="estimating.edit">
              <button className="btn" onClick={duplicate}>
                <Copy size={16} /> {t('Dupliquer', 'Duplicate')}
              </button>
            </Can>
          )}
          <button className="btn" disabled title={t('Bientôt disponible', 'Coming soon')}>
            <FileDown size={16} /> {t('Soumission PDF', 'Quote PDF')}
          </button>
          {editable && (
            <button className="btn" onClick={() => persist().then(() => toast(t('Estimation enregistrée', 'Estimate saved')))}>
              <Save size={16} /> {t('Enregistrer', 'Save')}
            </button>
          )}
          {est.status === 'draft' && editable && (
            <button className="btn btn-primary" onClick={() => move('costing', t('Estimation en chiffrage', 'Estimate in costing'))}>
              <Calculator size={16} /> {t('Passer au chiffrage', 'Start costing')}
            </button>
          )}
          {est.status === 'costing' && (
            <Can permission="estimating.approve">
              <button className="btn btn-primary" onClick={() => move('sent', t('Soumission envoyée au client', 'Quote sent to customer'))}>
                <Send size={16} /> {t('Soumettre au client', 'Send to customer')}
              </button>
            </Can>
          )}
          {est.status === 'sent' && (
            <Can permission="estimating.approve">
              <button className="btn" onClick={() => move('lost', t('Estimation refusée', 'Estimate lost'))}>
                <XCircle size={16} /> {t('Refusée', 'Lost')}
              </button>
              <button className="btn btn-primary" onClick={() => move('won', t('Acceptée — imago atteint', 'Won — imago reached'))}>
                <Trophy size={16} /> {t('Acceptée', 'Won')}
              </button>
            </Can>
          )}
          {(est.status === 'sent' || est.status === 'lost') && (
            <Can permission="estimating.approve">
              <button className="btn btn-ghost" onClick={() => move('costing', t('Estimation réouverte', 'Estimate reopened'))}>
                <RotateCcw size={16} /> {t('Réviser', 'Revise')}
              </button>
            </Can>
          )}
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <Stages stages={EST_STAGES} current={estStageIndex(est.status)} complete={est.status === 'won'} />
      </div>

      <nav className="est-sections">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <a key={s.id} href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <Icon size={15} /> {t(s.label[0], s.label[1])}
            </a>
          );
        })}
      </nav>

      <div className="est-layout">
        <fieldset disabled={!editable} className="stack est-main">
          {/* 1. Customer & project */}
          <Section id="client" title={t('Client et projet', 'Customer & project')} icon={<UserIcon size={16} />}>
            <div className="form-grid">
              <Field label={t('Client', 'Customer')} span2>
                <input className="input" value={est.customer} onChange={(e) => set({ customer: e.target.value })} placeholder={t('Nom de l’entreprise', 'Company name')} />
              </Field>
              <Field label={t('Contact', 'Contact')}>
                <input className="input" value={est.contact} onChange={(e) => set({ contact: e.target.value })} />
              </Field>
              <Field label={t('Courriel', 'E-mail')}>
                <input className="input" type="email" value={est.email} onChange={(e) => set({ email: e.target.value })} />
              </Field>
              <Field label={t('Nom du projet', 'Project name')} span2>
                <input className="input" value={est.project} onChange={(e) => set({ project: e.target.value })} placeholder={t('Ex. : Coffret cadeau des fêtes', 'E.g. Holiday gift box')} />
              </Field>
              <Field label={t('Échéance de la soumission', 'Quote due date')}>
                <input className="input" type="date" value={est.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
              </Field>
              <Field label={t('Estimateur', 'Estimator')}>
                <select className="select" value={est.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>
                  {allUsers.filter((u) => u.active).map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          {/* 2. Photo analysis (future) */}
          <Section
            id="photo"
            title={t('Photo de la boîte', 'Box photo')}
            icon={<Camera size={16} />}
            badge={<span className="badge badge-accent"><Sparkles size={12} /> {t('Analyse IA — bientôt', 'AI analysis — coming soon')}</span>}
          >
            <div className="photo-grid">
              <div
                className={`dropzone ${photoUrl ? 'has-photo' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onPhoto(e.dataTransfer.files[0]); }}
                role="button"
                tabIndex={0}
              >
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
                {photoUrl ? (
                  <>
                    <img src={photoUrl} alt="" />
                    <button className="btn btn-sm dropzone-clear" type="button" onClick={(e) => { e.stopPropagation(); setPhotoUrl(null); set({ photo: undefined }); }}>
                      <X size={14} />
                    </button>
                  </>
                ) : est.photo ? (
                  <div className="dropzone-empty">
                    <Camera size={28} />
                    <strong>{est.photo.fileName}</strong>
                    <span className="faint small">{t('Photo jointe — cliquez pour la remplacer', 'Photo attached — click to replace')}</span>
                  </div>
                ) : (
                  <div className="dropzone-empty">
                    <UploadCloud size={32} />
                    <strong>{t('Déposez une photo de la boîte', 'Drop a photo of the box')}</strong>
                    <span className="faint small">{t('ou cliquez pour choisir — JPG, PNG', 'or click to browse — JPG, PNG')}</span>
                  </div>
                )}
              </div>
              <div className="ai-panel">
                <div className="row small" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  <Sparkles size={15} /> {t('Ce que l’analyse remplira automatiquement', 'What the analysis will fill in')}
                </div>
                <ul>
                  <li>{t('Type et style de boîte (ECMA / FEFCO)', 'Box type and style (ECMA / FEFCO)')}</li>
                  <li>{t('Dimensions estimées', 'Estimated dimensions')}</li>
                  <li>{t('Matériau et épaisseur probables', 'Likely material and caliper')}</li>
                  <li>{t('Nombre de couleurs et procédé', 'Colour count and process')}</li>
                  <li>{t('Finitions détectées (dorure, UV, laminage…)', 'Detected finishes (foil, UV, lamination…)')}</li>
                  <li>{t('Options : fenêtre, insert, poignée…', 'Options: window, insert, handle…')}</li>
                </ul>
                <button className="btn btn-sm" type="button" disabled>
                  <Sparkles size={14} /> {t('Analyser la photo', 'Analyse photo')}
                </button>
              </div>
            </div>
          </Section>

          {/* 3. Packaging spec */}
          <Section id="spec" title={t('Spécifications de l’emballage', 'Packaging specifications')} icon={<Package size={16} />}>
            <div className="type-cards">
              {PACKAGING_TYPES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`type-card ${est.spec.type === p.key ? 'on' : ''}`}
                  onClick={() => {
                    const mat = mats.find((m) => MATERIAL_FOR[p.key].includes(m.category));
                    setSpec({ type: p.key, style: STYLES[p.key][0].code, materialId: mat?.id ?? est.spec.materialId });
                  }}
                >
                  <strong>{t(p.label)}</strong>
                  <span>{t(p.hint)}</span>
                </button>
              ))}
            </div>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <Field label={t('Style', 'Style')} span2>
                <select className="select" value={est.spec.style} onChange={(e) => setSpec({ style: e.target.value })}>
                  {STYLES[est.spec.type].map((s) => (
                    <option key={s.code} value={s.code}>{t(s.label)} — {s.code}</option>
                  ))}
                </select>
              </Field>
              {(['lengthMm', 'widthMm', 'heightMm'] as const).map((k, i) => (
                <Field key={k} label={[t('Longueur', 'Length'), t('Largeur', 'Width'), t('Hauteur', 'Height')][i] + ' (mm)'}>
                  <input className="input num" type="number" min={1} value={est.spec[k]} onChange={(e) => setSpec({ [k]: +e.target.value })} />
                  <span className="faint small">{inches(est.spec[k])} po</span>
                </Field>
              ))}
              <Field label={t('Matériau', 'Material')} span2>
                <select className="select" value={est.spec.materialId} onChange={(e) => setSpec({ materialId: e.target.value })}>
                  {typeMats.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} — {m.caliper} ({m.code})</option>
                  ))}
                </select>
              </Field>
              <label className="check" style={{ alignSelf: 'end', height: 38 }}>
                <input type="checkbox" checked={est.spec.newDie} onChange={(e) => setSpec({ newDie: e.target.checked })} />
                {t('Nouvelle forme de découpe', 'New cutting die')}
              </label>
            </div>
          </Section>

          {/* 4. Print & finish */}
          <Section id="finish" title={t('Impression et finition', 'Print & finish')} icon={<Layers size={16} />}>
            <div className="form-grid">
              <Field label={t('Procédé d’impression', 'Print process')}>
                <select className="select" value={est.spec.printProcess} onChange={(e) => setSpec({ printProcess: e.target.value as PackagingSpec['printProcess'] })}>
                  {PRINT_PROCESSES.map((p) => (
                    <option key={p.key} value={p.key}>{t(p.label)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('Couleurs — extérieur', 'Colours — outside')}>
                <input className="input num" type="number" min={0} max={8} value={est.spec.colorsOutside} disabled={est.spec.printProcess === 'none'} onChange={(e) => setSpec({ colorsOutside: +e.target.value })} />
              </Field>
              <Field label={t('Couleurs — intérieur', 'Colours — inside')}>
                <input className="input num" type="number" min={0} max={8} value={est.spec.colorsInside} disabled={est.spec.printProcess === 'none'} onChange={(e) => setSpec({ colorsInside: +e.target.value })} />
              </Field>
            </div>
            <div className="label" style={{ margin: '16px 0 8px' }}>{t('Finitions', 'Finishes')}</div>
            <div className="chips">
              {FINISHES.map((f) => (
                <button key={f.key} type="button" className={`chip ${est.spec.finishes.includes(f.key) ? 'on' : ''}`} onClick={() => setSpec({ finishes: toggle(est.spec.finishes, f.key) })}>
                  {t(f.label)}
                </button>
              ))}
            </div>
            <div className="label" style={{ margin: '16px 0 8px' }}>{t('Options de transformation', 'Converting options')}</div>
            <div className="chips">
              {OPTIONS.map((o) => (
                <button key={o.key} type="button" className={`chip ${est.spec.options.includes(o.key) ? 'on' : ''}`} onClick={() => setSpec({ options: toggle(est.spec.options, o.key) })}>
                  {t(o.label)}
                </button>
              ))}
            </div>
            <Field label={t('Notes techniques', 'Technical notes')} style={{ marginTop: 16 }}>
              <textarea className="textarea" value={est.spec.notes} onChange={(e) => setSpec({ notes: e.target.value })} placeholder={t('Tolérances, exigences du client, fichiers d’art…', 'Tolerances, customer requirements, artwork files…')} />
            </Field>
          </Section>

          {/* 5. Quantities & pricing */}
          <Section
            id="pricing"
            title={t('Quantités et prix', 'Quantities & price')}
            icon={<Calculator size={16} />}
            badge={<span className="badge badge-warn"><Info size={12} /> {t('Modèle de prix provisoire', 'Provisional pricing model')}</span>}
          >
            <div className="row row-wrap" style={{ marginBottom: 16 }}>
              <span className="label">{t('Paliers de quantité', 'Quantity breaks')}</span>
              {est.quantities.map((q, i) => (
                <span key={i} className="qty-chip">
                  {fmtNum(q)}
                  {editable && est.quantities.length > 1 && (
                    <button type="button" onClick={() => set({ quantities: est.quantities.filter((_, j) => j !== i) })} aria-label="remove">
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
              {editable && est.quantities.length < 5 && (
                <form
                  className="row"
                  style={{ gap: 6 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = parseInt(newQty, 10);
                    if (n > 0 && !est.quantities.includes(n)) set({ quantities: [...est.quantities, n].sort((a, b) => a - b) });
                    setNewQty('');
                  }}
                >
                  <input className="input input-sm num" style={{ width: 100 }} type="number" min={1} placeholder="Qté" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
                  <button className="btn btn-sm" type="submit">
                    <Plus size={14} />
                  </button>
                </form>
              )}
              <span className="spacer" />
              {seeCosts && (
                <label className="row small" style={{ gap: 8 }}>
                  {t('Marge', 'Margin')}
                  <input className="input input-sm num" style={{ width: 70 }} type="number" min={0} max={90} value={est.marginPct} onChange={(e) => set({ marginPct: +e.target.value })} />%
                </label>
              )}
            </div>

            <div className="table-wrap">
              <table className="table price-table">
                <thead>
                  <tr>
                    <th></th>
                    {pricing.map((p) => (
                      <th key={p.quantity} className="num">{fmtNum(p.quantity)} {t('unités', 'units')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seeCosts &&
                    Object.keys(COST_LABEL).map((k) => (
                      <tr key={k}>
                        <td className="muted">{t(...COST_LABEL[k])}</td>
                        {pricing.map((p) => (
                          <td key={p.quantity} className="num">{fmtMoney(p.lines.find((l) => l.key === k)!.amount)}</td>
                        ))}
                      </tr>
                    ))}
                  {seeCosts && (
                    <>
                      <tr className="subtotal">
                        <td>{t('Coût total', 'Total cost')}</td>
                        {pricing.map((p) => <td key={p.quantity} className="num">{fmtMoney(p.cost)}</td>)}
                      </tr>
                      <tr>
                        <td className="muted">{t('Marge', 'Margin')} ({est.marginPct} %)</td>
                        {pricing.map((p) => <td key={p.quantity} className="num">{fmtMoney(p.margin)}</td>)}
                      </tr>
                    </>
                  )}
                  <tr className="grand">
                    <td>{t('Prix de vente', 'Selling price')}</td>
                    {pricing.map((p) => <td key={p.quantity} className="num">{fmtMoney(p.price)}</td>)}
                  </tr>
                  <tr className="unit">
                    <td>{t('Prix unitaire', 'Unit price')}</td>
                    {pricing.map((p) => <td key={p.quantity} className="num">{fmtMoney(p.unitPrice)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* 6. Notes */}
          <Section id="notes" title={t('Notes internes', 'Internal notes')} icon={<StickyNote size={16} />}>
            <textarea className="textarea" style={{ minHeight: 110 }} value={est.internalNotes} onChange={(e) => set({ internalNotes: e.target.value })} placeholder={t('Visible uniquement à l’interne', 'Internal only')} />
            {est.history.length > 0 && (
              <ol className="timeline" style={{ padding: '16px 0 0' }}>
                {[...est.history].reverse().map((h, i) => (
                  <li key={i}>
                    <div className="tl-dot" />
                    <div className="small">
                      <strong>{h.action}</strong> <span className="faint">· {fmtDate(h.at, true)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </fieldset>

        {/* Sticky summary */}
        <aside className="est-summary">
          <div className="card">
            <div className="card-head">
              <h3>{t('Résumé', 'Summary')}</h3>
              <EstStatusBadge status={est.status} />
            </div>
            <div className="est-box">
              {est.spec.type === 'copacking' ? (
                <div className="faint small" style={{ padding: 30 }}>{t('Service de co-packing', 'Co-packing service')}</div>
              ) : (
                <BoxPreview l={est.spec.lengthMm} w={est.spec.widthMm} h={est.spec.heightMm} />
              )}
            </div>
            <dl className="est-facts">
              <dt>{t('Type', 'Type')}</dt>
              <dd>{t(PACKAGING_TYPES.find((p) => p.key === est.spec.type)!.label)}</dd>
              <dt>{t('Style', 'Style')}</dt>
              <dd>{styleLabel ? t(styleLabel) : est.spec.style}</dd>
              <dt>{t('Dimensions', 'Dimensions')}</dt>
              <dd className="mono">{est.spec.lengthMm} × {est.spec.widthMm} × {est.spec.heightMm} mm</dd>
              <dt>{t('Matériau', 'Material')}</dt>
              <dd>{material ? `${material.name} ${material.caliper}` : '—'}</dd>
              <dt>{t('Impression', 'Print')}</dt>
              <dd>
                {est.spec.printProcess === 'none'
                  ? t('Aucune', 'None')
                  : `${t(PRINT_PROCESSES.find((p) => p.key === est.spec.printProcess)!.label)} ${est.spec.colorsOutside}/${est.spec.colorsInside}`}
              </dd>
              {est.spec.finishes.length > 0 && (
                <>
                  <dt>{t('Finitions', 'Finishes')}</dt>
                  <dd>{est.spec.finishes.map((f) => t(FINISHES.find((x) => x.key === f)!.label)).join(', ')}</dd>
                </>
              )}
            </dl>
            <div className="est-prices">
              {pricing.map((p) => (
                <div key={p.quantity}>
                  <span>{fmtNum(p.quantity)}</span>
                  <strong>{fmtMoney(p.unitPrice)}</strong>
                  <span className="faint small">{fmtMoney(p.price)}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Page>
  );
}

function Section({ id, title, icon, badge, children }: { id: string; title: string; icon: ReactNode; badge?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="card est-section">
      <div className="card-head">
        <h3 className="row" style={{ gap: 8 }}>
          <span className="est-section-icon">{icon}</span>
          {title}
        </h3>
        {badge}
      </div>
      <div className="card-pad">{children}</div>
    </section>
  );
}

function Field({ label, span2, children, style }: { label: string; span2?: boolean; children: ReactNode; style?: CSSProperties }) {
  return (
    <label className={`field ${span2 ? 'span-2' : ''}`} style={style}>
      <span>{label}</span>
      {children}
    </label>
  );
}
