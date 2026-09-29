import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Printer, Truck, Ban, Plus, Trash2, Copy, CheckCircle2, BookUser } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, Modal, useToast } from '@/components/ui';
import { Stages } from '@/components/Stages';
import { addressBook, labels, nextLabelNo, shipFroms } from '../stores';
import { CARRIERS, type Address, type ShippingLabel } from '../types';
import { Label4x6 } from '../LabelPreview';
import { LABEL_STAGES, LabelStatusBadge, labelStageIndex } from './LabelList';

const emptyAddress: Address = { name: '', attention: '', street: '', street2: '', city: '', province: 'QC', postalCode: '', country: 'CA', phone: '' };

function blank(userId: string, shipFromId: string): ShippingLabel {
  return {
    id: uid('lb_'),
    no: '',
    status: 'draft',
    shipFromId,
    shipTo: { ...emptyAddress },
    carrier: 'Purolator',
    service: 'Ground',
    jobNo: '',
    customerPo: '',
    packages: [{ id: uid('p_'), weightKg: 1, lengthCm: 30, widthCm: 30, heightCm: 30 }],
    instructions: '',
    createdAt: new Date().toISOString(),
    createdBy: userId,
  };
}

/** Remount the editor per label id so state never leaks between labels. */
export function LabelEditorRoute() {
  const { id } = useParams();
  const { key } = useLocation();
  return <LabelEditor key={id === 'new' ? key : id} />;
}

