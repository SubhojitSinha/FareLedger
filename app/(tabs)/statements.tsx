import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import {
  dateStr,
  getStatement,
  listPeople,
  type Person,
  type PersonKind,
  type StatementKind,
  type StatementRow,
} from '../../src/db/repo';
import { AmountText, Card, DateField, PickField, SelectModal } from '../../src/components/ui';
import { useTheme } from '../../src/ThemeContext';
import { colors, fmt, space } from '../../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const KIND_LABEL: Record<StatementKind, string> = { bus: 'Bus', driver: 'Driver', conductor: 'Conductor' };
const PERSON_TABLE: Record<StatementKind, PersonKind> = { bus: 'buses', driver: 'drivers', conductor: 'conductors' };
/** Each subject has its own color so the three tabs are easy to tell apart. Read at render time. */
const kindColors = (k: StatementKind) =>
  k === 'bus'
    ? { solid: colors.primary, soft: colors.soft, text: colors.primary }
    : k === 'driver'
      ? { solid: colors.driver, soft: colors.driverSoft, text: colors.driverText }
      : { solid: colors.conductor, soft: colors.conductorSoft, text: colors.conductorText };

const sum = (rows: StatementRow[], f: (r: StatementRow) => number) => rows.reduce((s, r) => s + f(r), 0);

const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  return d;
};

export default function Statements() {
  const db = useSQLiteContext();
  const { scheme } = useTheme();

  const [kind, setKind] = useState<StatementKind>('bus');
  const [people, setPeople] = useState<Person[]>([]);
  // Each tab remembers its own selection; switching tabs never clears it.
  const [subjects, setSubjects] = useState<Record<StatementKind, Person | null>>({
    bus: null,
    driver: null,
    conductor: null,
  });
  const subject = subjects[kind];
  const setSubject = (p: Person | null) => setSubjects((cur) => ({ ...cur, [kind]: p }));
  const [picking, setPicking] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [from, setFrom] = useState(new Date());
  const [to, setTo] = useState(new Date());
  const [rows, setRows] = useState<StatementRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      listPeople(db, PERSON_TABLE[kind]).then((list) => {
        setPeople(list);
        // Keep this tab's choice if it still exists; never pick one for the user.
        setSubjects((cur) => ({ ...cur, [kind]: list.find((p) => p.id === cur[kind]?.id) ?? null }));
      });
    }, [db, kind])
  );

  useEffect(() => {
    if (!subject) {
      setRows([]);
      return;
    }
    getStatement(db, kind, subject.id, dateStr(from), dateStr(to)).then(setRows);
  }, [db, kind, subject, from, to]);

  const preset = (start: Date) => {
    setFrom(start);
    setTo(new Date());
  };

  const kc = kindColors(kind);

  return (
    <ScrollView
      key={scheme}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}
    >
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md, alignItems: 'center' }}>
        {(['bus', 'driver', 'conductor'] as StatementKind[]).map((k) => {
          const c = kindColors(k);
          const active = kind === k;
          return (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: c.solid,
                backgroundColor: active ? c.solid : c.soft,
              }}
            >
              <Text style={{ fontWeight: '700', color: active ? '#fff' : c.text }}>{KIND_LABEL[k]}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setShowFilter((v) => !v)}
          accessibilityLabel="Toggle filters"
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: showFilter ? kc.solid : colors.border,
            backgroundColor: showFilter ? kc.soft : colors.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={'options-outline' as IconName} size={22} color={kc.text} />
        </Pressable>
      </View>

      {showFilter ? (
        <Card>
          <PickField
            label={kind === 'bus' ? 'Bus number' : `${KIND_LABEL[kind]} name`}
            value={subject?.name}
            placeholder={people.length ? `Select ${kind}` : `No ${kind} saved yet`}
            onPress={() => people.length && setPicking(true)}
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <DateField label="From" value={from} onChange={setFrom} />
            <DateField label="To" value={to} onChange={setTo} />
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }}>
            {[
              { label: 'Today', run: () => preset(new Date()) },
              { label: 'Last 7 days', run: () => preset(daysAgo(6)) },
              { label: 'This month', run: () => preset(monthStart()) },
              { label: 'All', run: () => preset(new Date(2000, 0, 1)) },
            ].map((p) => (
              <Pressable
                key={p.label}
                onPress={p.run}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.input,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      {subject ? (
        <Card style={{ backgroundColor: kc.solid, borderColor: kc.solid }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>
            {kind === 'bus' ? `Bus ${subject.name}` : subject.name}
          </Text>
          {kind === 'bus' && subject.owner ? (
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 2 }}>Owner: {subject.owner}</Text>
          ) : null}
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 }}>
            {fmtDate(from)} – {fmtDate(to)}
          </Text>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Text style={{ color: colors.muted, marginTop: space.md }}>
          {subject
            ? 'No entries in this date range.'
            : `Tap the filter icon to choose a ${kind === 'bus' ? 'bus' : kind}.`}
        </Text>
      ) : (
        <>
          {rows.map((r, i) => (
            <EntryTile key={r.id} kind={kind} row={r} bg={i % 2 === 0 ? colors.card : colors.tileAlt} />
          ))}
          <TotalTile kind={kind} rows={rows} />
        </>
      )}

      <SelectModal
        visible={picking}
        title={`Select ${kind}`}
        items={people}
        onClose={() => setPicking(false)}
        onSelect={(p) => {
          setSubject(p);
          setPicking(false);
        }}
      />
    </ScrollView>
  );
}

