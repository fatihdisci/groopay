import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { Colors, Typography } from '@/constants/theme';
import TabBarButton from '@/components/TabBarButton';

type Ionicon = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { outline: Ionicon; filled: Ionicon }> = {
  groups: { outline: 'people-outline', filled: 'people' },
  dashboard: { outline: 'stats-chart-outline', filled: 'stats-chart' },
  activity: { outline: 'time-outline', filled: 'time' },
  account: { outline: 'person-outline', filled: 'person' },
};

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          shadowColor: '#4F46E5',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontFamily: Typography.fontBody,
          fontSize: 11,
        },
        tabBarButton: (props: any) => <TabBarButton {...props} />,
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerTitleStyle: {
          fontFamily: Typography.fontDisplayMedium,
          color: Colors.textPrimary,
          fontSize: Typography.size.lg,
        },
      }}
    >
      <Tabs.Screen
        name="groups"
        options={{
          title: t('tabs.groups'),
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? ICONS.groups!.filled : ICONS.groups!.outline} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? ICONS.dashboard!.filled : ICONS.dashboard!.outline} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: t('tabs.activity'),
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? ICONS.activity!.filled : ICONS.activity!.outline} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabs.account'),
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? ICONS.account!.filled : ICONS.account!.outline} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
