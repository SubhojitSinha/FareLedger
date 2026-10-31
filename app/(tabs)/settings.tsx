import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  addHead,
  addPrice,
  getRates,
  getThemePref,
  listHeads,
  listPrices,
  saveRates,
  setHeadActive,
  setPriceActive,
  type Head,
  type Price,
} from '../../src/db/repo';
import { Btn, Card, Field, SectionTitle, SelectModal } from '../../src/components/ui';
import { useKeyboardHeight } from '../../src/hooks/useKeyboardHeight';
import { useTheme } from '../../src/ThemeContext';
import { useLock } from '../../src/LockContext';
import { countEntries, exportBackup, pickBackup, restoreBackup } from '../../src/db/backup';
import type { ThemePref } from '../../src/theme';
import { CURRENCIES, colors, num, priceLabel, space } from '../../src/theme';

export default function Settings() {
  const db = useSQLiteContext();
  const kb = useKeyboardHeight();
  const { pref, setPref, currencyCode, setCurrencyCode } = useTheme();
  const [pickingCurrency, setPickingCurrency] = useState(false);
  const current = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  const router = useRouter();
  const lock = useLock();
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState<Price[]>([]);
  const [heads, setHeads] = useState<Head[]>([]);
  const [newPrice, setNewPrice] = useState('');
  const [newHead, setNewHead] = useState('');
  const [driverPct, setDriverPct] = useState('15');
  const [conductorPct, setConductorPct] = useState('9');
  const [issueCount, setIssueCount] = useState('100');

  const load = useCallback(async () => {
    const [p, h, r] = await Promise.all([listPrices(db), listHeads(db), getRates(db)]);
    setPrices(p);
    setHeads(h);
    setDriverPct(String(r.driverPct));
    setConductorPct(String(r.conductorPct));
    setIssueCount(String(r.issueCount));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAddPrice = async () => {
    const v = num(newPrice);
    if (v <= 0) return Alert.alert('Enter a ticket value greater than 0.');
    await addPrice(db, v);
    setNewPrice('');
    load();
  };

  const onAddHead = async () => {
    const name = newHead.trim();
    if (!name) return;
    await addHead(db, name);
    setNewHead('');
    load();
  };

  const onSaveRates = async () => {
    const d = num(driverPct);
    const c = num(conductorPct);
    const i = Math.floor(num(issueCount));
    if (d < 0 || c < 0 || d + c > 100) return Alert.alert('Percentages must be between 0 and 100 in total.');
    if (i <= 0) return Alert.alert('Issue count must be greater than 0.');
    await saveRates(db, { driverPct: d, conductorPct: c, issueCount: i });
    Alert.alert('Saved', 'New entries will use these values. Saved entries keep the values they were made with.');
  };

  const onExport = async () => {
    setBusy(true);
    try {
      const n = await exportBackup(db);
      Alert.alert('Backup ready', `${n} entr${n === 1 ? 'y' : 'ies'} exported. Save the file somewhere safe, like Drive or email.`);
    } catch (e) {
      Alert.alert('Could not export', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    setBusy(true);
    try {
      const picked = await pickBackup();
      if (!picked) return;
      const n = countEntries(picked.backup);
      Alert.alert(
        'Replace all data?',
        `"${picked.name}" has ${n} entr${n === 1 ? 'y' : 'ies'}, exported ${picked.backup.exportedAt.slice(0, 10)}.\n\nEverything currently in the app will be replaced. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: async () => {
              try {
                await restoreBackup(db, picked.backup);
                setPref(await getThemePref(db));
                await load();
                Alert.alert('Restored', 'Your data has been replaced with the backup.');
              } catch (e) {
                Alert.alert('Restore failed', `Nothing was changed.\n${String(e instanceof Error ? e.message : e)}`);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Could not import', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 48 + kb }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {(['system', 'light', 'dark'] as ThemePref[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPref(p)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 11,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: pref === p ? colors.primary : colors.border,
                backgroundColor: pref === p ? colors.primary : colors.input,
              }}
            >
              <Text style={{ fontWeight: '600', color: pref === p ? '#fff' : colors.text }}>
                {p === 'system' ? 'System' : p === 'light' ? 'Light' : 'Dark'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: space.sm }}>
          System follows your phone's light or dark setting.
        </Text>
      </Card>

      <SectionTitle>Currency</SectionTitle>
      <Pressable onPress={() => setPickingCurrency(true)}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
              {current.symbol.trim()}  {current.name} ({current.code})
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              Only changes how amounts are shown. Saved entries are not converted.
            </Text>
          </View>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Change</Text>
        </Card>
      </Pressable>

      <SectionTitle>Security</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>App lock</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              Ask for a 4-digit PIN when opening the app
            </Text>
          </View>
          <Switch
            value={lock.enabled}
            onValueChange={(v) => {
              if (v) lock.enable();
              else lock.disable();
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>
        {lock.enabled ? (
          <>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.md }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: space.md }}>
                <Text style={{ fontSize: 16, color: colors.text }}>Unlock with fingerprint / face</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  {lock.biometricAvailable
                    ? 'The PIN always works as a fallback'
                    : 'Not set up on this phone. Add one in phone settings.'}
                </Text>
              </View>
              <Switch
                value={lock.biometric && lock.biometricAvailable}
                disabled={!lock.biometricAvailable}
                onValueChange={(v) => {
                  lock.setBiometric(v);
                }}
                trackColor={{ true: colors.primary }}
              />
            </View>
            <Btn
              label="Change PIN"
              variant="ghost"
              onPress={() => {
                lock.changePin();
              }}
              style={{ marginTop: space.md }}
            />
          </>
        ) : null}
      </Card>

      <SectionTitle>People</SectionTitle>
      <Pressable onPress={() => router.push('/manage')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Buses, drivers & conductors</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              View, edit names, set the bus owner, or hide old ones
            </Text>
          </View>
          <Text style={{ color: colors.primary, fontSize: 20 }}>›</Text>
        </Card>
      </Pressable>

      <SectionTitle>Ticket values</SectionTitle>
      <Card>
        {prices.map((p) => (
          <Row
            key={p.id}
            label={priceLabel(p.value)}
            sub={p.active ? 'In use' : 'Hidden from new entries'}
            value={!!p.active}
            onChange={async (v) => {
              await setPriceActive(db, p.id, v);
              load();
            }}
          />
        ))}
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, alignItems: 'flex-end' }}>
          <Field
            label="New value"
            keyboardType="decimal-pad"
            value={newPrice}
            onChangeText={setNewPrice}
            style={{ flex: 1 }}
          />
          <Btn label="Add" onPress={onAddPrice} />
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: space.sm }}>
          Switch off old prices at season change. Past entries keep their prices.
        </Text>
      </Card>

      <SectionTitle>Expense heads</SectionTitle>
      <Card>
        {heads.map((h) => (
          <Row
            key={h.id}
            label={h.name}
            sub={h.is_system ? 'Fixed' : h.active ? 'In use' : 'Hidden from new entries'}
            value={!!h.active}
            disabled={!!h.is_system}
            onChange={async (v) => {
              await setHeadActive(db, h.id, v);
              load();
            }}
          />
        ))}
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, alignItems: 'flex-end' }}>
          <Field label="New head" value={newHead} onChangeText={setNewHead} autoCapitalize="words" style={{ flex: 1 }} />
          <Btn label="Add" onPress={onAddHead} />
        </View>
      </Card>

      <SectionTitle>Wages and issue count</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Field label="Driver %" keyboardType="decimal-pad" value={driverPct} onChangeText={setDriverPct} style={{ flex: 1 }} />
          <Field label="Conductor %" keyboardType="decimal-pad" value={conductorPct} onChangeText={setConductorPct} style={{ flex: 1 }} />
        </View>
        <Field
          label="Default issue count per ticket value"
          keyboardType="number-pad"
          value={issueCount}
          onChangeText={setIssueCount}
          style={{ marginTop: space.md, marginBottom: space.md }}
        />
        <Btn label="Save" onPress={onSaveRates} />
      </Card>

      <SectionTitle>Backup and restore</SectionTitle>
      <Card>
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: space.md }}>
          Your data is stored only on this phone. Export a backup file regularly and keep it somewhere safe. The file
          is not encrypted.
        </Text>
        <Btn label="Export backup" onPress={onExport} disabled={busy} />
        <Btn label="Import backup" variant="ghost" onPress={onImport} disabled={busy} style={{ marginTop: space.sm }} />
      </Card>

      <SelectModal
        visible={pickingCurrency}
        title="Select currency"
        items={CURRENCIES.map((c, i) => ({ id: i, name: `${c.symbol.trim()}  ${c.name} (${c.code})` }))}
        onClose={() => setPickingCurrency(false)}
        onSelect={(item) => {
          setCurrencyCode(CURRENCIES[item.id].code);
          setPickingCurrency(false);
        }}
      />
    </ScrollView>
  );
}

function Row({
  label,
  sub,
  value,
  onChange,
  disabled,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Text style={{ fontSize: 16, color: colors.text }}>{label}</Text>
        {sub ? <Text style={{ fontSize: 12, color: colors.muted }}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary }} />
    </View>
  );
}