function LabelEditor() {
  const { id } = useParams();
  const location = useLocation();
  const isNew = id === 'new';
  const nav = useNavigate();
  const { t } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const { rows: froms } = useCollection(shipFroms);
  const { rows: book } = useCollection(addressBook);
  const [label, setLabel] = useState<ShippingLabel | null>(null);
  const [dirty, setDirty] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [tracking, setTracking] = useState('');

  useEffect(() => {
    if (isNew) {
      const copy = (location.state as { copy?: ShippingLabel } | null)?.copy;
      if (copy) {
        setLabel((l) => l ?? copy);
        setDirty(true);
      } else if (froms.length && user) setLabel((l) => l ?? blank(user.id, (froms.find((f) => f.isDefault) ?? froms[0]).id));
    } else if (id) {
      labels.get(id).then((l) => setLabel(l ?? null));
    }
  }, [id, isNew, froms, user, location.state]);

  if (!label) return null;

  const from = froms.find((f) => f.id === label.shipFromId);
  const editable = (label.status === 'draft' || label.status === 'ready') && can('shipping.labels.create');
  const set = (patch: Partial<ShippingLabel>) => {
    setLabel({ ...label, ...patch });
    setDirty(true);
  };
  const setTo = (patch: Partial<Address>) => set({ shipTo: { ...label.shipTo, ...patch } });
  const setPkg = (pid: string, patch: Partial<ShippingLabel['packages'][number]>) =>
    set({ packages: label.packages.map((p) => (p.id === pid ? { ...p, ...patch } : p)) });

  const missing = [
    !label.shipTo.name && t('nom du destinataire', 'recipient name'),
    !label.shipTo.street && t('adresse', 'street'),
    !label.shipTo.city && t('ville', 'city'),
    !label.shipTo.postalCode && t('code postal', 'postal code'),
    !label.jobNo && t('no de job', 'job no.'),
    !label.packages.length && t('au moins un colis', 'at least one package'),
  ].filter(Boolean) as string[];

  const persist = async (patch: Partial<ShippingLabel> = {}) => {
    const next = { ...label, ...patch };
    const exists = await labels.get(next.id);
    if (!exists) {
      next.no = await nextLabelNo();
      await labels.insert(next);
      await logAudit(user!.id, 'shipping.label.create', next.no);
    } else {
      await labels.update(next.id, next);
    }
    setLabel(next);
    setDirty(false);
    if (isNew) nav(`/shipping/${next.id}`, { replace: true });
    return next;
  };

  const markReady = async () => {
    if (missing.length) return toast(t('Champs manquants : ', 'Missing: ') + missing.join(', '), 'err');
    await persist({ status: 'ready' });
    toast(t('Étiquette prête à imprimer', 'Label ready to print'));
  };

  const print = async () => {
    if (missing.length) return toast(t('Champs manquants : ', 'Missing: ') + missing.join(', '), 'err');
    const saved = await persist();
    setPrinting(true);
    // Let the portal render, then open the print dialog.
    setTimeout(async () => {
      window.print();
      setPrinting(false);
      await persist({
        status: saved.status === 'shipped' ? 'shipped' : 'printed',
        printedAt: new Date().toISOString(),
        printCount: (saved.printCount ?? 0) + 1,
      });
      await logAudit(user!.id, 'shipping.label.print', saved.no);
    }, 150);
  };

  const ship = async () => {
    await persist({ status: 'shipped', trackingNo: tracking.trim() || undefined, shippedAt: new Date().toISOString() });
    await logAudit(user!.id, 'shipping.label.ship', label.no);
    setShipOpen(false);
    toast(t('Expédiée — imago atteint', 'Shipped — imago reached'));
  };

  const duplicate = () => {
    const copy = { ...structuredClone(label), id: uid('lb_'), no: '', status: 'draft' as const, trackingNo: undefined, printedAt: undefined, printCount: 0, shippedAt: undefined, createdAt: new Date().toISOString(), createdBy: user!.id };
    nav('/shipping/new', { state: { copy } });
  };

  return (
    <Page wide>
      <Link to="/shipping" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, marginLeft: -10 }}>
        <ArrowLeft size={16} /> {t('Étiquettes', 'Labels')}
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('Étiquette d’expédition', 'Shipping label')}</div>
          <h1 className="mono">{label.no || t('Nouvelle', 'New')}</h1>
          <div className="row" style={{ marginTop: 8 }}>
            <LabelStatusBadge status={label.status} />
            {label.trackingNo && <span className="badge mono">{label.trackingNo}</span>}
            {dirty && <span className="badge badge-warn">{t('Non enregistrée', 'Unsaved')}</span>}
          </div>
        </div>
        <div className="row row-wrap">
          {label.no && (
            <Can permission="shipping.labels.create">
              <button className="btn" onClick={duplicate}>
                <Copy size={16} /> {t('Dupliquer', 'Duplicate')}
              </button>
            </Can>
          )}
          {editable && (
            <button className="btn" onClick={() => persist().then(() => toast(t('Enregistrée', 'Saved')))}>
              <Save size={16} /> {t('Enregistrer', 'Save')}
            </button>
          )}
          {label.status === 'draft' && editable && (
            <button className="btn" onClick={markReady}>
              <CheckCircle2 size={16} /> {t('Marquer prête', 'Mark ready')}
            </button>
          )}
          {label.status !== 'void' && label.no && (
            <Can permission="shipping.labels.print">
              <button className="btn btn-primary" onClick={print}>
                <Printer size={16} /> {label.printCount ? t('Réimprimer', 'Reprint') : t('Imprimer', 'Print')} ({label.packages.length})
              </button>
            </Can>
          )}
          {label.status === 'printed' && (
            <Can permission="shipping.labels.print">
              <button className="btn" onClick={() => { setTracking(label.trackingNo ?? ''); setShipOpen(true); }}>
                <Truck size={16} /> {t('Expédiée', 'Shipped')}
              </button>
            </Can>
          )}
          {label.no && label.status !== 'void' && label.status !== 'shipped' && (
            <Can permission="shipping.labels.void">
              <button className="btn btn-danger" onClick={() => persist({ status: 'void' }).then(() => toast(t('Étiquette annulée', 'Label voided')))}>
                <Ban size={16} /> {t('Annuler', 'Void')}
              </button>
            </Can>
          )}
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <Stages stages={LABEL_STAGES} current={labelStageIndex(label.status)} complete={label.status === 'shipped'} />
      </div>

      <div className="ship-editor">
        <fieldset disabled={!editable} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }} className="stack">
          <div className="card">
            <div className="card-head">
              <h3>{t('Destinataire', 'Ship to')}</h3>
              <div className="row">
                <BookUser size={16} className="faint" />
                <select
                  className="select input-sm"
                  style={{ width: 240 }}
                  value=""
                  onChange={(e) => {
                    const a = book.find((b) => b.id === e.target.value);
                    if (a) {
                      const { id: _id, code: _code, ...addr } = a;
                      setTo(addr);
                    }
                  }}
                >
                  <option value="">{t('Carnet d’adresses…', 'Address book…')}</option>
                  {book.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="card-pad form-grid">
              <label className="field span-2">
                <span>{t('Nom / entreprise', 'Name / company')} *</span>
                <input className="input" value={label.shipTo.name} onChange={(e) => setTo({ name: e.target.value })} />
              </label>
              <label className="field">
                <span>{t('À l’attention de', 'Attention')}</span>
                <input className="input" value={label.shipTo.attention ?? ''} onChange={(e) => setTo({ attention: e.target.value })} />
              </label>
              <label className="field">
                <span>{t('Téléphone', 'Phone')}</span>
                <input className="input" value={label.shipTo.phone ?? ''} onChange={(e) => setTo({ phone: e.target.value })} />
              </label>
              <label className="field span-2">
                <span>{t('Adresse', 'Street')} *</span>
                <input className="input" value={label.shipTo.street} onChange={(e) => setTo({ street: e.target.value })} />
              </label>
              <label className="field span-2">
                <span>{t('Adresse (ligne 2)', 'Street (line 2)')}</span>
                <input className="input" value={label.shipTo.street2 ?? ''} onChange={(e) => setTo({ street2: e.target.value })} />
              </label>
              <label className="field">
                <span>{t('Ville', 'City')} *</span>
                <input className="input" value={label.shipTo.city} onChange={(e) => setTo({ city: e.target.value })} />
              </label>
              <label className="field">
                <span>{t('Province / État', 'Province / State')}</span>
                <input className="input" value={label.shipTo.province} onChange={(e) => setTo({ province: e.target.value.toUpperCase() })} />
              </label>
              <label className="field">
                <span>{t('Code postal', 'Postal code')} *</span>
                <input className="input" value={label.shipTo.postalCode} onChange={(e) => setTo({ postalCode: e.target.value.toUpperCase() })} />
              </label>
              <label className="field">
                <span>{t('Pays', 'Country')}</span>
                <select className="select" value={label.shipTo.country} onChange={(e) => setTo({ country: e.target.value })}>
                  <option value="CA">Canada</option>
                  <option value="US">États-Unis / USA</option>
                  <option value="MX">Mexique / Mexico</option>
                </select>
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>{t('Expédition', 'Shipment')}</h3>
            </div>
            <div className="card-pad form-grid">
              <label className="field">
                <span>{t('Expéditeur', 'Ship from')}</span>
                <select className="select" value={label.shipFromId} onChange={(e) => set({ shipFromId: e.target.value })}>
                  {froms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t('Transporteur', 'Carrier')}</span>
                <select className="select" value={label.carrier} onChange={(e) => set({ carrier: e.target.value, service: CARRIERS[e.target.value][0] })}>
                  {Object.keys(CARRIERS).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Service</span>
                <select className="select" value={label.service} onChange={(e) => set({ service: e.target.value })}>
                  {(CARRIERS[label.carrier] ?? []).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t('No de job', 'Job no.')} *</span>
                <input className="input mono" value={label.jobNo} onChange={(e) => set({ jobNo: e.target.value.toUpperCase() })} placeholder="J-24-0000" />
              </label>
              <label className="field">
                <span>{t('PO client', 'Customer PO')}</span>
                <input className="input mono" value={label.customerPo} onChange={(e) => set({ customerPo: e.target.value })} />
              </label>
              <label className="field span-2">
                <span>{t('Instructions spéciales', 'Special instructions')}</span>
                <input className="input" value={label.instructions} onChange={(e) => set({ instructions: e.target.value })} placeholder={t('Fragile, ne pas empiler…', 'Fragile, do not stack…')} />
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>
                {t('Colis', 'Packages')} ({label.packages.length})
              </h3>
              <button className="btn btn-sm" onClick={() => set({ packages: [...label.packages, { ...label.packages[label.packages.length - 1] ?? { weightKg: 1, lengthCm: 30, widthCm: 30, heightCm: 30 }, id: uid('p_') }] })}>
                <Plus size={14} /> {t('Colis', 'Package')}
              </button>
            </div>
            <div className="table-wrap">
              <table className="table pkg-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('Poids (kg)', 'Weight (kg)')}</th>
                    <th>L (cm)</th>
                    <th>l (cm)</th>
                    <th>H (cm)</th>
                    <th>{t('Contenu', 'Contents')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {label.packages.map((p, i) => (
                    <tr key={p.id}>
                      <td className="faint">{i + 1}</td>
                      {(['weightKg', 'lengthCm', 'widthCm', 'heightCm'] as const).map((k) => (
                        <td key={k}>
                          <input className="input input-sm num" type="number" step={k === 'weightKg' ? 0.1 : 1} min={0} value={p[k]} onChange={(e) => setPkg(p.id, { [k]: +e.target.value })} />
                        </td>
                      ))}
                      <td>
                        <input className="input input-sm" value={p.description ?? ''} onChange={(e) => setPkg(p.id, { description: e.target.value })} />
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm" disabled={label.packages.length === 1} onClick={() => set({ packages: label.packages.filter((x) => x.id !== p.id) })}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </fieldset>

        <div className="ship-preview">
          <div className="row" style={{ marginBottom: 10 }}>
            <strong>{t('Aperçu 4 × 6 po', '4 × 6 in preview')}</strong>
            <span className="spacer" />
            <span className="faint small">{t('Colis 1 de', 'Package 1 of')} {label.packages.length}</span>
          </div>
          <div className="ship-preview-stage">
            <Label4x6 label={{ ...label, no: label.no || 'SHP-XXXXXX' }} from={from} index={0} />
          </div>
        </div>
      </div>

      {printing &&
        createPortal(
          <div className="print-area">
            {label.packages.map((p, i) => (
              <Label4x6 key={p.id} label={label} from={from} index={i} />
            ))}
          </div>,
          document.body,
        )}

      <Modal
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        title={t('Confirmer l’expédition', 'Confirm shipment')}
        footer={
          <>
            <button className="btn" onClick={() => setShipOpen(false)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" onClick={ship}>
              <Truck size={16} /> {t('Confirmer', 'Confirm')}
            </button>
          </>
        }
      >
        <label className="field">
          <span>{t('No de suivi (facultatif)', 'Tracking no. (optional)')}</span>
          <input className="input mono" value={tracking} onChange={(e) => setTracking(e.target.value)} autoFocus />
        </label>
      </Modal>
    </Page>
  );
}
