/**
 * Shared Bara UI primitives — aligned with approved Figma design (cyan, peach, capsule nav, smoke background).
 * Touch targets >= 48dp, accessible labels on actions, status always carries text.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  PressableStateCallbackType,
  TextInput,
  ActivityIndicator,
  Animated,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TextStyle,
  AccessibilityRole,
  Image,
} from 'react-native';
import { useTheme, useReducedMotion, space, radius, type, MIN_TOUCH, BaraTheme } from './theme';
import { Ionicons } from '@expo/vector-icons';
import { resolvePressableStyle } from './resolvePressableStyle';
import { formatIndonesianHeaderDate } from './format';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Press feedback: scale down on pointer-down, settle on release.
 */
function PressableScale({
  children,
  onPress,
  disabled,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: { disabled?: boolean; busy?: boolean };
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (reduced) {
      scale.stopAnimation();
      scale.setValue(1);
    }
  }, [reduced, scale]);

  const animateTo = (to: number) => {
    if (reduced) { scale.setValue(1); return; }
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const resolvedStyle = resolvePressableStyle(
    style as Parameters<typeof resolvePressableStyle>[0],
    pressed,
  ) as StyleProp<ViewStyle>;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { setPressed(true); animateTo(0.97); }}
      onPressOut={() => { setPressed(false); animateTo(1); }}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      style={[resolvedStyle, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Smoke background image as defined in Figma on all screens */
export function SmokeBackground() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 589,
        width: '100%',
      }}
    >
      <Image
        source={require('../../assets/smoke-bg.png')}
        style={{
          width: '100%',
          height: 589,
          opacity: 1,
        }}
        resizeMode="cover"
      />
    </View>
  );
}

export function Screen({
  children,
  noSmoke = false,
}: {
  children: React.ReactNode;
  noSmoke?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.canvas }}>
      {!noSmoke ? <SmokeBackground /> : null}
      {children}
    </View>
  );
}

/** Brand header with cropped Figma logo and subtitle */
export function BrandHeader({ subtitle }: { subtitle?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg }}>
      <View
        style={{
          width: 42,
          height: 41,
          borderRadius: 10,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          shadowColor: '#000000',
          shadowOffset: { width: 2, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 0,
          elevation: 3,
          position: 'relative',
        }}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={{
            position: 'absolute',
            width: '117.64%',
            height: '121.16%',
            left: '-8.82%',
            top: '-9.28%',
          }}
          resizeMode="cover"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '400', color: t.textPrimary, letterSpacing: 0.2 }}>Niragni</Text>
        <Text style={{ fontSize: 12, fontWeight: '400', color: t.textSecondary }}>{subtitle ?? formatIndonesianHeaderDate()}</Text>
      </View>
    </View>
  );
}

/**
 * Card surface with Figma palette support (cyan, peach, white) and subtle drop shadow.
 */
export function FigmaCard({
  children,
  variant = 'white',
  style,
}: {
  children: React.ReactNode;
  variant?: 'cyan' | 'peach' | 'white';
  style?: ViewStyle;
}) {
  const t = useTheme();
  const bg =
    variant === 'cyan' ? t.cyan
    : variant === 'peach' ? t.peach
    : t.surface;
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.card,
          padding: space.lg,
          borderWidth: variant === 'white' ? StyleSheet.hairlineWidth : 0,
          borderColor: t.border,
        },
        t.cardShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Rounded icon badge for card headers (transparent by default per user spec) */
export function BadgeIcon({
  name,
  size = 18,
  color,
  bgColor = 'transparent',
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  bgColor?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 11,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={size} color={color ?? t.textPrimary} />
    </View>
  );
}

/** Inline notice banner for lightweight context without multiple frames */
export function InlineNotice({
  icon = 'information-circle-outline',
  text,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.dark ? 'rgba(30,31,36,0.92)' : 'rgba(255,255,255,0.94)',
          borderRadius: 12,
          padding: space.md,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space.md,
          marginBottom: space.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
        },
        t.cardShadow,
      ]}
    >
      <Ionicons name={icon} size={20} color={t.textPrimary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, lineHeight: 18, color: t.textPrimary }}>{text}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: t.textSecondary }}>{actionLabel} →</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
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

