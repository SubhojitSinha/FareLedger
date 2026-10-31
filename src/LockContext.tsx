import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import PinPad from './components/PinPad';
import { getSetting, setSetting } from './db/repo';
import { useTheme } from './ThemeContext';
import { colors, space } from './theme';

/** Re-lock after the app has been in the background this long. */
const RELOCK_AFTER_MS = 30_000;
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;
const PIN_KEY = 'fareledger_pin';

/* ---------- PIN storage: salted hash in the phone's secure store ---------- */

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const hashPin = (pin: string, salt: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

async function savePin(pin: string) {
  const salt = hex(await Crypto.getRandomBytesAsync(16));
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify({ salt, hash: await hashPin(pin, salt) }));
}
async function hasPin() {
  return !!(await SecureStore.getItemAsync(PIN_KEY));
}
async function checkPin(pin: string) {
  const raw = await SecureStore.getItemAsync(PIN_KEY);
  if (!raw) return false;
  const { salt, hash } = JSON.parse(raw) as { salt: string; hash: string };
  return (await hashPin(pin, salt)) === hash;
}

/* ---------- biometrics ---------- */

const biometricsReady = async () =>
  (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());

const biometricUnlock = async (message = 'Unlock FareLedger') =>
  (
    await LocalAuthentication.authenticateAsync({
      promptMessage: message,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    })
  ).success;

/* ---------- context ---------- */

type Ctx = {
  enabled: boolean;
  biometric: boolean;
  biometricAvailable: boolean;
  enable: () => Promise<boolean>;
  disable: () => Promise<boolean>;
  changePin: () => Promise<boolean>;
  setBiometric: (on: boolean) => Promise<boolean>;
};

const LockCtx = createContext<Ctx>({
  enabled: false,
  biometric: false,
  biometricAvailable: false,
  enable: async () => false,
  disable: async () => false,
  changePin: async () => false,
  setBiometric: async () => false,
});
export const useLock = () => useContext(LockCtx);

type Flow = { kind: 'set' | 'verify'; title: string; resolve: (ok: boolean) => void };

export function LockProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  useTheme();
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [biometric, setBiometricState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [flag, bio, pin, ready] = await Promise.all([
        getSetting(db, 'app_lock'),
        getSetting(db, 'lock_biometric'),
        hasPin(),
        biometricsReady().catch(() => false),
      ]);
      // A lock flag without a stored PIN (new phone, reinstall) can't be honoured.
      const on = flag === '1' && pin;
      if (flag === '1' && !pin) await setSetting(db, 'app_lock', '0');
      setEnabled(on);
      setLocked(on);
      setBiometricState(bio === '1');
      setAvailable(ready);
      setLoaded(true);
    })();
  }, [db]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt.current = Date.now();
      if (state === 'active' && enabled && leftAt.current && Date.now() - leftAt.current > RELOCK_AFTER_MS) {
        setLocked(true);
      }
      if (state === 'active') leftAt.current = null;
    });
    return () => sub.remove();
  }, [enabled]);

  const runFlow = useCallback(
    (kind: Flow['kind'], title: string) => new Promise<boolean>((resolve) => setFlow({ kind, title, resolve })),
    []
  );
  const endFlow = (ok: boolean) => {
    flow?.resolve(ok);
    setFlow(null);
  };

  const enable = useCallback(async () => {
    if (!(await runFlow('set', 'Create a PIN'))) return false;
    await setSetting(db, 'app_lock', '1');
    const ready = await biometricsReady().catch(() => false);
    setAvailable(ready);
    // Fingerprint/face is on by default when the phone has it set up.
    if ((await getSetting(db, 'lock_biometric')) === null) {
      await setSetting(db, 'lock_biometric', ready ? '1' : '0');
      setBiometricState(ready);
    }
    setEnabled(true);
    return true;
  }, [db, runFlow]);

  const disable = useCallback(async () => {
    if (!(await runFlow('verify', 'Enter your PIN to turn off the lock'))) return false;
    await setSetting(db, 'app_lock', '0');
    await SecureStore.deleteItemAsync(PIN_KEY);
    setEnabled(false);
    setLocked(false);
    return true;
  }, [db, runFlow]);

  const changePin = useCallback(async () => {
    if (!(await runFlow('verify', 'Enter your current PIN'))) return false;
    return runFlow('set', 'Create a new PIN');
  }, [runFlow]);

  const setBiometric = useCallback(
    async (on: boolean) => {
      if (on) {
        if (!(await biometricsReady().catch(() => false))) {
          Alert.alert(
            'Set up fingerprint or face first',
            'Add a fingerprint or face in your phone settings, then turn this on again.'
          );
          return false;
        }
        if (!(await biometricUnlock('Confirm to turn on'))) return false;
      }
      await setSetting(db, 'lock_biometric', on ? '1' : '0');
      setBiometricState(on);
      return true;
    },
    [db]
  );

  /** "Forgot PIN": the phone's own screen lock proves it is the owner, then they choose a new PIN. */
  const resetViaDeviceLock = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Verify it is you' });
    if (!res.success) return;
    setLocked(false);
    await runFlow('set', 'Create a new PIN');
  }, [runFlow]);

  if (!loaded) return null;

  return (
    <LockCtx.Provider
      value={{ enabled, biometric, biometricAvailable: available, enable, disable, changePin, setBiometric }}
    >
      <View style={{ flex: 1 }}>
        {children}
        {locked ? (
          <LockScreen
            useBiometric={biometric && available}
            onUnlocked={() => setLocked(false)}
            onForgot={resetViaDeviceLock}
          />
        ) : null}
      </View>
      <PinFlowModal flow={flow} onDone={endFlow} />
    </LockCtx.Provider>
  );
}

