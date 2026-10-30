/**
 * Floating capsule tab bar aligned with approved Figma design.
 * Three destinations: Laporan, Bantuan (Kanal), Kesiapan (Kesiapan offline).
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

function FloatingCapsuleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: Math.max(insets.bottom, 12),
        left: 0,
        right: 0,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#11121A',
          height: 64,
          borderRadius: 34,
          padding: 7,
          width: '92%',
          maxWidth: 360,
          shadowColor: '#121F26',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          let iconName: keyof typeof Ionicons.glyphMap = 'document-text-outline';
          let tabTitle = 'Laporan';
          if (route.name === 'index') {
            tabTitle = 'Laporan';
            iconName = isFocused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'channels') {
            tabTitle = 'Bantuan';
            iconName = isFocused ? 'call' : 'call-outline';
          } else if (route.name === 'readiness') {
            tabTitle = 'Kesiapan';
            iconName = isFocused ? 'cloud-download' : 'cloud-download-outline';
          }

          const fullLabel = options.tabBarAccessibilityLabel ?? options.title ?? tabTitle;

          if (isFocused) {
            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={{ selected: true }}
                accessibilityLabel={fullLabel}
                onPress={onPress}
                onLongPress={onLongPress}
                style={{
                  backgroundColor: '#FFFFFF',
                  height: 50,
                  borderRadius: 27,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  shadowColor: '#121F26',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <Ionicons name={iconName} size={18} color="#11121A" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#11121A' }}>
                  {tabTitle}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: false }}
              accessibilityLabel={fullLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={{
                flex: 1,
                height: 48,
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Ionicons name={iconName} size={18} color="#FFFFFF" />
              <Text style={{ fontSize: 10, fontWeight: '500', color: '#FFFFFF' }}>
                {tabTitle}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingCapsuleTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Laporan',
          tabBarAccessibilityLabel: 'Laporan',
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          title: 'Kanal bantuan',
          tabBarAccessibilityLabel: 'Kanal bantuan',
        }}
      />
      <Tabs.Screen
        name="readiness"
        options={{
          title: 'Kesiapan offline',
          tabBarAccessibilityLabel: 'Kesiapan offline',
        }}
      />
    </Tabs>
  );
}
