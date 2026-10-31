import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn } from './ui';
import { colors, space } from '../theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const same = (a: Date | null, b: Date | null) => !!a && !!b && a.getTime() === b.getTime();
const label = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Calendar sheet for choosing a start and end date: tap the first day, then the last. */
export default function DateRangePicker({
  visible,
  from,
  to,
  onApply,
  onClose,
}: {
  visible: boolean;
  from: Date;
  to: Date;
  onApply: (from: Date, to: Date) => void;
  onClose: () => void;
}) {
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [month, setMonth] = useState(new Date(from.getFullYear(), from.getMonth(), 1));

  useEffect(() => {
    if (visible) {
      setStart(day(from));
      setEnd(day(to));
      setMonth(new Date(from.getFullYear(), from.getMonth(), 1));
    }
  }, [visible]);

  const cells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const lead = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    const list: (Date | null)[] = [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: count }, (_, i) => new Date(y, m, i + 1)),
    ];
    while (list.length % 7) list.push(null);
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < list.length; i += 7) weeks.push(list.slice(i, i + 7));
    return weeks;
  }, [month]);

  const pick = (d: Date) => {
    if (!start || end) {
      setStart(d);
      setEnd(null);
    } else if (d < start) {
      setStart(d);
    } else {
      setEnd(d);
    }
  };

  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const today = day(new Date());
  const summary = !start ? 'Pick the first day' : end ? `${label(start)} – ${label(end)}` : `${label(start)} – pick the last day`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <SafeAreaView
          edges={['bottom']}
          style={{ backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: space.lg }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Select date range</Text>
          <Text style={{ color: colors.primary, fontWeight: '600', marginTop: 4, marginBottom: space.md }}>{summary}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
            <Pressable onPress={() => shift(-1)} hitSlop={12} style={{ padding: 8 }}>
              <Text style={{ fontSize: 22, color: colors.primary }}>‹</Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </Text>
            <Pressable onPress={() => shift(1)} hitSlop={12} style={{ padding: 8 }}>
              <Text style={{ fontSize: 22, color: colors.primary }}>›</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row' }}>
            {DOW.map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, paddingBottom: 6 }}>
                {d}
              </Text>
            ))}
          </View>

          {cells.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map((d, di) => {
                if (!d) return <View key={di} style={{ flex: 1, height: 44 }} />;
                const isEnd = same(d, start) || same(d, end);
                const inRange = !!start && !!end && d > start && d < end;
                return (
                  <Pressable
                    key={di}
                    onPress={() => pick(d)}
                    style={{
                      flex: 1,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: inRange ? colors.soft : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isEnd ? colors.primary : 'transparent',
                        borderWidth: same(d, today) && !isEnd ? 1 : 0,
                        borderColor: colors.primary,
                      }}
                    >
                      <Text style={{ color: isEnd ? '#fff' : colors.text, fontWeight: isEnd ? '700' : '400' }}>
                        {d.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
            <Btn label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Btn
              label="Apply"
              disabled={!start}
              onPress={() => start && onApply(start, end ?? start)}
              style={{ flex: 2 }}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
