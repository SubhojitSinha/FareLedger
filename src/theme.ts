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

export type Currency = { code: string; symbol: string; name: string; locale: string };

/** `locale` only controls digit grouping (for example lakh grouping for INR). */
export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'en-US' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-US' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', locale: 'en-IN' },
  { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee', locale: 'en-IN' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', locale: 'en-IN' },
  { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee', locale: 'en-IN' },
  { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', locale: 'en-US' },
  { code: 'SAR', symbol: 'SAR ', name: 'Saudi Riyal', locale: 'en-US' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-US' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-US' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-US' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', locale: 'en-US' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'en-US' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', locale: 'en-US' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'en-US' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'en-US' },
  { code: 'CNY', symbol: 'CN¥', name: 'Chinese Yuan', locale: 'en-US' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-US' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', locale: 'en-US' },
  { code: 'KES', symbol: 'KSh ', name: 'Kenyan Shilling', locale: 'en-US' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'en-US' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', locale: 'en-US' },
];

export const DEFAULT_CURRENCY = 'USD';

/** Live currency, mutated by ThemeContext like `colors`. */
export const currency: Currency = { ...CURRENCIES[0] };

export const applyCurrency = (code: string) => {
  Object.assign(currency, CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]);
};

const digits = (n: number) =>
  Math.abs(Math.round(n * 100) / 100).toLocaleString(currency.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Money with two decimals, sign in front of the symbol: -$5.00 */
export const fmt = (n: number) => `${Math.round(n * 100) < 0 ? '-' : ''}${currency.symbol}${digits(n)}`;

/** A ticket price as entered, with the symbol: $10 */
export const priceLabel = (v: number) => `${currency.symbol}${v}`;

export const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
