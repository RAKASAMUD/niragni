/**
 * Native stack for the report flow. Headers hidden; each screen renders its own
 * back-aware header so the Back control can save or explain a failed save (no
 * silent loss). Only platform-default transitions are used (no custom motion to
 * gate on Reduce Motion).
 */
import React from 'react';
import { Stack } from 'expo-router';

export default function ReportStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/edit" />
      <Stack.Screen name="[id]/photos" />
      <Stack.Screen name="[id]/location" />
      <Stack.Screen name="[id]/generate" />
      <Stack.Screen name="[id]/review" />
      <Stack.Screen name="[id]/share" />
    </Stack>
  );
}
