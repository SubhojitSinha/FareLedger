import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HeaderBrand, HeaderDate } from '../../src/components/HomeHeader';
import { useTheme } from '../../src/ThemeContext';
import { colors } from '../../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const tab = (title: string, icon: string) => ({
  title,
  tabBarIcon: ({ color, size }: { color: unknown; size: number }) => (
    <Ionicons name={icon as IconName} color={color as string} size={size} />
  ),
});

export default function TabsLayout() {
  useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          ...tab('Daily', 'bus-outline'),
          headerTitle: '',
          headerLeft: () => <HeaderBrand />,
          headerRight: () => <HeaderDate />,
        }}
      />
      <Tabs.Screen name="reports" options={tab('Reports', 'stats-chart-outline')} />
      <Tabs.Screen name="statements" options={tab('Statements', 'document-text-outline')} />
      <Tabs.Screen name="settings" options={tab('Settings', 'settings-outline')} />
    </Tabs>
  );
}
