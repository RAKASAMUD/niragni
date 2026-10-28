/**
 * Bara entry.
 *
 * The app uses Expo Router; routing lives in `app/**`. With expo-router the
 * real entry is `expo-router/entry` wired via package.json "main" (coordinator
 * owns package/config/index). This file re-exports the router root so any
 * tooling or import that still points at src/App.tsx resolves to the router
 * tree rather than a second, competing React root.
 */
export { default } from 'expo-router';
