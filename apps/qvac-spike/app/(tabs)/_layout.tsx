/**
 * Three primary destinations per the UI spec: Laporan (home), Kanal bantuan,
 * Kesiapan offline. Specific, content-named tabs (not a vague "Home").
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.actionBg,
        tabBarInactiveTintColor: t.textSecondary,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Laporan',
          tabBarAccessibilityLabel: 'Laporan',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          title: 'Kanal bantuan',
          tabBarAccessibilityLabel: 'Kanal bantuan',
          tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="readiness"
        options={{
          title: 'Kesiapan offline',
          tabBarAccessibilityLabel: 'Kesiapan offline',
          tabBarIcon: ({ color, size }) => <Ionicons name="cloud-download-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
