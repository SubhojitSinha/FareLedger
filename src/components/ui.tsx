import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, current, radius, space } from '../theme';

/** Single-line amount that shrinks to fit its box instead of being cut off with an ellipsis. */
export function AmountText({ style, ...props }: TextProps) {
  return <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={style} {...props} />;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={s.section}>{children}</Text>;
}

export function Btn({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? colors.primary : 'transparent';
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? colors.danger : colors.primary;
  const border = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.border;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  style,
  ...props
}: Omit<TextInputProps, 'style'> & { label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.muted} style={s.input} {...props} />
    </View>
  );
}

export function PickField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={s.label}>{label}</Text>
      <Pressable onPress={onPress} style={[s.input, s.pick]}>
        <Text style={{ color: value ? colors.text : colors.muted, fontSize: 16 }}>{value || placeholder}</Text>
        <Text style={{ color: colors.muted }}>▾</Text>
      </Pressable>
    </View>
  );
}

export function SummaryRow({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <View style={s.sumRow}>
      <Text style={[s.sumText, { flex: 1, paddingRight: 12 }, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[s.sumText, { flexShrink: 0, textAlign: 'right' }, bold && { fontWeight: '700' }, color ? { color } : null]}>
        {value}
      </Text>
    </View>
  );
}

type Item = { id: number; name: string };

/** Full-screen list with search; offers "create" when the typed name has no exact match. */
export function SelectModal<T extends Item>({
  visible,
  title,
  items,
  onClose,
  onSelect,
  onCreate,
}: {
  visible: boolean;
  title: string;
  items: T[];
  onClose: () => void;
  onSelect: (item: T) => void;
  onCreate?: (name: string) => Promise<T>;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim();
  const filtered = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())),
    [items, q]
  );
  const exact = items.some((i) => i.name.toLowerCase() === q.toLowerCase());

  const close = () => {
    setQuery('');
    onClose();
  };
  const pick = (i: T) => {
    setQuery('');
    onSelect(i);
  };
  const create = async () => {
    if (!onCreate || !q) return;
    const item = await onCreate(q);
    pick(item);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={s.modalHead}>
          <Text style={s.modalTitle}>{title}</Text>
          <Pressable onPress={close}>
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Close</Text>
          </Pressable>
        </View>
        <View style={{ padding: space.lg }}>
          <Field
            placeholder={onCreate ? 'Search or type a new name' : 'Search'}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="words"
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: space.lg }}
          ListHeaderComponent={
            onCreate && q && !exact ? (
              <Pressable onPress={create} style={[s.opt, { borderColor: colors.primary, backgroundColor: colors.soft }]}>
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>+ Create “{q}”</Text>
              </Pressable>
            ) : undefined
          }
          ListEmptyComponent={
            !q || !onCreate ? <Text style={{ color: colors.muted, padding: space.md }}>Nothing here yet.</Text> : undefined
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => pick(item)} style={s.opt}>
              <Text style={{ fontSize: 16, color: colors.text }}>{item.name}</Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

