/**
 * Regression: PressableScale must hand Animated(Pressable) a CONCRETE style,
 * never a function.
 *
 * Why this test exists: when a Pressable `({pressed}) => style` callback was
 * passed straight through Animated.createAnimatedComponent(Pressable), RN never
 * flattened it (AnimatedProps only flattens object styles), the Animated.Value
 * transform stayed unresolved, and on the native build the button lost its
 * backgroundColor and padding (work/reports/niragni-ui-home.png). The fix is to
 * evaluate the consumer callback ourselves via resolvePressableStyle and pass a
 * plain object/array onward. This test locks that behavior without rendering RN.
 */
import { resolvePressableStyle, isConcreteStyle, type StyleOrFn } from '../ui/resolvePressableStyle';

// Mirrors the Button style callback in components.tsx: structural chrome that
// must always be present, plus a pressed-only opacity change.
function buttonStyleCallback(bg: string): StyleOrFn {
  return ({ pressed }) => [
    {
      minHeight: 48,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: bg,
      opacity: pressed ? 0.9 : 1,
    },
    // a consumer-supplied extra style object (e.g. { flex: 1 })
    { flex: 1 },
  ];
}

describe('resolvePressableStyle (PressableScale styling regression)', () => {
  it('resolves a function style to a concrete, non-function value', () => {
    const resolved = resolvePressableStyle(buttonStyleCallback('#175A46'), false);
    expect(typeof resolved).not.toBe('function');
    expect(isConcreteStyle(resolved)).toBe(true);
    expect(Array.isArray(resolved)).toBe(true);
  });

  it('preserves the button chrome (background + padding) in both pressed states', () => {
    for (const pressed of [false, true]) {
      const resolved = resolvePressableStyle(buttonStyleCallback('#175A46'), pressed) as Array<Record<string, unknown>>;
      const base = resolved[0];
      expect(base.backgroundColor).toBe('#175A46');
      expect(base.paddingHorizontal).toBe(16);
      expect(base.paddingVertical).toBe(12);
      expect(base.borderRadius).toBe(12);
      expect(base.minHeight).toBe(48);
    }
  });

  it('only the opacity differs between pressed and released (no chrome loss on press)', () => {
    const released = (resolvePressableStyle(buttonStyleCallback('#175A46'), false) as Array<Record<string, unknown>>)[0];
    const pressed = (resolvePressableStyle(buttonStyleCallback('#175A46'), true) as Array<Record<string, unknown>>)[0];
    expect(released.opacity).toBe(1);
    expect(pressed.opacity).toBe(0.9);
    // Everything except opacity is identical.
    const { opacity: _o1, ...restReleased } = released;
    const { opacity: _o2, ...restPressed } = pressed;
    expect(restPressed).toEqual(restReleased);
  });

  it('passes a plain object style through unchanged', () => {
    const obj = { backgroundColor: '#fff', padding: 8 };
    expect(resolvePressableStyle(obj, false)).toBe(obj);
    expect(isConcreteStyle(obj)).toBe(true);
  });

  it('passes nullish/absent styles through as concrete values', () => {
    expect(isConcreteStyle(resolvePressableStyle(undefined, false))).toBe(true);
    expect(isConcreteStyle(resolvePressableStyle(null, true))).toBe(true);
  });

  it('isConcreteStyle flags a function as unsafe (the pre-fix bug shape)', () => {
    expect(isConcreteStyle(() => ({}))).toBe(false);
  });
});
