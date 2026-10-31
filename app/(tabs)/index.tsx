import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { listEntriesOn, todayStr, type EntrySummary } from '../../src/db/repo';
import { AmountText, Card } from '../../src/components/ui';
import { colors, fmt, space } from '../../src/theme';
import { useTheme } from '../../src/ThemeContext';

export default function Daily() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { scheme } = useTheme();
  const [entries, setEntries] = useState<EntrySummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      listEntriesOn(db, todayStr()).then(setEntries);
    }, [db])
  );

  const todays = entries;
  const todayNet = todays.reduce((s, e) => s + e.net, 0);
  const todayOwner = todays.reduce((s, e) => s + e.owner_cut, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 110 }}
      data={todays}
      extraData={scheme}
      keyExtractor={(e) => String(e.id)}
      ListHeaderComponent={
        <View>
          <Card style={{ backgroundColor: colors.primary }}>
            <Text style={{ color: '#CFE8DF', fontSize: 13 }}>Today · {todays.length} bus{todays.length === 1 ? '' : 'es'}</Text>
            <AmountText style={{ color: '#fff', fontSize: 30, fontWeight: '700', marginTop: 4 }}>{fmt(todayNet)}</AmountText>
            <Text style={{ color: '#CFE8DF', marginTop: 2 }}>Net collection · Owner's cut {fmt(todayOwner)}</Text>
          </Card>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginBottom: space.sm }}>
            Today's entries
          </Text>
        </View>
      }
      ListEmptyComponent={<Text style={{ color: colors.muted }}>No entries today yet. Tap + New entry to add one.</Text>}
      renderItem={({ item, index }) => (
        <Pressable onPress={() => router.push(`/entry/${item.id}`)}>
          <Card style={{ backgroundColor: index % 2 === 0 ? colors.card : colors.tileAlt }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Bus {item.bus}</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>
                  {item.entry_date}
                  {item.entry_time ? `  ${item.entry_time}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push(`/entry/preview/${item.id}`)}
                hitSlop={10}
                accessibilityLabel="Preview settlement"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.soft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={'eye-outline' as keyof typeof Ionicons.glyphMap} size={22} color={colors.primary} />
              </Pressable>
            </View>
            <Text style={{ color: colors.muted, marginTop: space.sm }}>
              {item.driver} · {item.conductor}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md }}>
              <Stat label="Gross" value={fmt(item.gross)} />
              <Stat label="Expenses" value={fmt(item.total_expenses)} color={colors.expense} />
              <Stat label="Net" value={fmt(item.net)} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
              <Stat label="Driver" value={fmt(item.driver_wage)} color={colors.driverText} bg={colors.driverSoft} />
              <Stat label="Conductor" value={fmt(item.conductor_wage)} color={colors.conductorText} bg={colors.conductorSoft} />
              <Stat label="Owner" value={fmt(item.owner_cut)} color={colors.primary} bg={colors.soft} />
            </View>
          </Card>
        </Pressable>
      )}
    />
    <Pressable
      onPress={() => router.push('/entry/new')}
      accessibilityLabel="New entry"
      style={({ pressed }) => ({
        position: 'absolute',
        right: 20,
        bottom: 24,
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={'add' as keyof typeof Ionicons.glyphMap} size={34} color="#fff" />
    </Pressable>
    </View>
  );
}

function Stat({ label, value, color, bg }: { label: string; value: string; color?: string; bg?: string }) {
  return (
    <View style={[{ flex: 1 }, bg ? { backgroundColor: bg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 } : null]}>
      <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
      <AmountText style={{ fontSize: 15, fontWeight: '600', color: color ?? colors.text }}>{value}</AmountText>
    </View>
  );
}
