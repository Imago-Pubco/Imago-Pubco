import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Send, Trophy, XCircle, Copy, FileDown, Camera, Sparkles, UploadCloud, X, Plus,
  User as UserIcon, Package, Layers, Calculator, StickyNote, RotateCcw, Info, Ruler, FileText, History as HistoryIcon,
  Palette, Check, ExternalLink, AlertTriangle, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { API_MODE, uid, useCollection } from '@/data/db';
import { logAudit, users } from '@/data/stores';
import { useI18n, type L } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, Modal, useToast } from '@/components/ui';
import { Stages } from '@/components/Stages';
import { estimates, getEstSettings, materials, nextEstimateNo } from '../stores';
import { fileUrl, saveStudio, transitionRequest } from '@/modules/sales/stores';
import { FAMILY_LABEL, FINISHES, OPTIONS, PACKAGING_TYPES, PRINT_PROCESSES, STYLES, styleFamily } from '../catalog';
import { ValidationBanner } from '../setup/SetupWizard';
import { AutoBadge, BoxPreview, EST_STAGES, EST_STATUS, EstStatusBadge, estStageIndex, isEditable, useEstSettings, usePricing } from '../ui';
import { Dieline, BoxViews } from '../Dieline';
import { PriceReport } from '../PriceReport';
import { analyzeEstimateImage, uploadEstimateFile, type ImageSuggestion } from '../ai';
import type { Estimate, EstimateStatus, Material, PackagingSpec, PackagingType } from '../types';

const MATERIAL_FOR: Record<PackagingType, Material['category'][]> = {
  folding: ['carton'],
  corrugated: ['corrugated'],
  rigid: ['rigid'],
  display: ['corrugated', 'carton'],
  copacking: ['carton', 'corrugated', 'plastic'],
};

type TabId = 'specs' | 'blueprint' | 'pricing' | 'report' | 'history';
const TABS: { id: TabId; label: L; icon: LucideIcon }[] = [
  { id: 'specs', label: { fr: 'Spécifications', en: 'Specs' }, icon: Package },
  { id: 'blueprint', label: { fr: 'Plan', en: 'Blueprint' }, icon: Ruler },
  { id: 'pricing', label: { fr: 'Prix', en: 'Pricing' }, icon: Calculator },
  { id: 'report', label: { fr: 'Rapport', en: 'Report' }, icon: FileText },
  { id: 'history', label: { fr: 'Historique', en: 'History' }, icon: HistoryIcon },
];
const TAB_IDS = TABS.map((x) => x.id);

/** Sales stage each estimating action moves the request to (server-owned transition). */
type SalesTo = 'review' | 'quote_ready' | 'estimating';

type DiffKey = 'type' | 'style' | 'lengthMm' | 'widthMm' | 'heightMm' | 'materialId' | 'printProcess' | 'colorsOutside' | 'colorsInside' | 'finishes' | 'options' | 'newDie';
const DIFF_KEYS: DiffKey[] = ['type', 'style', 'lengthMm', 'widthMm', 'heightMm', 'materialId', 'printProcess', 'colorsOutside', 'colorsInside', 'finishes', 'options', 'newDie'];
const DIFF_LABEL: Record<DiffKey, L> = {
  type: { fr: 'Type', en: 'Type' },
  style: { fr: 'Style', en: 'Style' },
  lengthMm: { fr: 'Longueur (mm)', en: 'Length (mm)' },
  widthMm: { fr: 'Largeur (mm)', en: 'Width (mm)' },
  heightMm: { fr: 'Hauteur (mm)', en: 'Height (mm)' },
  materialId: { fr: 'Matériau', en: 'Material' },
  printProcess: { fr: 'Procédé', en: 'Print process' },
  colorsOutside: { fr: 'Couleurs — extérieur', en: 'Colours — outside' },
  colorsInside: { fr: 'Couleurs — intérieur', en: 'Colours — inside' },
  finishes: { fr: 'Finitions', en: 'Finishes' },
  options: { fr: 'Options', en: 'Options' },
  newDie: { fr: 'Nouvelle forme', en: 'New die' },
};

