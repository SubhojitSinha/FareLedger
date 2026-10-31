import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getEntry } from '../../../src/db/repo';
import { calculate } from '../../../src/domain/calc';
import SettlementView, { type SettlementData } from '../../../src/components/SettlementView';
import { Btn } from '../../../src/components/ui';
import { colors, space } from '../../../src/theme';
import { useTheme } from '../../../src/ThemeContext';

/** Read-only settlement page for a saved entry, built from the values it was saved with. */
export default function PreviewEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  useTheme();
  const [data, setData] = useState<SettlementData | null>(null);

  useEffect(() => {
    getEntry(db, Number(id)).then((e) => {
      if (!e) return;
      const expenses = e.expenses.filter((x) => x.amount > 0);
      setData({
        date: e.entry_date,
        time: e.entry_time ?? '',
        bus: e.bus,
        driver: e.driver,
        conductor: e.conductor,
        driverPct: e.driver_pct,
        conductorPct: e.conductor_pct,
        result: calculate(
          e.tickets,
          expenses.map((x) => ({ amount: x.amount, type: x.type })),
          e.driver_pct,
          e.conductor_pct
        ),
        expenses: expenses.map((x, i) => ({
          key: String(i),
          headName: x.head_name,
          note: x.note ?? '',
          type: x.type,
          amount: x.amount,
        })),
      });
    });
  }, [db, id]);

  if (!data) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 32 }}>
        <SettlementView data={data} />
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ flexDirection: 'row', gap: space.md, padding: space.md }}>
          <Btn label="Close" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
          <Btn label="Edit entry" onPress={() => router.replace(`/entry/${id}`)} style={{ flex: 1 }} />
        </View>
      </SafeAreaView>
    </View>
  );
}
