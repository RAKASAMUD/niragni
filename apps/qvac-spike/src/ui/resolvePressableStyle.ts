/**
 * Pure style-resolution for PressableScale (RN-free so it is unit-testable).
 *
 * Background: `Animated.createAnimatedComponent(Pressable)` cannot process the
 * Pressable `({pressed}) => style` callback form — a function style is never
 * flattened, so an embedded `Animated.Value` transform is left unresolved and
 * the native style becomes invalid (the button lost its background/padding on
 * the Xiaomi build). PressableScale therefore evaluates the consumer's style to
 * a CONCRETE value itself, using its own pressed state, and only ever hands the
 * animated component a plain style value (object/array), never a function.
 *
 * This module isolates that evaluation so a regression test can assert the
 * invariant without rendering React Native.
 */

/** A minimal style value: object, array of values, or null/undefined/false. */
export type StyleValue =
  | Record<string, unknown>
  | null
  | undefined
  | false
  | ReadonlyArray<StyleValue>;

export type StyleOrFn =
  | StyleValue
  | ((state: { pressed: boolean }) => StyleValue);

/**
 * Resolve a (possibly function) style to a concrete style value for the given
 * pressed state. The result is GUARANTEED not to be a function, so it is safe
 * to pass to Animated(Pressable).
 */
export function resolvePressableStyle(style: StyleOrFn, pressed: boolean): StyleValue {
  return typeof style === 'function' ? style({ pressed }) : style;
}

/** True iff the value is safe to hand to Animated(Pressable) (never a function). */
export function isConcreteStyle(value: unknown): boolean {
  return typeof value !== 'function';
}