function Stat({ label, value, color, bg, bold }: { label: string; value: string; color?: string; bg?: string; bold?: boolean }) {
  return (
    <View
      style={[
        { flex: 1 },
        bg ? { backgroundColor: bg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 } : null,
      ]}
    >
      <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
      <AmountText style={{ fontSize: 15, fontWeight: bold ? '800' : '600', color: color ?? colors.text }}>
        {value}
      </AmountText>
    </View>
  );
}

/** Eye button that opens the read-only settlement page for an entry. */
function PreviewButton({ id }: { id: number }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/entry/preview/${id}`)}
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
      <Ionicons name={'eye-outline' as IconName} size={22} color={colors.primary} />
    </Pressable>
  );
}

function EntryTile({ kind, row: r, bg }: { kind: StatementKind; row: StatementRow; bg: string }) {
  if (kind !== 'bus') return <PersonTile kind={kind} row={r} bg={bg} />;

  // Bus tile: date and the three shares only.
  return (
    <Card style={{ backgroundColor: bg, marginBottom: space.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{r.entry_date}</Text>
        <PreviewButton id={r.id} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <Stat label="Owner" value={fmt(r.owner_cut)} color={colors.primary} bg={colors.soft} />
        <Stat label="Driver" value={fmt(r.driver_wage)} color={colors.driverText} bg={colors.driverSoft} />
        <Stat label="Conductor" value={fmt(r.conductor_wage)} color={colors.conductorText} bg={colors.conductorSoft} />
      </View>
    </Card>
  );
}

/** Driver/conductor entry: bus number, date and time, and their own share only. */
function PersonTile({ kind, row: r, bg }: { kind: StatementKind; row: StatementRow; bg: string }) {
  const isDriver = kind === 'driver';
  const myShare = isDriver ? r.driver_wage : r.conductor_wage;
  const myColor = isDriver ? colors.driverText : colors.conductorText;
  return (
    <Card style={{ backgroundColor: bg, marginBottom: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
            {r.entry_date}
            {r.entry_time ? `  ${r.entry_time}` : ''}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 2 }}>Bus {r.bus}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, color: colors.muted }}>Earning</Text>
          <AmountText style={{ fontSize: 20, fontWeight: '800', color: myColor }}>{fmt(myShare)}</AmountText>
        </View>
        <PreviewButton id={r.id} />
      </View>
    </Card>
  );
}

function TotalTile({ kind, rows }: { kind: StatementKind; rows: StatementRow[] }) {
  const entriesLabel = `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`;
  const heading = {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  };
  const cardStyle = { backgroundColor: colors.soft, borderColor: colors.primary, borderWidth: 2, marginTop: space.sm };

  if (kind !== 'bus') {
    const isDriver = kind === 'driver';
    return (
      <Card style={cardStyle}>
        <Text style={heading}>Total earning · {entriesLabel}</Text>
        <AmountText style={{ fontSize: 30, fontWeight: '800', marginTop: 4, color: isDriver ? colors.driverText : colors.conductorText }}>
          {fmt(sum(rows, (r) => (isDriver ? r.driver_wage : r.conductor_wage)))}
        </AmountText>
      </Card>
    );
  }

  return (
    <Card style={cardStyle}>
      <Text style={heading}>Total · {entriesLabel}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <Stat label="Owner" value={fmt(sum(rows, (r) => r.owner_cut))} color={colors.primary} bg={colors.card} bold />
        <Stat label="Driver" value={fmt(sum(rows, (r) => r.driver_wage))} color={colors.driverText} bg={colors.driverSoft} bold />
        <Stat
          label="Conductor"
          value={fmt(sum(rows, (r) => r.conductor_wage))}
          color={colors.conductorText}
          bg={colors.conductorSoft}
          bold
        />
      </View>
    </Card>
  );
}
