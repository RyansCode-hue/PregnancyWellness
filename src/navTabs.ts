import { AppSettings, ToggleableTab } from './types';

// Canonical left-to-right order of every tab button. Used as the single source of truth
// for both rendering (AppHeader) and the slide-animation index (App.tsx). Settings always
// stays at the end and is always visible — disabling it would orphan the user.
export const ALL_TAB_ORDER = [
  'Calendar',
  'Labor',
  'Contractions',
  'Baby',
  'Settings',
] as const;

export type NavbarRoute = (typeof ALL_TAB_ORDER)[number];

/**
 * Filter the canonical order down to the tabs the user has enabled in settings.
 * Settings is always included regardless of `enabledTabs` so the user can always reach it.
 */
export function getEnabledTabs(enabledTabs: AppSettings['enabledTabs']): NavbarRoute[] {
  return ALL_TAB_ORDER.filter(
    (r) => r === 'Settings' || enabledTabs[r as ToggleableTab],
  );
}