export function Section({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[type.section, { color: t.textPrimary }, style]}>
      {children}
    </Text>
  );
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
          borderRadius: radius.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
          padding: space.lg,
        },
        t.cardShadow,
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
    : t.textPrimary;
  return (
    <PressableScale
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        {
          minHeight: MIN_TOUCH,
          borderRadius: 25,
          paddingHorizontal: space.xl,
          paddingVertical: space.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space.sm,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' || variant === 'quiet' ? StyleSheet.hairlineWidth : 0,
          borderColor: t.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
        },
        t.cardShadow,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 15, fontWeight: '700' }}>{title}</Text>
    </PressableScale>
  );
}

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
        style={[
          {
            backgroundColor: t.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.border,
            borderRadius: radius.input,
            color: t.textPrimary,
            fontSize: 15,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            minHeight: multiline ? 96 : MIN_TOUCH,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          t.cardShadow,
        ]}
      />
      {maxLength ? (
        <Caption style={{ marginTop: space.xs, textAlign: 'right' }}>
          {value.length}/{maxLength} karakter
        </Caption>
      ) : null}
      {helpText ? <Caption style={{ marginTop: space.xs }}>{helpText}</Caption> : null}
    </View>
  );
}

type PillKind = 'neutral' | 'positive' | 'busy' | 'warn' | 'error';

export function StatusPill({ label, kind = 'neutral' }: { label: string; kind?: PillKind }) {
  const t = useTheme();
  const map: Record<PillKind, { bg: string; fg: string }> = t.dark
    ? {
        neutral: { bg: t.surface, fg: t.textPrimary },
        positive: { bg: '#2D4A3E', fg: '#A3E5C8' },
        busy: { bg: '#1E3A5F', fg: '#93C5FD' },
        warn: { bg: '#543B1A', fg: '#FCD34D' },
        error: { bg: '#4A2020', fg: '#FFB4AB' },
      }
    : {
        neutral: { bg: '#FFFFFF', fg: '#11121A' },
        positive: { bg: '#D1FAE5', fg: '#065F46' },
        busy: { bg: '#DBEAFE', fg: '#1E40AF' },
        warn: { bg: '#FEF3C7', fg: '#92400E' },
        error: { bg: '#FEE2E2', fg: '#991B1B' },
      };
  const { bg, fg } = map[kind];
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: bg,
          borderRadius: 20,
          paddingHorizontal: space.md,
          paddingVertical: space.xs,
        },
        t.cardShadow,
      ]}
    >
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warn' | 'error' }) {
  const t = useTheme();
  const accent = tone === 'error' ? t.destructive : tone === 'warn' ? '#B45309' : t.textSecondary;
  return (
    <View
      accessibilityRole="text"
      style={{
        flexDirection: 'row',
        gap: space.sm,
        borderRadius: radius.input,
        paddingVertical: space.xs,
        marginBottom: space.sm,
      }}
    >
      <View style={{ width: 3, borderRadius: 2, backgroundColor: accent }} />
      <Text style={{ flex: 1, color: tone === 'info' ? t.textSecondary : t.textPrimary, fontSize: 13, lineHeight: 18 }}>
        {text}
      </Text>
    </View>
  );
}

export function SafetyFooter({
  text = 'Laporan belum dikirim dari aplikasi ini.',
  style,
}: {
  text?: string;
  style?: TextStyle;
}) {
  const t = useTheme();
  return (
    <Text
      accessibilityRole="text"
      style={[
        { color: t.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: space.lg },
        style,
      ]}
    >
      {text}
    </Text>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginVertical: space.md }} />;
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}

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
    <PressableScale
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        {
          minHeight: MIN_TOUCH,
          backgroundColor: t.surface,
          borderRadius: radius.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
          padding: space.lg,
          marginBottom: space.md,
          opacity: pressed && onPress ? 0.95 : 1,
        },
        t.cardShadow,
      ]}
    >
      {children}
    </PressableScale>
  );
}

export function DetailRow({
  label,
  value,
  placeholder,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const t = useTheme();
  const filled = !!value && value.trim().length > 0;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}: ${filled ? value : (placeholder ?? 'belum diisi')}`}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={[type.label, { color: t.textSecondary }]}>{label}</Text>
        <Text
          style={[type.body, { color: filled ? t.textPrimary : t.textSecondary, marginTop: 2 }]}
          numberOfLines={2}
        >
          {filled ? value : (placeholder ?? 'Belum diisi')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={t.textSecondary} />
    </PressableScale>
  );
}

export { useTheme, useReducedMotion, space, radius, type };
export type { BaraTheme };
