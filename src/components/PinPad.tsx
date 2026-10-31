import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, space } from '../theme';

export const PIN_LENGTH = 4;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** Number keypad with PIN dots. Calls onComplete with the digits once the PIN is full, then clears. */
export default function PinPad({
  title,
  subtitle,
  error,
  disabled,
  onComplete,
}: {
  title: string;
  subtitle?: string;
  error?: string | null;
  disabled?: boolean;
  onComplete: (pin: string) => void;
}) {
  const [pin, setPin] = useState('');

  const press = (k: string) => {
    if (disabled || !k) return;
    if (k === '⌫') return setPin((p) => p.slice(0, -1));
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + k;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      // Let the last dot fill before the parent reacts.
      setTimeout(() => {
        setPin('');
        onComplete(next);
      }, 120);
    }
  };

  return (
    <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{title}</Text>
      {subtitle ? (
        <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4, textAlign: 'center' }}>{subtitle}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 16, marginTop: space.xl, marginBottom: space.sm }}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: error ? colors.danger : colors.primary,
              backgroundColor: i < pin.length ? (error ? colors.danger : colors.primary) : 'transparent',
            }}
          />
        ))}
      </View>
      <Text style={{ height: 20, fontSize: 13, color: colors.danger, marginBottom: space.md }}>{error ?? ''}</Text>

      <View style={{ width: 264, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {KEYS.map((k, i) => (
          <View key={i} style={{ width: 76, height: 76, marginBottom: space.md }}>
            {k ? (
              <Pressable
                onPress={() => press(k)}
                disabled={disabled}
                accessibilityLabel={k === '⌫' ? 'Delete' : k}
                style={({ pressed }) => ({
                  flex: 1,
                  borderRadius: 38,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: k === '⌫' ? 'transparent' : colors.card,
                  borderWidth: k === '⌫' ? 0 : 1,
                  borderColor: colors.border,
                  opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ fontSize: k === '⌫' ? 24 : 28, fontWeight: '500', color: colors.text }}>{k}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
