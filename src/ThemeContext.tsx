import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { applyScheme, type SchemeName, type ThemePref } from './theme';
import { refreshStyles } from './components/ui';
import { getThemePref, saveThemePref } from './db/repo';

type Ctx = { pref: ThemePref; scheme: SchemeName; setPref: (p: ThemePref) => void };

const ThemeCtx = createContext<Ctx>({ pref: 'system', scheme: 'light', setPref: () => {} });

/** Call in any screen or layout that should re-render when the theme changes. */
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    getThemePref(db).then(setPrefState);
  }, [db]);

  const scheme: SchemeName = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;

  // Mutate the shared palette and rebuild styles before children render with the new scheme.
  applyScheme(scheme);
  refreshStyles();

  const setPref = useCallback(
    (p: ThemePref) => {
      setPrefState(p);
      saveThemePref(db, p);
    },
    [db]
  );

  return <ThemeCtx.Provider value={{ pref, scheme, setPref }}>{children}</ThemeCtx.Provider>;
}
