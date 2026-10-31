import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { colors } from '../theme';

/** Logo and app name for the left of the home header. */
export function HeaderBrand() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16 }}>
      <Image source={require('../../assets/icon.png')} style={{ width: 34, height: 34, borderRadius: 9 }} />
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>FareLedger</Text>
    </View>
  );
}

const label = (d: Date) =>
  d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Today's date as a highlighted pill, kept current if the app stays open past midnight. */
export function HeaderDate() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <View
      style={{
        marginRight: 16,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: colors.primary,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{label(now)}</Text>
    </View>
  );
}
