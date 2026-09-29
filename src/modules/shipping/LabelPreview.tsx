import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Butterfly } from '@/components/Butterfly';
import type { Address, ShipFrom, ShippingLabel } from './types';

function Barcode({ value, height = 60 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, { format: 'CODE128', height, width: 2, displayValue: true, fontSize: 14, margin: 0, font: 'monospace' });
    } catch {
      /* invalid chars while typing */
    }
  }, [value, height]);
  return <svg ref={ref} className="barcode" />;
}

function Addr({ a, big }: { a: Partial<Address>; big?: boolean }) {
  return (
    <div className={big ? 'addr addr-big' : 'addr'}>
      <strong>{a.name || '—'}</strong>
      {a.attention && <div>Attn : {a.attention}</div>}
      <div>{a.street}</div>
      {a.street2 && <div>{a.street2}</div>}
      <div>
        {[a.city, a.province].filter(Boolean).join(' ')} {a.postalCode && <span className="postal">{a.postalCode}</span>}
      </div>
      <div>{a.country}</div>
      {a.phone && <div>Tél. {a.phone}</div>}
    </div>
  );
}

/** One 4×6 in label for package `index` (0-based). */
export function Label4x6({ label, from, index }: { label: ShippingLabel; from?: ShipFrom; index: number }) {
  const pkg = label.packages[index];
  const count = label.packages.length;
  return (
    <div className="label-4x6">
      <div className="lbl-row lbl-from">
        <div>
          <div className="lbl-cap">DE / FROM</div>
          {from ? <Addr a={from} /> : <em>—</em>}
        </div>
        <Butterfly size={34} color="#000" />
      </div>
      <div className="lbl-row lbl-to">
        <div className="lbl-cap">À / SHIP TO</div>
        <Addr a={label.shipTo} big />
      </div>
      <div className="lbl-row lbl-grid">
        <div>
          <div className="lbl-cap">TRANSPORTEUR</div>
          <strong>{label.carrier || '—'}</strong>
          <div>{label.service}</div>
        </div>
        <div>
          <div className="lbl-cap">COLIS / PKG</div>
          <strong className="lbl-big">
            {index + 1} / {count}
          </strong>
        </div>
        <div>
          <div className="lbl-cap">POIDS</div>
          <strong>{pkg ? `${pkg.weightKg} kg` : '—'}</strong>
          {pkg && (
            <div>
              {pkg.lengthCm}×{pkg.widthCm}×{pkg.heightCm} cm
            </div>
          )}
        </div>
      </div>
      <div className="lbl-row lbl-grid lbl-refs">
        <div>
          <div className="lbl-cap">JOB</div>
          <strong>{label.jobNo || '—'}</strong>
        </div>
        <div>
          <div className="lbl-cap">PO CLIENT</div>
          <strong>{label.customerPo || '—'}</strong>
        </div>
      </div>
      {label.instructions && <div className="lbl-row lbl-instr">{label.instructions}</div>}
      <div className="lbl-row lbl-barcode">
        <Barcode value={`${label.no}-${String(index + 1).padStart(2, '0')}`} />
      </div>
      {pkg?.description && <div className="lbl-desc">{pkg.description}</div>}
    </div>
  );
}