/* ---------- lock screen ---------- */

function LockScreen({
  useBiometric,
  onUnlocked,
  onForgot,
}: {
  useBiometric: boolean;
  onUnlocked: () => void;
  onForgot: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [coolingUntil, setCoolingUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const prompting = useRef(false);

  const tryBiometric = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await biometricUnlock()) onUnlocked();
    } finally {
      prompting.current = false;
    }
  }, [onUnlocked]);

  useEffect(() => {
    if (useBiometric) tryBiometric();
  }, [useBiometric, tryBiometric]);

  useEffect(() => {
    if (coolingUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [coolingUntil]);

  const cooling = coolingUntil > now;
  const secondsLeft = Math.ceil((coolingUntil - now) / 1000);

  const submit = async (pin: string) => {
    if (cooling) return;
    if (await checkPin(pin)) return onUnlocked();
    const n = attempts + 1;
    if (n >= MAX_ATTEMPTS) {
      setAttempts(0);
      setCoolingUntil(Date.now() + COOLDOWN_MS);
      setNow(Date.now());
      setError('Too many tries');
    } else {
      setAttempts(n);
      setError(`Wrong PIN · ${MAX_ATTEMPTS - n} ${MAX_ATTEMPTS - n === 1 ? 'try' : 'tries'} left`);
    }
  };

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, zIndex: 100 }]}>
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <Image
          source={require('../assets/icon.png')}
          style={{ width: 84, height: 84, borderRadius: 20, marginBottom: space.lg }}
        />
        <PinPad
          title="FareLedger is locked"
          subtitle={cooling ? `Try again in ${secondsLeft}s` : 'Enter your PIN'}
          error={error}
          disabled={cooling}
          onComplete={submit}
        />
        <View style={{ flexDirection: 'row', gap: space.xl, marginTop: space.sm }}>
          {useBiometric ? (
            <Pressable onPress={tryBiometric} hitSlop={10}>
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 15 }}>Use fingerprint / face</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onForgot} hitSlop={10}>
            <Text style={{ color: colors.muted, fontSize: 15 }}>Forgot PIN?</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ---------- create / verify PIN sheet ---------- */

function PinFlowModal({ flow, onDone }: { flow: Flow | null; onDone: (ok: boolean) => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFirst(null);
    setError(null);
  }, [flow]);

  const onComplete = async (pin: string) => {
    if (!flow) return;
    if (flow.kind === 'verify') {
      if (await checkPin(pin)) return onDone(true);
      return setError('Wrong PIN');
    }
    if (first === null) {
      setFirst(pin);
      return setError(null);
    }
    if (pin !== first) {
      setFirst(null);
      return setError("PINs didn't match. Start again.");
    }
    await savePin(pin);
    onDone(true);
  };

  return (
    <Modal visible={flow !== null} animationType="slide" onRequestClose={() => onDone(false)}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
          <PinPad
            key={`${flow?.kind}-${first === null ? 'a' : 'b'}-${error ?? ''}`}
            title={flow?.kind === 'set' && first !== null ? 'Confirm your PIN' : (flow?.title ?? '')}
            subtitle={flow?.kind === 'set' ? 'Choose a 4-digit PIN' : undefined}
            error={error}
            onComplete={onComplete}
          />
          <Pressable onPress={() => onDone(false)} hitSlop={10} style={{ marginTop: space.md }}>
            <Text style={{ color: colors.muted, fontSize: 16 }}>Cancel</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
