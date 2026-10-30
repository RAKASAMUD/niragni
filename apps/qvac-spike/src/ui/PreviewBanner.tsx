/**
 * Native (mobile) build: NO preview banner. This is the production UI, so the
 * banner must never appear on device. Metro resolves this `.tsx` on native and
 * `PreviewBanner.web.tsx` on web, so the banner is a web-only artifact.
 */
import React from 'react';

export function PreviewBanner(): React.ReactElement | null {
  return null;
}
