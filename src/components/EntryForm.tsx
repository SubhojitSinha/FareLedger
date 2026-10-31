import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DUPLICATE,
  addHead,
  addPerson,
  dateStr,
  deleteEntry,
  entryExists,
  getEntry,
  getRates,
  listHeads,
  listPeople,
  listPrices,
  saveEntry,
  timeStr,
  type Head,
  type Person,
} from '../db/repo';
import { calculate, type ExpenseType } from '../domain/calc';
import { Btn, Card, DateTimeField, Field, SectionTitle, StepHeader, SummaryRow, Typeahead } from './ui';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import SettlementView from './SettlementView';
import { colors, fmt, num, space } from '../theme';
import { useTheme } from '../ThemeContext';

type TicketRow = { price: number; issued: string; returned: string };
type ExpenseRow = {
  key: string;
  headId: number | null;
  headName: string;
  type: ExpenseType;
  amount: string;
  note: string;
};

const STEPS = ['Crew', 'Tickets', 'Expenses', 'Settlement'];

let keySeq = 0;
const newKey = () => `e${++keySeq}`;

export default function EntryForm({ entryId }: { entryId?: number }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const kb = useKeyboardHeight();
  useTheme();

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [buses, setBuses] = useState<Person[]>([]);
  const [drivers, setDrivers] = useState<Person[]>([]);
  const [conductors, setConductors] = useState<Person[]>([]);
  const [heads, setHeads] = useState<Head[]>([]);

  const [when, setWhen] = useState(new Date());
  const [bus, setBus] = useState<Person | null>(null);
  const [driver, setDriver] = useState<Person | null>(null);
  const [conductor, setConductor] = useState<Person | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [pcts, setPcts] = useState({ driver: 15, conductor: 9 });
  const [saving, setSaving] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const scrollRef = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);

  useEffect(() => {
    (async () => {
      const [b, d, c, h] = await Promise.all([
        listPeople(db, 'buses'),
        listPeople(db, 'drivers'),
        listPeople(db, 'conductors'),
        listHeads(db, true),
      ]);
      setBuses(b);
      setDrivers(d);
      setConductors(c);
      setHeads(h);

      if (entryId) {
        const e = await getEntry(db, entryId);
        if (e) {
          setWhen(new Date(`${e.entry_date}T${e.entry_time || '00:00'}:00`));
          setBus(b.find((x) => x.id === e.bus_id) ?? { id: e.bus_id, name: e.bus });
          setDriver({ id: e.driver_id, name: e.driver });
          setConductor({ id: e.conductor_id, name: e.conductor });
          setPcts({ driver: e.driver_pct, conductor: e.conductor_pct });
          setTickets(
            e.tickets.map((t) => ({ price: t.price, issued: String(t.issued), returned: String(t.returned) }))
          );
          setExpenses(
            e.expenses.map((x) => ({
              key: newKey(),
              headId: x.head_id,
              headName: x.head_name,
              type: x.type,
              amount: String(x.amount),
              note: x.note ?? '',
            }))
          );
        }
      } else {
        const [rates, prices] = await Promise.all([getRates(db), listPrices(db, true)]);
        setPcts({ driver: rates.driverPct, conductor: rates.conductorPct });
        setTickets(prices.map((p) => ({ price: p.value, issued: String(rates.issueCount), returned: '0' })));
      }
      setReady(true);
    })();
  }, [db, entryId]);

  const result = useMemo(
    () =>
      calculate(
        tickets.map((t) => ({ price: t.price, issued: num(t.issued), returned: num(t.returned) })),
        expenses.map((e) => ({ amount: num(e.amount), type: e.type })),
        pcts.driver,
        pcts.conductor
      ),
    [tickets, expenses, pcts]
  );

  const setTicket = (i: number, patch: Partial<TicketRow>) =>
    setTickets((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setExpense = (key: string, patch: Partial<ExpenseRow>) =>
    setExpenses((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addExpenseRow = () => {
    const key = newKey();
    setExpenses((rows) => [...rows, { key, headId: null, headName: '', type: 'deduction', amount: '', note: '' }]);
    setFocusKey(key);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  };

  // Only the row just added should grab focus; clear it when leaving the step.
  useEffect(() => setFocusKey(null), [step]);

  const createPerson = (kind: 'buses' | 'drivers' | 'conductors') => async (name: string) => {
    const p = await addPerson(db, kind, name);
    const set = kind === 'buses' ? setBuses : kind === 'drivers' ? setDrivers : setConductors;
    set((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]));
    return p;
  };
  const createHead = async (name: string) => {
    const h = await addHead(db, name);
    setHeads((list) => (list.some((x) => x.id === h.id) ? list : [...list, h]));
    return h;
  };

  /** Returns an error message for the given step, or null when it is fine to leave. */
  const validateStep = (i: number): string | null => {
    if (i === 0) {
      if (!bus) return 'Select or create a bus.';
      if (!driver) return 'Select or create a driver.';
      if (!conductor) return 'Select or create a conductor.';
    }
    if (i === 1) {
      for (const t of tickets) {
        const issued = num(t.issued);
        const returned = num(t.returned);
        if (!Number.isInteger(issued) || !Number.isInteger(returned)) return `₹${t.price}: counts must be whole numbers.`;
        if (issued < 0 || returned < 0) return `₹${t.price}: counts can't be negative.`;
        if (returned > issued) return `₹${t.price}: returned is more than issued.`;
      }
    }
    if (i === 2) {
      for (const e of expenses) {
        if (num(e.amount) > 0 && !e.headId) return 'Choose a head for every expense with an amount.';
      }
    }
    return null;
  };

  const next = async () => {
    const err = validateStep(step);
    if (err) return Alert.alert('Check this step', err);
    // Catch a second entry for the same bus and day now, not at the very end.
    if (step === 0 && (await entryExists(db, bus!.id, dateStr(when), entryId))) {
      return Alert.alert('Already entered', `Bus ${bus!.name} already has an entry for ${dateStr(when)}.`);
    }
    setStep((s) => s + 1);
  };
  const jump = (i: number) => {
    if (i < step) setStep(i);
  };

  const save = async () => {
    for (let i = 0; i < 3; i++) {
      const err = validateStep(i);
      if (err) {
        setStep(i);
        return Alert.alert('Check this step', err);
      }
    }
    setSaving(true);
    try {
      await saveEntry(
        db,
        {
          date: dateStr(when),
          time: timeStr(when),
          busId: bus!.id,
          driverId: driver!.id,
          conductorId: conductor!.id,
          driverPct: pcts.driver,
          conductorPct: pcts.conductor,
          tickets: tickets.map((t) => ({ price: t.price, issued: num(t.issued), returned: num(t.returned) })),
          expenses: expenses
            .filter((e) => num(e.amount) > 0)
            .map((e) => ({
              headId: e.headId,
              headName: e.headName,
              type: e.type,
              amount: num(e.amount),
              note: e.note.trim(),
            })),
        },
        entryId
      );
      router.back();
    } catch (e) {
      if (e instanceof Error && e.message === DUPLICATE) {
        setStep(0);
        Alert.alert('Already entered', `Bus ${bus!.name} already has an entry for ${dateStr(when)}.`);
      } else {
        Alert.alert('Could not save', String(e));
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete this entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(db, entryId!);
          router.back();
        },
      },
    ]);

  if (!ready) return null;

  const last = step === STEPS.length - 1;
  const headOf = (e: ExpenseRow): Head | null =>
    e.headId
      ? heads.find((h) => h.id === e.headId) ?? { id: e.headId, name: e.headName, type: e.type, is_system: 0, active: 1 }
      : null;
  const activeExpenses = expenses.filter((e) => num(e.amount) > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: kb }}>
      <StepHeader steps={STEPS} current={step} onJump={jump} />

      <ScrollView
        ref={scrollRef as never}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        {step === 0 && (
          <>
            <SectionTitle>Date, bus and crew</SectionTitle>
            <Card>
              <DateTimeField value={when} onChange={setWhen} />
              <Typeahead
                label="Bus number"
                placeholder="Type to search or add a bus"
                items={buses}
                value={bus}
                onChange={setBus}
                onCreate={createPerson('buses')}
                autoCapitalize="characters"
              />
              {bus?.owner ? (
                <Text style={{ color: colors.muted, marginTop: -space.sm, marginBottom: space.md }}>Owner: {bus.owner}</Text>
              ) : null}
              <Typeahead
                label="Driver"
                placeholder="Type to search or add a driver"
                items={drivers}
                value={driver}
                onChange={setDriver}
                onCreate={createPerson('drivers')}
              />
              <Typeahead
                label="Conductor"
                placeholder="Type to search or add a conductor"
                items={conductors}
                value={conductor}
                onChange={setConductor}
                onCreate={createPerson('conductors')}
              />
            </Card>
          </>
        )}

        {step === 1 && (
          <>
            <SectionTitle>Ticket details</SectionTitle>
            <Card>
              {tickets.length === 0 && (
                <Text style={{ color: colors.muted }}>No active ticket prices. Add some in Settings.</Text>
              )}
              {tickets.map((t, i) => {
                const line = result.tickets[i];
                return (
                  <View key={t.price} style={{ marginBottom: space.lg }}>
                    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
                      <Text style={{ width: 56, fontSize: 20, fontWeight: '700', color: colors.text, paddingBottom: 12 }}>
                        ₹{t.price}
                      </Text>
                      <Field
                        label="Issued"
                        keyboardType="number-pad"
                        selectTextOnFocus
                        value={t.issued}
                        onChangeText={(v) => setTicket(i, { issued: v })}
                        style={{ flex: 1 }}
                      />
                      <Field
                        label="Returned"
                        keyboardType="number-pad"
                        selectTextOnFocus
                        value={t.returned}
                        onChangeText={(v) => setTicket(i, { returned: v })}
                        style={{ flex: 1 }}
                      />
                    </View>
                    <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'right' }}>
                      Sold {line?.sold ?? 0} → {fmt(line?.amount ?? 0)}
                    </Text>
                  </View>
                );
              })}
              <SummaryRow label="Gross collection" value={fmt(result.gross)} bold />
            </Card>
          </>
        )}

        {step === 2 && (
          <>
            <SectionTitle>Expenses</SectionTitle>
            <Card>
              {expenses.length === 0 && (
                <Text style={{ color: colors.muted, marginBottom: space.sm }}>
                  No expenses yet. Add fines, return tickets, diesel and so on.
                </Text>
              )}
              {expenses.map((e) => (
                <View
                  key={e.key}
                  style={{ marginBottom: space.md, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Typeahead
                    label="Head"
                    placeholder="Type to search or add a head"
                    items={heads}
                    autoFocus={e.key === focusKey}
                    value={headOf(e)}
                    onChange={(h) =>
                      setExpense(
                        e.key,
                        h
                          ? { headId: h.id, headName: h.name, type: h.type }
                          : { headId: null, headName: '', type: 'deduction' }
                      )
                    }
                    onCreate={createHead}
                  />
                  <Field
                    label="Amount"
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    value={e.amount}
                    onChangeText={(v) => setExpense(e.key, { amount: v })}
                    style={{ marginBottom: space.md }}
                  />
                  <Field
                    placeholder="Note (optional)"
                    value={e.note}
                    onChangeText={(v) => setExpense(e.key, { note: v })}
                  />
                  <Btn
                    label="Remove"
                    variant="danger"
                    onPress={() => setExpenses((rows) => rows.filter((r) => r.key !== e.key))}
                    style={{ marginTop: space.sm, paddingVertical: 8 }}
                  />
                </View>
              ))}
              <Btn label="+ Add expense" variant="ghost" onPress={addExpenseRow} />
              <View style={{ marginTop: space.md }}>
                <SummaryRow label="Total expenses" value={fmt(result.totalExpenses)} bold color={colors.expense} />
              </View>
            </Card>
          </>
        )}

        {step === 3 && (
          <>
            <SettlementView
              data={{
                date: dateStr(when),
                time: timeStr(when),
                bus: bus?.name,
                driver: driver?.name,
                conductor: conductor?.name,
                driverPct: pcts.driver,
                conductorPct: pcts.conductor,
                result,
                expenses: activeExpenses.map((e) => ({
                  key: e.key,
                  headName: e.headName,
                  note: e.note,
                  type: e.type,
                  amount: num(e.amount),
                })),
              }}
            />
            {entryId ? <Btn label="Delete entry" variant="danger" onPress={remove} style={{ marginTop: space.sm }} /> : null}
          </>
        )}
      </ScrollView>

      <SafeAreaView edges={kb > 0 ? [] : ['bottom']} style={{ backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ flexDirection: 'row', gap: space.md, padding: space.md }}>
          {step > 0 ? <Btn label="← Back" variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
          {last ? (
            <Btn
              label={saving ? 'Saving…' : entryId ? 'Update entry' : 'Save entry'}
              onPress={save}
              disabled={saving}
              style={{ flex: 2 }}
            />
          ) : (
            <Btn label="Next →" onPress={next} style={{ flex: 2 }} />
          )}
        </View>
      </SafeAreaView>

    </View>
  );
}
