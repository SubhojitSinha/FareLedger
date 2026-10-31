import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { migrate } from '../src/db/schema';
import { ThemeProvider, useTheme } from '../src/ThemeContext';
import { LockProvider } from '../src/LockContext';
import { colors } from '../src/theme';

const Loading = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color={colors.primary} />
  </View>
);

function ThemedStack() {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="entry/new" options={{ title: 'New entry' }} />
        <Stack.Screen name="entry/[id]" options={{ title: 'Edit entry' }} />
        <Stack.Screen name="entry/preview/[id]" options={{ title: 'Settlement preview' }} />
        <Stack.Screen name="manage" options={{ title: 'Buses, drivers & conductors' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <Suspense fallback={<Loading />}>
      <SQLiteProvider databaseName="tktcalc.db" onInit={migrate} useSuspense>
        <ThemeProvider>
          <LockProvider>
            <ThemedStack />
          </LockProvider>
        </ThemeProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
