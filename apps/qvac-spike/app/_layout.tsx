/**
 * Root navigation: a native Stack wrapping the bottom tabs and the report
 * detail/flow screens. SafeAreaProvider + themed status bar. We add no custom
 * animations — only platform-default transitions — so there is no custom motion
 * to gate on Reduce Motion. (If custom transitions are ever added, read
 * AccessibilityInfo.isReduceMotionEnabled rather than assuming defaults suffice.)
 */
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { services } from '../src/ui/services';
import { PreviewBanner } from '../src/ui/PreviewBanner';

export default function RootLayout() {
  const scheme = useColorScheme();

  useEffect(() => {
    // Initialize the local-first services (DB/media). Idempotent per contract.
    void services.init().catch(() => { /* surfaced by screens that read data */ });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* Web-only DEMO banner; renders null on native (production UI). */}
      <PreviewBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="report" />
      </Stack>
    </SafeAreaProvider>
  );
}
