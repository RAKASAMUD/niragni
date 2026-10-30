/**
 * WEB-ONLY persistent DEMO / UI-PREVIEW banner.
 *
 * Rendered at the root of the web app so EVERY screen — including a brand-new
 * blank report — shows an unmistakable, always-visible notice that this is a
 * fixture-data UI preview, not the real local-first app. It is never present on
 * the native build (see PreviewBanner.tsx, which renders null and is what Metro
 * resolves on iOS/Android).
 */
import React from 'react';
import { View, Text } from 'react-native';

export function PreviewBanner(): React.ReactElement {
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel="Pratinjau UI dengan data contoh. Draf disimpan di browser; AI, kamera, GPS, dan pengiriman tidak dijalankan."
      style={{
        backgroundColor: '#7c2d12',
        paddingVertical: 8,
        paddingHorizontal: 12,
        width: '100%',
        flexShrink: 0,
        borderBottomWidth: 2,
        borderBottomColor: '#fdba74',
      }}
    >
      <Text
        style={{
          color: '#fff7ed',
          fontWeight: '700',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        PRATINJAU UI · DATA CONTOH — Draf disimpan di browser. AI, kamera, GPS,
        dan pengiriman tidak dijalankan.
      </Text>
    </View>
  );
}
