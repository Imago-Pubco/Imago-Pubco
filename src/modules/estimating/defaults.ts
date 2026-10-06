import type { EstimatingSettings } from './types';

export const DEFAULT_EST_SETTINGS: EstimatingSettings = {
  id: 'settings',
  defaultMarginPct: 30,
  wastePct: 12,
  printSetupPerColor: 350,
  printRunPerColorUnit: 0.012,
  dieCost: 450,
  finishSetup: 150,
  finishRunUnit: 0.015,
  laborPerUnit: 0.03,
  freightPct: 3,
};
