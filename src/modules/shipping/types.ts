export interface Address {
  name: string;
  attention?: string;
  street: string;
  street2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface SavedAddress extends Address {
  id: string;
  code: string;
}

export interface ShipFrom extends Address {
  id: string;
  label: string;
  isDefault?: boolean;
}

export interface Package {
  id: string;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  description?: string;
}

export type LabelStatus = 'draft' | 'ready' | 'printed' | 'shipped' | 'void';

export interface ShippingLabel {
  id: string;
  no: string;
  status: LabelStatus;
  shipFromId: string;
  shipTo: Address;
  carrier: string;
  service: string;
  jobNo: string;
  customerPo: string;
  packages: Package[];
  instructions: string;
  trackingNo?: string;
  createdAt: string;
  createdBy: string;
  printedAt?: string;
  printCount?: number;
  shippedAt?: string;
}

export const CARRIERS: Record<string, string[]> = {
  Purolator: ['Ground', 'Express', 'Express 9AM'],
  UPS: ['Standard', 'Express Saver', 'Express'],
  FedEx: ['Ground', 'Priority Overnight', 'Economy'],
  Canpar: ['Ground', 'Select'],
  'Postes Canada': ['Colis accélérés', 'Xpresspost', 'Priorité'],
  'Transport Pubco': ['Livraison locale'],
  'Ramassage client': ['Cueillette à l’usine'],
};
