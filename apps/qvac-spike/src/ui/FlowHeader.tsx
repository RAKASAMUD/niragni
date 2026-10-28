/**
 * Back-aware header for the report flow. The Back control runs an async
 * handler (typically flush()) so edits are saved before leaving, or an error
 * is shown — never a silent loss. A right-side slot can carry a save-state
 * label or action. Touch targets >= 48dp; accessible labels provided.
 */
import React, { useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, space, MIN_TOUCH } from './theme';
import { Title } from './components';

export function FlowHeader({
  title,
  onBack,
  right,
  backLabel = 'Kembali',
}: {
  title: string;
  onBack: () => void | Promise<void>;
  right?: React.ReactNode;
  backLabel?: string;
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
        backgroundColor: t.canvas,
        borderBottomWidth: 0,
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
        {leaving ? <ActivityIndicator color={t.textPrimary} /> : <Ionicons name="chevron-back" size={26} color={t.textPrimary} />}
      </Pressable>
      <Title style={{ flex: 1 }} >{title}</Title>
      {right ? <View style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}>{right}</View> : null}
    </View>
  );
}
