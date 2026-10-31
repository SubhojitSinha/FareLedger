export type SchemeName = 'light' | 'dark';
export type ThemePref = 'system' | SchemeName;

const light = {
  bg: '#F4F6F8',
  card: '#FFFFFF',
  input: '#FFFFFF',
  text: '#1B2430',
  muted: '#6B7684',
  border: '#DDE2E8',
  primary: '#0B6E4F',
  primaryDark: '#095A41',
  danger: '#C0392B',
  warn: '#B9770E',
  soft: '#E6F2EE',
  driver: '#1D4ED8',
  driverText: '#1D4ED8',
  driverSoft: '#DBE6FF',
  conductor: '#C2410C',
  conductorText: '#C2410C',
  conductorSoft: '#FFE3D3',
  expense: '#BE123C',
  tileAlt: '#E9ECEF',
};

const dark: typeof light = {
  bg: '#0F1419',
  card: '#1A2028',
  input: '#222B35',
  text: '#E8ECF1',
  muted: '#9AA5B1',
  border: '#2B3541',
  primary: '#2A9D74',
  primaryDark: '#238262',
  danger: '#FF6B5E',
  warn: '#E0A030',
  soft: '#16332B',
  driver: '#3B6FE0',
  driverText: '#8FB0FF',
  driverSoft: '#1B2A4A',
  conductor: '#D9541A',
  conductorText: '#FFA46B',
  conductorSoft: '#3A2415',
  expense: '#FF6B8A',
  tileAlt: '#222B35',
};

/**
 * Live palette. It is mutated in place when the scheme changes (see ThemeContext),
 * so every `colors.x` read during render picks up the current scheme.
 */
export const colors: typeof light = { ...light };

export const current = { name: 'light' as SchemeName };

export const applyScheme = (name: SchemeName) => {
  current.name = name;
  Object.assign(colors, name === 'dark' ? dark : light);
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = 12;

export const fmt = (n: number) =>
  `₹${(Math.round(n * 100) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
