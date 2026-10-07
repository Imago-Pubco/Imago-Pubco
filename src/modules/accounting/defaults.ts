import type { AccountingSettings } from './types';

export const DEFAULT_SETTINGS: AccountingSettings = {
  id: 'settings',
  mode: 'assisted',
  autoMaxAmount: 0,
  mailbox: 'factures@pubco.ca',
  qtyTolerance: 0,
  priceTolerancePct: 2,
  totalTolerance: 1,
  requireApprovalAbove: 0,
};
