/**
 * Back-aware header for the report flow aligned with approved Figma design.
 * Features:
 * - Back button with chevron and label.
 * - Right slot or optional help action label ("Kanal bantuan").
 * - Async back handler awaiting save flush.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, space, MIN_TOUCH } from './theme';
import { Title } from './components';

export function FlowHeader({
  title,
  onBack,
  right,
  backLabel = 'Kembali',
  helpActionLabel,
  onHelp,
}: {
  title: string;
  onBack: () => void | Promise<void>;
  right?: React.ReactNode;
  backLabel?: string;
  helpActionLabel?: string;
  onHelp?: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [leaving, setLeaving] = useState(false);

  const handleBack = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await onBack();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <View
      style={{
        paddingTop: insets.top + space.sm,
        paddingBottom: space.sm,
        paddingHorizontal: space.md,
        backgroundColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
      }}
    >
      <Pressable
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        accessibilityHint="Menyimpan perubahan sebelum kembali"
        style={{ minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
      >
        {leaving ? (
          <ActivityIndicator color={t.textPrimary} />
        ) : (
          <Ionicons name="chevron-back" size={26} color={t.textPrimary} />
        )}
      </Pressable>
      <Title style={{ flex: 1, fontSize: 22, fontWeight: '500', letterSpacing: 0.1 }}>{title}</Title>
      {right ? (
        <View style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}>{right}</View>
      ) : onHelp && helpActionLabel ? (
        <Pressable
          onPress={onHelp}
          style={{ minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: 8 }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#656575' }}>
            {helpActionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