/** Type to search on the same screen; tap a suggestion or create a new entry. */
export function Typeahead<T extends Item>({
  label,
  placeholder,
  items,
  value,
  onChange,
  onCreate,
  autoCapitalize = 'words',
  autoFocus,
}: {
  label: string;
  placeholder: string;
  items: T[];
  value: T | null;
  onChange: (item: T | null) => void;
  onCreate: (name: string) => Promise<T>;
  autoCapitalize?: 'none' | 'words' | 'characters';
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(value?.name ?? '');
  const [focused, setFocused] = useState(false);

  // Mirror a selection into the box. Clearing is done by the box itself, so typing over a chosen name
  // (which clears the selection) is not wiped.
  useEffect(() => {
    if (value) setText(value.name);
  }, [value?.id]);

  const q = text.trim();
  const matches = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6),
    [items, q]
  );
  const exact = items.some((i) => i.name.toLowerCase() === q.toLowerCase());
  const showList = !value && (focused || q.length > 0);

  const choose = (i: T) => {
    setText(i.name);
    onChange(i);
  };
  const create = async () => {
    if (!q) return;
    choose(await onCreate(q));
  };
  const submit = async () => {
    const hit = items.find((i) => i.name.toLowerCase() === q.toLowerCase());
    if (hit) choose(hit);
    else await create();
  };

  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={s.label}>{label}</Text>
      <View>
        <TextInput
          value={text}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="done"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChangeText={(t) => {
            setText(t);
            if (value && t !== value.name) onChange(null);
          }}
          onSubmitEditing={submit}
          style={[s.input, value ? { borderColor: colors.primary, backgroundColor: colors.soft } : null]}
        />
        {value ? (
          <Pressable
            onPress={() => {
              setText('');
              onChange(null);
            }}
            style={s.clear}
            hitSlop={10}
          >
            <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      {showList ? (
        <View style={s.list}>
          {matches.map((i) => (
            <Pressable key={i.id} onPress={() => choose(i)} style={s.listRow}>
              <Text style={{ fontSize: 16, color: colors.text }}>{i.name}</Text>
            </Pressable>
          ))}
          {q && !exact ? (
            <Pressable onPress={create} style={[s.listRow, { backgroundColor: colors.soft }]}>
              <Text style={{ fontSize: 16, color: colors.primary, fontWeight: '600' }}>+ Create “{q}”</Text>
            </Pressable>
          ) : null}
          {!q && matches.length === 0 ? (
            <Text style={{ color: colors.muted, padding: space.md }}>Nothing yet. Type a name to create it.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const showDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const showTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Date and time buttons that open the native calendar and clock pickers. */
export function DateTimeField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);

  const handle = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setMode(null);
    if (e.type === 'set' && d) {
      const next = new Date(value);
      if (mode === 'date') next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      else next.setHours(d.getHours(), d.getMinutes(), 0, 0);
      onChange(next);
    }
    if (e.type === 'dismissed') setMode(null);
  };

  return (
    <View style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1.6 }}>
          <Text style={s.label}>Date</Text>
          <Pressable onPress={() => setMode('date')} style={[s.input, s.pick]}>
            <Text style={{ fontSize: 16, color: colors.text }}>{showDate(value)}</Text>
            <Text>📅</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Time</Text>
          <Pressable onPress={() => setMode('time')} style={[s.input, s.pick]}>
            <Text style={{ fontSize: 16, color: colors.text }}>{showTime(value)}</Text>
            <Text>🕒</Text>
          </Pressable>
        </View>
      </View>
      {mode ? (
        <View>
          <DateTimePicker
            value={value}
            mode={mode}
            is24Hour
            themeVariant={current.name}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handle}
          />
          {Platform.OS === 'ios' ? <Btn label="Done" variant="ghost" onPress={() => setMode(null)} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Numbered step indicator. Tapping a finished step jumps back to it. */
export function StepHeader({
  steps,
  current,
  onJump,
}: {
  steps: string[];
  current: number;
  onJump: (i: number) => void;
}) {
  return (
    <View style={s.steps}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Pressable key={label} disabled={i > current} onPress={() => onJump(i)} style={{ flex: 1, alignItems: 'center' }}>
            <View
              style={[
                s.dot,
                (done || active) && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <Text style={{ color: done || active ? '#fff' : colors.muted, fontWeight: '700' }}>{done ? '✓' : i + 1}</Text>
            </View>
            <Text
              style={{
                fontSize: 11,
                marginTop: 4,
                color: active ? colors.primary : colors.muted,
                fontWeight: active ? '700' : '400',
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Single date button that opens the native calendar. */
export function DateField({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  const handle = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (e.type === 'set' && d) onChange(d);
    if (e.type === 'dismissed') setOpen(false);
  };
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.label}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={[s.input, s.pick]}>
        <Text style={{ fontSize: 15, color: colors.text }}>
          {value.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
        <Text>📅</Text>
      </Pressable>
      {open ? (
        <View>
          <DateTimePicker
            value={value}
            mode="date"
            themeVariant={current.name}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handle}
          />
          {Platform.OS === 'ios' ? <Btn label="Done" variant="ghost" onPress={() => setOpen(false)} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  btn: {
    borderWidth: 1,
    borderRadius: radius,
    paddingVertical: 13,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  input: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.text,
  },
  clear: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  list: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  listRow: { padding: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  steps: {
    flexDirection: 'row',
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  pick: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  sumText: { fontSize: 15, color: colors.text },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  opt: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.sm,
  },
});

let s = makeStyles();
/** Rebuild the shared styles after the palette changes. */
export const refreshStyles = () => {
  s = makeStyles();
};
