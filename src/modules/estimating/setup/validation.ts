/** Which cost groups are still estimates (not confirmed by the owner). Pure: no React, no browser APIs. */
import { SETTING_GROUPS, resolveSettings } from '../defaults';
import type { EstimatingSettings, ValidationState } from '../types';

export { SETTING_GROUPS };

/** Read a value in a settings object by path (e.g. ['pressRates', 'offset', 'hourlyRate']). */
export function getIn(obj: unknown, path: (string | number)[]): unknown {
  return path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string | number, unknown>)[k] : undefined), obj);
}

/** Immutable write by path: returns a new object, creating missing branches. */
export function setIn(obj: unknown, path: (string | number)[], value: unknown): unknown {
  if (!path.length) return value;
  const [k, ...rest] = path;
  const base = (obj && typeof obj === 'object' ? obj : typeof k === 'number' ? [] : {}) as Record<string | number, unknown>;
  const copy = (Array.isArray(base) ? [...base] : { ...base }) as Record<string | number, unknown>;
  copy[k] = setIn(base[k], rest, value);
  return copy;
}

/** State of every group: a group that was never answered is an 'estimate'. */
export function validationStatus(settings: Partial<EstimatingSettings> | null | undefined): Record<string, ValidationState> {
  const v = resolveSettings(settings).validated ?? {};
  return Object.fromEntries(SETTING_GROUPS.map((g) => [g.id, v[g.id] === 'confirmed' ? 'confirmed' : 'estimate']));
}

/** Ids of the groups that still use provisional values. */
export function provisionalGroups(settings: Partial<EstimatingSettings> | null | undefined): string[] {
  const st = validationStatus(settings);
  return SETTING_GROUPS.filter((g) => st[g.id] !== 'confirmed').map((g) => g.id);
}

/** Same as provisionalGroups, split for display: confirmed ids and ids to validate. */
export function validationSummary(settings: Partial<EstimatingSettings> | null | undefined) {
  const st = validationStatus(settings);
  return {
    confirmed: SETTING_GROUPS.filter((g) => st[g.id] === 'confirmed').map((g) => g.id),
    toValidate: SETTING_GROUPS.filter((g) => st[g.id] !== 'confirmed').map((g) => g.id),
  };
}
