import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addPerson, listPeopleAll, updatePerson, type PersonKind, type PersonRow } from '../src/db/repo';
import { Btn, Card, Field } from '../src/components/ui';
import { useKeyboardHeight } from '../src/hooks/useKeyboardHeight';
import { useTheme } from '../src/ThemeContext';
import { colors, space } from '../src/theme';

const KINDS: { kind: PersonKind; label: string; single: string }[] = [
  { kind: 'buses', label: 'Buses', single: 'bus' },
  { kind: 'drivers', label: 'Drivers', single: 'driver' },
  { kind: 'conductors', label: 'Conductors', single: 'conductor' },
];

type Draft = { id?: number; name: string; owner: string; active: boolean };

export default function Manage() {
  const db = useSQLiteContext();
  const kb = useKeyboardHeight();
  const { scheme } = useTheme();

  const [kind, setKind] = useState<PersonKind>('buses');
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);

  const meta = KINDS.find((k) => k.kind === kind)!;

  const load = useCallback(() => listPeopleAll(db, kind).then(setRows), [db, kind]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const shown = useMemo(
    () =>
      rows.filter((r) =>
        `${r.name} ${r.owner ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [rows, query]
  );

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return Alert.alert(`Enter the ${meta.single} ${kind === 'buses' ? 'number' : 'name'}.`);
    try {
      if (draft.id) await updatePerson(db, kind, draft.id, name, draft.active, draft.owner);
      else await addPerson(db, kind, name, draft.owner);
      setDraft(null);
      load();
    } catch (e) {
      const msg = String(e);
      Alert.alert(
        msg.includes('UNIQUE') ? 'Already exists' : 'Could not save',
        msg.includes('UNIQUE') ? `Another ${meta.single} already has that name.` : msg
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', gap: space.sm, padding: space.lg, paddingBottom: space.sm }}>
        {KINDS.map((k) => (
          <Pressable
            key={k.kind}
            onPress={() => {
              setKind(k.kind);
              setQuery('');
            }}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: kind === k.kind ? colors.primary : colors.border,
              backgroundColor: kind === k.kind ? colors.primary : colors.card,
            }}
          >
            <Text style={{ fontWeight: '700', color: kind === k.kind ? '#fff' : colors.text }}>{k.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, alignItems: 'center' }}>
        <Field placeholder={`Search ${meta.label.toLowerCase()}`} value={query} onChangeText={setQuery} style={{ flex: 1 }} />
        <Btn label="+ Add" onPress={() => setDraft({ name: '', owner: '', active: true })} />
      </View>

      <FlatList
        data={shown}
        extraData={scheme}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}
        ListEmptyComponent={
          <Text style={{ color: colors.muted }}>
            {rows.length ? 'No match.' : `No ${meta.label.toLowerCase()} yet. Tap + Add.`}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              setDraft({ id: item.id, name: item.name, owner: item.owner ?? '', active: !!item.active })
            }
          >
            <Card style={{ opacity: item.active ? 1 : 0.6, marginBottom: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                    {kind === 'buses' ? `Bus ${item.name}` : item.name}
                  </Text>
                  {kind === 'buses' ? (
                    <Text style={{ color: colors.muted, marginTop: 2 }}>
                      Owner: {item.owner || 'not set'}
                    </Text>
                  ) : null}
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    {item.entries} entr{item.entries === 1 ? 'y' : 'ies'}
                    {item.active ? '' : ' · Hidden from pickers'}
                  </Text>
                </View>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Edit</Text>
              </View>
            </Card>
          </Pressable>
        )}
      />

      <Modal visible={draft !== null} animationType="slide" transparent onRequestClose={() => setDraft(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', paddingBottom: kb }}>
          <SafeAreaView
            edges={kb > 0 ? [] : ['bottom']}
            style={{
              backgroundColor: colors.bg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: space.lg,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: space.md }}>
              {draft?.id ? `Edit ${meta.single}` : `Add ${meta.single}`}
            </Text>
            <Field
              label={kind === 'buses' ? 'Bus number' : 'Name'}
              value={draft?.name ?? ''}
              onChangeText={(v) => setDraft((d) => d && { ...d, name: v })}
              autoCapitalize={kind === 'buses' ? 'characters' : 'words'}
              style={{ marginBottom: space.md }}
            />
            {kind === 'buses' ? (
              <Field
                label="Owner"
                placeholder="Owner name"
                value={draft?.owner ?? ''}
                onChangeText={(v) => setDraft((d) => d && { ...d, owner: v })}
                autoCapitalize="words"
                style={{ marginBottom: space.md }}
              />
            ) : null}
            {draft?.id ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, color: colors.text }}>Active</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    Turn off to hide from pickers. Past entries are kept.
                  </Text>
                </View>
                <Switch
                  value={draft.active}
                  onValueChange={(v) => setDraft((d) => d && { ...d, active: v })}
                  trackColor={{ true: colors.primary }}
                />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Btn label="Cancel" variant="ghost" onPress={() => setDraft(null)} style={{ flex: 1 }} />
              <Btn label="Save" onPress={save} style={{ flex: 2 }} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
