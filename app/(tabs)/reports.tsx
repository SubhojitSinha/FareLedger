import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { dateStr, getByBus, getByHead, getByPerson, getTotals, type Totals } from '../../src/db/repo';
import { Card, SectionTitle, SummaryRow } from '../../src/components/ui';
import DateRangePicker from '../../src/components/DateRangePicker';
import { colors, fmt, space } from '../../src/theme';
import { useTheme } from '../../src/ThemeContext';

type Preset = 'today' | 'month' | 'all' | 'custom';

const FOREVER_START = new Date(2000, 0, 1);

const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  return d;
};

const show = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

type Data = {
  totals: Totals;
  bus: Awaited<ReturnType<typeof getByBus>>;
  drivers: Awaited<ReturnType<typeof getByPerson>>;
  conductors: Awaited<ReturnType<typeof getByPerson>>;
  heads: Awaited<ReturnType<typeof getByHead>>;
};

export default function Reports() {
  const db = useSQLiteContext();
  const { scheme } = useTheme();
  const [preset, setPreset] = useState<Preset>('today');
  const [from, setFrom] = useState(new Date());
  const [to, setTo] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    const f = dateStr(from);
    const t = dateStr(to);
    Promise.all([
      getTotals(db, f, t),
      getByBus(db, f, t),
      getByPerson(db, 'drivers', f, t),
      getByPerson(db, 'conductors', f, t),
      getByHead(db, f, t),
    ]).then(([totals, bus, drivers, conductors, heads]) => setData({ totals, bus, drivers, conductors, heads }));
  }, [db, from, to, tick]);

  useEffect(load, [load]);

  // Reload whenever the tab is opened (entries may have changed) and roll presets forward past midnight.
  useFocusEffect(
    useCallback(() => {
      const now = new Date();
      if (preset === 'today') {
        setFrom(now);
        setTo(now);
      } else if (preset === 'month') {
        setFrom(monthStart());
        setTo(now);
      } else if (preset === 'all') {
        setTo(now);
      }
      setTick((t) => t + 1);
    }, [preset])
  );

  const choose = (p: Preset) => {
    if (p === 'custom') return setPickerOpen(true);
    setPreset(p);
    const now = new Date();
    if (p === 'today') {
      setFrom(now);
      setTo(now);
    } else if (p === 'month') {
      setFrom(monthStart());
      setTo(now);
    } else {
      setFrom(FOREVER_START);
      setTo(now);
    }
  };

  const t = data?.totals;
  const chips: { key: Preset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'month', label: 'This month' },
    { key: 'all', label: 'All time' },
    { key: 'custom', label: '📅 Pick dates' },
  ];

  return (
    <ScrollView
      key={scheme}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}
    >
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        {chips.map((c) => {
          const active = preset === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => choose(c.key)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 20,
                backgroundColor: active ? colors.primary : colors.card,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600' }}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: colors.muted, marginTop: space.sm, marginBottom: space.md }}>
        {preset === 'all' ? 'All entries' : `${show(from)} – ${show(to)}`}
      </Text>

      <Card>
        <SummaryRow label="Entries" value={String(t?.entries ?? 0)} />
        <SummaryRow label="Gross collection" value={fmt(t?.gross ?? 0)} />
        <SummaryRow label="Expenses" value={fmt(t?.expenses ?? 0)} color={colors.expense} />
        <SummaryRow label="Net" value={fmt(t?.net ?? 0)} bold />
        <SummaryRow label="Driver wages" value={fmt(t?.driver ?? 0)} color={colors.driverText} />
        <SummaryRow label="Conductor wages" value={fmt(t?.conductor ?? 0)} color={colors.conductorText} />
        <SummaryRow label="Owner's cut" value={fmt(t?.owner ?? 0)} bold color={colors.primary} />
      </Card>

      <SectionTitle>By bus</SectionTitle>
      <Card>
        {data?.bus.length ? (
          data.bus.map((b, i) => (
            <ListRow
              key={b.name}
              last={i === data.bus.length - 1}
              title={`Bus ${b.name}`}
              sub={`${b.days} day${b.days === 1 ? '' : 's'}`}
              value={fmt(b.net)}
              valueSub={`Owner ${fmt(b.owner)}`}
            />
          ))
        ) : (
          <Text style={{ color: colors.muted }}>No data.</Text>
        )}
      </Card>

      <SectionTitle>Driver wages</SectionTitle>
      <Card>
        {data?.drivers.length ? (
          data.drivers.map((d, i) => (
            <ListRow
              key={d.name}
              last={i === data.drivers.length - 1}
              title={d.name}
              sub={`${d.days} day${d.days === 1 ? '' : 's'}`}
              value={fmt(d.wages)}
              color={colors.driverText}
            />
          ))
        ) : (
          <Text style={{ color: colors.muted }}>No data.</Text>
        )}
      </Card>

      <SectionTitle>Conductor wages</SectionTitle>
      <Card>
        {data?.conductors.length ? (
          data.conductors.map((c, i) => (
            <ListRow
              key={c.name}
              last={i === data.conductors.length - 1}
              title={c.name}
              sub={`${c.days} day${c.days === 1 ? '' : 's'}`}
              value={fmt(c.wages)}
              color={colors.conductorText}
            />
          ))
        ) : (
          <Text style={{ color: colors.muted }}>No data.</Text>
        )}
      </Card>

      <SectionTitle>Expenses by head</SectionTitle>
      <Card>
        {data?.heads.length ? (
          data.heads.map((h, i) => (
            <ListRow
              key={`${h.name}-${h.type}`}
              last={i === data.heads.length - 1}
              title={h.name}
              sub={h.type === 'addition' ? 'Addition' : undefined}
              value={fmt(h.total)}
              color={colors.expense}
            />
          ))
        ) : (
          <Text style={{ color: colors.muted }}>No data.</Text>
        )}
      </Card>

      <DateRangePicker
        visible={pickerOpen}
        from={from}
        to={to}
        onClose={() => setPickerOpen(false)}
        onApply={(f, t2) => {
          setFrom(f);
          setTo(t2);
          setPreset('custom');
          setPickerOpen(false);
        }}
      />
    </ScrollView>
  );
}

/** Name on the left (wraps if long), amounts stacked on the right, so nothing overflows the card. */
function ListRow({
  title,
  sub,
  value,
  valueSub,
  color,
  last,
}: {
  title: string;
  sub?: string;
  value: string;
  valueSub?: string;
  color?: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{title}</Text>
        {sub ? <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: color ?? colors.text }}>{value}</Text>
        {valueSub ? <Text style={{ fontSize: 12, color: colors.primary, marginTop: 1 }}>{valueSub}</Text> : null}
      </View>
    </View>
  );
}
