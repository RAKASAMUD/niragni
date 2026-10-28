/**
 * Shared Bara UI primitives — quiet, native, accessible.
 * Touch targets >= 48dp, accessible labels on actions, status always carries
 * text (not color/haptic alone). No decorative fire, no fake success ticks.
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  AccessibilityRole,
} from 'react-native';
import { useTheme, space, radius, type, MIN_TOUCH, BaraTheme } from './theme';

export function Screen({ children, scroll }: { children: React.ReactNode; scroll?: boolean }) {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.canvas }}>{children}</View>;
}

export function Heading({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[type.heading, { color: t.textPrimary }, style]}>
      {children}
    </Text>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[type.title, { color: t.textPrimary }, style]}>{children}</Text>;
}

export function Body({ children, style, secondary }: { children: React.ReactNode; style?: TextStyle; secondary?: boolean }) {
  const t = useTheme();
  return <Text style={[type.body, { color: secondary ? t.textSecondary : t.textPrimary }, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[type.label, { color: t.textSecondary }, style]}>{children}</Text>;
}

export function Caption({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[type.caption, { color: t.textSecondary }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: radius.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
          padding: space.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'quiet';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const isDisabled = disabled || loading;
  const bg =
    variant === 'primary' ? t.actionBg
    : variant === 'destructive' ? t.destructive
    : variant === 'secondary' ? t.surface
    : 'transparent';
  const fg =
    variant === 'primary' ? t.actionText
    : variant === 'destructive' ? t.destructiveText
    : variant === 'secondary' ? t.textPrimary
    : t.actionBg;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        {
          minHeight: MIN_TOUCH,
          borderRadius: radius.input,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space.sm,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' || variant === 'quiet' ? StyleSheet.hairlineWidth : 0,
          borderColor: t.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

/** A labelled single/multiline text field that scales with system type. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
  keyboardType,
  accessibilityLabel,
  autoCapitalize,
  helpText,
  autoFocus,
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  accessibilityLabel?: string;
  autoCapitalize?: 'none' | 'sentences';
  helpText?: string;
  autoFocus?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: space.md }}>
      {label ? <Label style={{ marginBottom: space.xs }}>{label}</Label> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textSecondary}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        accessibilityLabel={accessibilityLabel ?? label}
        autoFocus={autoFocus}
        style={{
          backgroundColor: t.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
          borderRadius: radius.input,
          color: t.textPrimary,
          fontSize: 17,
          paddingHorizontal: space.md,
          paddingVertical: space.md,
          minHeight: multiline ? 96 : MIN_TOUCH,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {maxLength ? (
        <Caption style={{ marginTop: space.xs, textAlign: 'right' }}>
          {value.length}/{maxLength}
        </Caption>
      ) : null}
      {helpText ? <Caption style={{ marginTop: space.xs }}>{helpText}</Caption> : null}
    </View>
  );
}

type PillKind = 'neutral' | 'positive' | 'busy' | 'warn' | 'error';

/** Status pill: color plus a text label always (never color alone). */
export function StatusPill({ label, kind = 'neutral' }: { label: string; kind?: PillKind }) {
  const t = useTheme();
  const map: Record<PillKind, string> = {
    neutral: t.textSecondary,
    positive: t.actionBg,
    busy: '#2563EB',
    warn: '#B45309',
    error: t.destructive,
  };
  const bg = map[kind];
  const fg = kind === 'positive' && t.dark ? t.actionText : '#FFFFFF';
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
      }}
    >
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/** Inline notice banner used for microcopy (offline, GPS denied, etc). */
export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warn' | 'error' }) {
  const t = useTheme();
  const border = tone === 'error' ? t.destructive : tone === 'warn' ? '#B45309' : t.border;
  return (
    <View
      accessibilityRole="text"
      style={{
        backgroundColor: t.surface,
        borderLeftWidth: 3,
        borderLeftColor: border,
        borderRadius: radius.input,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        marginBottom: space.md,
      }}
    >
      <Text style={{ color: t.textPrimary, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginVertical: space.md }} />;
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}

/** A minimum-48dp pressable list row with an accessible label. */
export function ListRow({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  role = 'button',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  role?: AccessibilityRole;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        backgroundColor: t.surface,
        borderRadius: radius.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: t.border,
        padding: space.lg,
        marginBottom: space.md,
        opacity: pressed && onPress ? 0.85 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

export { useTheme, space, radius, type };
export type { BaraTheme };