type Analysis = ImageSuggestion & { fileId: string };

const COST_LABEL: Record<string, L> = {
  material: { fr: 'Matériaux', en: 'Material' },
  print: { fr: 'Impression', en: 'Printing' },
  tooling: { fr: 'Outillage (forme de découpe)', en: 'Tooling (cutting die)' },
  finishing: { fr: 'Finition', en: 'Finishing' },
  labor: { fr: 'Main-d’œuvre / transformation', en: 'Labour / converting' },
  assembly: { fr: 'Assemblage / emballage', en: 'Assembly / packing' },
  overhead: { fr: 'Frais généraux', en: 'Overhead' },
  freight: { fr: 'Transport', en: 'Freight' },
};

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Fields where the suggestion differs from the current spec. */
function diffKeys(current: PackagingSpec, suggested: Partial<PackagingSpec>): DiffKey[] {
  return DIFF_KEYS.filter((k) => suggested[k] !== undefined && JSON.stringify(suggested[k]) !== JSON.stringify(current[k]));
}

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
  const { state } = useLocation();
  const copyId = (state as { copy?: Estimate } | null)?.copy?.id ?? '';
  return <EstimateEditor key={id === 'new' ? `new:${copyId}` : id} />;
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
  const settings = useEstSettings();
  const [est, setEst] = useState<Estimate | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [accepted, setAccepted] = useState<Partial<Record<DiffKey, boolean>>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [newQty, setNewQty] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioBrief, setStudioBrief] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ specs: null, blueprint: null, pricing: null, report: null, history: null });
  const pricing = usePricing(est);

  // Tab lives in the URL hash (#specs, #blueprint, #pricing, #report, #history).
  const hashTab = location.hash.replace('#', '') as TabId;
  const tab: TabId = TAB_IDS.includes(hashTab) ? hashTab : 'specs';
  const setTab = (next: TabId, focus = false) => {
    nav({ pathname: location.pathname, search: location.search, hash: `#${next}` }, { replace: true, state: location.state });
    if (focus) tabRefs.current[next]?.focus();
  };
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = TABS.length - 1;
    if (j < 0) return;
    e.preventDefault();
    setTab(TABS[j].id, true);
  };

  useEffect(() => {
    const copy = (location.state as { copy?: Estimate } | null)?.copy;
    if (isNew) {
      if (copy) {
        setEst(copy);
        setDirty(true);
      } else if (user) blank(user.id).then(setEst);
    } else if (id) estimates.get(id).then((e) => setEst(e ?? null));
  }, [id, isNew, user, location.state]);

  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );

  if (!est) return null;

  const editable = isEditable(est.status) && can('estimating.edit');
  const canApprove = can('estimating.approve');
  const seeCosts = can('estimating.pricing.view');
  const set =(patch: Partial<Estimate>) => {
    setEst({ ...est, ...patch });
    setDirty(true);
  };
  const setSpec = (patch: Partial<PackagingSpec>) => set({ spec: { ...est.spec, ...patch } });
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);
  const inches = (mm: number) => (mm / 25.4).toFixed(2);
  const userName = (uid: string) => allUsers.find((u) => u.id === uid)?.displayName ?? uid;

  /** Saves `base` with a patch; creates the record the first time. */
  const saveEst = async (base: Estimate, patch: Partial<Estimate> = {}, action?: string, noteText?: string): Promise<Estimate> => {
    const now = new Date().toISOString();
    const next: Estimate = {
      ...base,
      ...patch,
      updatedAt: now,
      history: action ? [...base.history, { at: now, userId: user!.id, action, note: noteText }] : base.history,
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
  const persist = (patch: Partial<Estimate> = {}, action?: string, noteText?: string) => saveEst(est, patch, action, noteText);

  /**
   * Moves the estimate to a new status. With a sales request and a sales stage, the sales route performs the
   * transition (it also updates the estimate; in dev mode the browser stand-in does). Without a request, the estimate is updated directly.
   */
  const transition = async (next: EstimateStatus, salesTo: SalesTo | null, msg: string, noteText?: string) => {
    if (!est.customer.trim() || !est.project.trim()) return toast(t('Client et projet requis.', 'Customer and project are required.'), 'err');
    setBusy(true);
    try {
      if (salesTo && est.requestId) {
        if (dirty) await persist();
        await transitionRequest(est.requestId, salesTo, noteText);
        const fresh = await estimates.get(est.id);
        if (fresh) setEst(fresh);
        setDirty(false);
      } else {
        await persist({ status: next }, next, noteText);
      }
      await logAudit(user!.id, `estimating.${next}`, est.no || est.customer);
      toast(msg);
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const confirmReturn = async () => {
    const text = note.trim();
    if (!text) return;
    setNoteOpen(false);
    setNote('');
    await transition('costing', 'estimating', t('Renvoyée en révision', 'Sent back for revision'), text);
  };

  const requestStudio = async () => {
    if (!est.requestId || !studioBrief.trim()) return;
    setBusy(true);
    try {
      await saveStudio(est.requestId, { status: 'requested', brief: studioBrief.trim(), fileIds: [] });
      setStudioOpen(false);
      setStudioBrief('');
      toast(t('Demande envoyée au studio', 'Request sent to the studio'));
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const duplicate = () => {
    const now = new Date().toISOString();
    const copy: Estimate = { ...structuredClone(est), id: uid('est_'), no: '', status: 'draft', requestId: undefined, autoGenerated: false, createdAt: now, updatedAt: now, createdBy: user!.id, history: [] };
    nav('/estimating/new', { state: { copy } });
  };

  const onPhoto = (f: File | undefined) => {
    if (!f || !f.type.startsWith('image/')) return;
    setPhotoUrl(URL.createObjectURL(f));
    setPendingFile(f);
    setAnalysis(null);
    setAnalysisError(null);
    set({ photo: { fileName: f.name, status: 'pending' } });
  };

  /** Uploads the photo, asks the server to analyse it, and keeps the suggestion for the estimator to accept field by field. */
  const runAnalysis = async () => {
    if (!pendingFile || !API_MODE) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    try {
      const saved = dirty || isNew ? await persist() : est;
      const fileId = await uploadEstimateFile(pendingFile);
      const res = await analyzeEstimateImage(saved.id, fileId);
      const diffs = diffKeys(saved.spec, res.suggested);
      setAnalysis({ ...res, fileId });
      setAccepted(diffs.reduce<Partial<Record<DiffKey, boolean>>>((acc, k) => ({ ...acc, [k]: true }), {}));
      await saveEst(saved, {
        photo: { fileName: pendingFile.name, status: 'done', suggested: res.suggested },
        sourceFileIds: [...(saved.sourceFileIds ?? []), fileId],
      });
      toast(t('Analyse terminée — vérifiez les valeurs suggérées', 'Analysis done — check the suggested values'));
    } catch (e) {
      setAnalysisError(errText(e));
      toast(t('Analyse impossible — la saisie manuelle reste possible', 'Analysis failed — manual entry is still possible'), 'err');
    } finally {
      setAnalyzing(false);
    }
  };

  const applySuggestions = () => {
    if (!analysis) return;
    const patch: Partial<PackagingSpec> = {};
    for (const k of diffKeys(est.spec, analysis.suggested)) {
      if (accepted[k]) Object.assign(patch, { [k]: analysis.suggested[k] });
    }
    if (!Object.keys(patch).length) return;
    setSpec(patch);
    setAnalysis(null);
    toast(t('Valeurs appliquées — enregistrez l’estimation', 'Values applied — save the estimate'));
  };

  const showVal = (k: DiffKey, v: unknown): string => {
    if (v === undefined || v === null || v === '') return '—';
    switch (k) {
      case 'type':
        return t(PACKAGING_TYPES.find((p) => p.key === v)?.label ?? { fr: String(v), en: String(v) });
      case 'materialId': {
        const m = mats.find((x) => x.id === v);
        return m ? `${m.name} ${m.caliper}` : String(v);
      }
      case 'printProcess':
        return t(PRINT_PROCESSES.find((p) => p.key === v)?.label ?? { fr: String(v), en: String(v) });
      case 'finishes':
        return (v as string[]).map((f) => t(FINISHES.find((x) => x.key === f)?.label ?? { fr: f, en: f })).join(', ') || '—';
      case 'options':
        return (v as string[]).map((o) => t(OPTIONS.find((x) => x.key === o)?.label ?? { fr: o, en: o })).join(', ') || '—';
      case 'newDie':
        return v ? t('Oui', 'Yes') : t('Non', 'No');
      default:
        return String(v);
    }
  };

  const typeMats = mats.filter((m) => MATERIAL_FOR[est.spec.type].includes(m.category));
  const material = mats.find((m) => m.id === est.spec.materialId);
  const styleLabel = STYLES[est.spec.type].find((s) => s.code === est.spec.style)?.label;
  const diffs = analysis ? diffKeys(est.spec, analysis.suggested) : [];
  const isCopacking = est.spec.type === 'copacking';

  const headerActions = (
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
        <button className="btn" disabled={busy} onClick={() => persist().then(() => toast(t('Estimation enregistrée', 'Estimate saved')))}>
          <Save size={16} /> {t('Enregistrer', 'Save')}
        </button>
      )}
      {est.status === 'draft' && editable && (
        <button className="btn btn-primary" disabled={busy} onClick={() => transition('costing', null, t('Chiffrage commencé', 'Costing started'))}>
          <Calculator size={16} /> {t('Commencer le chiffrage', 'Start costing')}
        </button>
      )}
      {est.status === 'costing' && editable && (
        <button className="btn btn-primary" disabled={busy} onClick={() => transition('review', 'review', t('Estimation prête pour révision', 'Estimate ready for review'))}>
          <Send size={16} /> {t('Marquer prêt pour révision', 'Mark ready for review')}
        </button>
      )}
      {est.status === 'review' && canApprove && (
        <>
          <button className="btn" disabled={busy} onClick={() => setNoteOpen(true)}>
            <RotateCcw size={16} /> {t('Renvoyer en révision (note requise)', 'Send back to revision (note required)')}
          </button>
          <button className="btn btn-primary btn-lg-prominent" disabled={busy} onClick={() => transition('approved', 'quote_ready', t('Approuvée — renvoyée aux ventes', 'Approved — back to sales'))}>
            <Check size={16} /> {t('Approuver et renvoyer aux ventes', 'Approve and return to sales')}
          </button>
        </>
      )}
      {est.status === 'approved' && canApprove && !est.requestId && (
        <button className="btn btn-primary" disabled={busy} onClick={() => transition('sent', null, t('Soumission envoyée au client', 'Quote sent to customer'))}>
          <Send size={16} /> {t('Marquer soumise au client', 'Mark sent to customer')}
        </button>
      )}
      {est.status === 'sent' && canApprove && (
        <>
          <button className="btn" disabled={busy} onClick={() => transition('lost', null, t('Estimation refusée', 'Estimate lost'))}>
            <XCircle size={16} /> {t('Refusée', 'Lost')}
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => transition('won', null, t('Acceptée — imago atteint', 'Won — imago reached'))}>
            <Trophy size={16} /> {t('Acceptée', 'Won')}
          </button>
        </>
      )}
      {(est.status === 'sent' || est.status === 'lost') && canApprove && (
        <button className="btn btn-ghost" disabled={busy} onClick={() => transition('costing', null, t('Estimation réouverte', 'Estimate reopened'))}>
          <RotateCcw size={16} /> {t('Réviser', 'Revise')}
        </button>
      )}
      {est.requestId && can('estimating.edit') && (
        <button className="btn" disabled={busy} onClick={() => setStudioOpen(true)}>
          <Palette size={16} /> {t('Demander le studio', 'Ask the studio')}
        </button>
      )}
    </div>
  );

  const specsTab = (
    <>
      {est.assumptions && est.assumptions.length > 0 && (
        <section className="card card-pad est-assumptions" aria-label={t('Hypothèses', 'Assumptions')}>
          <h3 className="row" style={{ gap: 8, fontSize: 15 }}>
            <AlertTriangle size={16} /> {t('Hypothèses de l’estimation automatique — à vérifier', 'Assumptions of the automatic estimate — to verify')}
          </h3>
          <ul className="small">
            {est.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}
      {(est.requestId || (est.sourceFileIds?.length ?? 0) > 0) && (
        <section className="card card-pad est-links">
          {est.requestId && (
            <div className="row row-wrap" style={{ justifyContent: 'space-between', marginBottom: est.sourceFileIds?.length ? 12 : 0 }}>
              <span className="small muted">{t('Demande de vente d’origine', 'Originating sales request')} <span className="mono">{est.requestId}</span></span>
              <Link className="btn btn-sm" to={`/sales?r=${encodeURIComponent(est.requestId)}`}>
                <ExternalLink size={14} /> {t('Ouvrir la demande', 'Open request')}
              </Link>
            </div>
          )}
          <SourceFiles ids={est.sourceFileIds ?? []} title={t('Fichiers de la demande', 'Request files')} />
        </section>
      )}

      <fieldset disabled={!editable} className="stack est-fieldset">
        {/* Customer & project */}
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

        {/* Photo analysis */}
        <Section
          id="photo"
          title={t('Photo de la boîte', 'Box photo')}
          icon={<Camera size={16} />}
          badge={
            est.photo?.status === 'done' ? (
              <span className="badge badge-ok"><Sparkles size={12} /> {t('Analysée', 'Analysed')}</span>
            ) : (
              <span className="badge badge-accent"><Sparkles size={12} /> {t('Analyse IA', 'AI analysis')}</span>
            )
          }
        >
          <div className="photo-grid">
            <div
              className={`dropzone ${photoUrl ? 'has-photo' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onPhoto(e.dataTransfer.files[0]); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
            >
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
              {photoUrl ? (
                <>
                  <img src={photoUrl} alt="" />
                  <button
                    className="btn btn-sm dropzone-clear"
                    type="button"
                    aria-label={t('Retirer la photo', 'Remove photo')}
                    onClick={(e) => { e.stopPropagation(); setPhotoUrl(null); setPendingFile(null); setAnalysis(null); set({ photo: undefined }); }}
                  >
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
                <Sparkles size={15} /> {t('Ce que l’analyse peut remplir', 'What the analysis can fill in')}
              </div>
              <ul>
                <li>{t('Type et style de boîte (ECMA / FEFCO)', 'Box type and style (ECMA / FEFCO)')}</li>
                <li>{t('Dimensions estimées', 'Estimated dimensions')}</li>
                <li>{t('Matériau et épaisseur probables', 'Likely material and caliper')}</li>
                <li>{t('Nombre de couleurs et procédé', 'Colour count and process')}</li>
                <li>{t('Finitions détectées (dorure, UV, laminage…)', 'Detected finishes (foil, UV, lamination…)')}</li>
                <li>{t('Options : fenêtre, insert, poignée…', 'Options: window, insert, handle…')}</li>
              </ul>
              <button
                className="btn btn-sm"
                type="button"
                disabled={!pendingFile || !API_MODE || analyzing || !editable}
                title={API_MODE ? undefined : t('Disponible avec le serveur Imago — saisie manuelle en mode démo', 'Available with the Imago server — manual entry in demo mode')}
                onClick={runAnalysis}
              >
                <Sparkles size={14} /> {analyzing ? t('Analyse en cours…', 'Analysing…') : t('Analyser la photo', 'Analyse photo')}
              </button>
              {!API_MODE && <div className="faint small">{t('Mode démo : saisie manuelle uniquement.', 'Demo mode: manual entry only.')}</div>}
              {analysisError && (
                <div className="photo-error small" role="alert">
                  <AlertTriangle size={14} /> {t('L’analyse a échoué. Vous pouvez saisir les valeurs manuellement.', 'The analysis failed. You can enter the values manually.')}
                  <div className="faint mono">{analysisError}</div>
                </div>
              )}
            </div>
          </div>

          {analysis && (
            <div className="photo-result">
              {analysis.summary && <p className="small" style={{ marginTop: 16 }}>{analysis.summary}</p>}
              {analysis.assumptions.length > 0 && (
                <ul className="small">
                  {analysis.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
              {diffs.length > 0 ? (
                <>
                  <div className="table-wrap">
                    <table className="table photo-diff">
                      <thead>
                        <tr>
                          <th aria-label={t('Accepter', 'Accept')}></th>
                          <th>{t('Champ', 'Field')}</th>
                          <th>{t('Actuel', 'Current')}</th>
                          <th>{t('Suggéré', 'Suggested')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffs.map((k) => (
                          <tr key={k}>
                            <td>
                              <input
                                type="checkbox"
                                checked={!!accepted[k]}
                                aria-label={t(DIFF_LABEL[k])}
                                onChange={(e) => setAccepted({ ...accepted, [k]: e.target.checked })}
                              />
                            </td>
                            <td>{t(DIFF_LABEL[k])}</td>
                            <td className="muted">{showVal(k, est.spec[k])}</td>
                            <td>{showVal(k, analysis.suggested[k])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="row row-wrap" style={{ marginTop: 12, gap: 8 }}>
                    <button className="btn btn-primary btn-sm" type="button" disabled={!diffs.some((k) => accepted[k])} onClick={applySuggestions}>
                      <Check size={14} /> {t('Appliquer les valeurs suggérées', 'Apply suggested values')}
                    </button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setAnalysis(null)}>
                      {t('Ignorer', 'Dismiss')}
                    </button>
                  </div>
                </>
              ) : (
                <p className="small faint">{t('Aucune différence avec les valeurs actuelles.', 'No difference from the current values.')}</p>
              )}
            </div>
          )}
        </Section>

        {/* Packaging spec */}
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

        {/* Print & finish */}
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

        {/* Internal notes */}
        <Section id="notes" title={t('Notes internes', 'Internal notes')} icon={<StickyNote size={16} />}>
          <textarea className="textarea" style={{ minHeight: 110 }} value={est.internalNotes} onChange={(e) => set({ internalNotes: e.target.value })} placeholder={t('Visible uniquement à l’interne', 'Internal only')} />
        </Section>
      </fieldset>
    </>
  );

  const blueprintTab = (
    <>
      <div className="bp-grid">
        <Section
          id="plan"
          title={t('Plan de découpe', 'Cutting plan')}
          icon={<Ruler size={16} />}
          badge={<span className="badge">{t(FAMILY_LABEL[styleFamily(est.spec.style)])}</span>}
        >
          <Dieline spec={est.spec} showDims />
        </Section>
        <Section id="views" title={t('Aperçu 3D et vues', '3D preview and views')} icon={<Package size={16} />}>
          {isCopacking ? (
            <div className="faint small">{t('Service de co-packing : pas de boîte à représenter.', 'Co-packing service: no box to draw.')}</div>
          ) : (
            <>
              <div className="est-box bp-iso">
                <BoxPreview l={est.spec.lengthMm} w={est.spec.widthMm} h={est.spec.heightMm} size={260} />
              </div>
              <BoxViews spec={est.spec} />
            </>
          )}
        </Section>
      </div>

      <Section id="studio" title={t('Gabarits et croquis du studio', 'Studio dielines and sketches')} icon={<Palette size={16} />}>
        {(est.dielineFileIds?.length ?? 0) > 0 ? (
          <SourceFiles ids={est.dielineFileIds ?? []} title={t('Fichiers du studio', 'Studio files')} />
        ) : (
          <p className="small faint">{t('Aucun gabarit du studio pour le moment.', 'No studio dieline yet.')}</p>
        )}
        <fieldset disabled={!editable} className="stack est-fieldset" style={{ marginTop: 16 }}>
          <Field label={t('Notes du studio', 'Studio notes')}>
            <textarea className="textarea" value={est.studioNotes ?? ''} onChange={(e) => set({ studioNotes: e.target.value })} placeholder={t('Consignes, retours du studio, choix de fibre…', 'Instructions, studio feedback, board choice…')} />
          </Field>
        </fieldset>
      </Section>
    </>
  );

  const pricingTab = (
    <fieldset disabled={!editable} className="stack est-fieldset">
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
                <button type="button" onClick={() => set({ quantities: est.quantities.filter((_, j) => j !== i) })} aria-label={t('Retirer', 'Remove')}>
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
              <input className="input input-sm num" style={{ width: 100 }} type="number" min={1} placeholder={t('Qté', 'Qty')} value={newQty} onChange={(e) => setNewQty(e.target.value)} />
              <button className="btn btn-sm" type="submit" aria-label={t('Ajouter', 'Add')}>
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
                    <td className="muted">{t(COST_LABEL[k])}</td>
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
    </fieldset>
  );

  const reportTab = (
    <>
      {seeCosts && <ValidationBanner />}
      <PriceReport estimate={est} material={material} settings={settings} canSeeCosts={seeCosts} />
    </>
  );

  const historyTab = (
    <Section id="history" title={t('Historique', 'History')} icon={<HistoryIcon size={16} />}>
      {est.requestId && (
        <p className="small" style={{ marginTop: 0 }}>
          <Link to={`/sales?r=${encodeURIComponent(est.requestId)}`}>{t('Voir l’historique de la demande de vente', 'See the sales request history')}</Link>
        </p>
      )}
      {est.history.length ? (
        <ol className="timeline" style={{ padding: 0 }}>
          {[...est.history].reverse().map((h, i) => (
            <li key={i}>
              <div className="tl-dot" />
              <div className="small">
                <strong>
                  {h.action === 'created'
                    ? t('Créée', 'Created')
                    : (EST_STATUS as Record<string, [L, string] | undefined>)[h.action]
                      ? t((EST_STATUS as Record<string, [L, string]>)[h.action][0])
                      : h.action}
                </strong>{' '}
                <span className="faint">· {fmtDate(h.at, true)} · {userName(h.userId)}</span>
                {h.note && <div className="muted">{h.note}</div>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="faint small">{t('Aucun événement pour le moment.', 'No events yet.')}</p>
      )}
    </Section>
  );

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
          <div className="row row-wrap" style={{ marginTop: 8 }}>
            <EstStatusBadge status={est.status} />
            <AutoBadge show={est.autoGenerated} />
            {dirty && <span className="badge badge-warn">{t('Non enregistrée', 'Unsaved')}</span>}
            {est.requestId && !API_MODE && (
              <span className="faint small">
                {t('Mode démo : demande de vente simulée dans ce navigateur (sans courriel ni IA)', 'Demo mode: sales request simulated in this browser (no e-mail, no AI)')}
              </span>
            )}
          </div>
        </div>
        {headerActions}
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <Stages stages={EST_STAGES} current={estStageIndex(est.status)} complete={est.status === 'won'} />
      </div>

      {est.status === 'review' && (
        <div className="est-review-banner small" role="status">
          <strong>{t('Cette estimation attend une révision.', 'This estimate is waiting for review.')}</strong>{' '}
          {est.autoGenerated
            ? t('Elle a été construite automatiquement : vérifiez les hypothèses avant d’approuver.', 'It was built automatically: check the assumptions before approving.')
            : t('Vérifiez le plan, les prix et le rapport avant de renvoyer aux ventes.', 'Check the blueprint, prices and report before returning it to sales.')}
        </div>
      )}

      <div role="tablist" aria-label={t('Sections de l’estimation', 'Estimate sections')} className="tabs est-tabs">
        {TABS.map((tb, i) => {
          const Icon = tb.icon;
          const on = tab === tb.id;
          return (
            <button
              key={tb.id}
              ref={(el) => { tabRefs.current[tb.id] = el; }}
              type="button"
              role="tab"
              id={`est-tab-${tb.id}`}
              aria-selected={on}
              aria-controls={`est-panel-${tb.id}`}
              tabIndex={on ? 0 : -1}
              className={`tab ${on ? 'active' : ''}`}
              onClick={() => setTab(tb.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <Icon size={15} /> {t(tb.label)}
            </button>
          );
        })}
      </div>

      <div className="est-layout">
        <div className="stack est-main" role="tabpanel" id={`est-panel-${tab}`} aria-labelledby={`est-tab-${tab}`} tabIndex={0}>
          {tab === 'specs' && specsTab}
          {tab === 'blueprint' && blueprintTab}
          {tab === 'pricing' && pricingTab}
          {tab === 'report' && reportTab}
          {tab === 'history' && historyTab}
        </div>

        {/* Sticky summary */}
        <aside className="est-summary">
          <div className="card">
            <div className="card-head">
              <h3>{t('Résumé', 'Summary')}</h3>
              <EstStatusBadge status={est.status} />
            </div>
            <div className="est-box">
              {isCopacking ? (
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

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={t('Renvoyer en révision', 'Send back to revision')}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setNoteOpen(false)}>{t('Annuler', 'Cancel')}</button>
            <button className="btn btn-primary" disabled={!note.trim() || busy} onClick={confirmReturn}>{t('Renvoyer', 'Send back')}</button>
          </>
        }
      >
        <p className="small muted" style={{ marginTop: 0 }}>
          {t('Expliquez ce qui doit être revu. La note reste dans l’historique.', 'Explain what must be reviewed. The note stays in the history.')}
        </p>
        <textarea
          className="textarea"
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label={t('Note de révision', 'Review note')}
          placeholder={t('Ex. : vérifier la charge du carton, confirmer les dimensions…', 'E.g. check board strength, confirm dimensions…')}
        />
      </Modal>

      <Modal
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
        title={t('Demander le studio', 'Ask the studio')}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setStudioOpen(false)}>{t('Annuler', 'Cancel')}</button>
            <button className="btn btn-primary" disabled={!studioBrief.trim() || busy} onClick={requestStudio}>{t('Envoyer la demande', 'Send request')}</button>
          </>
        }
      >
        <p className="small muted" style={{ marginTop: 0 }}>
          {t('Décrivez ce que le studio doit préparer : croquis, gabarit, fichier d’art.', 'Describe what the studio should prepare: sketch, dieline, artwork file.')}
        </p>
        <textarea
          className="textarea"
          autoFocus
          value={studioBrief}
          onChange={(e) => setStudioBrief(e.target.value)}
          aria-label={t('Demande au studio', 'Studio brief')}
        />
      </Modal>
    </Page>
  );
}

function SourceFiles({ ids, title }: { ids: string[]; title: string }) {
  if (!ids.length) return null;
  return (
    <div className="est-sources">
      {title && <div className="label" style={{ marginBottom: 8 }}>{title}</div>}
      <div className="src-grid">
        {ids.map((id) => (
          <SourceTile key={id} id={id} />
        ))}
      </div>
    </div>
  );
}

/** Images show as thumbnails; anything that does not render (PDFs, other documents) becomes a link. */
function SourceTile({ id }: { id: string }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const href = fileUrl(id);
  if (failed) {
    return (
      <a className="src-tile src-link" href={href} target="_blank" rel="noreferrer">
        <FileText size={22} />
        <span className="small">{t('Ouvrir le fichier', 'Open file')}</span>
      </a>
    );
  }
  return (
    <a className="src-tile" href={href} target="_blank" rel="noreferrer" aria-label={t('Ouvrir le fichier', 'Open file')}>
      <img src={href} alt="" loading="lazy" onError={() => setFailed(true)} />
    </a>
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
