import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { DEFAULT_CURRENCY, applyCurrency, applyScheme, type SchemeName, type ThemePref } from './theme';
import { refreshStyles } from './components/ui';
import { getSetting, getThemePref, saveThemePref, setSetting } from './db/repo';

type Ctx = {
  pref: ThemePref;
  scheme: SchemeName;
  setPref: (p: ThemePref) => void;
  currencyCode: string;
  setCurrencyCode: (code: string) => void;
};

const ThemeCtx = createContext<Ctx>({
  pref: 'system',
  scheme: 'light',
  setPref: () => {},
  currencyCode: DEFAULT_CURRENCY,
  setCurrencyCode: () => {},
});

/** Call in any screen or layout that should re-render when the theme changes. */
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [currencyCode, setCurrencyState] = useState(DEFAULT_CURRENCY);

  useEffect(() => {
    getThemePref(db).then(setPrefState);
    getSetting(db, 'currency').then((c) => setCurrencyState(c ?? DEFAULT_CURRENCY));
  }, [db]);

  const scheme: SchemeName = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;

  // Mutate the shared palette and rebuild styles before children render with the new scheme.
  applyScheme(scheme);
  applyCurrency(currencyCode);
  refreshStyles();

  const setPref = useCallback(
    (p: ThemePref) => {
      setPrefState(p);
      saveThemePref(db, p);
    },
    [db]
  );

  const setCurrencyCode = useCallback(
    (code: string) => {
      setCurrencyState(code);
      setSetting(db, 'currency', code);
    },
    [db]
  );

  return (
    <ThemeCtx.Provider value={{ pref, scheme, setPref, currencyCode, setCurrencyCode }}>{children}</ThemeCtx.Provider>
  );
}
